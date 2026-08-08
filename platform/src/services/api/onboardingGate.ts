import { supabase } from '@/services/supabase/client';

type TaskComplianceGateRow = {
  user_id: string;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  onboarding_block_reason: string | null;
  onboarding_progress: Record<string, unknown> | null;
};

type OnboardingGateAuditRow = {
  next_state: 'blocked' | 'unblocked';
};

export type OnboardingGateDecision = {
  enforced: boolean;
  blocked: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  reason: string | null;
  nextStepPath: string | null;
  allowedModuleKeys: string[];
};

const DEFAULT_ALLOWED_WHILE_BLOCKED = ['onboarding', 'profile'];

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function asModuleKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

async function loadGateSettings(): Promise<{ enforced: boolean; allowedWhileBlocked: string[] }> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', ['onboarding_gate_enforced', 'onboarding_gate_allowed_modules']);

  if (error || !Array.isArray(data)) {
    return {
      enforced: true,
      allowedWhileBlocked: DEFAULT_ALLOWED_WHILE_BLOCKED,
    };
  }

  const byKey = Object.fromEntries(data.map((row) => [String((row as Record<string, unknown>).key), (row as Record<string, unknown>).value]));
  const configuredAllowed = asModuleKeys(byKey.onboarding_gate_allowed_modules);

  return {
    enforced: asBoolean(byKey.onboarding_gate_enforced, true),
    allowedWhileBlocked: configuredAllowed.length ? configuredAllowed : DEFAULT_ALLOWED_WHILE_BLOCKED,
  };
}

async function recordGateTransition(userId: string, nextState: 'blocked' | 'unblocked', reason: string | null): Promise<void> {
  const { data: latest } = await supabase
    .from('onboarding_gate_audits')
    .select('next_state')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<OnboardingGateAuditRow>();

  if (latest?.next_state === nextState) {
    return;
  }

  await supabase.from('onboarding_gate_audits').insert({
    user_id: userId,
    previous_state: latest?.next_state ?? null,
    next_state: nextState,
    reason,
    actor_source: 'gate_resolver',
    metadata: {
      source: 'onboarding_gate_service',
    },
  });
}

export async function resolveOnboardingGate(userId: string): Promise<OnboardingGateDecision> {
  const [settings, profileResult] = await Promise.all([
    loadGateSettings(),
    supabase
      .from('task_compliance_profiles')
      .select('user_id,onboarding_completed,onboarding_completed_at,onboarding_block_reason,onboarding_progress')
      .eq('user_id', userId)
      .maybeSingle<TaskComplianceGateRow>(),
  ]);

  const profile = profileResult.data;
  const onboardingCompleted = Boolean(profile?.onboarding_completed);
  const reason = onboardingCompleted
    ? null
    : profile?.onboarding_block_reason?.trim() || 'Complete onboarding to unlock app modules.';

  const blocked = settings.enforced && !onboardingCompleted;

  try {
    await recordGateTransition(userId, blocked ? 'blocked' : 'unblocked', reason);
  } catch {
    // Audit writes should never block gate resolution.
  }

  return {
    enforced: settings.enforced,
    blocked,
    onboardingCompleted,
    onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    reason,
    nextStepPath: blocked ? '/app/onboarding' : null,
    allowedModuleKeys: blocked ? settings.allowedWhileBlocked : ['*'],
  };
}

export async function assertOnboardingModuleAccess(userId: string, moduleKey: string): Promise<void> {
  const decision = await resolveOnboardingGate(userId);
  if (!decision.blocked) return;

  const normalized = moduleKey.trim().toLowerCase();
  const allowed = decision.allowedModuleKeys.includes(normalized);
  if (allowed) return;

  throw new Error(decision.reason ?? 'Onboarding is required before accessing this module.');
}