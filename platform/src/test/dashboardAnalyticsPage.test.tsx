import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardAnalyticsPage } from '@/features/admin/pages/DashboardAnalyticsPage';

const analyticsApiState = vi.hoisted(() => ({
  listAnalyticsReport: vi.fn(),
}));

vi.mock('@/services/api/analytics', () => ({
  listAnalyticsReport: analyticsApiState.listAnalyticsReport,
}));

describe('DashboardAnalyticsPage', () => {
  beforeEach(() => {
    analyticsApiState.listAnalyticsReport.mockReset();
  });

  it('renders live analytics data instead of hardcoded module placeholders', async () => {
    analyticsApiState.listAnalyticsReport.mockResolvedValue({
      generatedAt: '2026-07-05T12:00:00.000Z',
      rangeDays: 30,
      kpis: {
        totalUsers: 3,
        activeUsers: 2,
        totalRevenue: 84200,
        activeCampaigns: 2,
        rewardsIssued: 12,
        withdrawalsVolume: 1800,
      },
      userGrowth: [],
      activeUsers: [],
      revenue: [],
      taskCompletion: [],
      retention: [],
      campaignPerformance: [
        {
          campaignId: 'campaign-1',
          campaignTitle: 'Homepage hero takeover',
          participants: 120,
          submissions: 18,
          approvalRate: 88.5,
          rewardsIssued: 14,
          spend: 5000,
        },
      ],
      rewardDistribution: [],
      withdrawalStatistics: {
        totalRequests: 1,
        totalVolume: 1800,
        approvedRate: 100,
        byStatus: [],
        byMethod: [],
      },
      referralPerformance: {
        referredUsers: 0,
        qualifiedReferrals: 0,
        referralCommissions: 0,
        referralsByDay: [],
        activePrograms: 0,
        fraudFlags: 1,
        programsByActivity: [],
        leaderboard: [],
        fraudSignals: [],
      },
      geographicStatistics: [],
      deviceStatistics: [],
      browserStatistics: [],
      conversionFunnels: [],
    });

    render(<DashboardAnalyticsPage />);

    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('$84,200')).toBeInTheDocument();
    expect(screen.getByText('Homepage hero takeover')).toBeInTheDocument();
    expect(screen.getByText('Live metrics from Supabase-backed analytics tables.')).toBeInTheDocument();
  });
});
