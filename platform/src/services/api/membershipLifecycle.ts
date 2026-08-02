import { evaluateMembershipRuleSet, resolveMembershipPlan, type MembershipPlanDefinition } from '@/services/api/membership';
import { supabase } from '@/services/supabase/client';

export interface MembershipLifecycleConfig {
  autoUpgrade: {
    everyNWithdrawals: number;
    insufficientBalanceAction: 'block' | 'partial_deduction' | 'pending_upgrade' | 'admin_review';
  };
  downgrade: {
    graceDays: number;
    warningDays: number;
    recoveryDays: number;
  };
  carryForward: {
    deductionPercent: number;
    resetMultiplierOnUpgrade: boolean;
  };
  multiplier: {
    priceFormula: 'equal_to_membership_price' | 'fixed_percent_of_membership_price';
    fixedPercent: number;
    paymentMethods: Array<'gateway_only'>;
  };
  feeCompliance: {
    enforceFromWithdrawalCount: number;
    blockOnOutstandingFee: boolean;
  };
  rollout: {
    mode: 'shadow' | 'progressive' | 'enforced';
    percent: number;
  };
}

export interface UpgradeDecision {
  triggered: boolean;
  nextLevel: number;
  action: MembershipLifecycleConfig['autoUpgrade']['insufficientBalanceAction'];
  reason: string;
}

export interface DowngradeDecision {
  shouldDowngrade: boolean;
  reason: string;
  effectiveAfterDays: number;
}

export interface CarryForwardDecision {
  continueFromLevel: number;
  deductionPercent: number;
  resetMultiplier: boolean;
}

export interface MultiplierPricingDecision {
  amount: number;
  currency: string;
  requiresGatewayPayment: boolean;
  priceFormula: MembershipLifecycleConfig['multiplier']['priceFormula'];
}

export interface FeeComplianceDecision {
  compliant: boolean;
  reason: 'compliant' | 'fee_required' | 'blocked_by_policy';
}

export interface WorkflowTransitionResult {
  allowed: boolean;
  nextState: string;
  trace: string[];
}

export interface GatewayRoutingDecision {
  provider: string;
  reason: string;
}

export interface RolloutDecision {
  enforceNewPolicy: boolean;
  mode: MembershipLifecycleConfig['rollout']['mode'];
  percent: number;
}

export interface MembershipAnalyticsSnapshot {
  totalMembers: number;
  paidMembers: number;
  pendingUpgrades: number;
  activeMultipliers: number;
  feeDelinquentMembers: number;
  topPlan: Pick<MembershipPlanDefinition, 'level' | 'label' | 'slug'>;
}

type MembershipLifecycleSettingRow = {
  key: string;
  value: unknown;
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
}

function toInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : fallback;
}

function toRolloutMode(value: unknown, fallback: MembershipLifecycleConfig['rollout']['mode']): MembershipLifecycleConfig['rollout']['mode'] {
  if (value === 'shadow' || value === 'progressive' || value === 'enforced') {
    return value;
  }

  return fallback;
}

function toRolloutPercent(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function buildMembershipLifecycleSettingsFromStore(
  rows: MembershipLifecycleSettingRow[] = [],
  rolloutFlag?: { mode?: unknown; rolloutPercent?: unknown },
): MembershipLifecycleConfig {
  const baseConfig = getDefaultMembershipLifecycleConfig();
  const lookup = new Map(rows.map((row) => [row.key, row.value]));

  return {
    ...baseConfig,
    feeCompliance: {
      ...baseConfig.feeCompliance,
      enforceFromWithdrawalCount: toInteger(
        lookup.get('membership_fee_enforce_from_withdrawal_count'),
        baseConfig.feeCompliance.enforceFromWithdrawalCount,
      ),
      blockOnOutstandingFee: toBoolean(
        lookup.get('membership_fee_block_without_settlement'),
        baseConfig.feeCompliance.blockOnOutstandingFee,
      ),
    },
    rollout: {
      ...baseConfig.rollout,
      mode: toRolloutMode(rolloutFlag?.mode, baseConfig.rollout.mode),
      percent: toRolloutPercent(rolloutFlag?.rolloutPercent, baseConfig.rollout.percent),
    },
  };
}

export async function listMembershipLifecycleSettings(): Promise<MembershipLifecycleConfig> {
  const [settingsResponse, rolloutResponse] = await Promise.all([
    supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', ['membership_fee_enforce_from_withdrawal_count', 'membership_fee_block_without_settlement']),
    supabase
      .from('membership_rollout_flags')
      .select('mode,rollout_percent')
      .eq('flag_key', 'membership_rules_engine_v2')
      .maybeSingle(),
  ]);

  if (settingsResponse.error || rolloutResponse.error) {
    return getDefaultMembershipLifecycleConfig();
  }

  return buildMembershipLifecycleSettingsFromStore(
    Array.isArray(settingsResponse.data) ? (settingsResponse.data as MembershipLifecycleSettingRow[]) : [],
    {
      mode: rolloutResponse.data?.mode,
      rolloutPercent: rolloutResponse.data?.rollout_percent,
    },
  );
}

export async function updateMembershipLifecycleSettings(input: {
  blockWithoutFeeSettlement?: boolean;
  enforceFromWithdrawalCount?: number;
  rolloutMode?: MembershipLifecycleConfig['rollout']['mode'];
  rolloutPercent?: number;
}): Promise<void> {
  const rows: Array<{ key: string; value: unknown; description: string }> = [];

  if (typeof input.enforceFromWithdrawalCount === 'number') {
    rows.push({
      key: 'membership_fee_enforce_from_withdrawal_count',
      value: input.enforceFromWithdrawalCount,
      description: 'Withdrawal count from which fee settlement enforcement begins',
    });
  }

  if (typeof input.blockWithoutFeeSettlement === 'boolean') {
    rows.push({
      key: 'membership_fee_block_without_settlement',
      value: input.blockWithoutFeeSettlement,
      description: 'Whether to block withdrawals when membership fee is outstanding',
    });
  }

  if (rows.length) {
    const { error } = await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  }

  if (typeof input.rolloutMode === 'string' || typeof input.rolloutPercent === 'number') {
    const rolloutMode = input.rolloutMode ?? 'progressive';
    const rolloutPercent = typeof input.rolloutPercent === 'number'
      ? input.rolloutPercent
      : rolloutMode === 'enforced'
        ? 100
        : rolloutMode === 'progressive'
          ? 20
          : 0;

    const { error } = await supabase.from('membership_rollout_flags').upsert({
      flag_key: 'membership_rules_engine_v2',
      mode: rolloutMode,
      rollout_percent: rolloutPercent,
      metadata: { updated_via: 'admin_ui' },
    }, { onConflict: 'flag_key' });

    if (error) throw error;
  }
}

const defaultConfig: MembershipLifecycleConfig = {
  autoUpgrade: {
    everyNWithdrawals: 4,
    insufficientBalanceAction: 'pending_upgrade',
  },
  downgrade: {
    graceDays: 7,
    warningDays: 3,
    recoveryDays: 14,
  },
  carryForward: {
    deductionPercent: 20,
    resetMultiplierOnUpgrade: true,
  },
  multiplier: {
    priceFormula: 'equal_to_membership_price',
    fixedPercent: 100,
    paymentMethods: ['gateway_only'],
  },
  feeCompliance: {
    enforceFromWithdrawalCount: 2,
    blockOnOutstandingFee: true,
  },
  rollout: {
    mode: 'progressive',
    percent: 20,
  },
};

export function getDefaultMembershipLifecycleConfig(): MembershipLifecycleConfig {
  return defaultConfig;
}

export function evaluateAutoUpgradeTrigger(
  input: { currentLevel: number; successfulWithdrawalCount: number; canAffordUpgrade: boolean },
  config: MembershipLifecycleConfig = defaultConfig,
): UpgradeDecision {
  const threshold = Math.max(1, Math.round(config.autoUpgrade.everyNWithdrawals || 1));
  const reachedThreshold = input.successfulWithdrawalCount >= threshold;

  if (!reachedThreshold) {
    return {
      triggered: false,
      nextLevel: input.currentLevel,
      action: config.autoUpgrade.insufficientBalanceAction,
      reason: 'threshold_not_reached',
    };
  }

  if (!input.canAffordUpgrade) {
    return {
      triggered: true,
      nextLevel: input.currentLevel + 1,
      action: config.autoUpgrade.insufficientBalanceAction,
      reason: 'eligible_but_insufficient_balance',
    };
  }

  return {
    triggered: true,
    nextLevel: input.currentLevel + 1,
    action: 'block',
    reason: 'auto_upgrade_ready',
  };
}

export function evaluateDowngradePolicy(
  input: { overdueDays: number; hasOutstandingFee: boolean },
  config: MembershipLifecycleConfig = defaultConfig,
): DowngradeDecision {
  if (!input.hasOutstandingFee) {
    return {
      shouldDowngrade: false,
      reason: 'no_outstanding_fee',
      effectiveAfterDays: 0,
    };
  }

  const threshold = config.downgrade.graceDays + config.downgrade.recoveryDays;
  const shouldDowngrade = input.overdueDays >= threshold;

  return {
    shouldDowngrade,
    reason: shouldDowngrade ? 'fee_overdue_beyond_recovery_window' : 'still_in_grace_or_recovery_window',
    effectiveAfterDays: threshold,
  };
}

export function evaluateCarryForwardPolicy(
  input: { previousLevel: number; newLevel: number },
  config: MembershipLifecycleConfig = defaultConfig,
): CarryForwardDecision {
  return {
    continueFromLevel: Math.max(1, Math.min(input.previousLevel, input.newLevel)),
    deductionPercent: config.carryForward.deductionPercent,
    resetMultiplier: config.carryForward.resetMultiplierOnUpgrade,
  };
}

export function evaluateMultiplierPricing(
  level: number,
  config: MembershipLifecycleConfig = defaultConfig,
): MultiplierPricingDecision {
  const plan = resolveMembershipPlan(level);
  const amount = config.multiplier.priceFormula === 'equal_to_membership_price'
    ? plan.price
    : Math.round(plan.price * (config.multiplier.fixedPercent / 100));

  return {
    amount,
    currency: plan.currency,
    requiresGatewayPayment: config.multiplier.paymentMethods.includes('gateway_only'),
    priceFormula: config.multiplier.priceFormula,
  };
}

export function evaluateMembershipFeeCompliance(
  input: { successfulWithdrawalCount: number; feeSettled: boolean },
  config: MembershipLifecycleConfig = defaultConfig,
): FeeComplianceDecision {
  const threshold = Math.max(1, Math.round(config.feeCompliance.enforceFromWithdrawalCount || 1));
  const requiresFee = input.successfulWithdrawalCount >= threshold;

  if (!requiresFee) {
    return {
      compliant: true,
      reason: 'compliant',
    };
  }

  if (input.feeSettled) {
    return {
      compliant: true,
      reason: 'compliant',
    };
  }

  return {
    compliant: !config.feeCompliance.blockOnOutstandingFee,
    reason: config.feeCompliance.blockOnOutstandingFee ? 'blocked_by_policy' : 'fee_required',
  };
}

export function simulateWorkflowTransition(
  definition: {
    states: string[];
    transitions: Array<{ from: string; event: string; to: string; requires?: Array<'fee_compliance' | 'admin_approval'> }>;
  },
  input: { currentState: string; event: string; feeCompliant: boolean; adminApproved: boolean },
): WorkflowTransitionResult {
  const transition = definition.transitions.find((candidate) => candidate.from === input.currentState && candidate.event === input.event);

  if (!transition) {
    return {
      allowed: false,
      nextState: input.currentState,
      trace: ['transition_not_found'],
    };
  }

  const trace: string[] = [];

  if (transition.requires?.includes('fee_compliance') && !input.feeCompliant) {
    trace.push('blocked_fee_compliance');
    return {
      allowed: false,
      nextState: input.currentState,
      trace,
    };
  }

  if (transition.requires?.includes('admin_approval') && !input.adminApproved) {
    trace.push('blocked_admin_approval');
    return {
      allowed: false,
      nextState: input.currentState,
      trace,
    };
  }

  trace.push('transition_allowed');
  return {
    allowed: true,
    nextState: transition.to,
    trace,
  };
}

export function resolvePaymentGatewayRoute(
  input: { amount: number; currency: string; availableProviders: Array<{ id: string; currencies: string[]; maxAmount: number; rank: number }> },
): GatewayRoutingDecision {
  const compatible = input.availableProviders
    .filter((provider) => provider.currencies.includes(input.currency.toUpperCase()) && input.amount <= provider.maxAmount)
    .sort((left, right) => left.rank - right.rank);

  if (compatible[0]) {
    return {
      provider: compatible[0].id,
      reason: 'best_rank_compatible_provider',
    };
  }

  return {
    provider: 'manual_review',
    reason: 'no_provider_for_amount_or_currency',
  };
}

export function evaluateRolloutStage(userSeed: number, config: MembershipLifecycleConfig = defaultConfig): RolloutDecision {
  const percent = Math.max(0, Math.min(100, Math.round(config.rollout.percent || 0)));

  if (config.rollout.mode === 'enforced') {
    return {
      enforceNewPolicy: true,
      mode: config.rollout.mode,
      percent,
    };
  }

  if (config.rollout.mode === 'shadow') {
    return {
      enforceNewPolicy: false,
      mode: config.rollout.mode,
      percent,
    };
  }

  return {
    enforceNewPolicy: Math.abs(userSeed % 100) < percent,
    mode: config.rollout.mode,
    percent,
  };
}

export function buildMembershipAnalyticsSnapshot(input: {
  totalMembers: number;
  paidMembers: number;
  pendingUpgrades: number;
  activeMultipliers: number;
  feeDelinquentMembers: number;
  topPlanLevel: number;
}): MembershipAnalyticsSnapshot {
  const topPlan = resolveMembershipPlan(input.topPlanLevel);
  const ruleAwarePlan = evaluateMembershipRuleSet({ level: topPlan.level, balance: 0, withdrawalCount: 0 }).plan;

  return {
    totalMembers: input.totalMembers,
    paidMembers: input.paidMembers,
    pendingUpgrades: input.pendingUpgrades,
    activeMultipliers: input.activeMultipliers,
    feeDelinquentMembers: input.feeDelinquentMembers,
    topPlan: {
      level: ruleAwarePlan.level,
      label: ruleAwarePlan.label,
      slug: ruleAwarePlan.slug,
    },
  };
}
