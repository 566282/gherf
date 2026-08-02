export interface MembershipPlanDefinition {
  level: number;
  slug: string;
  label: string;
  price: number;
  currency: string;
  durationDays: number;
  category: string;
  benefits: string[];
}

export interface MembershipAssignmentSnapshot {
  changeType: 'purchase' | 'renewal' | 'upgrade' | 'downgrade' | 'fee-settlement' | 'multiplier-activation';
  planLevel: number;
  previousPlanLevel: number | null;
  planSlug: string;
  previousPlanSlug: string | null;
  planLabel: string;
  previousPlanLabel: string | null;
  version: 'v1';
  price: number;
  currency: string;
}

export interface MembershipRuleEvaluation {
  plan: MembershipPlanDefinition;
  rewardConfig: {
    dailyPercent: number;
    cycleDays: number;
    targetWallet: string;
  };
  withdrawalConfig: {
    minThreshold: number;
    maxWithdrawal: number;
    holdDays: number;
  };
  feeConfig: {
    feePercent: number;
    feeThreshold: number;
  };
}

export interface DailyRewardResult {
  amount: number;
  targetWallet: string;
  cycleDays: number;
}

export interface WithdrawalPolicyEvaluation {
  allowed: boolean;
  reason: 'eligible' | 'fee_not_paid' | 'request_out_of_policy' | 'plan_upgrade_required';
  minThreshold: number;
  maxWithdrawal: number;
  holdDays: number;
}

const tierLabels = [
  'Starter',
  'Starter Plus',
  'Bronze',
  'Bronze Plus',
  'Bronze Elite',
  'Silver',
  'Silver Plus',
  'Silver Elite',
  'Gold',
  'Gold Plus',
  'Gold Elite',
  'Platinum',
  'Platinum Plus',
  'Platinum Elite',
  'Diamond',
  'Diamond Plus',
  'Diamond Elite',
  'Sapphire',
  'Sapphire Plus',
  'Sapphire Elite',
  'Emerald',
  'Emerald Plus',
  'Emerald Elite',
  'Ruby',
  'Ruby Plus',
  'Ruby Elite',
  'Pearl',
  'Pearl Plus',
  'Pearl Elite',
  'Titanium',
  'Titanium Plus',
  'Titanium Elite',
  'Prestige',
  'Prestige Plus',
  'Prestige Elite',
  'Executive',
  'Executive Plus',
  'Executive Elite',
  'Royal',
  'Royal Plus',
  'Royal Elite',
  'Crown',
  'Crown Plus',
  'Crown Elite',
  'Imperial',
  'Imperial Plus',
  'Imperial Elite',
  'Legacy',
  'Legacy Plus',
  'Legacy Elite',
  'Infinity',
  'Infinity Plus',
  'Infinity Elite',
  'Elite Club',
  'Elite Prime',
  'Elite Signature',
  'Visionary',
  'Visionary Plus',
  'Visionary Elite',
  'Chairman',
  'Chairman Plus',
  'Chairman Elite',
  'Ambassador',
  'Ambassador Plus',
  'Ambassador Elite',
  'President',
  'President Plus',
  'President Elite',
  'Founder',
  'Founder Plus',
  'Founder Elite',
  'Pinnacle',
  'Pinnacle Plus',
  'Pinnacle Elite',
  'Supreme',
  'Supreme Plus',
  'Supreme Elite',
  'Apex',
  'Apex Plus',
  'Apex Elite',
  'Legend',
  'Legend Plus',
  'Legend Elite',
  'Dynasty',
  'Dynasty Plus',
  'Dynasty Elite',
  'Global',
  'Global Plus',
  'Global Elite',
  'Ultra',
  'Ultra Plus',
  'Ultra Elite',
  'Black',
  'Black Plus',
  'Black Elite',
  'Titanium Black',
  'Titanium Black Elite',
  'Diamond Black',
  'Diamond Black Elite',
  'Ultimate Founder',
];

const tierPrices = [
  5000, 7500, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000,
  50000, 60000, 70000, 80000, 90000, 100000, 110000, 125000, 140000, 155000,
  170000, 185000, 200000, 225000, 250000, 275000, 300000, 325000, 350000, 375000,
  400000, 425000, 450000, 475000, 500000, 550000, 600000, 650000, 700000, 750000,
  800000, 850000, 900000, 950000, 1000000, 1100000, 1200000, 1300000, 1400000, 1500000,
  1600000, 1700000, 1800000, 1900000, 2000000, 2100000, 2200000, 2300000, 2400000, 2500000,
  2600000, 2700000, 2800000, 2900000, 3000000, 3200000, 3400000, 3600000, 3800000, 4000000,
  4200000, 4400000, 4600000, 4800000, 5000000, 5200000, 5400000, 5600000, 5800000, 6000000,
  6200000, 6400000, 6600000, 6800000, 7000000, 7500000, 8000000, 8500000, 9000000, 9500000,
  10000000, 10500000, 11000000, 11250000, 11500000, 11750000, 12000000, 12300000, 12650000, 13000000,
];

const catalogCache: MembershipPlanDefinition[] = [];

function buildCatalog(): MembershipPlanDefinition[] {
  if (catalogCache.length > 0) {
    return catalogCache;
  }

  const plans = tierLabels.map((label, index) => {
    const level = index + 1;
    const price = tierPrices[index] ?? 13000000;

    return {
      level,
      slug: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      label,
      price,
      currency: 'NGN',
      durationDays: 30,
      category: level >= 50 ? 'enterprise' : level >= 20 ? 'growth' : 'starter',
      benefits: [
        'Priority support',
        'Reward multiplier access',
        'Withdrawal eligibility',
      ],
    };
  });

  catalogCache.push(...plans);
  return catalogCache;
}

export function getMembershipPlanCatalog(): MembershipPlanDefinition[] {
  return buildCatalog();
}

export function resolveMembershipPlan(levelTier: number): MembershipPlanDefinition {
  const normalizedTier = Math.max(1, Math.min(100, Math.round(Number(levelTier) || 1)));
  return buildCatalog()[normalizedTier - 1];
}

export function resolveMembershipLabel(levelTier: number): string {
  return resolveMembershipPlan(levelTier).label;
}

export function getMembershipPlanOptions(): Array<{ value: number; label: string }> {
  return buildCatalog().map((plan) => ({
    value: plan.level,
    label: `Tier ${plan.level} · ${plan.label}`,
  }));
}

export function createMembershipAssignmentSnapshot(
  nextPlan: Pick<MembershipPlanDefinition, 'level' | 'slug' | 'label' | 'price' | 'currency'>,
  previousPlan: Pick<MembershipPlanDefinition, 'level' | 'slug' | 'label' | 'price' | 'currency'> | null,
  changeType: MembershipAssignmentSnapshot['changeType'],
): MembershipAssignmentSnapshot {
  return {
    changeType,
    planLevel: nextPlan.level,
    previousPlanLevel: previousPlan?.level ?? null,
    planSlug: nextPlan.slug,
    previousPlanSlug: previousPlan?.slug ?? null,
    planLabel: nextPlan.label,
    previousPlanLabel: previousPlan?.label ?? null,
    version: 'v1',
    price: nextPlan.price,
    currency: nextPlan.currency,
  };
}

export function evaluateMembershipRuleSet(input: { level: number; balance: number; withdrawalCount: number }): MembershipRuleEvaluation {
  const plan = resolveMembershipPlan(input.level);

  return {
    plan,
    rewardConfig: {
      dailyPercent: 10,
      cycleDays: 31,
      targetWallet: 'main_wallet',
    },
    withdrawalConfig: {
      minThreshold: 10000,
      maxWithdrawal: plan.level >= 21 ? 500000 : 250000,
      holdDays: plan.level >= 25 ? 2 : 1,
    },
    feeConfig: {
      feePercent: plan.level >= 20 ? 1.5 : 2,
      feeThreshold: 2,
    },
  };
}

export function calculateDailyReward(balance: number, level: number, overrides?: Partial<MembershipRuleEvaluation['rewardConfig']>): DailyRewardResult {
  const evaluation = evaluateMembershipRuleSet({ level, balance, withdrawalCount: 0 });
  const dailyPercent = overrides?.dailyPercent ?? evaluation.rewardConfig.dailyPercent;

  return {
    amount: Math.round(balance * (dailyPercent / 100)),
    targetWallet: overrides?.targetWallet ?? evaluation.rewardConfig.targetWallet,
    cycleDays: overrides?.cycleDays ?? evaluation.rewardConfig.cycleDays,
  };
}

export function evaluateWithdrawalPolicy(input: {
  level: number;
  balance: number;
  withdrawalCount: number;
  requestAmount: number;
  feePaid: boolean;
}): WithdrawalPolicyEvaluation {
  const evaluation = evaluateMembershipRuleSet({ level: input.level, balance: input.balance, withdrawalCount: input.withdrawalCount });
  const planEligible = Math.max(1, Math.round(input.level || 1)) >= 2;
  const withinPolicy = input.requestAmount <= evaluation.withdrawalConfig.maxWithdrawal && input.requestAmount >= evaluation.withdrawalConfig.minThreshold;
  const allowed = planEligible && input.feePaid && withinPolicy;
  let reason: WithdrawalPolicyEvaluation['reason'] = 'eligible';

  if (!planEligible) {
    reason = 'plan_upgrade_required';
  } else if (!input.feePaid) {
    reason = 'fee_not_paid';
  } else if (!withinPolicy) {
    reason = 'request_out_of_policy';
  }

  return {
    allowed,
    reason,
    minThreshold: evaluation.withdrawalConfig.minThreshold,
    maxWithdrawal: evaluation.withdrawalConfig.maxWithdrawal,
    holdDays: evaluation.withdrawalConfig.holdDays,
  };
}
