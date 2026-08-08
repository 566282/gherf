import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listAnalyticsReport, type AnalyticsReport } from '@/services/api/analytics';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DashboardAnalyticsPage(): JSX.Element {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void listAnalyticsReport(30)
      .then((nextReport) => {
        if (!active) return;
        setReport(nextReport);
      })
      .catch(() => {
        if (!active) return;
        setReport(null);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!report) {
      return [] as Array<{ label: string; value: string; note: string }>;
    }

    return [
      { label: 'Total users', value: formatNumber(report.kpis.totalUsers), note: 'Signed-up accounts in the selected window' },
      { label: 'Active users', value: formatNumber(report.kpis.activeUsers), note: 'Users active in the last reporting period' },
      { label: 'Revenue', value: formatCurrency(report.kpis.totalRevenue), note: 'Approved rewards and claim activity' },
      { label: 'Active campaigns', value: formatNumber(report.kpis.activeCampaigns), note: 'Campaigns currently active in the system' },
      { label: 'Rewards issued', value: formatNumber(report.kpis.rewardsIssued), note: 'Completed reward events from the feed' },
      { label: 'Withdrawals', value: formatCurrency(report.kpis.withdrawalsVolume), note: 'Volume across payout requests' },
    ];
  }, [report]);

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.18),transparent_35%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Executive reporting</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Dashboard analytics</h1>
            <p className="text-base text-muted">Live metrics from Supabase-backed analytics tables.</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">
            {isLoading ? 'Refreshing the latest analytics snapshot...' : report ? `Last synced ${formatDate(report.generatedAt)}` : 'No analytics snapshot available right now.'}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border border-border bg-surface-elevated">
            <p className="text-sm uppercase tracking-[0.2em] text-muted">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{metric.value}</p>
            <p className="mt-2 text-sm text-muted">{metric.note}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Campaign performance</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Live campaign rollups</h2>
          </div>
          <p className="text-sm text-muted">Values are drawn from the analytics feed rather than seeded admin content.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Participants</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Submissions</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Approval</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Rewards</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Spend</th>
              </tr>
            </thead>
            <tbody>
              {report?.campaignPerformance?.length ? (
                report.campaignPerformance.map((entry) => (
                  <tr key={entry.campaignId} className="border-t border-border">
                    <td className="px-4 py-3 align-top font-medium text-foreground">{entry.campaignTitle}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{entry.participants}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{entry.submissions}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{entry.approvalRate}%</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{entry.rewardsIssued}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(entry.spend)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">No campaign performance rows were returned for the current analytics snapshot.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}