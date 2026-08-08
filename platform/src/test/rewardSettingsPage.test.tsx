import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RewardSettingsPage } from '@/features/admin/pages/RewardSettingsPage';

const gamificationApiState = vi.hoisted(() => ({
  listGamificationConfig: vi.fn(),
}));

const walletApiState = vi.hoisted(() => ({
  listWalletSettings: vi.fn(),
}));

const promoState = vi.hoisted(() => ({
  adminDecidePromotionalReward: vi.fn(),
  buildPromotionalWheelSegments: vi.fn(),
  deleteSpinPrizeInventory: vi.fn(),
  getPromotionalSpinAnalytics: vi.fn(),
  listPromotionalRewardQueue: vi.fn(),
  listPromotionalSpinSettings: vi.fn(),
  listSpinCampaignsAdmin: vi.fn(),
  listSpinPrizeInventory: vi.fn(),
  reinstatePromotionalReward: vi.fn(),
  upsertSpinCampaignAdmin: vi.fn(),
  upsertSpinPrizeInventory: vi.fn(),
  updatePromotionalSpinSettings: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'admin-1' } }),
}));

vi.mock('@/services/api/gamification', () => ({
  listGamificationConfig: gamificationApiState.listGamificationConfig,
}));

vi.mock('@/services/api/wallet', () => ({
  listWalletSettings: walletApiState.listWalletSettings,
}));

vi.mock('@/services/api/promotionalRewards', () => ({
  adminDecidePromotionalReward: promoState.adminDecidePromotionalReward,
  buildPromotionalWheelSegments: promoState.buildPromotionalWheelSegments,
  deleteSpinPrizeInventory: promoState.deleteSpinPrizeInventory,
  getPromotionalSpinAnalytics: promoState.getPromotionalSpinAnalytics,
  listPromotionalRewardQueue: promoState.listPromotionalRewardQueue,
  listPromotionalSpinSettings: promoState.listPromotionalSpinSettings,
  listSpinCampaignsAdmin: promoState.listSpinCampaignsAdmin,
  listSpinPrizeInventory: promoState.listSpinPrizeInventory,
  reinstatePromotionalReward: promoState.reinstatePromotionalReward,
  upsertSpinCampaignAdmin: promoState.upsertSpinCampaignAdmin,
  upsertSpinPrizeInventory: promoState.upsertSpinPrizeInventory,
  updatePromotionalSpinSettings: promoState.updatePromotionalSpinSettings,
}));

describe('RewardSettingsPage', () => {
  beforeEach(() => {
    gamificationApiState.listGamificationConfig.mockReset();
    walletApiState.listWalletSettings.mockReset();

    promoState.adminDecidePromotionalReward.mockReset();
    promoState.buildPromotionalWheelSegments.mockReset();
    promoState.deleteSpinPrizeInventory.mockReset();
    promoState.getPromotionalSpinAnalytics.mockReset();
    promoState.listPromotionalRewardQueue.mockReset();
    promoState.listPromotionalSpinSettings.mockReset();
    promoState.listSpinCampaignsAdmin.mockReset();
    promoState.listSpinPrizeInventory.mockReset();
    promoState.reinstatePromotionalReward.mockReset();
    promoState.upsertSpinCampaignAdmin.mockReset();
    promoState.upsertSpinPrizeInventory.mockReset();
    promoState.updatePromotionalSpinSettings.mockReset();

    gamificationApiState.listGamificationConfig.mockResolvedValue({
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
      dailyTaskPlan: {
        mode: 'balanced',
        title: 'Daily quest',
        description: 'One meaningful action per day',
        rewardLabel: 'Daily quest reward',
        xpReward: 30,
        completionTarget: 1,
        cooldownHours: 24,
        maxDailyClaims: 1,
      },
      modules: {
        dailyLogin: { enabled: true, cadence: 'Daily', rewardLabel: 'Daily bonus', xpReward: 20, note: '' },
        streaks: { enabled: true, cadence: 'Rolling week', rewardLabel: 'Streak bonus', xpReward: 12, note: '' },
        achievements: { enabled: true, cadence: 'Event driven', rewardLabel: 'Milestone reward', xpReward: 80, note: '' },
        xpLevels: { enabled: true, cadence: 'Always on', rewardLabel: 'Progress XP', xpReward: 25, note: '' },
        leaderboards: { enabled: true, cadence: 'Weekly reset', rewardLabel: 'Ranking boost', xpReward: 30, note: '' },
        luckyWheel: { enabled: true, cadence: 'Daily spins', rewardLabel: 'Wheel spin', xpReward: 10, note: '' },
        mysteryRewards: { enabled: true, cadence: 'Triggered', rewardLabel: 'Mystery gift', xpReward: 45, note: '' },
        spinBonuses: { enabled: true, cadence: 'Triggered', rewardLabel: 'Bonus spin', xpReward: 18, note: '' },
        missions: { enabled: true, cadence: 'Weekly', rewardLabel: 'Mission reward', xpReward: 60, note: '' },
        seasonalEvents: { enabled: true, cadence: 'Seasonal', rewardLabel: 'Event prize', xpReward: 100, note: '' },
        dailyQuests: { enabled: true, cadence: 'Daily reset', rewardLabel: 'Quest reward', xpReward: 15, note: '' },
      },
    });

    walletApiState.listWalletSettings.mockResolvedValue({
      minWithdrawal: 25,
      maxWithdrawal: 5000,
      processingFeePercent: 1.5,
      currency: 'USD',
      internalTransfersEnabled: false,
      internalTransferUnlockPrice: 65,
      multiplierPremiumEnabled: false,
      approvalWorkflow: 'manual',
      exchangeRates: [{ currency: 'USD', rate: 1, label: 'US Dollar' }],
      supportedMethods: ['bank_transfer'],
      paidMembershipMinTier: 1,
      withdrawalHoldThreshold: 4,
      membershipFeeEnforcementStartWithdrawalCount: 2,
      blockWithoutFeeSettlement: true,
    });

    promoState.listPromotionalSpinSettings.mockResolvedValue({
      enabled: true,
      rolloutStage: 'production',
      cooldownMinutes: 20,
      triggerSurfaces: ['home'],
      showOncePerGuest: true,
      wheelSegmentLabels: ['$5', '$10', '$15', '$20', '$8', '$12', '$18', '$25', '$7', '$9', '$14', '$30'],
      enabledStages: ['internal', 'beta', 'production'],
      reopenLabel: 'Open reward wheel',
    });

    promoState.listSpinCampaignsAdmin.mockResolvedValue([]);
    promoState.listPromotionalRewardQueue.mockResolvedValue([]);
    promoState.getPromotionalSpinAnalytics.mockResolvedValue({
      rangeDays: 30,
      attempts: 0,
      wins: 0,
      winRate: 0,
      reservedRewards: 0,
      claimedRewards: 0,
      pendingRewards: 0,
      expiredRewards: 0,
      revokedRewards: 0,
      unlockConversionRate: 0,
      referralCompletionRate: 0,
      abuseSignals: 0,
      bySurface: [],
      daily: [],
    });

    promoState.buildPromotionalWheelSegments.mockReturnValue(
      Array.from({ length: 12 }, (_, index) => ({ label: `Prize ${index + 1}`, value: index + 1 })),
    );
  });

  it('renders live project-wide reward settings instead of static seeded module content', async () => {
    render(<RewardSettingsPage />);

    expect(await screen.findByText('Reward settings control plane')).toBeInTheDocument();
    expect(screen.getByText('Season of Momentum')).toBeInTheDocument();
    expect(screen.getByText('USD 25-5000')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('Rules enabled')).not.toBeInTheDocument();
  });
});
