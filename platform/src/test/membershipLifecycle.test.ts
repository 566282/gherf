import { describe, expect, it } from 'vitest';
import {
  buildMembershipAnalyticsSnapshot,
  buildMembershipLifecycleSettingsFromStore,
  evaluateAutoUpgradeTrigger,
  evaluateCarryForwardPolicy,
  evaluateDowngradePolicy,
  evaluateMembershipFeeCompliance,
  evaluateMultiplierPricing,
  evaluateRolloutStage,
  getDefaultMembershipLifecycleConfig,
  resolvePaymentGatewayRoute,
  simulateWorkflowTransition,
} from '@/services/api/membershipLifecycle';

describe('membership lifecycle phases 6-13', () => {
  it('triggers auto-upgrade when withdrawal threshold is reached', () => {
    const decision = evaluateAutoUpgradeTrigger({
      currentLevel: 2,
      successfulWithdrawalCount: 4,
      canAffordUpgrade: false,
    });

    expect(decision).toMatchObject({
      triggered: true,
      nextLevel: 3,
      action: 'pending_upgrade',
    });
  });

  it('evaluates downgrade policy with grace and recovery windows', () => {
    const config = getDefaultMembershipLifecycleConfig();
    const overdueDays = config.downgrade.graceDays + config.downgrade.recoveryDays;
    const decision = evaluateDowngradePolicy({ overdueDays, hasOutstandingFee: true });

    expect(decision.shouldDowngrade).toBe(true);
  });

  it('keeps reward carry-forward level and reset toggle policy-driven', () => {
    const carryForward = evaluateCarryForwardPolicy({ previousLevel: 8, newLevel: 12 });

    expect(carryForward).toMatchObject({
      continueFromLevel: 8,
      deductionPercent: 20,
      resetMultiplier: true,
    });
  });

  it('prices multiplier module from membership plan by default', () => {
    const pricing = evaluateMultiplierPricing(15);

    expect(pricing.requiresGatewayPayment).toBe(true);
    expect(pricing.amount).toBeGreaterThan(0);
  });

  it('enforces fee compliance from configured withdrawal count', () => {
    const compliance = evaluateMembershipFeeCompliance({
      successfulWithdrawalCount: 2,
      feeSettled: false,
    });

    expect(compliance).toMatchObject({
      compliant: false,
      reason: 'blocked_by_policy',
    });
  });

  it('simulates workflow transitions and blocks when constraints fail', () => {
    const transition = simulateWorkflowTransition(
      {
        states: ['requested', 'approved'],
        transitions: [{ from: 'requested', event: 'approve', to: 'approved', requires: ['fee_compliance', 'admin_approval'] }],
      },
      {
        currentState: 'requested',
        event: 'approve',
        feeCompliant: true,
        adminApproved: false,
      },
    );

    expect(transition).toMatchObject({
      allowed: false,
      nextState: 'requested',
    });
    expect(transition.trace).toContain('blocked_admin_approval');
  });

  it('routes payments through the best compatible gateway', () => {
    const route = resolvePaymentGatewayRoute({
      amount: 150000,
      currency: 'NGN',
      availableProviders: [
        { id: 'gateway-low-rank', currencies: ['NGN'], maxAmount: 200000, rank: 2 },
        { id: 'gateway-top-rank', currencies: ['NGN', 'USD'], maxAmount: 500000, rank: 1 },
      ],
    });

    expect(route).toMatchObject({
      provider: 'gateway-top-rank',
      reason: 'best_rank_compatible_provider',
    });
  });

  it('evaluates progressive rollout stage', () => {
    const decision = evaluateRolloutStage(19);

    expect(decision.mode).toBe('progressive');
    expect(typeof decision.enforceNewPolicy).toBe('boolean');
  });

  it('builds lifecycle settings from persisted rollout and fee controls', () => {
    const config = buildMembershipLifecycleSettingsFromStore(
      [
        { key: 'membership_fee_enforce_from_withdrawal_count', value: 3 },
        { key: 'membership_fee_block_without_settlement', value: true },
      ],
      { mode: 'enforced', rolloutPercent: 100 },
    );

    expect(config.feeCompliance.enforceFromWithdrawalCount).toBe(3);
    expect(config.feeCompliance.blockOnOutstandingFee).toBe(true);
    expect(config.rollout.mode).toBe('enforced');
    expect(config.rollout.percent).toBe(100);
  });

  it('builds analytics snapshot with resolved top plan metadata', () => {
    const snapshot = buildMembershipAnalyticsSnapshot({
      totalMembers: 1200,
      paidMembers: 880,
      pendingUpgrades: 65,
      activeMultipliers: 110,
      feeDelinquentMembers: 22,
      topPlanLevel: 35,
    });

    expect(snapshot).toMatchObject({
      totalMembers: 1200,
      paidMembers: 880,
      pendingUpgrades: 65,
      topPlan: {
        level: 35,
      },
    });
  });
});
