import { describe, expect, it } from 'vitest';
import { buildReferralSignupPlan, getReferralCommissionReleaseWindow } from '@/services/api/referrals';

describe('buildReferralSignupPlan', () => {
  it('builds attribution, commission, and leaderboard inputs for a single referral signup', () => {
    const createdAt = '2026-07-05T00:00:00.000Z';
    const plan = buildReferralSignupPlan(
      {
        id: 'program-1',
        campaignSlug: 'referral_campaigns',
        inviteBonusAmount: 4,
        tierOneCommissionPercent: 8,
        tierTwoCommissionPercent: 3,
        maxTierDepth: 2,
        milestoneConfig: [
          { key: 'first_referral', label: 'First referral', threshold: 1, rewardAmount: 4 },
        ],
      },
      {
        referredProfileId: 'profile-new',
        referrerProfileId: 'profile-referrer',
        referralCode: 'REF-1234',
        createdAt,
        referrerReferrerProfileId: 'profile-parent',
      },
    );

    expect(plan.attribution).toMatchObject({
      programId: 'program-1',
      referredProfileId: 'profile-new',
      referrerProfileId: 'profile-referrer',
      referralCode: 'REF-1234',
      sourceCampaignSlug: 'referral_campaigns',
      qualificationStatus: 'qualified',
    });
    expect(plan.commissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ beneficiaryProfileId: 'profile-referrer', commissionKind: 'invite_bonus', amount: 4 }),
        expect.objectContaining({ beneficiaryProfileId: 'profile-referrer', commissionKind: 'tier_one_commission', amount: 0.32 }),
        expect.objectContaining({ beneficiaryProfileId: 'profile-parent', commissionKind: 'tier_two_commission', amount: 0.12 }),
      ]),
    );
    expect(plan.leaderboardSnapshotKey).toBe(createdAt.slice(0, 7));
    expect(plan.milestoneSeed).toHaveLength(1);
    expect(plan.attribution.metadata).toEqual({
      source: 'signup',
      createdAt,
    });
    expect(plan.attribution.fraudStatus).toBe('clear');
    expect(plan.attribution.isDuplicateAccount).toBe(false);
    expect(plan.attribution.fraudScore).toBe(0);
  });

  it('flags duplicate signup plans for review', () => {
    const plan = buildReferralSignupPlan(
      {
        id: 'program-1',
        campaignSlug: 'referral_campaigns',
        inviteBonusAmount: 4,
        tierOneCommissionPercent: 8,
        tierTwoCommissionPercent: 3,
        maxTierDepth: 2,
        milestoneConfig: [],
      },
      {
        referredProfileId: 'profile-new',
        referrerProfileId: 'profile-referrer',
        referralCode: 'REF-1234',
        duplicateAccount: true,
      },
    );

    expect(plan.attribution.fraudStatus).toBe('flagged');
    expect(plan.attribution.isDuplicateAccount).toBe(true);
    expect(plan.attribution.fraudScore).toBe(80);
    expect(plan.attribution.metadata).toMatchObject({
      source: 'signup',
    });
  });

  it('computes a hold window for commission release policy', () => {
    const window = getReferralCommissionReleaseWindow('2026-07-01T00:00:00.000Z', 7);

    expect(window.unlockAt).toBe('2026-07-08T00:00:00.000Z');
    expect(window.eligible).toBe(false);
  });
});