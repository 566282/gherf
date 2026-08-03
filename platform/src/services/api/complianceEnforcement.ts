import { supabase } from '@/services/supabase/client';
import { sendUserNotification } from '@/services/api/communications';
import { dispatchComplianceLifecycleEvent } from '@/services/api/complianceNotifications';

function toRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export async function computeAndPersistComplianceRiskScore(userId: string): Promise<{ score: number; level: 'low' | 'medium' | 'high' | 'critical' }> {
  const [verificationRes, violationsRes, identityRes] = await Promise.all([
    supabase
      .from('task_verification_events')
      .select('risk_score,verification_state')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('compliance_violations')
      .select('severity,status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('identity_consistency_checks')
      .select('score,status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (verificationRes.error) throw verificationRes.error;
  if (violationsRes.error) throw violationsRes.error;
  if (identityRes.error) throw identityRes.error;

  const verificationEvents = Array.isArray(verificationRes.data) ? verificationRes.data : [];
  const violations = Array.isArray(violationsRes.data) ? violationsRes.data : [];
  const identityChecks = Array.isArray(identityRes.data) ? identityRes.data : [];

  const averageEventRisk = verificationEvents.length
    ? verificationEvents.reduce((sum, row) => sum + Number((row as Record<string, unknown>).risk_score ?? 0), 0) / verificationEvents.length
    : 20;

  const rejectedCount = verificationEvents.filter((row) => String((row as Record<string, unknown>).verification_state) === 'rejected').length;
  const reviewRequiredCount = verificationEvents.filter((row) => String((row as Record<string, unknown>).verification_state) === 'review_required').length;

  const violationWeight = violations.reduce((sum, row) => {
    const severity = String((row as Record<string, unknown>).severity ?? 'low');
    if (severity === 'critical') return sum + 25;
    if (severity === 'high') return sum + 15;
    if (severity === 'medium') return sum + 8;
    return sum + 3;
  }, 0);

  const latestIdentityScore = identityChecks.length ? Number((identityChecks[0] as Record<string, unknown>).score ?? 0) : 10;

  const rawScore =
    averageEventRisk * 0.45
    + Math.min(25, rejectedCount * 8)
    + Math.min(15, reviewRequiredCount * 4)
    + Math.min(25, violationWeight)
    + Math.min(15, latestIdentityScore * 0.2);

  const score = clampScore(rawScore);
  const level = toRiskLevel(score);

  const factors = {
    averageEventRisk,
    rejectedCount,
    reviewRequiredCount,
    violationWeight,
    latestIdentityScore,
  };

  const { error: insertError } = await supabase.from('compliance_risk_scores').insert({
    user_id: userId,
    score,
    level,
    factors,
    computed_by: 'task_compliance_runner',
  });

  if (insertError) throw insertError;

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: userId,
    p_event_type: 'risk_score_computed',
    p_entity_type: 'compliance_risk_scores',
    p_entity_id: userId,
    p_payload: {
      score,
      level,
      factors,
    },
  });

  return { score, level };
}

export async function runIdentityConsistencyCheck(userId: string, input: {
  profileName?: string | null;
  kycName?: string | null;
  socialHandleName?: string | null;
  historicalName?: string | null;
}): Promise<{ checkId: string; score: number; status: 'pending' | 'passed' | 'warning' | 'failed' }> {
  const normalized = {
    profileName: (input.profileName ?? '').trim().toLowerCase(),
    kycName: (input.kycName ?? '').trim().toLowerCase(),
    socialHandleName: (input.socialHandleName ?? '').trim().toLowerCase(),
    historicalName: (input.historicalName ?? '').trim().toLowerCase(),
  };

  let score = 0;
  const signals: Array<{ signalKey: string; severity: 'low' | 'medium' | 'high' | 'critical'; details: Record<string, unknown> }> = [];

  if (normalized.kycName && normalized.profileName && normalized.kycName !== normalized.profileName) {
    score += 40;
    signals.push({
      signalKey: 'kyc_profile_name_mismatch',
      severity: 'high',
      details: {
        profileName: input.profileName,
        kycName: input.kycName,
      },
    });
  }

  if (normalized.socialHandleName && normalized.profileName && !normalized.socialHandleName.includes(normalized.profileName.split(' ')[0] ?? '')) {
    score += 20;
    signals.push({
      signalKey: 'social_profile_name_inconsistency',
      severity: 'medium',
      details: {
        profileName: input.profileName,
        socialHandleName: input.socialHandleName,
      },
    });
  }

  if (normalized.historicalName && normalized.profileName && normalized.historicalName !== normalized.profileName) {
    score += 25;
    signals.push({
      signalKey: 'historical_name_change',
      severity: 'medium',
      details: {
        profileName: input.profileName,
        historicalName: input.historicalName,
      },
    });
  }

  score = clampScore(score);

  const status: 'pending' | 'passed' | 'warning' | 'failed' = score >= 70 ? 'failed' : score >= 35 ? 'warning' : 'passed';

  const { data: checkRow, error: checkError } = await supabase
    .from('identity_consistency_checks')
    .insert({
      user_id: userId,
      status,
      score,
      summary: {
        input,
        signalCount: signals.length,
      },
    })
    .select('id')
    .single<{ id: string }>();

  if (checkError || !checkRow) {
    throw checkError ?? new Error('Unable to create identity consistency check.');
  }

  if (signals.length) {
    const { error: signalError } = await supabase.from('identity_consistency_signals').insert(
      signals.map((signal) => ({
        check_id: checkRow.id,
        signal_key: signal.signalKey,
        severity: signal.severity,
        details: signal.details,
      })),
    );

    if (signalError) throw signalError;
  }

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: userId,
    p_event_type: 'identity_consistency_checked',
    p_entity_type: 'identity_consistency_checks',
    p_entity_id: checkRow.id,
    p_payload: {
      score,
      status,
      signals,
    },
  });

  await dispatchComplianceLifecycleEvent({
    userId: input.userId,
    event: 'enforcement_applied',
    title: 'Compliance enforcement applied',
    message: `Enforcement action ${actionType} was applied to your account due to compliance risk signals.`,
    metadata: {
      actionId: actionRow.id,
      actionType,
      riskScore: score,
    },
    notifyAdmins: true,
  });

  return {
    checkId: checkRow.id,
    score,
    status,
  };
}

export async function applyComplianceEnforcement(input: {
  userId: string;
  violationId?: string | null;
  riskScore: number;
  reason: string;
  actorUserId?: string | null;
}): Promise<{ actionId: string; actionType: 'warning' | 'hold' | 'suspend' | 'ban' }> {
  const score = clampScore(input.riskScore);

  const actionType: 'warning' | 'hold' | 'suspend' | 'ban' =
    score >= 95 ? 'ban' : score >= 80 ? 'suspend' : score >= 60 ? 'hold' : 'warning';

  const payload = {
    riskScore: score,
    reason: input.reason,
  };

  const { data: actionRow, error: actionError } = await supabase
    .from('compliance_enforcement_actions')
    .insert({
      violation_id: input.violationId ?? null,
      user_id: input.userId,
      action_type: actionType,
      status: 'applied',
      reason: input.reason,
      payload,
      applied_by: input.actorUserId ?? null,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: string }>();

  if (actionError || !actionRow) {
    throw actionError ?? new Error('Unable to create enforcement action.');
  }

  if (actionType === 'suspend' || actionType === 'ban') {
    const status = actionType === 'ban' ? 'banned' : 'suspended';

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status,
        suspension_reason: input.reason,
      })
      .eq('id', input.userId);

    if (profileError) throw profileError;

    const noticeTitle = actionType === 'ban' ? 'Account banned by compliance policy' : 'Account suspended by compliance policy';
    const noticeMessage = `${noticeTitle}. Reason: ${input.reason}`;

    const { error: noticeError } = await supabase.from('compliance_suspension_notices').insert({
      user_id: input.userId,
      enforcement_action_id: actionRow.id,
      notice_state: 'active',
      title: noticeTitle,
      message: noticeMessage,
      next_steps: [
        'Review violation details in your profile compliance section.',
        'If eligible, submit an appeal with supporting evidence.',
      ],
      appeal_eligible: true,
      metadata: {
        riskScore: score,
      },
    });

    if (noticeError) throw noticeError;

    await sendUserNotification(input.userId, {
      title: actionType === 'ban' ? 'Account banned' : 'Account suspended',
      message: noticeMessage,
      type: actionType === 'ban' ? 'critical' : 'warning',
      category: 'transactional',
      metadata: {
        enforcementActionId: actionRow.id,
        riskScore: score,
      },
    });
  }

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: input.userId,
    p_event_type: 'compliance_enforcement_applied',
    p_entity_type: 'compliance_enforcement_actions',
    p_entity_id: actionRow.id,
    p_payload: {
      actionType,
      riskScore: score,
      reason: input.reason,
    },
  });

  return {
    actionId: actionRow.id,
    actionType,
  };
}

export async function listSuspensionNotices(userId?: string, limit = 50): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from('compliance_suspension_notices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load suspension notices.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}
