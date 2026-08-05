import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessDashboardPage } from '@/features/admin/pages/BusinessDashboardPage';
import { MerchantDashboardPage } from '@/features/dashboard/pages/MerchantDashboardPage';

const authState = vi.hoisted(() => ({
  profile: { id: 'user-1' } as { id: string } | null,
}));

const campaignsState = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  saveCampaign: vi.fn(),
  transitionCampaignStatus: vi.fn(),
  campaignToFormValues: vi.fn(),
}));

const merchantState = vi.hoisted(() => ({
  getMerchantProfileByUserId: vi.fn(),
  listMerchantAnalytics: vi.fn(),
  getMerchantWalletAccounts: vi.fn(),
  listMerchantAssignedOrders: vi.fn(),
  listMerchantWithdrawalAssignments: vi.fn(),
  merchantMarkWithdrawalPayoutSent: vi.fn(),
  merchantRespondWithdrawalAssignment: vi.fn(),
  transitionP2POrderState: vi.fn(),
  openP2PDispute: vi.fn(),
  listP2PRuntimeSettings: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/services/api/campaigns', () => ({
  listCampaigns: campaignsState.listCampaigns,
  saveCampaign: campaignsState.saveCampaign,
  transitionCampaignStatus: campaignsState.transitionCampaignStatus,
  campaignToFormValues: campaignsState.campaignToFormValues,
}));

vi.mock('@/services/api/fraud', () => ({
  defaultFraudThresholds: { block: 80 },
  fraudRiskChecks: ['fraud_detection', 'bot_detection'],
  describeFraudRiskChecks: (checks: string[]) => checks.map((check) => check.replace(/_/g, ' ')),
}));

vi.mock('@/services/api/communications', () => ({
  sendAdminPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/api/p2pMerchant', () => ({
  getMerchantProfileByUserId: merchantState.getMerchantProfileByUserId,
  listMerchantAnalytics: merchantState.listMerchantAnalytics,
  getMerchantWalletAccounts: merchantState.getMerchantWalletAccounts,
  listMerchantAssignedOrders: merchantState.listMerchantAssignedOrders,
}));

vi.mock('@/services/api/withdrawalOperations', () => ({
  listMerchantWithdrawalAssignments: merchantState.listMerchantWithdrawalAssignments,
  merchantMarkWithdrawalPayoutSent: merchantState.merchantMarkWithdrawalPayoutSent,
  merchantRespondWithdrawalAssignment: merchantState.merchantRespondWithdrawalAssignment,
}));

vi.mock('@/services/api/p2pEscrow', () => ({
  transitionP2POrderState: merchantState.transitionP2POrderState,
}));

vi.mock('@/services/api/p2pDisputes', () => ({
  openP2PDispute: merchantState.openP2PDispute,
}));

vi.mock('@/services/api/p2pAdmin', () => ({
  listP2PRuntimeSettings: merchantState.listP2PRuntimeSettings,
}));

function renderBusinessDashboard(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BusinessDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderMerchantDashboard(): void {
  render(
    <MemoryRouter>
      <MerchantDashboardPage />
    </MemoryRouter>,
  );
}

function buildCampaign(index: number) {
  const id = `campaign-${index}`;
  const status = index % 2 === 0 ? 'active' : 'paused';

  return {
    id,
    businessId: 'business-1',
    title: `Campaign ${index}`,
    description: `Campaign description ${index}`,
    bannerUrl: null,
    campaignImageUrl: null,
    videoUrl: null,
    landingUrl: 'https://example.com',
    campaignType: 'click_advertisements',
    instructions: `Instructions ${index}`,
    engineConfig: {
      campaignType: 'click_advertisements',
      instructions: `Instructions ${index}`,
      campaignImageUrl: '',
      videoUrl: '',
      landingUrl: 'https://example.com',
      rewardAmount: 2,
      durationValue: 14,
      durationUnit: 'days',
      completionLimit: 200,
      dailyLimit: 20,
      countryRestrictions: ['US'],
      deviceRestrictions: ['any'],
      browserRestrictions: ['any'],
      ageRestrictionMin: 18,
      ageRestrictionMax: 55,
      verificationMethod: 'manual_review',
      autoApproval: false,
      manualApproval: true,
      budget: 1000 + index * 100,
      totalParticipants: 1000,
      campaignCategories: ['growth'],
      targetAudience: {
        ageRange: '18-55',
        interests: ['growth'],
        regions: ['North America'],
        languages: ['en'],
        tags: ['high-intent'],
        notes: 'Test audience',
      },
      activeFrom: '2026-07-01T00:00:00.000Z',
      activeTo: '2026-08-01T00:00:00.000Z',
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
    status,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-08-01T00:00:00.000Z',
    budget: 1000 + index * 100,
    budgetCurrency: 'USD',
    totalRewardsAllocated: 600,
    maxParticipants: 1200,
    ageRestrictionMin: 18,
    ageRestrictionMax: 55,
    campaignCategories: ['growth'],
    recurringConfig: {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      timezone: 'UTC',
      endsAt: null,
    },
    currentParticipants: 100 + index,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  };
}

describe('Phase 18 dashboard behavior', () => {
  beforeEach(() => {
    authState.profile = { id: 'user-1' };

    campaignsState.listCampaigns.mockResolvedValue(Array.from({ length: 10 }, (_, index) => buildCampaign(index + 1)));
    campaignsState.saveCampaign.mockResolvedValue(buildCampaign(1));
    campaignsState.transitionCampaignStatus.mockImplementation(async (campaign: unknown) => campaign);
    campaignsState.campaignToFormValues.mockReturnValue({ status: 'active', budget: 1000, title: 'Campaign 1' });

    merchantState.getMerchantProfileByUserId.mockResolvedValue({
      id: 'merchant-1',
      merchantCode: 'MRC-1001',
      status: 'active',
      countryCode: 'US',
      riskScore: 12,
      ratingScore: 4.7,
      completionRate: 98,
      preferredCurrency: 'USD',
    });

    merchantState.getMerchantWalletAccounts.mockResolvedValue([
      { walletType: 'available', availableBalance: 20000 },
      { walletType: 'reserved', reservedBalance: 5000 },
      { walletType: 'pending', pendingBalance: 1200 },
      { walletType: 'locked', lockedBalance: 300 },
    ]);

    merchantState.listMerchantAssignedOrders.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        id: `order-${index + 1}`,
        orderCode: `ORD-${index + 1}`,
        totalAmount: 100 + index,
        currency: 'USD',
        currentState: 'merchant_assigned',
        updatedAt: '2026-08-05T08:00:00.000Z',
      })),
    );

    merchantState.listMerchantWithdrawalAssignments.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        assignmentId: `assignment-${index + 1}`,
        userDisplayName: `User ${index + 1}`,
        userEmail: `user${index + 1}@example.com`,
        userId: `user-${index + 1}`,
        netAmount: 75 + index,
        amount: 80 + index,
        currency: 'USD',
        destinationLabel: 'Bank',
        destinationValue: `Account ${index + 1}`,
        workflowStateKey: 'merchant_acknowledged',
        assignmentStatus: 'accepted',
        dueAt: '2026-08-06T10:00:00.000Z',
      })),
    );

    merchantState.listMerchantAnalytics.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        id: `analytics-${index + 1}`,
        reportDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
        assignedOrders: 10 + index,
        completedOrders: 9 + index,
        disputedOrders: 1,
        averageResponseSeconds: 45.2,
        completionRate: 97.5,
        earningsTotal: 300 + index * 10,
      })),
    );

    merchantState.listP2PRuntimeSettings.mockResolvedValue({
      p2p_min_operating_balance: 500,
    });

    merchantState.merchantMarkWithdrawalPayoutSent.mockResolvedValue(undefined);
    merchantState.merchantRespondWithdrawalAssignment.mockResolvedValue({ reassignedAssignmentId: null });
    merchantState.transitionP2POrderState.mockResolvedValue(undefined);
    merchantState.openP2PDispute.mockResolvedValue(undefined);
  });

  it('collapses and expands business dashboard sections', async () => {
    const user = userEvent.setup();
    renderBusinessDashboard();

    expect(await screen.findByText('Jump to sections')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide portfolio performance' }));
    const portfolioSection = document.querySelector('#portfolio-performance');
    expect(portfolioSection).toHaveClass('hidden');

    await user.click(screen.getByRole('button', { name: 'Show activity diagnostics' }));
    const diagnosticsSection = document.querySelector('#activity-diagnostics');
    expect(diagnosticsSection).not.toHaveClass('hidden');
  }, 15000);

  it('reveals additional merchant assignments and supports collapsing analytics section', async () => {
    const user = userEvent.setup();
    renderMerchantDashboard();

    expect(await screen.findByText('User 1')).toBeInTheDocument();
    expect(screen.queryByText('User 13')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show more assignments' }));
    expect(await screen.findByText('User 13')).toBeInTheDocument();

    const analyticsSection = document.querySelector('#merchant-analytics');
    expect(analyticsSection).toHaveClass('hidden');

    await user.click(screen.getByRole('button', { name: 'Show analytics snapshots' }));
    expect(analyticsSection).not.toHaveClass('hidden');
  }, 15000);
});
