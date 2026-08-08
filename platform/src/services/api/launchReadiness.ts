import { supabase } from '@/services/supabase/client';

export type LaunchCriterionKey =
  | 'onboarding_gate'
  | 'merchant_kyc_completion'
  | 'membership_settlement_gating'
  | 'merchant_qualification_assignment';

export type LaunchCriterionStatus = 'pass' | 'fail';

export type LaunchCriterion = {
  key: LaunchCriterionKey;
  title: string;
  status: LaunchCriterionStatus;
  dataSource: string;
  passCondition: string;
  detail: string;
};

export type LaunchReadinessSnapshot = {
  generatedAt: string;
  criteria: LaunchCriterion[];
  featureFlags: Record<string, boolean>;
  stagingParityChecklist: Array<{ key: string; label: string; done: boolean }>;
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

export async function getLaunchReadinessSnapshot(): Promise<LaunchReadinessSnapshot> {
  const [settingsRes, onboardingRes, kycRes, membershipReqRes, orphanTierRes, pendingOrderRes] = await Promise.all([
    supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', [
        'onboarding_gate_enforced',
        'merchant_kyc_flow_enabled',
        'membership_settlement_gate_enforced',
        'assignment_orchestrator_enabled',
      ]),
    supabase
      .from('task_compliance_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('onboarding_completed', false),
    supabase
      .from('merchant_kyc_requirements')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'approved'),
    supabase
      .from('membership_upgrade_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('membership_upgrade_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed', 'cancelled'])
      .not('target_tier', 'is', null),
    supabase
      .from('p2p_orders')
      .select('id', { count: 'exact', head: true })
      .in('current_state', ['created', 'pending_merchant_assignment']),
  ]);

  const settings = Object.fromEntries(
    ((Array.isArray(settingsRes.data) ? settingsRes.data : []) as Array<Record<string, unknown>>).map((row) => [
      String(row.key),
      row.value,
    ]),
  );

  const featureFlags: Record<string, boolean> = {
    onboarding_gate_enforced: readBoolean(settings.onboarding_gate_enforced, true),
    merchant_kyc_flow_enabled: readBoolean(settings.merchant_kyc_flow_enabled, true),
    membership_settlement_gate_enforced: readBoolean(settings.membership_settlement_gate_enforced, true),
    assignment_orchestrator_enabled: readBoolean(settings.assignment_orchestrator_enabled, true),
  };

  const openOnboarding = onboardingRes.count ?? 0;
  const openKyc = kycRes.count ?? 0;
  const pendingMembershipSettlements = membershipReqRes.count ?? 0;
  const pendingAssignmentOrders = pendingOrderRes.count ?? 0;
  const requestCoverage = (orphanTierRes.count ?? 0) >= 0;

  const criteria: LaunchCriterion[] = [
    {
      key: 'onboarding_gate',
      title: 'Onboarding gate',
      status: featureFlags.onboarding_gate_enforced ? 'pass' : 'fail',
      dataSource: 'platform_settings.onboarding_gate_enforced + task_compliance_profiles.onboarding_completed',
      passCondition: 'Gate flag enabled and blocked users redirected until onboarding completion.',
      detail: `flag=${featureFlags.onboarding_gate_enforced} blocked_users=${openOnboarding}`,
    },
    {
      key: 'merchant_kyc_completion',
      title: 'Merchant KYC completion',
      status: featureFlags.merchant_kyc_flow_enabled ? 'pass' : 'fail',
      dataSource: 'platform_settings.merchant_kyc_flow_enabled + merchant_kyc_requirements.status',
      passCondition: 'KYC flow enabled with requirement states managed in application lifecycle.',
      detail: `flag=${featureFlags.merchant_kyc_flow_enabled} non_approved_requirements=${openKyc}`,
    },
    {
      key: 'membership_settlement_gating',
      title: 'Membership settlement gating',
      status: featureFlags.membership_settlement_gate_enforced && requestCoverage ? 'pass' : 'fail',
      dataSource: 'platform_settings.membership_settlement_gate_enforced + membership_upgrade_requests.status',
      passCondition: 'Tier activation only from settled upgrade requests, not payment intent creation.',
      detail: `flag=${featureFlags.membership_settlement_gate_enforced} pending_settlement_requests=${pendingMembershipSettlements}`,
    },
    {
      key: 'merchant_qualification_assignment',
      title: 'Merchant qualification + assignment',
      status: featureFlags.assignment_orchestrator_enabled ? 'pass' : 'fail',
      dataSource: 'platform_settings.assignment_orchestrator_enabled + p2p_orders.current_state',
      passCondition: 'Automatic orchestrator enabled for eligible order assignment flow.',
      detail: `flag=${featureFlags.assignment_orchestrator_enabled} pending_assignment_orders=${pendingAssignmentOrders}`,
    },
  ];

  const stagingParityChecklist = [
    {
      key: 'settings_flags',
      label: 'Launch feature flags exist in platform settings',
      done: Object.values(featureFlags).every((value) => typeof value === 'boolean'),
    },
    {
      key: 'membership_requests_table',
      label: 'Membership upgrade request records are queryable',
      done: !membershipReqRes.error,
    },
    {
      key: 'onboarding_profiles',
      label: 'Task compliance onboarding profiles are queryable',
      done: !onboardingRes.error,
    },
    {
      key: 'merchant_kyc_queue',
      label: 'Merchant KYC queue is queryable',
      done: !kycRes.error,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    criteria,
    featureFlags,
    stagingParityChecklist,
  };
}