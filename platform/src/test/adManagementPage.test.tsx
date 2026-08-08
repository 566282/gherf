import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdManagementPage } from '@/features/admin/pages/AdManagementPage';

const campaignApiState = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
}));

const analyticsApiState = vi.hoisted(() => ({
  listAnalyticsReport: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'admin-1' } }),
}));

vi.mock('@/services/api/campaigns', () => ({
  listCampaigns: campaignApiState.listCampaigns,
}));

vi.mock('@/services/api/analytics', () => ({
  listAnalyticsReport: analyticsApiState.listAnalyticsReport,
}));

vi.mock('@/services/api/admin', () => ({
  listAdminModuleCatalog: vi.fn().mockResolvedValue({}),
  updateAdminModuleCatalog: vi.fn().mockResolvedValue(undefined),
}));

describe('AdManagementPage', () => {
  beforeEach(() => {
    campaignApiState.listCampaigns.mockReset();
    analyticsApiState.listAnalyticsReport.mockReset();
  });

  it('renders live campaigns and analytics instead of seeded module placeholders', async () => {
    campaignApiState.listCampaigns.mockResolvedValue([
      {
        id: 'campaign-1',
        businessId: 'business-1',
        title: 'Homepage hero takeover',
        description: 'Premium homepage unit',
        bannerUrl: null,
        campaignImageUrl: null,
        videoUrl: null,
        landingUrl: 'https://example.com',
        campaignType: 'click_advertisements',
        instructions: 'Launch the homepage banner',
        engineConfig: {},
        status: 'active',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        budget: 5000,
        budgetCurrency: 'USD',
        totalRewardsAllocated: 5000,
        maxParticipants: 1000,
        ageRestrictionMin: 18,
        ageRestrictionMax: 44,
        campaignCategories: ['homepage'],
        recurringConfig: { enabled: false, frequency: 'weekly', interval: 1, daysOfWeek: [], timezone: 'UTC', endsAt: null },
        currentParticipants: 120,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-04T12:00:00.000Z',
      },
    ]);

    analyticsApiState.listAnalyticsReport.mockResolvedValue({
      generatedAt: '2026-07-05T12:00:00.000Z',
      rangeDays: 30,
      kpis: {
        totalUsers: 3,
        activeUsers: 2,
        totalRevenue: 84200,
        activeCampaigns: 1,
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

    render(
      <MemoryRouter>
        <AdManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Homepage hero takeover')).toBeInTheDocument();
    expect(screen.getByText('Live ad operations')).toBeInTheDocument();
  });
});
