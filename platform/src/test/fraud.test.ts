import { describe, expect, it } from 'vitest';
import { defaultFraudThresholds, evaluateFraudProfile, explainFraudAssessment, type FraudUserProfile } from '@/services/api/fraud';

const safeUser: FraudUserProfile = {
  id: 'user-safe',
  name: 'Safe User',
  email: 'safe@example.com',
  campaign: 'watch_video',
  country: 'US',
  device: 'MacBook Pro · Safari',
  ipGroup: 'IP-1',
  watchTimeMinutes: 12,
  clicksPerMinute: 2,
  refreshesPerMinute: 0,
  automationConfidence: 8,
  sharedIpAccounts: 1,
  deviceReuseCount: 1,
  linkedAccounts: 1,
  referralLoopScore: 4,
  vpn: false,
  proxy: false,
  emulator: false,
  bot: false,
  suspiciousReferrals: false,
  lastSeen: '2026-07-05T00:00:00.000Z',
};

const riskyUser: FraudUserProfile = {
  id: 'user-risky',
  name: 'Risky User',
  email: 'risky@example.com',
  campaign: 'referral_campaigns',
  country: 'NL',
  device: 'Android emulator · Chrome',
  ipGroup: 'IP-9',
  watchTimeMinutes: 0.4,
  clicksPerMinute: 18,
  refreshesPerMinute: 7,
  automationConfidence: 92,
  sharedIpAccounts: 4,
  deviceReuseCount: 3,
  linkedAccounts: 5,
  referralLoopScore: 91,
  vpn: true,
  proxy: true,
  emulator: true,
  bot: true,
  suspiciousReferrals: true,
  lastSeen: '2026-07-05T00:00:00.000Z',
};

const boundaryUser: FraudUserProfile = {
  ...safeUser,
  id: 'user-boundary',
  name: 'Boundary User',
  email: 'boundary@example.com',
  vpn: true,
};

const matrixCases: Array<{
  name: string;
  user: FraudUserProfile;
  expectedSignals: string[];
  expectedDecision: 'Block' | 'Quarantine' | 'Review' | 'Monitor';
}> = [
  {
    name: 'vpn and duplicate ip',
    user: {
      ...safeUser,
      id: 'user-vpn-duplicate-ip',
      name: 'VPN Duplicate IP',
      vpn: true,
      sharedIpAccounts: 4,
    },
    expectedSignals: ['VPN', 'Duplicate IP'],
    expectedDecision: 'Block',
  },
  {
    name: 'bot and rapid clicking',
    user: {
      ...safeUser,
      id: 'user-bot-rapid-clicking',
      name: 'Bot Rapid Clicking',
      bot: true,
      clicksPerMinute: 20,
    },
    expectedSignals: ['Bot', 'Rapid clicking'],
    expectedDecision: 'Block',
  },
  {
    name: 'suspicious referrals and multiple accounts',
    user: {
      ...safeUser,
      id: 'user-referrals-multi-account',
      name: 'Referral Ring',
      linkedAccounts: 6,
      referralLoopScore: 90,
      suspiciousReferrals: true,
    },
    expectedSignals: ['Multiple accounts', 'Suspicious referrals'],
    expectedDecision: 'Block',
  },
];

describe('evaluateFraudProfile', () => {
  it('keeps a low-risk user in monitor state', () => {
    const result = evaluateFraudProfile(safeUser, defaultFraudThresholds);

    expect(result.score).toBe(100);
    expect(result.decision).toBe('Monitor');
    expect(result.activeSignals).toHaveLength(0);
  });

  it('flags multiple fraud signals and escalates the decision', () => {
    const result = evaluateFraudProfile(riskyUser, defaultFraudThresholds);

    expect(result.score).toBeLessThan(defaultFraudThresholds.review);
    expect(result.decision).toBe('Block');
    expect(result.activeSignals).toEqual(
      expect.arrayContaining(['VPN', 'Proxy', 'Emulator', 'Bot', 'Multiple accounts', 'Duplicate IP', 'Device fingerprint', 'Rapid clicking', 'Fake watch time', 'Auto refresh', 'Automation', 'Suspicious referrals']),
    );
  });

  it('responds to stricter thresholds by raising the decision band', () => {
    const strictThresholds = {
      ...defaultFraudThresholds,
      review: 80,
      quarantine: 85,
      block: 90,
      watchTimeMinutes: 4,
    };

    const result = evaluateFraudProfile(boundaryUser, strictThresholds);

    expect(result.score).toBe(82);
    expect(result.decision).toBe('Review');
  });

  it.each(matrixCases)('flags $name as a $expectedDecision decision', ({ user, expectedSignals, expectedDecision }) => {
    const result = evaluateFraudProfile(user, defaultFraudThresholds);

    expect(result.decision).toBe(expectedDecision);
    expect(result.activeSignals).toEqual(expect.arrayContaining(expectedSignals));
  });

  it('explains the decision and contributing signals', () => {
    const result = evaluateFraudProfile(riskyUser, defaultFraudThresholds);
    const explanation = explainFraudAssessment(result, defaultFraudThresholds);

    expect(explanation.decision).toBe('Block');
    expect(explanation.summary).toContain('block threshold');
    expect(explanation.reasons).toEqual(expect.arrayContaining(['Flags traffic that routes through anonymized or privacy-grade tunnels.', 'Detects proxy hops, residential relays, and masked IP paths.']));
  });
});