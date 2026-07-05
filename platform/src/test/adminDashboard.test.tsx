import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { VideoManagementPage } from '@/features/admin/pages/VideoManagementPage';
import { defaultCustomizationConfig } from '@/lib/customization';

const authState = vi.hoisted(() => ({
  profile: { id: 'admin-1' } as { id: string } | null,
}));

const adminApiState = vi.hoisted(() => ({
  listAdminConsoleConfig: vi.fn(),
  listAdminModuleCatalog: vi.fn(),
}));

const dataApiState = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listSupportTickets: vi.fn(),
  listActivityLogs: vi.fn(),
  listWalletAccounts: vi.fn(),
  listWalletTransactions: vi.fn(),
  listGamificationConfig: vi.fn(),
  getReferralEngineSummary: vi.fn(),
  listCampaignTasks: vi.fn(),
}));

const campaignApiState = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  saveCampaign: vi.fn(),
  campaignToFormValues: vi.fn(),
}));

const analyticsApiState = vi.hoisted(() => ({
  listAnalyticsReport: vi.fn(),
}));

function getMetricCard(label: string): HTMLElement {
  const labelElement = screen.getByText(label);
  const container = labelElement.closest('div') ?? labelElement.parentElement;

  if (!container) {
    throw new Error(`Unable to find metric card for ${label}`);
  }

  return container;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/services/api/admin', () => ({
  listAdminConsoleConfig: adminApiState.listAdminConsoleConfig,
  listAdminModuleCatalog: adminApiState.listAdminModuleCatalog,
  updateAdminConsoleConfig: vi.fn(),
  updateAdminModuleCatalog: vi.fn(),
}));

vi.mock('@/services/api/auth', () => ({
  listUsers: dataApiState.listUsers,
  listActivityLogs: dataApiState.listActivityLogs,
}));

vi.mock('@/services/api/campaigns', () => ({
  listCampaigns: campaignApiState.listCampaigns,
  saveCampaign: campaignApiState.saveCampaign,
  campaignToFormValues: campaignApiState.campaignToFormValues,
}));

vi.mock('@/services/api/analytics', () => ({
  listAnalyticsReport: analyticsApiState.listAnalyticsReport,
}));

vi.mock('@/services/api/support', () => ({
  listSupportTickets: dataApiState.listSupportTickets,
}));

vi.mock('@/services/api/wallet', () => ({
  listWalletAccounts: dataApiState.listWalletAccounts,
  listWalletTransactions: dataApiState.listWalletTransactions,
}));

vi.mock('@/services/api/gamification', () => ({
  gamificationModules: [],
  listGamificationConfig: dataApiState.listGamificationConfig,
}));

vi.mock('@/services/api/referrals', () => ({
  getReferralEngineSummary: dataApiState.getReferralEngineSummary,
}));

vi.mock('@/services/api/tasks', () => ({
  listCampaignTasks: dataApiState.listCampaignTasks,
}));

describe('Admin enterprise routes', () => {
  beforeEach(() => {
    authState.profile = { id: 'admin-1' };

    adminApiState.listAdminConsoleConfig.mockResolvedValue({
      features: {},
      theme: {
        mode: 'auto',
        palette: 'deep-blue',
        fontFamily: 'Inter',
      },
      customization: defaultCustomizationConfig,
    });

    adminApiState.listAdminModuleCatalog.mockResolvedValue({
      'dashboard-analytics': {
        records: [
          {
            id: 'dashboard-analytics-1',
            name: 'Acquisition overview',
            category: 'Growth',
            status: 'Published',
            owner: 'Growth Ops',
            value: 'CTR 4.8%',
            updatedAt: '2026-07-04T10:00:00.000Z',
            risk: 'Medium',
            notes: 'Traffic trends and channel mix.',
          },
          {
            id: 'dashboard-analytics-2',
            name: 'Revenue snapshot',
            category: 'Finance',
            status: 'Published',
            owner: 'Finance',
            value: 'USD 84.2k',
            updatedAt: '2026-07-03T10:00:00.000Z',
            risk: 'High',
            notes: 'Revenue, fees, and margin rollups.',
          },
        ],
        activity: [
          {
            title: 'CSV export completed',
            description: 'Filtered dashboard rows were exported.',
            meta: 'Export trail',
          },
        ],
      },
      'ad-platform': {
        records: [],
        activity: [
          {
            title: 'Campaign optimization queued',
            description: 'Bid rules and audience splits were prepared for the next optimization cycle.',
            meta: 'Activity log',
          },
        ],
      },
    });

    dataApiState.listUsers.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }]);
    dataApiState.listSupportTickets.mockResolvedValue([{ id: 'ticket-1' }, { id: 'ticket-2' }, { id: 'ticket-3' }, { id: 'ticket-4' }]);
    dataApiState.listActivityLogs.mockResolvedValue([{ id: 'log-1' }]);
    dataApiState.listWalletAccounts.mockResolvedValue([{ id: 'wallet-1' }, { id: 'wallet-2' }]);
    dataApiState.listWalletTransactions.mockResolvedValue([{ id: 'tx-1' }, { id: 'tx-2' }, { id: 'tx-3' }, { id: 'tx-4' }, { id: 'tx-5' }]);
    dataApiState.listGamificationConfig.mockResolvedValue({
      seasonName: 'Season of Momentum',
      seasonTheme: 'Daily wins and long-term progression',
      seasonEndsOn: '2026-07-26',
      xpPerLevel: 250,
      dailyResetHour: 0,
      maxDailyWheelSpins: 3,
      dailyLoginBonus: 20,
      streakBonusPerDay: 8,
      spinBonusXp: 40,
      mysteryRewardPool: ['25 XP'],
      modules: {},
    });
    dataApiState.listCampaignTasks.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3' }]);
    dataApiState.getReferralEngineSummary.mockResolvedValue({
      programs: [{ id: 'program-1' }, { id: 'program-2' }],
      attributions: [{ id: 'attrib-1' }, { id: 'attrib-2' }, { id: 'attrib-3' }],
      fraudFlags: [{ id: 'flag-1' }],
      leaderboard: [],
    });

    campaignApiState.campaignToFormValues.mockImplementation((campaign: { status: string }) => ({
      status: campaign.status,
    }));
    campaignApiState.saveCampaign.mockImplementation(async (formValues: { status: string }, campaignId?: string) => {
      const campaigns = await campaignApiState.listCampaigns.mock.results[0]?.value;
      const currentCampaign = Array.isArray(campaigns) ? campaigns.find((campaign: { id: string }) => campaign.id === (campaignId ?? 'campaign-1')) ?? campaigns[0] : null;

      if (!currentCampaign) {
        throw new Error('missing campaign fixture');
      }

      return {
        ...currentCampaign,
        status: formValues.status,
        updatedAt: '2026-07-05T15:00:00.000Z',
      };
    });

    campaignApiState.listCampaigns.mockResolvedValue([
      {
        id: 'campaign-1',
        businessId: 'business-1',
        title: 'Homepage hero takeover',
        description: 'Premium homepage unit with country targeting.',
        bannerUrl: 'https://example.com/banner.png',
        campaignImageUrl: null,
        videoUrl: null,
        landingUrl: 'https://example.com',
        campaignType: 'click_advertisements',
        instructions: 'Launch the homepage banner.',
        engineConfig: {
          campaignType: 'click_advertisements',
          instructions: 'Launch the homepage banner.',
          campaignImageUrl: '',
          videoUrl: '',
          landingUrl: 'https://example.com',
          rewardAmount: 2,
          durationValue: 14,
          durationUnit: 'days',
          completionLimit: 100,
          dailyLimit: 20,
          countryRestrictions: ['US'],
          deviceRestrictions: ['desktop'],
          browserRestrictions: ['chrome'],
          ageRestrictionMin: 18,
          ageRestrictionMax: 44,
          verificationMethod: 'manual_review',
          autoApproval: false,
          manualApproval: true,
          budget: 5000,
          totalParticipants: 1000,
          campaignCategories: ['homepage'],
          targetAudience: {
            ageRange: '18-44',
            interests: ['finance', 'growth'],
            regions: ['North America'],
            languages: ['en'],
            tags: ['premium'],
            notes: 'Homepage targeting',
          },
          activeFrom: '2026-07-01T00:00:00.000Z',
          activeTo: '2026-07-31T00:00:00.000Z',
          priority: 1,
          requiredScreenshots: 0,
          requiredProof: '',
          verificationPolicy: {
            primaryMethod: 'manual_review',
            requiredEvidence: [],
            riskChecks: ['fraud_detection'],
            randomAuditRate: 0,
            fraudThreshold: 80,
            appealWindowHours: 72,
          },
          recurringConfig: {
            enabled: false,
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: [],
            timezone: 'UTC',
            endsAt: null,
          },
          timeDelayBeforeReward: 0,
          cooldownPeriod: 0,
        },
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
        recurringConfig: {
          enabled: false,
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [],
          timezone: 'UTC',
          endsAt: null,
        },
        currentParticipants: 120,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-04T12:00:00.000Z',
      },
      {
        id: 'campaign-2',
        businessId: 'business-1',
        title: 'Rewarded video campaign',
        description: 'Rewarded format tied to conversions.',
        bannerUrl: null,
        campaignImageUrl: null,
        videoUrl: 'https://example.com/video.mp4',
        landingUrl: 'https://example.com/video',
        campaignType: 'watch_videos',
        instructions: 'Launch the rewarded video campaign.',
        engineConfig: {
          campaignType: 'watch_videos',
          instructions: 'Launch the rewarded video campaign.',
          campaignImageUrl: '',
          videoUrl: 'https://example.com/video.mp4',
          landingUrl: 'https://example.com/video',
          rewardAmount: 1.8,
          durationValue: 7,
          durationUnit: 'days',
          completionLimit: 200,
          dailyLimit: 40,
          countryRestrictions: ['CA'],
          deviceRestrictions: ['mobile'],
          browserRestrictions: ['any'],
          ageRestrictionMin: 18,
          ageRestrictionMax: 35,
          verificationMethod: 'screenshot_upload',
          autoApproval: false,
          manualApproval: true,
          budget: 2500,
          totalParticipants: 600,
          campaignCategories: ['video'],
          targetAudience: {
            ageRange: '18-35',
            interests: ['video', 'mobile'],
            regions: ['Canada'],
            languages: ['en', 'fr'],
            tags: ['rewarded'],
            notes: 'Rewarded audience',
          },
          activeFrom: '2026-07-03T00:00:00.000Z',
          activeTo: '2026-07-10T00:00:00.000Z',
          priority: 2,
          requiredScreenshots: 1,
          requiredProof: '',
          verificationPolicy: {
            primaryMethod: 'screenshot_upload',
            requiredEvidence: ['screenshot_upload'],
            riskChecks: ['fraud_detection', 'bot_detection'],
            randomAuditRate: 5,
            fraudThreshold: 80,
            appealWindowHours: 72,
          },
          recurringConfig: {
            enabled: false,
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: [],
            timezone: 'UTC',
            endsAt: null,
          },
          timeDelayBeforeReward: 0,
          cooldownPeriod: 0,
        },
        status: 'scheduled',
        startDate: '2026-07-03T00:00:00.000Z',
        endDate: '2026-07-10T00:00:00.000Z',
        budget: 2500,
        budgetCurrency: 'USD',
        totalRewardsAllocated: 2500,
        maxParticipants: 600,
        ageRestrictionMin: 18,
        ageRestrictionMax: 35,
        campaignCategories: ['video'],
        recurringConfig: {
          enabled: false,
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [],
          timezone: 'UTC',
          endsAt: null,
        },
        currentParticipants: 84,
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-04T13:00:00.000Z',
      },
    ]);

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
        fraudSignals: [
          {
            ruleKey: 'proxy_detection',
            severity: 'medium',
            status: 'open',
            count: 1,
          },
        ],
      },
      geographicStatistics: [],
      deviceStatistics: [],
      browserStatistics: [],
      conversionFunnels: [
        { step: 'Signups', users: 100, conversionFromPrevious: 100 },
        { step: 'Active users', users: 80, conversionFromPrevious: 80 },
        { step: 'Task submissions', users: 40, conversionFromPrevious: 50 },
        { step: 'Approved submissions', users: 30, conversionFromPrevious: 75 },
        { step: 'Reward claims', users: 20, conversionFromPrevious: 66.67 },
      ],
    });
  });

  it('renders the admin landing route with live module snapshots', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Enterprise module index')).toBeInTheDocument();
    expect(await screen.findByText('Live platform metrics')).toBeInTheDocument();
    expect(within(getMetricCard('Users')).getByText('3')).toBeInTheDocument();
    expect(within(getMetricCard('Campaigns')).getByText('2')).toBeInTheDocument();
    expect(within(getMetricCard('Support tickets')).getByText('4')).toBeInTheDocument();
    expect(await screen.findByText('3 live records · 2 activity entries')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard Analytics/i })).toBeInTheDocument();
    expect(screen.getByText('2 records')).toBeInTheDocument();
    expect(screen.getByText('1 activity entries')).toBeInTheDocument();
  });

  it('renders the ad platform route as a dedicated module workspace', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/ad-platform']}>
        <Routes>
          <Route path="/admin/ad-platform" element={<VideoManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Ad Platform' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ad types' })).toBeInTheDocument();
    expect(await screen.findByText('Banner')).toBeInTheDocument();
    expect(screen.getByText('Campaign detail drawer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review analytics' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create campaign' })).toHaveAttribute('href', '/business/campaigns/new');
    expect(screen.getByRole('link', { name: 'Edit selected campaign' })).toHaveAttribute('href', '/business/campaigns/campaign-1/edit');
  });

  it('shows reporting filters and moderation controls', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/ad-platform']}>
        <Routes>
          <Route path="/admin/ad-platform" element={<VideoManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Review analytics' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Review analytics' }).click();

    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument();
    expect(screen.getByLabelText('Campaign filter')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Inspect fraud controls' }).click();
    expect(screen.getByText('Approval and moderation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Pause' }).click();

    expect(campaignApiState.saveCampaign).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }), 'campaign-1');
  });

  it('shows a loading shell while the live campaign sources are pending', () => {
    const campaignsDeferred = createDeferred<typeof campaignApiState.listCampaigns>();
    const analyticsDeferred = createDeferred<typeof analyticsApiState.listAnalyticsReport>();

    campaignApiState.listCampaigns.mockReturnValue(campaignsDeferred.promise);
    analyticsApiState.listAnalyticsReport.mockReturnValue(analyticsDeferred.promise);

    render(
      <MemoryRouter initialEntries={['/admin/ad-platform']}>
        <Routes>
          <Route path="/admin/ad-platform" element={<VideoManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading live campaign sources...')).toBeInTheDocument();
    expect(screen.getByText('Syncing live campaign sources')).toBeInTheDocument();
    expect(screen.getByText('Loading creative inventory')).toBeInTheDocument();
  });

  it('falls back to the local workspace shell when live sources fail', async () => {
    campaignApiState.listCampaigns.mockRejectedValueOnce(new Error('campaign feed offline'));
    analyticsApiState.listAnalyticsReport.mockRejectedValueOnce(new Error('analytics feed offline'));

    render(
      <MemoryRouter initialEntries={['/admin/ad-platform']}>
        <Routes>
          <Route path="/admin/ad-platform" element={<VideoManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Supabase feed unavailable')).toBeInTheDocument();
    expect(screen.getByText('Live campaign data unavailable')).toBeInTheDocument();
  });
});