import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/app/providers/AuthProvider';
import { listNotifications, listRewardLedger, listWalletActivity } from '@/services/api/auth';
import { listGamificationConfig, type GamificationConfig } from '@/services/api/gamification';
import { listSupportTickets } from '@/services/api/support';
import { listWalletTransactions, listWithdrawalRequests } from '@/services/api/wallet';
import type { NotificationItem, RewardLedgerItem, WalletActivity } from '@/types/auth';
import type { SupportTicket, WalletTransaction, WithdrawalRequest } from '@/types';

interface DashboardMetrics {
  currentEarnings: number;
  pendingRewards: number;
  completedTasks: number;
  walletBalance: number;
  recentActivity: Array<{ id: string; title: string; amount: number; time: string; type: 'earn' | 'task' | 'referral' }>;
  recentNotifications: Array<{ id: string; title: string; message: string; type: NotificationItem['type']; isRead: boolean; createdAt: string }>;
  referralCount: number;
  referralEarnings: number;
  notificationCount: number;
  dailyGoalProgress: number;
  campaignRecommendations: Array<{ id: string; title: string; reward: number; type: string }>;
  achievementProgress: Array<{ title: string; current: number; total: number }>;
  campaignHistory: Array<{ id: string; title: string; reward: number; status: 'completed' | 'processing' | 'failed'; completedAt: string }>;
  withdrawalRequests: Array<{ id: string; amount: number; method: string; status: 'pending' | 'processing' | 'completed' | 'rejected'; createdAt: string }>;
  supportTickets: Array<{ id: string; subject: string; category: string; priority: string; status: SupportTicket['status']; updatedAt: string }>;
  leaderboardSnapshot: {
    seasonName: string;
    seasonTheme: string;
    seasonEndsOn: string;
    activeModules: number;
    totalModules: number;
    leaderboardsEnabled: boolean;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTimeAgo(time: string): string {
  const date = new Date(time);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function mapRecentActivity(walletActivity: WalletActivity[], rewardLedger: RewardLedgerItem[]): DashboardMetrics['recentActivity'] {
  const activity = walletActivity.slice(0, 4).map((item) => ({
    id: item.id,
    title: item.note ?? 'Wallet update',
    amount: Math.abs(item.amount),
    time: item.createdAt,
    type: item.amount >= 0 ? 'earn' : 'task',
  }));

  if (activity.length >= 4) {
    return activity;
  }

  const rewardActivity = rewardLedger.slice(0, 4 - activity.length).map((item) => ({
    id: item.id,
    title: item.reason ?? `Reward ${item.action}`,
    amount: item.amount,
    time: item.createdAt,
    type: 'referral' as const,
  }));

  return [...activity, ...rewardActivity];
}

function mapRecentNotifications(notifications: NotificationItem[]): DashboardMetrics['recentNotifications'] {
  return notifications.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    type: item.type,
    isRead: item.isRead,
    createdAt: item.createdAt,
  }));
}

function mapCampaignHistory(rewardLedger: RewardLedgerItem[]): DashboardMetrics['campaignHistory'] {
  return rewardLedger.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.reason ?? `Reward ${item.action}`,
    reward: item.amount,
    status: item.status === 'claimed' || item.status === 'approved' ? 'completed' : item.status === 'pending' ? 'processing' : 'failed',
    completedAt: item.createdAt,
  }));
}

function mapWithdrawalRequests(withdrawals: WithdrawalRequest[]): DashboardMetrics['withdrawalRequests'] {
  return withdrawals.slice(0, 6).map((item) => ({
    id: item.id,
    amount: item.amount,
    method: item.method.replace(/_/g, ' '),
    status: item.status === 'approved' || item.status === 'paid' ? 'completed' : item.status === 'processing' ? 'processing' : item.status === 'rejected' ? 'rejected' : 'pending',
    createdAt: item.createdAt,
  }));
}

function mapSupportTickets(tickets: SupportTicket[]): DashboardMetrics['supportTickets'] {
  return tickets.slice(0, 4).map((item) => ({
    id: item.id,
    subject: item.subject,
    category: item.category,
    priority: item.priority,
    status: item.status,
    updatedAt: item.updatedAt,
  }));
}

function mapDashboardData(
  walletTransactions: WalletTransaction[],
  withdrawalRequests: WithdrawalRequest[],
  rewardLedger: RewardLedgerItem[],
  walletActivity: WalletActivity[],
  notifications: NotificationItem[],
  supportTickets: SupportTicket[],
  gamificationConfig: GamificationConfig,
  profileBalance: { walletBalance: number; rewardBalance: number; unreadNotificationsCount: number; referralCode?: string; rewardHistoryCount?: number },
): DashboardMetrics {
  const pendingRewards = rewardLedger.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
  const completedTasks = rewardLedger.filter((item) => item.status === 'approved' || item.status === 'claimed').length;
  const referralEarnings = walletTransactions
    .filter((transaction) => transaction.transactionType === 'referral_commission')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const earnings = walletTransactions.reduce((sum, transaction) => {
    if (transaction.amount > 0) return sum + transaction.amount;
    return sum;
  }, 0);

  return {
    currentEarnings: earnings,
    pendingRewards,
    completedTasks,
    walletBalance: profileBalance.walletBalance,
    recentActivity: mapRecentActivity(walletActivity, rewardLedger),
    recentNotifications: mapRecentNotifications(notifications),
    referralCount: profileBalance.rewardHistoryCount ?? 0,
    referralEarnings,
    notificationCount: profileBalance.unreadNotificationsCount,
    dailyGoalProgress: Math.min(100, Math.max(0, completedTasks * 4)),
    campaignRecommendations: [
      { id: 'wallet-recent', title: 'Recent wallet activity', reward: Math.max(1, Math.round(earnings || 1)), type: 'live_supabase_data' },
      { id: 'wallet-withdrawals', title: 'Withdrawal review', reward: Math.max(1, Math.round(withdrawalRequests.length || 1)), type: 'live_supabase_data' },
      { id: 'wallet-ledger', title: 'Reward ledger', reward: Math.max(1, Math.round(rewardLedger.length || 1)), type: 'live_supabase_data' },
    ],
    achievementProgress: [
      { title: 'Wallet updates', current: walletActivity.length, total: 30 },
      { title: 'Reward entries', current: rewardLedger.length, total: 50 },
      { title: 'Notifications', current: notifications.length, total: 25 },
    ],
    campaignHistory: mapCampaignHistory(rewardLedger),
    withdrawalRequests: mapWithdrawalRequests(withdrawalRequests),
    supportTickets: mapSupportTickets(supportTickets),
    leaderboardSnapshot: {
      seasonName: gamificationConfig.seasonName,
      seasonTheme: gamificationConfig.seasonTheme,
      seasonEndsOn: gamificationConfig.seasonEndsOn,
      activeModules: Object.values(gamificationConfig.modules).filter((module) => module.enabled).length,
      totalModules: Object.keys(gamificationConfig.modules).length,
      leaderboardsEnabled: Boolean(gamificationConfig.modules.leaderboards?.enabled),
    },
  };
}

function formatRelativeTime(time: string): string {
  const date = new Date(time);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function DashboardPage(): JSX.Element {
  const { profile } = useAuth();
  const { data: dashboardData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['user-dashboard', profile?.id],
    queryFn: async () => {
      if (!profile) {
        throw new Error('Profile unavailable');
      }

      const [notifications, rewardLedger, walletActivity, walletTransactions, withdrawalRequests, supportTickets, gamificationConfig] = await Promise.all([
        listNotifications(profile.id),
        listRewardLedger(profile.id),
        listWalletActivity(profile.id),
        listWalletTransactions(profile.id, 20),
        listWithdrawalRequests(profile.id, 12),
        listSupportTickets(profile.id, 8),
        listGamificationConfig(),
      ]);

      return mapDashboardData(walletTransactions, withdrawalRequests, rewardLedger, walletActivity, notifications, supportTickets, gamificationConfig, {
        walletBalance: profile.walletBalance,
        rewardBalance: profile.rewardBalance,
        unreadNotificationsCount: profile.unreadNotificationsCount,
        referralCode: profile.referralCode,
        rewardHistoryCount: profile.rewardHistoryCount,
      });
    },
    enabled: Boolean(profile),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const [activityFilter, setActivityFilter] = useState<'all' | 'earn' | 'task' | 'referral'>('all');
  const [activityQuery, setActivityQuery] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const pageSize = 3;

  const filteredActivities = useMemo(() => {
    const items = dashboardData?.recentActivity ?? [];
    const query = activityQuery.trim().toLowerCase();

    return items.filter((activity) => {
      const matchesType = activityFilter === 'all' || activity.type === activityFilter;
      const matchesQuery = !query || activity.title.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [activityFilter, activityQuery, dashboardData?.recentActivity]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const currentActivityPage = Math.min(activityPage, totalPages);
  const activitySlice = filteredActivities.slice((currentActivityPage - 1) * pageSize, currentActivityPage * pageSize);

  const ticketStatusClass = (status: string): string => {
    if (status === 'completed' || status === 'resolved' || status === 'closed') return 'text-mint';
    if (status === 'processing' || status === 'waiting_on_you' || status === 'pending' || status === 'open') return 'text-ember';
    return 'text-red-300';
  };

  if (error) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Unable to load dashboard</h1>
        <p className="mt-2 text-mist/80">The user dashboard could not be loaded right now.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist hover:border-mint/30 hover:text-mint transition"
        >
          Retry
        </button>
      </Card>
    );
  }

  if (isLoading || !dashboardData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const supportLabel = dashboardData.supportTickets.length ? 'Support inbox' : 'Support tickets';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Earn at a glance</h1>
            <p className="mt-2 max-w-2xl text-mist/80">
              Track your earnings, complete recommended campaigns, and watch your wallet grow in real time.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/app/tasks" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Resume last task
              </Link>
              <Link to="/app/wallet" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Claim reward
              </Link>
              <Link to="/app/profile" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Open notifications inbox
              </Link>
            </div>
          </div>
          <button
            onClick={() => void refetch()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist hover:border-mint/30 hover:text-mint transition"
          >
            {isFetching ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Link to="/app/profile" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Profile</p>
            <p className="mt-2 text-2xl font-bold text-white">Account</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">Open profile →</p>
          </Card>
        </Link>
        <Link to="/app/wallet" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Wallet</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(dashboardData.walletBalance)}</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">View wallet →</p>
          </Card>
        </Link>
        <Link to="/app/tasks" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Task center</p>
            <p className="mt-2 text-2xl font-bold text-white">{dashboardData.completedTasks}</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">Open tasks →</p>
          </Card>
        </Link>
        <Link to="/app/wallet" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Rewards</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(dashboardData.pendingRewards)}</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">Check earnings →</p>
          </Card>
        </Link>
        <Link to="/app/gamification" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Gamification</p>
            <p className="mt-2 text-2xl font-bold text-white">{dashboardData.achievementProgress.length}</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">View achievements →</p>
          </Card>
        </Link>
        <Link to="/help-center" className="group block h-full">
          <Card className="h-full border border-white/10 bg-white/5 transition group-hover:border-mint/30 group-hover:bg-mint/10">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Support</p>
            <p className="mt-2 text-2xl font-bold text-white">{dashboardData.supportTickets.length}</p>
            <p className="mt-3 text-sm text-ember/90 transition group-hover:text-ember">Open help center →</p>
          </Card>
        </Link>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-mint/70">Quick shortcuts</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Jump into the main user flows</h2>
            <p className="mt-1 text-sm text-mist/70">Use these direct links to move from overview into the screens users act on most.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/app/profile" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
              Open profile
            </Link>
            <Link to="/app/wallet" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
              Open wallet
            </Link>
            <Link to="/app/tasks" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
              Open tasks
            </Link>
            <Link to="/app/gamification" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
              Open leaderboard
            </Link>
          </div>
        </div>
      </Card>

      {/* Key metrics row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Current earnings</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(dashboardData.currentEarnings)}</p>
          <p className="mt-1 text-xs text-mist/70">In this session</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Pending rewards</p>
          <p className="mt-2 text-3xl font-bold text-ember">{formatCurrency(dashboardData.pendingRewards)}</p>
          <p className="mt-1 text-xs text-mist/70">Awaiting approval</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Completed tasks</p>
          <p className="mt-2 text-3xl font-bold text-white">{dashboardData.completedTasks}</p>
          <p className="mt-1 text-xs text-mist/70">This month</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Wallet balance</p>
          <p className="mt-2 text-3xl font-bold text-mint">{formatCurrency(dashboardData.walletBalance)}</p>
          <Link to="/app/wallet" className="mt-1 text-xs text-ember/90 hover:text-ember">
            View details →
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Daily goal</p>
          <p className="mt-2 text-3xl font-bold text-white">{dashboardData.dailyGoalProgress}%</p>
          <div className="mt-2 h-1 rounded-full bg-white/10">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-mint to-ember"
              style={{ width: `${dashboardData.dailyGoalProgress}%` }}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{supportLabel}</h2>
              <p className="text-sm text-mist/70">Live support tickets from Supabase.</p>
            </div>
            <Link to="/help-center" className="text-sm text-ember/90 hover:text-ember">Help center →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {dashboardData.supportTickets.length ? dashboardData.supportTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{ticket.subject}</p>
                    <p className="text-xs text-mist/70">{ticket.category} · {ticket.priority}</p>
                    <p className="text-xs text-mist/70">Updated {formatRelativeTime(ticket.updatedAt)}</p>
                  </div>
                  <span className={`text-xs uppercase tracking-[0.18em] ${ticketStatusClass(ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-mist/70">
                No support tickets yet.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Campaign history</h2>
          <div className="mt-4 space-y-3">
            {dashboardData.campaignHistory.length ? dashboardData.campaignHistory.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-sm font-medium text-white">{campaign.title}</p>
                  <p className="text-xs text-mist/70">Completed {formatRelativeTime(campaign.completedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-mint">+{formatCurrency(campaign.reward)}</p>
                  <p className={`text-xs uppercase tracking-[0.18em] ${ticketStatusClass(campaign.status)}`}>{campaign.status}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-mist/70">
                No campaign history yet.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Withdrawal requests</h2>
          <div className="mt-4 space-y-3">
            {dashboardData.withdrawalRequests.length ? dashboardData.withdrawalRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-sm font-medium text-white">{request.method}</p>
                  <p className="text-xs text-mist/70">Requested {formatRelativeTime(request.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatCurrency(request.amount)}</p>
                  <p className={`text-xs uppercase tracking-[0.18em] ${ticketStatusClass(request.status)}`}>{request.status}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-mist/70">
                No withdrawal requests yet.
              </div>
            )}
          </div>
          <Link to="/app/wallet" className="mt-4 inline-block text-sm text-ember/90 hover:text-ember">Manage withdrawals →</Link>
        </Card>
      </div>

      {/* Notifications and goals */}
      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <span className="rounded-full bg-ember/20 px-2 py-1 text-xs text-ember">{dashboardData.notificationCount}</span>
          </div>
          <div className="mt-4 space-y-3">
            {dashboardData.recentNotifications.length ? dashboardData.recentNotifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{notification.title}</p>
                    <p className="text-xs text-mist/70">{notification.message}</p>
                    <p className="text-xs text-mist/70">{formatRelativeTime(notification.createdAt)}</p>
                  </div>
                  <span className={`text-xs uppercase tracking-[0.18em] ${notification.isRead ? 'text-mist/50' : 'text-mint'}`}>
                    {notification.type}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-mist/70">
                No notifications yet.
              </div>
            )}
          </div>
          <Link to="/app/profile" className="mt-4 inline-block text-sm text-ember/90 hover:text-ember">Open profile notifications →</Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Season</p>
              <p className="mt-2 text-sm font-medium text-white">{dashboardData.leaderboardSnapshot.seasonName}</p>
              <p className="text-xs text-mist/70">{dashboardData.leaderboardSnapshot.seasonTheme}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Modules</p>
                <p className="mt-2 text-2xl font-bold text-white">{dashboardData.leaderboardSnapshot.activeModules}/{dashboardData.leaderboardSnapshot.totalModules}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Ends</p>
                <p className="mt-2 text-sm font-medium text-white">{formatDate(dashboardData.leaderboardSnapshot.seasonEndsOn)}</p>
                <p className="text-xs text-mist/70">{dashboardData.leaderboardSnapshot.leaderboardsEnabled ? 'Leaderboard active' : 'Leaderboard paused'}</p>
              </div>
            </div>
          </div>
          <Link to="/app/gamification" className="mt-4 inline-block text-sm text-ember/90 hover:text-ember">View full leaderboard →</Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Referral performance</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-mist/80">Active referrals</span>
              <span className="text-2xl font-bold text-mint">{dashboardData.referralCount}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-mist/80">Referral earnings</span>
              <span className="text-2xl font-bold text-white">{formatCurrency(dashboardData.referralEarnings)}</span>
            </div>
            <Link
              to="/app/profile"
              className="mt-4 inline-block text-sm text-ember/90 hover:text-ember transition"
            >
              Share referral link →
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Achievement progress</h2>
          <div className="mt-4 space-y-4">
            {dashboardData.achievementProgress.map((achievement, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-mist/80">{achievement.title}</span>
                  <span className="text-xs text-mist/60">{achievement.current}/{achievement.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-mint to-ember"
                    style={{ width: `${(achievement.current / achievement.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity and campaign recommendations */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">History search</h2>
              <p className="text-sm text-mist/70">Search and filter recent activity across the user dashboard.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[30rem]">
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.18em] text-mint/70">Search</span>
                <input
                  type="search"
                  value={activityQuery}
                  onChange={(event) => {
                    setActivityQuery(event.target.value);
                    setActivityPage(1);
                  }}
                  placeholder="Find an activity"
                  className="input-base bg-white/5"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.18em] text-mint/70">Filter</span>
                <select
                  value={activityFilter}
                  onChange={(event) => {
                    setActivityFilter(event.target.value as typeof activityFilter);
                    setActivityPage(1);
                  }}
                  className="input-base bg-white/5"
                >
                  <option value="all">All types</option>
                  <option value="earn">Earnings</option>
                  <option value="task">Tasks</option>
                  <option value="referral">Referrals</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {activitySlice.length ? activitySlice.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      activity.type === 'earn' ? 'bg-mint' : activity.type === 'task' ? 'bg-blue-500' : 'bg-ember'
                    }`}
                  />
                  <div>
                    <p className="text-sm text-white">{activity.title}</p>
                    <p className="text-xs text-mist/70">{formatTimeAgo(activity.time)}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-mint">+{formatCurrency(activity.amount)}</span>
              </div>
            )) : (
              <p className="text-sm text-mist/60">
                {filteredActivities.length
                  ? 'No activity matches the current search.'
                  : 'No activity yet. Complete a task or earn a reward to populate this feed.'}
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-mist/70">
            <span>
              Page {currentActivityPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                disabled={currentActivityPage === 1}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm hover:border-mint/30 hover:text-mint disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setActivityPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentActivityPage === totalPages}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm hover:border-mint/30 hover:text-mint disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Campaign recommendations</h2>
          <div className="mt-4 space-y-3">
            {dashboardData.campaignRecommendations.map((campaign) => (
              <Link
                key={campaign.id}
                to={`/app/campaigns/${campaign.id}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-mint/40 hover:bg-mint/10"
              >
                <div>
                  <p className="text-sm font-medium text-white">{campaign.title}</p>
                  <p className="text-xs text-mist/70">{campaign.type.replace(/_/g, ' ')}</p>
                </div>
                <span className="rounded-full bg-mint/20 px-2 py-1 text-xs font-medium text-mint">
                  +{formatCurrency(campaign.reward)}
                </span>
              </Link>
            ))}
          </div>
          <Link to="/app/campaigns" className="mt-4 inline-block text-sm text-ember/90 hover:text-ember transition">
            Browse all campaigns →
          </Link>
        </Card>
      </div>
    </div>
  );
}
