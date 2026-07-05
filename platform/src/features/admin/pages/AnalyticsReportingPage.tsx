import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAnalyticsReport, type AnalyticsReport, type CategoryMetric, type TimeSeriesPoint } from '@/services/api/analytics';
import { exportAnalyticsReport, type AnalyticsDatasetKey, type ExportFormat } from '@/services/export/reportExport';
import { supabase } from '@/services/supabase/client';

const rangeOptions = [
  { label: '7 days', value: 7 as const },
  { label: '30 days', value: 30 as const },
  { label: '90 days', value: 90 as const },
];

const exportScopes: Array<{ label: string; value: AnalyticsDatasetKey }> = [
  { label: 'All dashboards', value: 'all' },
  { label: 'User growth', value: 'userGrowth' },
  { label: 'Active users', value: 'activeUsers' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Task completion', value: 'taskCompletion' },
  { label: 'Retention', value: 'retention' },
  { label: 'Campaign performance', value: 'campaignPerformance' },
  { label: 'Reward distribution', value: 'rewardDistribution' },
  { label: 'Withdrawal statistics', value: 'withdrawalStatistics' },
  { label: 'Referral performance', value: 'referralPerformance' },
  { label: 'Geographic statistics', value: 'geographicStatistics' },
  { label: 'Device statistics', value: 'deviceStatistics' },
  { label: 'Browser statistics', value: 'browserStatistics' },
  { label: 'Conversion funnels', value: 'conversionFunnels' },
];

const enterpriseAnalyticsCoverage = [
  'Revenue',
  'Campaign performance',
  'User growth',
  'Task completion',
  'Retention',
  'Active users',
  'Referral statistics',
  'Top campaigns',
  'Top countries',
  'Device analytics',
  'Browser analytics',
  'Export: PDF, CSV, Excel',
  'Live dashboard',
];

const dataSourceLabels = [
  'Supabase profiles',
  'Supabase campaigns',
  'Supabase rewards',
  'Supabase referrals',
  'Supabase withdrawals',
  'Supabase submissions',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function maxValue(series: Array<{ value: number }>): number {
  return Math.max(1, ...series.map((item) => item.value));
}

function MiniSeriesChart({ title, subtitle, series, chartVar }: { title: string; subtitle: string; series: TimeSeriesPoint[]; chartVar: string }): JSX.Element {
  const max = maxValue(series);
  const tail = series.slice(-12);

  return (
    <Card>
      <p className="text-sm uppercase tracking-[0.24em] text-accent/70">{title}</p>
      <h3 className="mt-2 text-xl font-semibold text-foreground">{subtitle}</h3>
      <div className="mt-4 flex h-32 items-end gap-2 rounded-xl border border-border bg-surface-elevated p-3">
        {tail.map((point) => (
          <div key={point.label} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-md" style={{ backgroundColor: `hsl(var(${chartVar}))`, height: `${Math.max(4, (point.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-border bg-background/95 px-2 py-1 text-[10px] text-foreground opacity-0 transition group-hover:opacity-100">
              {point.label}: {formatNumber(point.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Showing the latest 12 points in the selected range.</p>
    </Card>
  );
}

function CategoryList({ title, items }: { title: string; items: CategoryMetric[] }): JSX.Element {
  const max = maxValue(items);

  return (
    <Card>
      <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Distribution</p>
      <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm text-foreground/80">
                <span>{item.label}</span>
                <span>{formatNumber(item.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-border">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">No data available.</p>
        )}
      </div>
    </Card>
  );
}

export function AnalyticsReportingPage(): JSX.Element {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading analytics dashboards...');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<AnalyticsDatasetKey>('all');

  useEffect(() => {
    let cancelled = false;
    const refreshableTables = ['profiles', 'campaigns', 'campaign_tasks', 'task_submissions', 'rewards', 'withdrawal_requests', 'referral_programs', 'referral_attributions', 'referral_commission_ledger', 'referral_fraud_flags', 'referral_leaderboard_snapshots'];

    const refreshAnalytics = async () => {
      setIsLoading(true);
      setStatusMessage('Loading analytics dashboards...');

      try {
        const nextReport = await listAnalyticsReport(rangeDays);
        if (cancelled) return;

        setReport(nextReport);
        setStatusMessage(`Analytics ready for last ${rangeDays} days via Supabase.`);
        setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch {
        if (!cancelled) {
          setStatusMessage('Unable to load analytics right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void refreshAnalytics();

    const channel = supabase.channel(`analytics-report-${rangeDays}`);
    refreshableTables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void refreshAnalytics();
      });
    });
    void channel.subscribe();

    const refreshHandle = window.setInterval(() => {
      void refreshAnalytics();
    }, 60000);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      window.clearInterval(refreshHandle);
    };
  }, [rangeDays]);

  const funnelMax = useMemo(() => {
    if (!report) return 1;
    return Math.max(1, ...report.conversionFunnels.map((entry) => entry.users));
  }, [report]);

  const handleExport = async (format: ExportFormat) => {
    if (!report) return;

    setStatusMessage(`Preparing ${format.toUpperCase()} export...`);
    try {
      await exportAnalyticsReport(report, format, exportScope);
      setStatusMessage(`Export complete: ${format.toUpperCase()} file downloaded.`);
    } catch {
      setStatusMessage(`Export failed. Please retry ${format.toUpperCase()} export.`);
    }
  };

  if (!report) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h1 className="text-3xl font-bold text-foreground">Analytics and reporting</h1>
          <p className="mt-2 text-muted">{statusMessage}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Phase 10 analytics and reporting</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Business intelligence dashboard suite</h1>
            <p className="text-base text-muted">
              Monitor user growth, active users, revenue, campaign outcomes, reward and withdrawal behavior, referral velocity, geography/device/browser mix, and end-to-end conversion funnel health.
            </p>
          </div>

          <div className="w-full space-y-3 rounded-2xl border border-border bg-surface-elevated p-4 xl:w-[30rem]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Enterprise analytics</p>
              <div className="flex flex-wrap gap-2">
                {enterpriseAnalyticsCoverage.map((item) => (
                  <span key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground/80">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/60 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Live dashboard</p>
              <p className="mt-1 text-sm text-foreground/80">Connected to Supabase and refreshed from production-backed analytics tables.</p>
              <p className="mt-1 text-xs text-muted">Last refreshed: {lastRefreshedAt ?? 'pending first sync'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dataSourceLabels.map((label) => (
                  <span key={label} className="rounded-full bg-surface-elevated px-2 py-1 text-[11px] text-foreground/70">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {rangeOptions.map((option) => (
                <Button key={option.value} variant={rangeDays === option.value ? 'primary' : 'ghost'} onClick={() => setRangeDays(option.value)}>
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <label className="grid gap-2 sm:col-span-1">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Export scope</span>
                <select className="input-base" value={exportScope} onChange={(event) => setExportScope(event.target.value as AnalyticsDatasetKey)}>
                  {exportScopes.map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={() => void handleExport('csv')}>CSV</Button>
              <Button onClick={() => void handleExport('excel')}>Excel</Button>
              <Button onClick={() => void handleExport('pdf')}>PDF</Button>
            </div>
            <p className="text-xs text-muted">{isLoading ? 'Refreshing analytics...' : statusMessage}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total users</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNumber(report.kpis.totalUsers)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Active users</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNumber(report.kpis.activeUsers)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(report.kpis.totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Active campaigns</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNumber(report.kpis.activeCampaigns)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Rewards issued</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNumber(report.kpis.rewardsIssued)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Withdrawal volume</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(report.kpis.withdrawalsVolume)}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <MiniSeriesChart title="User growth" subtitle="New users over time" series={report.userGrowth} chartVar="--chart-1" />
        <MiniSeriesChart title="Active users" subtitle="Daily active users" series={report.activeUsers} chartVar="--chart-2" />
        <MiniSeriesChart title="Revenue" subtitle="Daily recognized revenue" series={report.revenue} chartVar="--chart-3" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MiniSeriesChart title="Task completion" subtitle="Approved submissions as a share of daily submissions" series={report.taskCompletion} chartVar="--chart-4" />
        <MiniSeriesChart title="Retention" subtitle="Returning users as a share of daily active users" series={report.retention} chartVar="--chart-5" />
      </div>

      <Card>
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Campaign performance</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Top campaigns by spend</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Participants</th>
                <th className="px-3 py-2">Submissions</th>
                <th className="px-3 py-2">Approval rate</th>
                <th className="px-3 py-2">Rewards issued</th>
                <th className="px-3 py-2">Spend</th>
              </tr>
            </thead>
            <tbody>
              {report.campaignPerformance.length ? (
                report.campaignPerformance.map((campaign) => (
                  <tr key={campaign.campaignId} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{campaign.campaignTitle}</td>
                    <td className="px-3 py-2 text-foreground/80">{formatNumber(campaign.participants)}</td>
                    <td className="px-3 py-2 text-foreground/80">{formatNumber(campaign.submissions)}</td>
                    <td className="px-3 py-2 text-foreground/80">{formatNumber(campaign.approvalRate)}%</td>
                    <td className="px-3 py-2 text-foreground/80">{formatNumber(campaign.rewardsIssued)}</td>
                    <td className="px-3 py-2 text-foreground/80">{formatCurrency(campaign.spend)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted">
                    No campaign performance data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <CategoryList title="Reward distribution" items={report.rewardDistribution} />

        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Withdrawal statistics</p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">Payout queue behavior</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="text-xs text-muted">Requests</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{formatNumber(report.withdrawalStatistics.totalRequests)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="text-xs text-muted">Volume</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(report.withdrawalStatistics.totalVolume)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated p-3">
              <p className="text-xs text-muted">Approved rate</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{formatNumber(report.withdrawalStatistics.approvedRate)}%</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <CategoryList title="By status" items={report.withdrawalStatistics.byStatus} />
            <CategoryList title="By method" items={report.withdrawalStatistics.byMethod} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Referral performance</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Referral growth, commissions, and risk controls</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Qualified referrals</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.referralPerformance.qualifiedReferrals)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Referral commissions</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(report.referralPerformance.referralCommissions)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Active programs</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.referralPerformance.activePrograms)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Fraud flags</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.referralPerformance.fraudFlags)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {report.referralPerformance.referralsByDay.slice(-8).map((entry) => (
              <div key={entry.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="text-mist/80">{entry.label}</span>
                <span className="text-white">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Referral backend</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Programs, leaderboard, and fraud signals</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-mist/70">Programs by activity</p>
              {report.referralPerformance.programsByActivity.length ? (
                report.referralPerformance.programsByActivity.map((program) => (
                  <div key={program.programId} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white">{program.programName}</span>
                      <span className="text-mist/80">{program.status}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-mist/70">
                      <span>{formatNumber(program.referredUsers)} referred</span>
                      <span>{formatCurrency(program.referralCommissions)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-mist/70">No referral programs found.</p>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-mist/70">Leaderboard</p>
              {report.referralPerformance.leaderboard.length ? (
                report.referralPerformance.leaderboard.map((entry) => (
                  <div key={`${entry.programId}-${entry.profileId}-${entry.periodKey}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white">{entry.profileId}</span>
                      <span className="text-mist/80">#{entry.rank ?? '-'}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-mist/70">
                      <span>{formatNumber(entry.referralCount)} referrals</span>
                      <span>{formatCurrency(entry.commissionTotal)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-mist/70">No leaderboard snapshots yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-mist/70">Fraud signals</p>
            {report.referralPerformance.fraudSignals.length ? (
              report.referralPerformance.fraudSignals.map((signal) => (
                <div key={`${signal.ruleKey}-${signal.severity}-${signal.status}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-mist/80">{signal.ruleKey}</span>
                  <span className="text-white">{formatNumber(signal.count)} {signal.severity} / {signal.status}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-mist/70">No referral fraud signals in the selected range.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <CategoryList title="Geographic statistics" items={report.geographicStatistics} />
        <CategoryList title="Device statistics" items={report.deviceStatistics} />
        <CategoryList title="Browser statistics" items={report.browserStatistics} />
      </div>
    </div>
  );
}
