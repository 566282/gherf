import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { listCampaigns } from '@/services/api/campaigns';
import { listAnalyticsReport, type AnalyticsReport } from '@/services/api/analytics';

type CampaignSummary = {
  id: string;
  title: string;
  status: string;
  budget: number | string;
  currentParticipants: number | null;
  updatedAt: string;
};

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

export function AdManagementPage(): JSX.Element {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void Promise.all([listCampaigns(), listAnalyticsReport(30)])
      .then(([campaignRows, nextReport]) => {
        if (!active) return;

        const mappedCampaigns = campaignRows.map((campaign: { id: string; title: string; status: string; budget: number | string; currentParticipants: number | null; updatedAt: string }) => ({
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          budget: campaign.budget,
          currentParticipants: campaign.currentParticipants,
          updatedAt: campaign.updatedAt,
        }));

        setCampaigns(mappedCampaigns);
        setReport(nextReport);
      })
      .catch(() => {
        if (!active) return;
        setCampaigns([]);
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

  const summary = useMemo(() => {
    const activeCount = campaigns.filter((campaign) => ['active', 'scheduled', 'live', 'optimizing'].includes(campaign.status)).length;
    const totalBudget = campaigns.reduce((sum, campaign) => sum + Number(campaign.budget ?? 0), 0);
    const averageApproval = report?.campaignPerformance.length
      ? report.campaignPerformance.reduce((sum, entry) => sum + entry.approvalRate, 0) / report.campaignPerformance.length
      : 0;
    const totalReach = campaigns.reduce((sum, campaign) => sum + Number(campaign.currentParticipants ?? 0), 0);

    return [
      { label: 'Active campaigns', value: formatNumber(activeCount), note: 'Campaigns currently active or scheduled in the workspace' },
      { label: 'Live spend', value: formatCurrency(totalBudget), note: 'Budget committed across live ad inventory' },
      { label: 'Approval rate', value: `${averageApproval.toFixed(1)}%`, note: 'Average approval rate from analytics rollups' },
      { label: 'Audience reach', value: formatNumber(totalReach), note: 'Current participants across the active campaign set' },
    ];
  }, [campaigns, report]);

  return (
    <>
      <div className="px-6 pt-6">
        <Card className="border border-accent/30 bg-[linear-gradient(120deg,hsl(var(--chart-1)/0.14),hsl(var(--color-surface-elevated)))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-accent/80">Live enterprise controls</p>
              <h2 className="text-2xl font-semibold text-foreground">Need launch timing, targeting, analytics, and risk review?</h2>
              <p className="max-w-3xl text-sm text-muted">
                Open the live Ad Platform workspace for operational controls, campaign moderation, reporting filters, and fraud policy review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/ad-platform"
                className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
              >
                Open live Ad Platform
              </Link>
              <Link
                to="/admin/campaigns/new"
                className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
              >
                Create campaign
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="page-transition space-y-6 p-6">
        <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Growth operations</p>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Ad Management</h1>
              <p className="text-base text-muted">Live ad operations from the current campaign workspace and analytics feed.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">
              {isLoading ? 'Refreshing live campaign data...' : 'Values are sourced from the live workspace instead of hardcoded admin placeholders.'}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="border border-border bg-surface-elevated">
              <p className="text-sm uppercase tracking-[0.2em] text-muted">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{item.value}</p>
              <p className="mt-2 text-sm text-muted">{item.note}</p>
            </Card>
          ))}
        </div>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live ad operations</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Campaign inventory</h2>
            </div>
            <p className="text-sm text-muted">Campaign rows are pulled from the live campaigns table and paired with analytics rollups.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Budget</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Participants</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length ? campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-border">
                    <td className="px-4 py-3 align-top font-medium text-foreground">{campaign.title}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{campaign.status}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(Number(campaign.budget ?? 0))}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{campaign.currentParticipants ?? 0}</td>
                    <td className="px-4 py-3 align-top text-foreground/85">{formatDate(campaign.updatedAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">No live campaign rows are currently available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}