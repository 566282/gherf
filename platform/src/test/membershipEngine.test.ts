import { describe, expect, it } from 'vitest';
import {
  calculateDailyReward,
  createMembershipAssignmentSnapshot,
  evaluateMembershipRuleSet,
  evaluateWithdrawalPolicy,
  resolveMembershipPlan,
} from '@/services/api/membership';

describe('membership engine phases 0-5', () => {
  it('resolves tiers from a 100-level catalog without clamping to three levels', () => {
    const starter = resolveMembershipPlan(1);
    const premium = resolveMembershipPlan(100);
    const clamped = resolveMembershipPlan(999);

    expect(starter).toMatchObject({ level: 1, slug: 'starter', label: 'Starter' });
    expect(premium).toMatchObject({ level: 100, slug: 'ultimate-founder', label: 'Ultimate Founder' });
    expect(clamped).toMatchObject({ level: 100, slug: 'ultimate-founder', label: 'Ultimate Founder' });
  });

  it('produces a membership assignment snapshot that is plan-based and versioned', () => {
    const snapshot = createMembershipAssignmentSnapshot({
      level: 12,
      label: 'Platinum',
      slug: 'platinum',
      price: 60000,
      currency: 'NGN',
    }, {
      level: 3,
      label: 'Bronze',
      slug: 'bronze',
      price: 10000,
      currency: 'NGN',
    }, 'upgrade');

    expect(snapshot).toMatchObject({
      changeType: 'upgrade',
      planLevel: 12,
      previousPlanLevel: 3,
      planSlug: 'platinum',
      previousPlanSlug: 'bronze',
      version: 'v1',
    });
  });

  it('evaluates rules through a central rules engine', () => {
    const evaluation = evaluateMembershipRuleSet({ level: 21, balance: 250000, withdrawalCount: 2 });

    expect(evaluation.rewardConfig).toMatchObject({
      dailyPercent: 10,
      cycleDays: 31,
      targetWallet: 'main_wallet',
    });
    expect(evaluation.withdrawalConfig).toMatchObject({
      minThreshold: 10000,
      maxWithdrawal: 500000,
      holdDays: 1,
    });
  });

  it('calculates a daily reward from configurable policy values', () => {
    const reward = calculateDailyReward(100000, 21, { dailyPercent: 12, cycleDays: 30, targetWallet: 'main_wallet' });

    expect(reward.amount).toBe(12000);
    expect(reward.targetWallet).toBe('main_wallet');
  });

  it('evaluates withdrawal policy and flags eligibility for fee-compliant members', () => {
    const evaluation = evaluateWithdrawalPolicy({
      level: 25,
      balance: 200000,
      withdrawalCount: 2,
      requestAmount: 50000,
      feePaid: true,
    });

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.reason).toBe('eligible');
    expect(evaluation.maxWithdrawal).toBe(500000);
  });
});
