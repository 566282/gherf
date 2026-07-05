import { describe, expect, it } from 'vitest';
import { explainReferralFraudFlag, type ReferralFraudFlag } from '@/services/api/referrals';

const referralFlag: ReferralFraudFlag = {
  id: 'flag-1',
  programId: 'program-1',
  attributionId: 'attr-1',
  profileId: 'profile-1',
  relatedProfileId: 'profile-2',
  ruleKey: 'duplicate_detection',
  severity: 'high',
  status: 'open',
  signal: 'duplicate_detection',
  metadata: {},
  createdAt: '2026-07-05T00:00:00.000Z',
};

describe('explainReferralFraudFlag', () => {
  it('returns a human-readable referral fraud explanation', () => {
    const explanation = explainReferralFraudFlag(referralFlag);

    expect(explanation.summary).toContain('Duplicate accounts or mirrored profiles are blocked.');
    expect(explanation.reasons).toEqual(
      expect.arrayContaining(['Severity: high', 'Status: open', 'Signal: duplicate detection']),
    );
  });
});