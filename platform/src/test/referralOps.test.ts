import { beforeEach, describe, expect, it, vi } from 'vitest';
import { referralOpsReviewPresets } from '@/services/api/admin';
import { buildReferralBackfillValidationChecks, getReferralCommissionApprovalPolicy, getReferralCommissionReleaseWindow, updateReferralCommissionStatus, updateReferralFraudFlagStatus } from '@/services/api/referrals';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

describe('referral ops workflow', () => {
  beforeEach(() => {
    const query = {
      update: supabaseState.update,
      eq: supabaseState.eq,
    };

    supabaseState.from.mockReturnValue(query);
    supabaseState.update.mockReturnValue(query);
    supabaseState.eq.mockResolvedValue({ error: null });
  });

  it('updates commission status for hold and approval workflows', async () => {
    await updateReferralCommissionStatus('commission-1', 'held', 'Held for review');

    expect(supabaseState.from).toHaveBeenCalledWith('referral_commission_ledger');
    expect(supabaseState.update).toHaveBeenCalledWith({ status: 'held', note: 'Held for review' });
    expect(supabaseState.eq).toHaveBeenCalledWith('id', 'commission-1');
  });

  it('updates fraud flag status for review resolution', async () => {
    await updateReferralFraudFlagStatus('flag-1', 'resolved');

    expect(supabaseState.from).toHaveBeenCalledWith('referral_fraud_flags');
    expect(supabaseState.update).toHaveBeenCalledWith({ status: 'resolved' });
    expect(supabaseState.eq).toHaveBeenCalledWith('id', 'flag-1');
  });

  it('respects payout delay windows before commission release', () => {
    const window = getReferralCommissionReleaseWindow('2026-07-01T00:00:00.000Z', 7);

    expect(window.unlockAt).toBe('2026-07-08T00:00:00.000Z');
    expect(window.eligible).toBe(false);
  });

  it('requires escalation for large commissions', () => {
    const policy = getReferralCommissionApprovalPolicy({
      commissionCreatedAt: '2026-06-01T00:00:00.000Z',
      payoutDelayDays: 0,
      amount: 5000,
      status: 'available',
      holdThreshold: 250,
      escalationThreshold: 1000,
    });

    expect(policy.requiresEscalation).toBe(true);
    expect(policy.canRelease).toBe(false);
    expect(policy.reason).toContain('requires escalation review');
  });

  it('builds backfill validation checks from seeded referral data', () => {
    const checks = buildReferralBackfillValidationChecks({
      programs: [{ slug: 'default-referral-program', metadata: { source: 'migration_014_referral_engine_backfill' } }],
      attributions: [{ metadata: { source: 'backfill' } }],
      fraudFlags: [{ ruleKey: 'invalid_referral_code', metadata: { source: 'backfill' } }],
      leaderboard: [{ metadata: { source: 'backfill' } }],
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'default-program', passed: true }),
        expect.objectContaining({ key: 'attribution-backfill', passed: true }),
        expect.objectContaining({ key: 'fraud-backfill', passed: true }),
        expect.objectContaining({ key: 'leaderboard-backfill', passed: true }),
      ]),
    );
  });

  it('exposes the saved referral review presets', () => {
    expect(referralOpsReviewPresets.map((preset) => preset.key)).toEqual(['pending-review', 'held-review', 'blocked-review']);
  });
});