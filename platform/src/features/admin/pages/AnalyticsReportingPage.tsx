import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAnalyticsReport, type AnalyticsReport, type CategoryMetric, type TimeSeriesPoint } from '@/services/api/analytics';
import { exportAnalyticsReport, type AnalyticsDatasetKey, type ExportFormat } from '@/services/export/reportExport';

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
  { label: 'Campaign performance', value: 'campaignPerformance' },
  { label: 'Reward distribution', value: 'rewardDistribution' },
  { label: 'Withdrawal statistics', value: 'withdrawalStatistics' },
  { label: 'Referral performance', value: 'referralPerformance' },
  { label: 'Geographic statistics', value: 'geographicStatistics' },
  { label: 'Device statistics', value: 'deviceStatistics' },
  { label: 'Browser statistics', value: 'browserStatistics' },
  { label: 'Conversion funnels', value: 'conversionFunnels' },
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

function MiniSeriesChart({ title, subtitle, series, colorClass }: { title: string; subtitle: string; series: TimeSeriesPoint[]; colorClass: string }): JSX.Element {
  const max = maxValue(series);
  const tail = series.slice(-12);

  return (
    <Card>
      <p className="text-sm uppercase tracking-[0.24em] text-mint/70">{title}</p>
      <h3 className="mt-2 text-xl font-semibold text-white">{subtitle}</h3>
      <div className="mt-4 flex h-32 items-end gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        {tail.map((point) => (
          <div key={point.label} className="group relative flex h-full flex-1 items-end">
            <div className={`w-full rounded-md ${colorClass}`} style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-white/20 bg-[#111827] px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
              {point.label}: {formatNumber(point.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-mist/70">Showing the latest 12 points in the selected range.</p>
    </Card>
  );
}

function CategoryList({ title, items }: { title: string; items: CategoryMetric[] }): JSX.Element {
  const max = maxValue(items);

  return (
    <Card>
      <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Distribution</p>
      <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm text-mist/80">
                <span>{item.label}</span>
                <span>{formatNumber(item.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-ember" style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-mist/70">No data available.</p>
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
  const [exportScope, setExportScope] = useState<AnalyticsDatasetKey>('all');

  useEffect(() => {
    setIsLoading(true);
    setStatusMessage('Loading analytics dashboards...');

    void listAnalyticsReport(rangeDays)
      .then((nextReport) => {
        setReport(nextReport);
        setStatusMessage(`Analytics ready for last ${rangeDays} days.`);
      })
      .catch(() => {
        setStatusMessage('Unable to load analytics right now.');
      })
      .finally(() => setIsLoading(false));
  }, [rangeDays]);

  const funnelMax = useMemo(() => {
    if (!report) return 1;
    return Math.max(1, ...report.conversionFunnels.map((entry) => entry.users));
  }, [report]);

  const handleExport = (format: ExportFormat) => {
    if (!report) return;
    exportAnalyticsReport(report, format, exportScope);
  };

  if (!report) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h1 className="text-3xl font-bold text-white">Analytics and reporting</h1>
          <p className="mt-2 text-mist/80">{statusMessage}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(78,142,255,0.22),transparent_34%),linear-gradient(135deg,rgba(10,14,20,0.97),rgba(18,22,31,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-mint/80">Phase 10 analytics and reporting</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Business intelligence dashboard suite</h1>
            <p className="text-base text-mist/80">
              Monitor user growth, active users, revenue, campaign outcomes, reward and withdrawal behavior, referral velocity, geography/device/browser mix, and end-to-end conversion funnel health.
            </p>
          </div>

          <div className="w-full space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 xl:w-[30rem]">
            <div className="grid gap-3 sm:grid-cols-3">
              {rangeOptions.map((option) => (
                <Button key={option.value} variant={rangeDays === option.value ? 'primary' : 'ghost'} onClick={() => setRangeDays(option.value)}>
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <label className="grid gap-2 sm:col-span-1">
                <span className="text-xs uppercase tracking-[0.2em] text-mist/70">Export scope</span>
                <select className="input-base" value={exportScope} onChange={(event) => setExportScope(event.target.value as AnalyticsDatasetKey)}>
                  {exportScopes.map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={() => handleExport('csv')}>CSV</Button>
              <Button onClick={() => handleExport('excel')}>Excel</Button>
              <Button onClick={() => handleExport('pdf')}>PDF</Button>
            </div>
            <p className="text-xs text-mist/70">{isLoading ? 'Refreshing analytics...' : statusMessage}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <p className="text-sm text-mist/70">Total users</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatNumber(report.kpis.totalUsers)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mist/70">Active users</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatNumber(report.kpis.activeUsers)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mist/70">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(report.kpis.totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mist/70">Active campaigns</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatNumber(report.kpis.activeCampaigns)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mist/70">Rewards issued</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatNumber(report.kpis.rewardsIssued)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mist/70">Withdrawal volume</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(report.kpis.withdrawalsVolume)}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <MiniSeriesChart title="User growth" subtitle="New users over time" series={report.userGrowth} colorClass="bg-sky-400" />
        <MiniSeriesChart title="Active users" subtitle="Daily active users" series={report.activeUsers} colorClass="bg-emerald-400" />
        <MiniSeriesChart title="Revenue" subtitle="Daily recognized revenue" series={report.revenue} colorClass="bg-amber-400" />
      </div>

      <Card>
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Campaign performance</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Top campaigns by spend</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-mist/70">
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
                  <tr key={campaign.campaignId} className="border-t border-white/10">
                    <td className="px-3 py-2 text-white">{campaign.campaignTitle}</td>
                    <td className="px-3 py-2 text-mist/80">{formatNumber(campaign.participants)}</td>
                    <td className="px-3 py-2 text-mist/80">{formatNumber(campaign.submissions)}</td>
                    <td className="px-3 py-2 text-mist/80">{formatNumber(campaign.approvalRate)}%</td>
                    <td className="px-3 py-2 text-mist/80">{formatNumber(campaign.rewardsIssued)}</td>
                    <td className="px-3 py-2 text-mist/80">{formatCurrency(campaign.spend)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-mist/70">
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
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Withdrawal statistics</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Payout queue behavior</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Requests</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.withdrawalStatistics.totalRequests)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Volume</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(report.withdrawalStatistics.totalVolume)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Approved rate</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.withdrawalStatistics.approvedRate)}%</p>
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
          <h3 className="mt-2 text-xl font-semibold text-white">Referral growth and commission value</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Referred users</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatNumber(report.referralPerformance.referredUsers)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-mist/70">Referral commissions</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(report.referralPerformance.referralCommissions)}</p>
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
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Conversion funnels</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Signup to reward claim flow</h3>
          <div className="mt-4 space-y-3">
            {report.conversionFunnels.map((step) => (
              <div key={step.step} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mist/80">{step.step}</span>
                  <span className="text-white">{formatNumber(step.users)} ({formatNumber(step.conversionFromPrevious)}%)</span>
                </div>
                <div className="h-3 rounded-full bg-white/10">
                  <div className="h-3 rounded-full bg-mint" style={{ width: `${Math.max(2, (step.users / funnelMax) * 100)}%` }} />
                </div>
              </div>
            ))}
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
