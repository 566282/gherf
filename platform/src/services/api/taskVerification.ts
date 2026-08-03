import { supabase } from '@/services/supabase/client';
import { getActiveCompliancePolicy, type TaskCompliancePolicy, type VerificationMethod } from '@/services/api/compliancePolicy';
import { dispatchComplianceLifecycleEvent } from '@/services/api/complianceNotifications';

export interface VerificationExecutionInput {
  userId: string;
  taskId: string;
  submissionId?: string | null;
  campaignId?: string | null;
  preferredMethod?: VerificationMethod | null;
  context?: Record<string, unknown>;
}

export interface VerificationEvidenceInput {
  verificationEventId: string;
  userId: string;
  evidenceType: string;
  storageUrl?: string;
  evidencePayload?: Record<string, unknown>;
  hashSha256?: string;
}

export interface VerificationExecutionResult {
  verificationEventId: string;
  method: VerificationMethod;
  state: 'approved' | 'review_required' | 'rejected';
  confidenceScore: number;
  riskScore: number;
  reason: string;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferRiskFromContext(context: Record<string, unknown> | undefined): number {
  if (!context) return 20;

  const rapidRetries = toNumber(context.rapidRetries, 0);
  const suspiciousDevice = Boolean(context.suspiciousDevice ?? false);
  const duplicateSignals = toNumber(context.duplicateSignals, 0);
  const evidenceQuality = Math.max(0, Math.min(100, toNumber(context.evidenceQuality, 75)));

  let risk = 10;
  risk += rapidRetries * 8;
  risk += duplicateSignals * 12;
  if (suspiciousDevice) risk += 25;
  risk += Math.max(0, 70 - evidenceQuality) * 0.35;

  return Math.max(0, Math.min(100, risk));
}

function chooseMethod(policy: TaskCompliancePolicy, input: VerificationExecutionInput): VerificationMethod {
  const methods = policy.verificationStrategy.methods;
  if (input.preferredMethod && methods.includes(input.preferredMethod)) {
    return input.preferredMethod;
  }

  const fallback = policy.verificationStrategy.fallbackOrder.find((method) => methods.includes(method));
  return fallback ?? methods[0] ?? 'manual_review';
}

function evaluateExecution(method: VerificationMethod, riskScore: number, policy: TaskCompliancePolicy): VerificationExecutionResult['state'] {
  if (riskScore >= 90) {
    return 'rejected';
  }

  if (riskScore >= policy.verificationStrategy.manualReview.minRiskScore) {
    return 'review_required';
  }

  if (method === 'manual_review' || method === 'random_audit') {
    return 'review_required';
  }

  return 'approved';
}

export async function executeTaskVerification(input: VerificationExecutionInput): Promise<VerificationExecutionResult> {
  const activePolicy = await getActiveCompliancePolicy();
  const policy = activePolicy?.policy;

  if (!policy) {
    throw new Error('No active compliance policy is available for verification execution.');
  }

  const method = chooseMethod(policy, input);
  const riskScore = inferRiskFromContext(input.context);
  const state = evaluateExecution(method, riskScore, policy);
  const confidenceScore = Math.max(0, Math.min(100, 100 - riskScore));

  const { data: eventRow, error: eventError } = await supabase
    .from('task_verification_events')
    .insert({
      user_id: input.userId,
      campaign_id: input.campaignId ?? null,
      task_id: input.taskId,
      submission_id: input.submissionId ?? null,
      verification_method: method,
      verification_state: state,
      confidence_score: confidenceScore,
      risk_score: riskScore,
      requires_manual_review: state === 'review_required',
      raw_result: {
        method,
        context: input.context ?? {},
        policyVersion: activePolicy.version,
      },
      metadata: {
        policyVersion: activePolicy.version,
        policyKey: activePolicy.policyKey,
      },
    })
    .select('id')
    .single<{ id: string }>();

  if (eventError || !eventRow) {
    throw eventError ?? new Error('Unable to create verification event.');
  }

  const verificationEventId = eventRow.id;

  const { error: auditError } = await supabase.from('task_verification_audits').insert({
    verification_event_id: verificationEventId,
    action: 'verification_executed',
    actor_user_id: input.userId,
    new_values: {
      state,
      confidenceScore,
      riskScore,
      method,
    },
    metadata: {
      source: 'taskVerification.executeTaskVerification',
    },
  });

  if (auditError) throw auditError;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: input.userId,
    p_event_type: 'task_verification_executed',
    p_entity_type: 'task_verification_event',
    p_entity_id: verificationEventId,
    p_payload: {
      state,
      confidenceScore,
      riskScore,
      method,
    },
  });

  if (state === 'review_required') {
    await dispatchComplianceLifecycleEvent({
      userId: input.userId,
      event: 'verification_review_required',
      title: 'Verification queued for manual review',
      message: 'Your task verification needs manual review before final decision.',
      metadata: {
        verificationEventId,
        method,
        riskScore,
      },
      notifyAdmins: true,
    });
  }

  return {
    verificationEventId,
    method,
    state,
    confidenceScore,
    riskScore,
    reason:
      state === 'approved'
        ? 'Verification approved by policy.'
        : state === 'review_required'
          ? 'Verification requires manual review by policy.'
          : 'Verification rejected by high-risk policy.',
  };
}

export async function addTaskVerificationEvidence(input: VerificationEvidenceInput): Promise<void> {
  const { error } = await supabase.from('task_verification_evidence').insert({
    verification_event_id: input.verificationEventId,
    user_id: input.userId,
    evidence_type: input.evidenceType,
    storage_url: input.storageUrl ?? null,
    evidence_payload: input.evidencePayload ?? {},
    hash_sha256: input.hashSha256 ?? null,
    metadata: {
      source: 'taskVerification.addTaskVerificationEvidence',
    },
  });

  if (error) throw error;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: input.userId,
    p_event_type: 'task_verification_evidence_added',
    p_entity_type: 'task_verification_event',
    p_entity_id: input.verificationEventId,
    p_payload: {
      evidenceType: input.evidenceType,
      storageUrl: input.storageUrl ?? null,
    },
  });
}

export async function submitTaskVerificationReview(input: {
  verificationEventId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'needs_more_evidence';
  reason: string;
  notes?: string;
}): Promise<void> {
  const { data: eventRow, error: eventError } = await supabase
    .from('task_verification_events')
    .select('id,user_id')
    .eq('id', input.verificationEventId)
    .single();

  if (eventError || !eventRow) {
    throw eventError ?? new Error('Verification event not found.');
  }

  const { error: reviewError } = await supabase.from('task_verification_reviews').insert({
    verification_event_id: input.verificationEventId,
    reviewer_id: input.reviewerId,
    decision: input.decision,
    reason: input.reason,
    notes: input.notes ?? null,
  });

  if (reviewError) throw reviewError;

  const nextState = input.decision === 'approved' ? 'approved' : input.decision === 'rejected' ? 'rejected' : 'review_required';

  const { error: updateError } = await supabase
    .from('task_verification_events')
    .update({
      verification_state: nextState,
      requires_manual_review: nextState === 'review_required',
    })
    .eq('id', input.verificationEventId);

  if (updateError) throw updateError;

  const { error: auditError } = await supabase.from('task_verification_audits').insert({
    verification_event_id: input.verificationEventId,
    action: 'verification_review_submitted',
    actor_user_id: input.reviewerId,
    new_values: {
      decision: input.decision,
      reason: input.reason,
      notes: input.notes ?? null,
      nextState,
    },
    metadata: {
      source: 'taskVerification.submitTaskVerificationReview',
    },
  });

  if (auditError) throw auditError;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: String((eventRow as Record<string, unknown>).user_id),
    p_event_type: 'task_verification_review_submitted',
    p_entity_type: 'task_verification_event',
    p_entity_id: input.verificationEventId,
    p_payload: {
      decision: input.decision,
      reviewerId: input.reviewerId,
      reason: input.reason,
    },
  });
}

export async function listTaskVerificationEvents(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('task_verification_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load task verification events.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}
