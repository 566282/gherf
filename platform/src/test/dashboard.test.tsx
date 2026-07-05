import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import type { UserProfile } from '@/types/auth';

const authState = vi.hoisted(() => ({
  profile: null as UserProfile | null,
}));

const apiState = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  listRewardLedger: vi.fn(),
  listWalletActivity: vi.fn(),
  listWalletTransactions: vi.fn(),
  listWithdrawalRequests: vi.fn(),
  listSupportTickets: vi.fn(),
  listGamificationConfig: vi.fn(),
}));

const baseProfile: UserProfile = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  role: 'registered_user',
  status: 'active',
  isActive: true,
  isEmailVerified: true,
  twoFactorEnabled: false,
  referralCode: 'TEST123',
  referredByCode: null,
  walletBalance: 120,
  rewardBalance: 35,
  rewardHistoryCount: 4,
  unreadNotificationsCount: 2,
  reputationScore: 128,
  levelLabel: 'Starter',
  levelTier: 1,
  badges: ['Rising Star'],
  lastLoginAt: '2026-07-05T09:00:00.000Z',
};

const gamificationConfig = {
  seasonName: 'Season of Momentum',
  seasonTheme: 'Daily wins and long-term progression',
  seasonEndsOn: '2026-07-26',
  xpPerLevel: 250,
  dailyResetHour: 0,
  maxDailyWheelSpins: 3,
  dailyLoginBonus: 20,
  streakBonusPerDay: 8,
  spinBonusXp: 40,
  mysteryRewardPool: ['25 XP', '1 wheel spin'],
  modules: {
    dailyLogin: { enabled: true, cadence: 'Daily', rewardLabel: 'Daily bonus', xpReward: 20, note: 'Daily login is active.' },
    streaks: { enabled: true, cadence: 'Weekly', rewardLabel: 'Streak bonus', xpReward: 12, note: 'Streaks are active.' },
    achievements: { enabled: true, cadence: 'Event driven', rewardLabel: 'Milestone reward', xpReward: 80, note: 'Achievements are active.' },
    xpLevels: { enabled: true, cadence: 'Always on', rewardLabel: 'Progress XP', xpReward: 25, note: 'XP levels are active.' },
    leaderboards: { enabled: true, cadence: 'Weekly reset', rewardLabel: 'Ranking boost', xpReward: 30, note: 'Leaderboards are active.' },
    luckyWheel: { enabled: true, cadence: 'Daily spins', rewardLabel: 'Wheel spin', xpReward: 10, note: 'Lucky wheel is active.' },
    mysteryRewards: { enabled: true, cadence: 'Triggered', rewardLabel: 'Mystery gift', xpReward: 45, note: 'Mystery rewards are active.' },
    spinBonuses: { enabled: true, cadence: 'Triggered', rewardLabel: 'Bonus spin', xpReward: 18, note: 'Spin bonuses are active.' },
    missions: { enabled: true, cadence: 'Weekly', rewardLabel: 'Mission reward', xpReward: 60, note: 'Missions are active.' },
    seasonalEvents: { enabled: true, cadence: 'Seasonal', rewardLabel: 'Event prize', xpReward: 100, note: 'Seasonal events are active.' },
    dailyQuests: { enabled: true, cadence: 'Daily reset', rewardLabel: 'Quest reward', xpReward: 15, note: 'Daily quests are active.' },
  },
} as const;

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/services/api/auth', () => ({
  listNotifications: apiState.listNotifications,
  listRewardLedger: apiState.listRewardLedger,
  listWalletActivity: apiState.listWalletActivity,
}));

vi.mock('@/services/api/gamification', () => ({
  listGamificationConfig: apiState.listGamificationConfig,
}));

vi.mock('@/services/api/support', () => ({
  listSupportTickets: apiState.listSupportTickets,
}));

vi.mock('@/services/api/wallet', () => ({
  listWalletTransactions: apiState.listWalletTransactions,
  listWithdrawalRequests: apiState.listWithdrawalRequests,
}));

function renderDashboard(): void {
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
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    authState.profile = baseProfile;

    apiState.listGamificationConfig.mockResolvedValue(gamificationConfig);
    apiState.listNotifications.mockResolvedValue([
      { id: 'note-1', title: 'Reward approved', message: 'Your latest reward cleared successfully.', type: 'success', isRead: false, createdAt: '2026-07-05T10:00:00.000Z' },
      { id: 'note-2', title: 'New campaign available', message: 'A fresh earning campaign is live.', type: 'info', isRead: true, createdAt: '2026-07-05T09:30:00.000Z' },
    ]);
    apiState.listRewardLedger.mockResolvedValue([
      { id: 'reward-1', amount: 12, currency: 'USD', status: 'claimed', action: 'claimed', reason: 'Campaign reward', createdAt: '2026-07-05T08:00:00.000Z' },
      { id: 'reward-2', amount: 8, currency: 'USD', status: 'approved', action: 'approved', reason: 'Referral bonus', createdAt: '2026-07-04T18:00:00.000Z' },
      { id: 'reward-3', amount: 4, currency: 'USD', status: 'pending', action: 'issued', reason: 'Task reward', createdAt: '2026-07-04T12:00:00.000Z' },
      { id: 'reward-4', amount: 6, currency: 'USD', status: 'claimed', action: 'claimed', reason: 'Daily bonus', createdAt: '2026-07-03T12:00:00.000Z' },
    ]);
    apiState.listWalletActivity.mockResolvedValue([
      { id: 'activity-1', amount: 10, balanceAfter: 130, note: 'Campaign reward', createdAt: '2026-07-05T08:05:00.000Z' },
      { id: 'activity-2', amount: -5, balanceAfter: 125, note: 'Withdrawal fee', createdAt: '2026-07-05T08:10:00.000Z' },
      { id: 'activity-3', amount: 14, balanceAfter: 139, note: 'Referral commission', createdAt: '2026-07-04T20:00:00.000Z' },
      { id: 'activity-4', amount: 9, balanceAfter: 148, note: 'Reward adjustment', createdAt: '2026-07-03T20:00:00.000Z' },
    ]);
    apiState.listWalletTransactions.mockResolvedValue([
      { id: 'tx-1', amount: 10, transactionType: 'campaign_reward', createdAt: '2026-07-05T08:05:00.000Z' },
      { id: 'tx-2', amount: 14, transactionType: 'referral_commission', createdAt: '2026-07-04T20:00:00.000Z' },
      { id: 'tx-3', amount: 6, transactionType: 'campaign_reward', createdAt: '2026-07-03T20:00:00.000Z' },
    ]);
    apiState.listWithdrawalRequests.mockResolvedValue([
      { id: 'withdrawal-1', amount: 50, method: 'bank_transfer', status: 'pending', createdAt: '2026-07-04T15:00:00.000Z' },
      { id: 'withdrawal-2', amount: 25, method: 'paypal', status: 'processing', createdAt: '2026-07-03T15:00:00.000Z' },
    ]);
    apiState.listSupportTickets.mockResolvedValue([
      { id: 'ticket-1', subject: 'Payout question', category: 'billing', priority: 'medium', status: 'open', updatedAt: '2026-07-05T11:00:00.000Z' },
    ]);
  });

  it('renders the dashboard summaries and controls', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByText('Season of Momentum')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard active')).toBeInTheDocument();
    expect(screen.getByText('Reward approved')).toBeInTheDocument();
    expect(screen.getByText('New campaign available')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Find an activity')).toBeInTheDocument();
    expect(screen.getByText('Open profile notifications →')).toBeInTheDocument();
  });

  it('shows empty states when the user has no dashboard records yet', async () => {
    apiState.listNotifications.mockResolvedValue([]);
    apiState.listRewardLedger.mockResolvedValue([]);
    apiState.listWalletActivity.mockResolvedValue([]);
    apiState.listWalletTransactions.mockResolvedValue([]);
    apiState.listWithdrawalRequests.mockResolvedValue([]);
    apiState.listSupportTickets.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
    expect(screen.getByText('No campaign history yet.')).toBeInTheDocument();
    expect(screen.getByText('No withdrawal requests yet.')).toBeInTheDocument();
    expect(screen.getByText('No support tickets yet.')).toBeInTheDocument();
    expect(screen.getByText('No activity yet. Complete a task or earn a reward to populate this feed.')).toBeInTheDocument();
  });
});