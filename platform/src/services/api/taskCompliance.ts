import { supabase } from '@/services/supabase/client';
import {
  TASK_COMPLIANCE_POLICY_KEY,
  createDefaultTaskCompliancePolicy,
  getActiveCompliancePolicy,
  type TaskCompliancePolicy,
} from '@/services/api/compliancePolicy';
import {
  evaluateTaskComplianceRolloutDecision,
  getTaskComplianceRolloutConfig,
} from '@/services/api/complianceRollout';
import { dispatchComplianceLifecycleEvent } from '@/services/api/complianceNotifications';

export type WithdrawalComplianceState = 'draft' | 'pending_compliance' | 'held_compliance' | 'approved' | 'rejected' | 'bypassed';

export interface WithdrawalComplianceReview {
  id: string;
  withdrawalRequestId: string;
  userId: string;
  policyKey: string;
  policyVersion: string;
  state: WithdrawalComplianceState;
  riskScore: number;
  summary: Record<string, unknown>;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalComplianceReviewItem {
  id: string;
  reviewId: string;
  checkKey: string;
  status: 'pass' | 'fail' | 'warning' | 'manual_review';
  reason: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WithdrawalComplianceDecision {
  state: WithdrawalComplianceState;
  reason: string;
  riskScore: number;
  items: Array<{
    checkKey: string;
    status: 'pass' | 'fail' | 'warning' | 'manual_review';
    reason: string;
    payload?: Record<string, unknown>;
  }>;
  summary?: Record<string, unknown>;
}

export interface CompliancePrecheckInput {
  userId: string;
  withdrawalRequestId: string;
  amount: number;
  currency: string;
  membershipTier: number;
  successfulWithdrawalCount: number;
  accountAgeDays: number;
  hasOutstandingFee: boolean;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toReview(row: Record<string, unknown>): WithdrawalComplianceReview {
  return {
    id: String(row.id),
    withdrawalRequestId: String(row.withdrawal_request_id),
    userId: String(row.user_id),
    policyKey: String(row.policy_key),
    policyVersion: String(row.policy_version),
    state: String(row.state) as WithdrawalComplianceState,
    riskScore: toNumber(row.risk_score, 0),
    summary: (row.summary as Record<string, unknown>) ?? {},
    decidedBy: row.decided_by == null ? null : String(row.decided_by),
    decidedAt: row.decided_at == null ? null : String(row.decided_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toReviewItem(row: Record<string, unknown>): WithdrawalComplianceReviewItem {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    checkKey: String(row.check_key),
    status: String(row.status) as WithdrawalComplianceReviewItem['status'],
    reason: row.reason == null ? null : String(row.reason),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function inferRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function calculatePrecheckRiskScore(input: CompliancePrecheckInput): number {
  let score = 0;

  if (input.amount >= 1000) score += 20;
  if (input.amount >= 2500) score += 15;
  if (input.membershipTier <= 2) score += 20;
  if (input.successfulWithdrawalCount >= 4) score += 20;
  if (input.accountAgeDays < 30) score += 20;
  if (input.accountAgeDays < 7) score += 10;
  if (input.hasOutstandingFee) score += 25;

  return Math.max(0, Math.min(100, score));
}

function evaluatePrecheck(input: CompliancePrecheckInput, policy: TaskCompliancePolicy): WithdrawalComplianceDecision {
  const riskScore = calculatePrecheckRiskScore(input);
  const items: WithdrawalComplianceDecision['items'] = [];

  const outstandingFeeStatus = input.hasOutstandingFee ? 'fail' : 'pass';
  items.push({
    checkKey: 'membership_fee_compliance',
    status: outstandingFeeStatus,
    reason: input.hasOutstandingFee ? 'Outstanding membership fee detected.' : 'No outstanding membership fee.',
    payload: {
      hasOutstandingFee: input.hasOutstandingFee,
    },
  });

  const accountAgeStatus = input.accountAgeDays < policy.withdrawalGate.bypass.minAccountAgeDays ? 'warning' : 'pass';
  items.push({
    checkKey: 'account_age',
    status: accountAgeStatus,
    reason:
      accountAgeStatus === 'warning'
        ? `Account age ${input.accountAgeDays}d is below bypass minimum ${policy.withdrawalGate.bypass.minAccountAgeDays}d.`
        : `Account age ${input.accountAgeDays}d satisfies bypass minimum.`,
    payload: {
      accountAgeDays: input.accountAgeDays,
      minAccountAgeDays: policy.withdrawalGate.bypass.minAccountAgeDays,
    },
  });

  const riskDecision = riskScore >= policy.verificationStrategy.manualReview.minRiskScore ? 'manual_review' : 'pass';
  items.push({
    checkKey: 'risk_threshold',
    status: riskDecision,
    reason:
      riskDecision === 'manual_review'
        ? `Risk score ${riskScore} exceeds manual review threshold ${policy.verificationStrategy.manualReview.minRiskScore}.`
        : `Risk score ${riskScore} below manual review threshold.`,
    payload: {
      riskScore,
      manualReviewThreshold: policy.verificationStrategy.manualReview.minRiskScore,
    },
  });

  const fails = items.filter((item) => item.status === 'fail').length;
  const manualReviews = items.filter((item) => item.status === 'manual_review').length;

  if (fails > 0) {
    return {
      state: 'held_compliance',
      reason: 'Compliance hold: failed mandatory checks.',
      riskScore,
      items,
      summary: {
        riskLevel: inferRiskLevel(riskScore),
        failedChecks: fails,
        manualReviewChecks: manualReviews,
      },
    };
  }

  if (!policy.withdrawalGate.enabled) {
    return {
      state: 'bypassed',
      reason: 'Compliance gate bypassed by policy.',
      riskScore,
      items,
      summary: {
        riskLevel: inferRiskLevel(riskScore),
        mode: 'gate_disabled',
      },
    };
  }

  const canBypass =
    policy.withdrawalGate.bypass.enabled
    && riskScore <= policy.withdrawalGate.bypass.maxRiskScore
    && input.accountAgeDays >= policy.withdrawalGate.bypass.minAccountAgeDays;

  if (canBypass) {
    return {
      state: 'bypassed',
      reason: 'Bypassed by low-risk policy.',
      riskScore,
      items,
      summary: {
        riskLevel: inferRiskLevel(riskScore),
        mode: 'policy_bypass',
      },
    };
  }

  if (manualReviews > 0) {
    return {
      state: 'held_compliance',
      reason: 'Manual compliance review required.',
      riskScore,
      items,
      summary: {
        riskLevel: inferRiskLevel(riskScore),
        mode: 'manual_review',
      },
    };
  }

  return {
    state: 'approved',
    reason: 'Compliance checks passed.',
    riskScore,
    items,
    summary: {
      riskLevel: inferRiskLevel(riskScore),
      mode: 'auto_pass',
    },
  };
}

export async function listWithdrawalComplianceReviews(limit = 30): Promise<WithdrawalComplianceReview[]> {
  const { data, error } = await supabase
    .from('withdrawal_compliance_reviews')
    .select('id,withdrawal_request_id,user_id,policy_key,policy_version,state,risk_score,summary,decided_by,decided_at,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load withdrawal compliance reviews.');
  }

  return data.map((row) => toReview(row as Record<string, unknown>));
}

export async function listWithdrawalComplianceReviewItems(reviewId: string): Promise<WithdrawalComplianceReviewItem[]> {
  const { data, error } = await supabase
    .from('withdrawal_compliance_review_items')
    .select('id,review_id,check_key,status,reason,payload,created_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load compliance review items.');
  }

  return data.map((row) => toReviewItem(row as Record<string, unknown>));
}

export async function getWithdrawalComplianceReviewByWithdrawalId(withdrawalRequestId: string): Promise<WithdrawalComplianceReview | null> {
  const { data, error } = await supabase
    .from('withdrawal_compliance_reviews')
    .select('id,withdrawal_request_id,user_id,policy_key,policy_version,state,risk_score,summary,decided_by,decided_at,created_at,updated_at')
    .eq('withdrawal_request_id', withdrawalRequestId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toReview(data as Record<string, unknown>);
}

export async function createWithdrawalCompliancePrecheck(input: CompliancePrecheckInput): Promise<WithdrawalComplianceReview> {
  const activePolicy = await getActiveCompliancePolicy();
  const policy = activePolicy?.policy ?? createDefaultTaskCompliancePolicy();
  const policyVersion = activePolicy?.version ?? 'v1-baseline';

  const decision = evaluatePrecheck(input, policy);
  const rolloutConfig = await getTaskComplianceRolloutConfig();
  const rolloutDecision = evaluateTaskComplianceRolloutDecision({
    userId: input.userId,
    riskScore: decision.riskScore,
    desiredState: decision.state === 'rejected' ? 'held_compliance' : decision.state,
    config: rolloutConfig,
  });

  const { data: createdReview, error: reviewError } = await supabase
    .from('withdrawal_compliance_reviews')
    .insert({
      withdrawal_request_id: input.withdrawalRequestId,
      user_id: input.userId,
      policy_key: TASK_COMPLIANCE_POLICY_KEY,
      policy_version: policyVersion,
      state: 'pending_compliance',
      risk_score: decision.riskScore,
      summary: {
        ...decision.summary,
        startedAt: new Date().toISOString(),
      },
    })
    .select('id,withdrawal_request_id,user_id,policy_key,policy_version,state,risk_score,summary,decided_by,decided_at,created_at,updated_at')
    .single();

  if (reviewError || !createdReview) {
    throw reviewError ?? new Error('Unable to create withdrawal compliance review.');
  }

  const review = toReview(createdReview as Record<string, unknown>);

  const itemRows = decision.items.map((item) => ({
    review_id: review.id,
    check_key: item.checkKey,
    status: item.status,
    reason: item.reason,
    payload: item.payload ?? {},
  }));

  const { error: itemsError } = await supabase.from('withdrawal_compliance_review_items').insert(itemRows);
  if (itemsError) throw itemsError;

  const finalState = rolloutDecision.effectiveState;

  const { error: reviewUpdateError } = await supabase
    .from('withdrawal_compliance_reviews')
    .update({
      state: finalState,
      decided_at: new Date().toISOString(),
      summary: {
        ...review.summary,
        ...decision.summary,
        decisionReason: decision.reason,
        rolloutMode: rolloutDecision.mode,
        rolloutReason: rolloutDecision.reason,
        rolloutInPercent: rolloutDecision.inRollout,
        desiredState: decision.state,
      },
    })
    .eq('id', review.id);

  if (reviewUpdateError) throw reviewUpdateError;

  const { error: decisionError } = await supabase.from('withdrawal_compliance_decisions').insert({
    review_id: review.id,
    decision: finalState === 'held_compliance' ? 'held' : finalState === 'bypassed' ? 'bypassed' : finalState,
    reason: decision.reason,
    actor_user_id: null,
    metadata: {
      riskScore: decision.riskScore,
      policyVersion,
    },
  });
  if (decisionError) throw decisionError;

  const { error: withdrawalUpdateError } = await supabase
    .from('withdrawal_requests')
    .update({
      compliance_review_id: review.id,
      compliance_state: finalState,
      status: finalState === 'held_compliance' ? 'held' : finalState === 'approved' || finalState === 'bypassed' ? 'pending' : 'rejected',
    })
    .eq('id', input.withdrawalRequestId);

  if (withdrawalUpdateError) throw withdrawalUpdateError;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: input.userId,
    p_event_type: 'withdrawal_compliance_precheck',
    p_entity_type: 'withdrawal_request',
    p_entity_id: input.withdrawalRequestId,
    p_payload: {
      reviewId: review.id,
      policyVersion,
      state: finalState,
      desiredState: decision.state,
      riskScore: decision.riskScore,
      reason: decision.reason,
      rollout: {
        mode: rolloutDecision.mode,
        inRollout: rolloutDecision.inRollout,
        reason: rolloutDecision.reason,
      },
    },
  });

  const finalReview = await getWithdrawalComplianceReviewByWithdrawalId(input.withdrawalRequestId);
  if (!finalReview) {
    throw new Error('Unable to load created compliance review.');
  }

  await dispatchComplianceLifecycleEvent({
    userId: input.userId,
    event: finalState === 'held_compliance' ? 'withdrawal_compliance_held' : 'withdrawal_compliance_approved',
    title: finalState === 'held_compliance' ? 'Withdrawal held by compliance' : 'Withdrawal passed compliance',
    message:
      finalState === 'held_compliance'
        ? 'Your withdrawal is held pending compliance review.'
        : 'Your withdrawal passed compliance precheck.',
    metadata: {
      reviewId: review.id,
      withdrawalRequestId: input.withdrawalRequestId,
      state: finalState,
      desiredState: decision.state,
      riskScore: decision.riskScore,
      rolloutMode: rolloutDecision.mode,
      rolloutInPercent: rolloutDecision.inRollout,
      rolloutReason: rolloutDecision.reason,
    },
    notifyAdmins: finalState === 'held_compliance',
  });

  return finalReview;
}

export async function resolveWithdrawalComplianceReview(reviewId: string, nextState: 'approved' | 'held_compliance' | 'rejected', reason: string, reviewerId: string): Promise<void> {
  const decision = nextState === 'held_compliance' ? 'held' : nextState;

  const { data: review, error: reviewError } = await supabase
    .from('withdrawal_compliance_reviews')
    .select('id,withdrawal_request_id,user_id')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    throw reviewError ?? new Error('Compliance review not found.');
  }

  const { error: updateError } = await supabase
    .from('withdrawal_compliance_reviews')
    .update({
      state: nextState,
      decided_by: reviewerId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (updateError) throw updateError;

  const { error: decisionError } = await supabase.from('withdrawal_compliance_decisions').insert({
    review_id: reviewId,
    decision,
    reason,
    actor_user_id: reviewerId,
    metadata: {
      source: 'manual_resolution',
    },
  });

  if (decisionError) throw decisionError;

  const withdrawalStatus = nextState === 'approved' ? 'pending' : nextState === 'held_compliance' ? 'held' : 'rejected';

  const { error: withdrawalError } = await supabase
    .from('withdrawal_requests')
    .update({
      compliance_state: nextState,
      status: withdrawalStatus,
    })
    .eq('id', String((review as Record<string, unknown>).withdrawal_request_id));

  if (withdrawalError) throw withdrawalError;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: String((review as Record<string, unknown>).user_id),
    p_event_type: 'withdrawal_compliance_manual_resolution',
    p_entity_type: 'withdrawal_compliance_review',
    p_entity_id: reviewId,
    p_payload: {
      nextState,
      reason,
      reviewerId,
    },
  });
}

export async function listComplianceAuditLedger(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('compliance_audit_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load compliance audit ledger.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}
