import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';

interface DashboardMetrics {
  currentEarnings: number;
  pendingRewards: number;
  completedTasks: number;
  walletBalance: number;
  recentActivity: Array<{ id: string; title: string; amount: number; time: string; type: 'earn' | 'task' | 'referral' }>;
  referralCount: number;
  referralEarnings: number;
  notificationCount: number;
  dailyGoalProgress: number;
  campaignRecommendations: Array<{ id: string; title: string; reward: number; type: string }>;
  achievementProgress: Array<{ title: string; current: number; total: number }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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

function useMockDashboardData(): DashboardMetrics {
  const [data] = useState<DashboardMetrics>({
    currentEarnings: 1250.75,
    pendingRewards: 340.50,
    completedTasks: 28,
    walletBalance: 2150.25,
    recentActivity: [
      { id: '1', title: 'Video watch reward', amount: 2.50, time: new Date(Date.now() - 5 * 60000).toISOString(), type: 'earn' },
      { id: '2', title: 'Survey completion', amount: 5.00, time: new Date(Date.now() - 15 * 60000).toISOString(), type: 'task' },
      { id: '3', title: 'Referral bonus', amount: 10.00, time: new Date(Date.now() - 2 * 3600000).toISOString(), type: 'referral' },
      { id: '4', title: 'Daily bonus streak', amount: 1.00, time: new Date(Date.now() - 4 * 3600000).toISOString(), type: 'earn' },
    ],
    referralCount: 12,
    referralEarnings: 120.50,
    notificationCount: 3,
    dailyGoalProgress: 75,
    campaignRecommendations: [
      { id: 'camp-1', title: 'App install promo', reward: 3.50, type: 'install_mobile_apps' },
      { id: 'camp-2', title: 'Video series', reward: 2.00, type: 'watch_videos' },
      { id: 'camp-3', title: 'Social follow', reward: 1.50, type: 'social_media_follows' },
    ],
    achievementProgress: [
      { title: 'Streak Master', current: 7, total: 30 },
      { title: 'Task Crusher', current: 28, total: 50 },
      { title: 'Referral Star', current: 12, total: 25 },
    ],
  });

  return data;
}

export function DashboardPage(): JSX.Element {
  const dashboardData = useMockDashboardData();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist hover:border-mint/30 hover:text-mint transition"
          >
            ↻ Refresh
          </button>
        </div>
      </Card>

      {/* Key metrics row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" key={refreshKey}>
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

      {/* Notifications and goals */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <span className="rounded-full bg-ember/20 px-2 py-1 text-xs text-ember">{dashboardData.notificationCount}</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="h-2 w-2 rounded-full bg-mint mt-1.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-white font-medium">New campaign available</p>
                <p className="text-xs text-mist/70">App install promo now live</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="h-2 w-2 rounded-full bg-ember mt-1.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-white font-medium">Reward approved</p>
                <p className="text-xs text-mist/70">Video watch earned $2.50</p>
              </div>
            </div>
          </div>
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
          <h2 className="text-lg font-semibold text-white">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {dashboardData.recentActivity.map((activity) => (
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
            ))}
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
