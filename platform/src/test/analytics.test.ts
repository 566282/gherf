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

describe('listAnalyticsReport', () => {
  beforeEach(() => {
    const tableRows: Record<string, unknown[]> = {
      profiles: [
        { id: 'profile-1', created_at: daysAgoIso(10), last_login_at: daysAgoIso(1), referred_by_code: null },
        { id: 'profile-2', created_at: daysAgoIso(10), last_login_at: daysAgoIso(1), referred_by_code: null },
        { id: 'profile-3', created_at: daysAgoIso(1), last_login_at: daysAgoIso(1), referred_by_code: null },
      ],
      campaigns: [],
      campaign_tasks: [],
      task_submissions: [
        { id: 'submission-1', task_id: 'task-1', user_id: 'profile-1', status: 'approved', created_at: daysAgoIso(1), submission_data: null },
        { id: 'submission-2', task_id: 'task-1', user_id: 'profile-2', status: 'approved', created_at: daysAgoIso(1), submission_data: null },
        { id: 'submission-3', task_id: 'task-1', user_id: 'profile-3', status: 'rejected', created_at: daysAgoIso(1), submission_data: null },
        { id: 'submission-4', task_id: 'task-2', user_id: 'profile-3', status: 'approved', created_at: daysAgoIso(2), submission_data: null },
      ],
      rewards: [{ id: 'reward-1', user_id: 'profile-1', campaign_id: 'campaign-1', status: 'approved', amount: 18, created_at: daysAgoIso(1) }],
      withdrawal_requests: [],
      wallet_transactions: [],
      referral_programs: [],
      referral_attributions: [],
      referral_commission_ledger: [],
      referral_fraud_flags: [],
      referral_leaderboard_snapshots: [],
    };

    supabaseState.from.mockImplementation((table: string) => ({
      select: async () => ({ data: tableRows[table] ?? [], error: null }),
    }));
  });

  it('derives task completion and retention as first-class series', async () => {
    const report = await listAnalyticsReport(7);
    const targetLabel = daysAgoIso(1).slice(0, 10);

    expect(report.taskCompletion).toHaveLength(7);
    expect(report.retention).toHaveLength(7);
    expect(report.taskCompletion.find((point) => point.label === targetLabel)?.value).toBe(66.67);
    expect(report.retention.find((point) => point.label === targetLabel)?.value).toBe(66.67);
  });

  it('returns zeroed retention when there are no returning users', async () => {
    const emptyTableRows: Record<string, unknown[]> = {
      profiles: [{ id: 'profile-1', created_at: daysAgoIso(1), last_login_at: daysAgoIso(1), referred_by_code: null }],
      campaigns: [],
      campaign_tasks: [],
      task_submissions: [],
      rewards: [],
      withdrawal_requests: [],
      wallet_transactions: [],
      referral_programs: [],
      referral_attributions: [],
      referral_commission_ledger: [],
      referral_fraud_flags: [],
      referral_leaderboard_snapshots: [],
    };

    supabaseState.from.mockImplementation((table: string) => ({
      select: async () => ({ data: emptyTableRows[table] ?? [], error: null }),
    }));

    const report = await listAnalyticsReport(7);

    expect(report.retention.every((point) => point.value === 0)).toBe(true);
  });
});