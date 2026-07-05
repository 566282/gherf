import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAnalyticsReport } from '@/services/api/analytics';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe('referral analytics reporting', () => {
  beforeEach(() => {
    const tableRows: Record<string, unknown[]> = {
      profiles: [{ id: 'profile-1', created_at: daysAgoIso(3), last_login_at: daysAgoIso(1), referred_by_code: null }],
      campaigns: [],
      campaign_tasks: [],
      task_submissions: [],
      rewards: [],
      withdrawal_requests: [],
      wallet_transactions: [],
      referral_programs: [
        { id: 'program-1', name: 'Default Referral', status: 'active', created_at: daysAgoIso(10) },
        { id: 'program-2', name: 'Paused Referral', status: 'paused', created_at: daysAgoIso(10) },
      ],
      referral_attributions: [
        {
          id: 'attr-1',
          program_id: 'program-1',
          referred_profile_id: 'profile-2',
          referrer_profile_id: 'profile-1',
          qualification_status: 'qualified',
          fraud_status: 'clear',
          is_duplicate_account: false,
          created_at: daysAgoIso(2),
        },
        {
          id: 'attr-2',
          program_id: 'program-2',
          referred_profile_id: 'profile-3',
          referrer_profile_id: 'profile-1',
          qualification_status: 'pending',
          fraud_status: 'flagged',
          is_duplicate_account: true,
          created_at: daysAgoIso(2),
        },
      ],
      referral_commission_ledger: [
        {
          id: 'commission-1',
          program_id: 'program-1',
          beneficiary_profile_id: 'profile-1',
          tier_depth: 1,
          commission_kind: 'invite_bonus',
          amount: 12,
          status: 'available',
          created_at: daysAgoIso(2),
        },
        {
          id: 'commission-2',
          program_id: 'program-1',
          beneficiary_profile_id: 'profile-1',
          tier_depth: 2,
          commission_kind: 'tier_two_commission',
          amount: 8,
          status: 'held',
          created_at: daysAgoIso(1),
        },
      ],
      referral_fraud_flags: [
        {
          id: 'flag-1',
          program_id: 'program-1',
          rule_key: 'duplicate_detection',
          severity: 'high',
          status: 'open',
          signal: 'Duplicate account detected',
          created_at: daysAgoIso(1),
        },
        {
          id: 'flag-2',
          program_id: 'program-2',
          rule_key: 'invalid_referral_code',
          severity: 'medium',
          status: 'resolved',
          signal: 'Invalid code',
          created_at: daysAgoIso(1),
        },
      ],
      referral_leaderboard_snapshots: [
        {
          id: 'leaderboard-1',
          program_id: 'program-1',
          profile_id: 'profile-1',
          period_key: '2026-07',
          referral_count: 2,
          commission_total: 20,
          rank: 1,
          created_at: daysAgoIso(1),
        },
      ],
    };

    supabaseState.from.mockImplementation((table: string) => ({
      select: async () => ({ data: tableRows[table] ?? [], error: null }),
    }));
  });

  it('sources referral metrics from the referral backend tables', async () => {
    const report = await listAnalyticsReport(7);

    expect(report.referralPerformance.referredUsers).toBe(2);
    expect(report.referralPerformance.qualifiedReferrals).toBe(1);
    expect(report.referralPerformance.activePrograms).toBe(1);
    expect(report.referralPerformance.fraudFlags).toBe(2);
    expect(report.referralPerformance.referralCommissions).toBe(20);
    expect(report.referralPerformance.programsByActivity).toHaveLength(2);
    expect(report.referralPerformance.programsByActivity[0]).toMatchObject({ programName: 'Default Referral', referredUsers: 1, referralCommissions: 20 });
    expect(report.referralPerformance.leaderboard[0]).toMatchObject({ profileId: 'profile-1', rank: 1, referralCount: 2, commissionTotal: 20 });
    expect(report.referralPerformance.fraudSignals.some((signal) => signal.ruleKey === 'duplicate_detection')).toBe(true);
  });
});