import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsReportingPage } from '@/features/admin/pages/AnalyticsReportingPage';

const analyticsApiState = vi.hoisted(() => ({
  listAnalyticsReport: vi.fn(),
}));

vi.mock('@/services/api/analytics', () => ({
  listAnalyticsReport: analyticsApiState.listAnalyticsReport,
}));

vi.mock('@/services/export/reportExport', () => ({
  exportAnalyticsReport: vi.fn(),
}));

function buildReport() {
  return {
    generatedAt: '2026-07-05T12:00:00.000Z',
    rangeDays: 30,
    kpis: {
      totalUsers: 125,
      activeUsers: 52,
      totalRevenue: 8420,
      activeCampaigns: 8,
      rewardsIssued: 41,
      withdrawalsVolume: 1240,
    },
    userGrowth: [{ label: '2026-07-05', value: 9 }],
    activeUsers: [{ label: '2026-07-05', value: 6 }],
    revenue: [{ label: '2026-07-05', value: 240 }],
    taskCompletion: [{ label: '2026-07-05', value: 71.43 }],
    retention: [{ label: '2026-07-05', value: 64.29 }],
    campaignPerformance: [],
    rewardDistribution: [],
    withdrawalStatistics: { totalRequests: 0, totalVolume: 0, approvedRate: 0, byStatus: [], byMethod: [] },
    referralPerformance: {
      referredUsers: 0,
      qualifiedReferrals: 0,
      referralCommissions: 0,
      referralsByDay: [],
      activePrograms: 0,
      fraudFlags: 0,
      programsByActivity: [],
      leaderboard: [],
      fraudSignals: [],
    },
    geographicStatistics: [],
    deviceStatistics: [],
    browserStatistics: [],
    conversionFunnels: [],
  };
}

describe('AnalyticsReportingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    analyticsApiState.listAnalyticsReport.mockResolvedValue(buildReport());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the enterprise analytics overview and refreshes from Supabase on an interval', async () => {
    render(<AnalyticsReportingPage />);

    expect(await screen.findByText('Enterprise analytics')).toBeInTheDocument();
    expect(screen.getByText('Live dashboard')).toBeInTheDocument();
    expect(screen.getByText('Connected to Supabase and refreshed from production-backed analytics tables.')).toBeInTheDocument();

    await waitFor(() => expect(analyticsApiState.listAnalyticsReport).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60000);
    });

    await waitFor(() => expect(analyticsApiState.listAnalyticsReport).toHaveBeenCalledTimes(2));
  });
});