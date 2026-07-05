import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs, Timeline } from '@/components/ui/DesignSystem';
import { AdPlatformStatePanel, CampaignDetailPanel, MiniSeriesChart } from '../components/AdPlatformComponents';
import { listAnalyticsReport, type AnalyticsReport } from '@/services/api/analytics';
import { campaignToFormValues, listCampaigns, saveCampaign } from '@/services/api/campaigns';
import type { Campaign } from '@/types';

type AdSectionKey = 'ad-types' | 'targeting' | 'scheduling' | 'analytics' | 'fraud';
type AnalyticsRangeDays = 7 | 30 | 90;
type CampaignLifecycleFilter = 'all' | Campaign['status'];

type SectionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: JSX.Element;
};

type FormatSummary = {
  label: string;
  count: number;
  budget: number;
  sample: string;
};

type TargetingSummary = {
  label: string;
  values: Array<{ label: string; count: number }>;
};

type FraudSignalSummary = {
  ruleKey: string;
  severity: string;
  status: string;
  count: number;
};

const adSectionTabs: Array<{ id: AdSectionKey; label: string; description: string }> = [
  { id: 'ad-types', label: 'Ad types', description: 'Formats and placements' },
  { id: 'targeting', label: 'Targeting', description: 'Audience filters and exclusions' },
  { id: 'scheduling', label: 'Scheduling', description: 'Budget and delivery controls' },
  { id: 'analytics', label: 'Analytics', description: 'Performance and revenue signals' },
  { id: 'fraud', label: 'Fraud', description: 'Traffic quality and review controls' },
];

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function daysBetween(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function splitValues(values: string[]): string[] {
  return values.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
}

function normalizeLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function inferAdType(campaign: Campaign): string {
  const type = campaign.campaignType.toLowerCase();

  if (campaign.videoUrl || type.includes('watch')) return 'Video';
  if (campaign.bannerUrl || campaign.campaignImageUrl || type.includes('click')) return 'Banner';
  if (type.includes('referral') || type.includes('social_media') || type.includes('comments') || type.includes('shares') || type.includes('subscribe')) {
    return 'Sponsored Posts';
  }
  if (type.includes('install') || type.includes('download')) return 'Popup';
  if (type.includes('daily') || type.includes('weekly') || type.includes('seasonal') || type.includes('custom')) return 'Rewarded';
  if (type.includes('visit') || type.includes('read')) return 'Native';
  if (type.includes('join')) return 'Sidebar';

  return 'Homepage';
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('active') || normalized.includes('live') || normalized.includes('published') || normalized.includes('approved') || normalized.includes('enabled') || normalized.includes('granted') || normalized.includes('healthy') || normalized.includes('delivered')) {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  }

  if (normalized.includes('pause') || normalized.includes('review') || normalized.includes('pending') || normalized.includes('scheduled') || normalized.includes('assigned') || normalized.includes('staged') || normalized.includes('draft') || normalized.includes('flag')) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }

  if (normalized.includes('reject') || normalized.includes('block') || normalized.includes('frozen') || normalized.includes('disabled') || normalized.includes('revoked') || normalized.includes('archived') || normalized.includes('quarantined')) {
    return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  }

  return 'border-white/10 bg-white/5 text-mist/80';
}

function riskTone(risk: string): string {
  const normalized = risk.toLowerCase();
  if (normalized.includes('high')) return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  if (normalized.includes('medium')) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
}

function normalizeList(values: string[] | undefined, fallback = 'All'): string {
  return values?.length ? values.join(', ') : fallback;
}

function buildCampaignReportCsv(rows: Array<{ campaignTitle: string; participants: number; submissions: number; approvalRate: number; rewardsIssued: number; spend: number; status: string }>): string {
  const header = ['campaign_title', 'participants', 'submissions', 'approval_rate', 'rewards_issued', 'spend', 'status'];
  const lines = rows.map((row) => [row.campaignTitle, row.participants, row.submissions, row.approvalRate.toFixed(1), row.rewardsIssued, row.spend, row.status].join(','));

  return [header.join(','), ...lines].join('\n');
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function SectionCard({ eyebrow, title, description, children }: SectionCardProps): JSX.Element {
  return (
    <Card className="space-y-4 border border-border bg-surface-elevated">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-accent/70">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export function VideoManagementPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdSectionKey>('ad-types');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<AnalyticsRangeDays>(30);
  const [campaignLifecycleFilter, setCampaignLifecycleFilter] = useState<CampaignLifecycleFilter>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading live campaign sources...');

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setLoadError(false);
    setStatusMessage('Loading live campaign sources...');

    void Promise.all([listCampaigns(), listAnalyticsReport(analyticsRangeDays)])
      .then(([campaignRows, analyticsReport]) => {
        if (!active) return;

        setCampaigns(campaignRows);
        setReport(analyticsReport);
        setStatusMessage(`Synced ${campaignRows.length} campaigns with reporting data from the last ${analyticsRangeDays} days.`);
      })
      .catch(() => {
        if (!active) return;

        setCampaigns([]);
        setReport(null);
        setLoadError(true);
        setStatusMessage('Using local section layout until live campaign data becomes available.');
      })
      .finally(() => {
        if (!active) return;

        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [analyticsRangeDays]);

  useEffect(() => {
    if (!campaigns.length) {
      setSelectedCampaignId(null);
      return;
    }

    setSelectedCampaignId((current) => (current && campaigns.some((campaign) => campaign.id === current) ? current : campaigns[0].id));
  }, [campaigns]);

  const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null, [campaigns, selectedCampaignId]);
  const hasLiveCampaigns = campaigns.length > 0;
  const emptyTone = loadError ? 'error' : 'empty';
  const emptyTitle = loadError ? 'Live campaign data unavailable' : 'No live campaigns loaded yet';
  const emptyDescription = loadError
    ? 'Supabase did not return campaign data, so the page is showing the local workspace shell until the feed recovers.'
    : 'No live campaigns are available yet, so the workspace is showing its local section layout.';

  const liveFormats = useMemo<FormatSummary[]>(() => {
    const buckets = new Map<string, { count: number; budget: number; sample: string }>();

    campaigns.forEach((campaign) => {
      const label = inferAdType(campaign);
      const current = buckets.get(label) ?? { count: 0, budget: 0, sample: campaign.title };
      current.count += 1;
      current.budget += campaign.budget;
      current.sample = current.sample || campaign.title;
      buckets.set(label, current);
    });

    return Array.from(buckets.entries())
      .map(([label, value]) => ({ label, count: value.count, budget: value.budget, sample: value.sample }))
      .sort((left, right) => right.count - left.count || right.budget - left.budget);
  }, [campaigns]);

  const targetingSummaries = useMemo<TargetingSummary[]>(() => {
    const regionBuckets = new Map<string, number>();
    const languageBuckets = new Map<string, number>();
    const interestBuckets = new Map<string, number>();
    const ageBuckets = new Map<string, number>();

    campaigns.forEach((campaign) => {
      const audience = campaign.engineConfig.targetAudience;
      splitValues(campaign.engineConfig.countryRestrictions).forEach((value) => regionBuckets.set(value, (regionBuckets.get(value) ?? 0) + 1));
      splitValues(audience.regions).forEach((value) => regionBuckets.set(value, (regionBuckets.get(value) ?? 0) + 1));
      splitValues(audience.languages).forEach((value) => languageBuckets.set(value, (languageBuckets.get(value) ?? 0) + 1));
      splitValues(audience.interests).forEach((value) => interestBuckets.set(value, (interestBuckets.get(value) ?? 0) + 1));
      if (audience.ageRange) {
        ageBuckets.set(audience.ageRange, (ageBuckets.get(audience.ageRange) ?? 0) + 1);
      }
    });

    return [
      { label: 'Countries and regions', values: Array.from(regionBuckets.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count).slice(0, 6) },
      { label: 'Languages', values: Array.from(languageBuckets.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count).slice(0, 6) },
      { label: 'Interests', values: Array.from(interestBuckets.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count).slice(0, 8) },
      { label: 'Age bands', values: Array.from(ageBuckets.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count).slice(0, 4) },
    ];
  }, [campaigns]);

  const analyticsMetrics = useMemo(() => {
    if (report) {
      return [
        { label: 'CTR', value: `${report.campaignPerformance[0]?.approvalRate?.toFixed?.(1) ?? 0}%`, note: 'Campaign approval rate from live reporting data.' },
        { label: 'Conversions', value: String(report.kpis.activeCampaigns), note: 'Active campaigns reflected in the reporting window.' },
        { label: 'Revenue', value: formatCurrency(report.kpis.totalRevenue), note: 'Revenue aggregated from the analytics report.' },
        { label: 'ROAS', value: `${report.campaignPerformance.length ? (report.kpis.totalRevenue / Math.max(report.kpis.withdrawalsVolume || 1, 1)).toFixed(1) : '0.0'}x`, note: 'Relative spend efficiency from the reporting payload.' },
      ];
    }

    return [
      { label: 'CTR', value: '—', note: 'Waiting for analytics report data.' },
      { label: 'Conversions', value: String(campaigns.length), note: 'Current live campaign count.' },
      { label: 'Revenue', value: '—', note: 'Waiting for analytics report data.' },
      { label: 'ROAS', value: '—', note: 'Waiting for analytics report data.' },
    ];
  }, [campaigns.length, report]);

  const analyticsSignals = useMemo(() => {
    if (!report) {
      return [];
    }

    return [
      {
        title: 'Top campaign performance',
        description: report.campaignPerformance.length
          ? `${report.campaignPerformance[0].campaignTitle} is leading with ${report.campaignPerformance[0].rewardsIssued} rewards issued and ${report.campaignPerformance[0].approvalRate.toFixed(1)}% approval.`
          : 'No campaign performance data is available yet.',
        meta: 'Live report',
      },
      {
        title: 'Revenue trajectory',
        description: `${report.revenue.length} reporting points are available for the selected 30-day window.`,
        meta: 'Trend series',
      },
      {
        title: 'Conversion funnel',
        description: `${report.conversionFunnels[report.conversionFunnels.length - 1]?.users ?? 0} users reached the final reward claim step.`,
        meta: 'Funnel view',
      },
    ];
  }, [report]);

  const visibleCampaignPerformance = useMemo(() => {
    const rows = report?.campaignPerformance ?? [];
    const search = campaignSearch.trim().toLowerCase();

    return rows.filter((row) => {
      const linkedCampaign = campaigns.find((campaign) => campaign.title === row.campaignTitle);
      const matchesLifecycle = campaignLifecycleFilter === 'all' || linkedCampaign?.status === campaignLifecycleFilter;
      const matchesSearch = !search || row.campaignTitle.toLowerCase().includes(search) || linkedCampaign?.campaignType.toLowerCase().includes(search);

      return matchesLifecycle && matchesSearch;
    });
  }, [campaignLifecycleFilter, campaignSearch, campaigns, report?.campaignPerformance]);

  const analyticsAlerts = useMemo(() => {
    const alerts: Array<{ title: string; description: string; tone: 'low' | 'medium' | 'high' }> = [];

    if (report?.referralPerformance.fraudFlags) {
      alerts.push({
        title: 'Fraud flags detected',
        description: `${report.referralPerformance.fraudFlags} open fraud flag${report.referralPerformance.fraudFlags === 1 ? '' : 's'} need review before scaling spend.`,
        tone: 'high',
      });
    }

    const lowApprovalCampaigns = visibleCampaignPerformance.filter((row) => row.approvalRate < 80);
    if (lowApprovalCampaigns.length) {
      alerts.push({
        title: 'Underperforming campaigns',
        description: `${lowApprovalCampaigns.length} campaign${lowApprovalCampaigns.length === 1 ? '' : 's'} are below the 80% approval threshold.`,
        tone: 'medium',
      });
    }

    if (!alerts.length) {
      alerts.push({
        title: 'Reporting looks healthy',
        description: 'No critical campaign alerts are active in the current reporting window.',
        tone: 'low',
      });
    }

    return alerts;
  }, [report?.referralPerformance.fraudFlags, visibleCampaignPerformance]);

  const exportCurrentPerformance = () => {
    if (!visibleCampaignPerformance.length) {
      setStatusMessage('No campaign performance rows are available to export.');
      return;
    }

    triggerDownload(`ad-platform-performance-${analyticsRangeDays}d.csv`, buildCampaignReportCsv(visibleCampaignPerformance.map((row) => ({ ...row, status: campaigns.find((campaign) => campaign.title === row.campaignTitle)?.status ?? 'unlinked' }))));
    setStatusMessage(`Exported ${visibleCampaignPerformance.length} campaign performance row${visibleCampaignPerformance.length === 1 ? '' : 's'}.`);
  };

  const updateCampaignStatus = async (campaign: Campaign, nextStatus: Campaign['status']) => {
    setStatusSavingId(campaign.id);
    const previousStatus = campaign.status;

    setCampaigns((current) => current.map((entry) => (entry.id === campaign.id ? { ...entry, status: nextStatus, updatedAt: new Date().toISOString() } : entry)));

    try {
      const saved = await saveCampaign({ ...campaignToFormValues(campaign), status: nextStatus }, campaign.id);
      setCampaigns((current) => current.map((entry) => (entry.id === campaign.id ? saved : entry)));
      setStatusMessage(`${campaign.title} moved to ${nextStatus}.`);
    } catch {
      setCampaigns((current) => current.map((entry) => (entry.id === campaign.id ? { ...entry, status: previousStatus } : entry)));
      setStatusMessage(`Updated ${campaign.title} locally. Connect Supabase to persist the moderation change.`);
    } finally {
      setStatusSavingId(null);
    }
  };

  const moderationActions = [
    { label: 'Draft', status: 'draft' as const },
    { label: 'Review', status: 'scheduled' as const },
    { label: 'Approve', status: 'active' as const },
    { label: 'Pause', status: 'paused' as const },
    { label: 'Reject', status: 'archived' as const },
  ];

  const fraudSignals = useMemo<FraudSignalSummary[]>(() => {
    const signals = report?.referralPerformance.fraudSignals ?? [];

    if (signals.length) {
      return signals.slice(0, 6);
    }

    return [
      { ruleKey: 'policy-scan', severity: 'low', status: 'clear', count: 0 },
    ];
  }, [report]);

  const fraudControls = useMemo(() => {
    const controlMap = new Map<string, number>();

    campaigns.forEach((campaign) => {
      campaign.engineConfig.verificationPolicy.riskChecks.forEach((check) => {
        controlMap.set(check, (controlMap.get(check) ?? 0) + 1);
      });
    });

    return Array.from(controlMap.entries())
      .map(([label, count]) => ({ label: normalizeLabel(label), count }))
      .sort((left, right) => right.count - left.count);
  }, [campaigns]);

  const scheduleTimeline = useMemo(
    () =>
      [...campaigns]
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
        .slice(0, 4)
        .map((campaign) => ({
          title: campaign.title,
          description: `${formatShortDate(campaign.startDate)} to ${formatShortDate(campaign.endDate)} • ${formatCurrency(campaign.budget)}`,
          meta: normalizeLabel(campaign.status),
        })),
    [campaigns],
  );

  const adTypeRows = useMemo(
    () =>
      liveFormats.map((format) => ({
        ...format,
        topCampaign: campaigns.find((campaign) => inferAdType(campaign) === format.label) ?? null,
      })),
    [campaigns, liveFormats],
  );

  const targetingRows = useMemo(
    () =>
      campaigns.map((campaign) => ({
        campaign,
        regions: normalizeList([...campaign.engineConfig.countryRestrictions, ...campaign.engineConfig.targetAudience.regions]),
        device: normalizeList(campaign.engineConfig.deviceRestrictions),
        languages: normalizeList(campaign.engineConfig.targetAudience.languages),
        ageRange: campaign.engineConfig.targetAudience.ageRange,
        interests: normalizeList(campaign.engineConfig.targetAudience.interests),
      })),
    [campaigns],
  );

  const scheduleRows = useMemo(
    () =>
      campaigns.map((campaign) => ({
        campaign,
        durationDays: daysBetween(campaign.startDate, campaign.endDate),
        dailyBudget: campaign.engineConfig.dailyLimit > 0 ? campaign.budget / campaign.engineConfig.dailyLimit : campaign.budget,
        statusLabel: normalizeLabel(campaign.status),
      })),
    [campaigns],
  );

  const fraudRows = useMemo(
    () =>
      campaigns.map((campaign) => ({
        campaign,
        method: normalizeLabel(campaign.engineConfig.verificationMethod),
        riskChecks: campaign.engineConfig.verificationPolicy.riskChecks.map((check) => normalizeLabel(check)).join(', '),
        status: campaign.engineConfig.verificationPolicy.requiredEvidence.length ? 'Review required' : 'Monitoring',
      })),
    [campaigns],
  );

  const analyticsTrendSeries = useMemo(
    () =>
      report
        ? [
            { title: 'User growth', subtitle: 'New users over time', series: report.userGrowth, chartVar: '--chart-1' },
            { title: 'Active users', subtitle: 'Daily active users', series: report.activeUsers, chartVar: '--chart-2' },
            { title: 'Revenue', subtitle: 'Daily recognized revenue', series: report.revenue, chartVar: '--chart-3' },
            { title: 'Task completion', subtitle: 'Approved submissions as a share of daily submissions', series: report.taskCompletion, chartVar: '--chart-4' },
            { title: 'Retention', subtitle: 'Returning users as a share of daily active users', series: report.retention, chartVar: '--chart-5' },
          ]
        : [],
    [report],
  );

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.18),transparent_36%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Growth operations</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Ad Platform</h1>
            <p className="text-base text-muted">
              A live workspace for format selection, audience targeting, scheduling, analytics, and fraud-aware delivery.
            </p>
          </div>

          <div className="w-full space-y-3 rounded-2xl border border-border bg-surface-elevated p-4 xl:w-[30rem]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Live campaigns</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{isLoading ? '…' : campaigns.length}</p>
                <p className="mt-1 text-xs text-muted">Fetched from Supabase in real time.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Targeting sets</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{isLoading ? '…' : targetingSummaries.reduce((sum, item) => sum + item.values.length, 0)}</p>
                <p className="mt-1 text-xs text-muted">Regions, interests, languages, and age bands.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Analytics</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{isLoading ? 'Loading' : report ? 'Live' : 'Offline'}</p>
                <p className="mt-1 text-xs text-muted">CTR, revenue, and conversion reporting.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Fraud controls</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{isLoading ? '…' : fraudSignals.length}</p>
                <p className="mt-1 text-xs text-muted">Live fraud signals and policy checks.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setActiveTab('analytics')}>
                Review analytics
              </Button>
              <Button type="button" variant="ghost" onClick={() => setActiveTab('fraud')}>
                Inspect fraud controls
              </Button>
              <Link to="/business/campaigns/new" className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft">
                Create campaign
              </Link>
              <Link
                to={selectedCampaign ? `/business/campaigns/${selectedCampaign.id}/edit` : '/business/campaigns'}
                className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
              >
                {selectedCampaign ? 'Edit selected campaign' : 'Open campaign editor'}
              </Link>
            </div>
            <CampaignDetailPanel campaign={selectedCampaign} report={report} />
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live sync</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Campaign and reporting feed</h2>
            <p className="mt-2 max-w-3xl text-muted">{statusMessage}</p>
          </div>
          <p className={`text-sm ${loadError ? 'text-rose-300' : 'text-muted'}`}>{isLoading ? 'Refreshing live sources...' : loadError ? 'Supabase feed unavailable' : 'Updated from Supabase'} </p>
        </div>
      </Card>

      {isLoading ? <AdPlatformStatePanel tone="loading" title="Syncing live campaign sources" description="Pulling campaigns and analytics from Supabase before rendering the section tables." /> : null}

      {loadError ? <AdPlatformStatePanel tone="error" title="Live campaign data unavailable" description="The operator workspace is using the local layout shell until the Supabase feed recovers." /> : null}

      <Tabs tabs={adSectionTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'ad-types' ? (
        <SectionCard
          eyebrow="Ad types"
          title="Creative inventory"
          description="Each card reflects a live campaign format inferred from the current campaign feed."
        >
          {isLoading ? (
            <AdPlatformStatePanel tone="loading" title="Loading creative inventory" description="Waiting for campaign rows before inferring ad formats and creative placements." />
          ) : hasLiveCampaigns ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-elevated text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Format</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Live campaigns</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Budget</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Top campaign</th>
                  </tr>
                </thead>
                <tbody>
                  {adTypeRows.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-foreground">{row.label}</p>
                        <p className="mt-1 text-xs text-muted">Inferred from live campaign creative and type metadata.</p>
                      </td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.count}</td>
                      <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(row.budget)}</td>
                      <td className="px-4 py-3 align-top">
                        {row.topCampaign ? (
                          <button
                            type="button"
                            className="text-left text-accent transition hover:text-foreground"
                            onClick={() => setSelectedCampaignId(row.topCampaign?.id ?? null)}
                          >
                            <span className="block font-medium text-foreground">{row.topCampaign.title}</span>
                            <span className="block text-xs text-muted">{row.topCampaign.status} · {formatShortDate(row.topCampaign.startDate)}</span>
                          </button>
                        ) : (
                          <span className="text-muted">No campaign assigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdPlatformStatePanel tone={emptyTone} title={emptyTitle} description={emptyDescription} />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'targeting' ? (
        <SectionCard
          eyebrow="Targeting"
          title="Audience filters"
          description="Live campaign configuration drives the audience mix shown here."
        >
          {isLoading ? (
            <AdPlatformStatePanel tone="loading" title="Loading audience filters" description="Waiting for campaign audience definitions before rendering targeting rows." />
          ) : hasLiveCampaigns ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-elevated text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Regions</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Device</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Languages</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Age</th>
                    <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Interests</th>
                  </tr>
                </thead>
                <tbody>
                  {targetingRows.map((row) => (
                    <tr key={row.campaign.id} className="border-t border-border">
                      <td className="px-4 py-3 align-top">
                        <button type="button" className="text-left" onClick={() => setSelectedCampaignId(row.campaign.id)}>
                          <span className="block font-medium text-foreground">{row.campaign.title}</span>
                          <span className="block text-xs text-muted">{normalizeLabel(row.campaign.campaignType)}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.regions}</td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.device}</td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.languages}</td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.ageRange}</td>
                      <td className="px-4 py-3 align-top text-foreground/85">{row.interests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdPlatformStatePanel tone={emptyTone} title={emptyTitle} description={emptyDescription} />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'scheduling' ? (
        <SectionCard
          eyebrow="Scheduling"
          title="Budget and delivery control"
          description="Spend ceilings, launch windows, and campaign pacing are derived from live campaign records."
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {isLoading ? (
              <AdPlatformStatePanel tone="loading" title="Loading scheduling data" description="Waiting for campaign windows and budget caps from the live feed." />
            ) : hasLiveCampaigns ? (
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface-elevated text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Launch window</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Budget</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Daily cap</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row) => (
                      <tr key={row.campaign.id} className="border-t border-border">
                        <td className="px-4 py-3 align-top">
                          <button type="button" className="text-left" onClick={() => setSelectedCampaignId(row.campaign.id)}>
                            <span className="block font-medium text-foreground">{row.campaign.title}</span>
                            <span className="block text-xs text-muted">{normalizeLabel(row.campaign.campaignType)}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(row.campaign.status)}`}>{row.statusLabel}</span>
                        </td>
                        <td className="px-4 py-3 align-top text-foreground/85">
                          {formatCompactDate(row.campaign.startDate)} - {formatCompactDate(row.campaign.endDate)}
                        </td>
                        <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(row.campaign.budget, row.campaign.budgetCurrency)}</td>
                        <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(row.dailyBudget, row.campaign.budgetCurrency)}</td>
                        <td className="px-4 py-3 align-top text-foreground/85">{row.durationDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdPlatformStatePanel tone={emptyTone} title={emptyTitle} description={emptyDescription} />
            )}

            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Launch sequence</p>
              <Timeline items={scheduleTimeline} />
              <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted">
                Daily budgets are derived from each campaign window and the configured daily delivery cap.
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === 'analytics' ? (
        <SectionCard
          eyebrow="Analytics"
          title="Performance dashboard"
          description="CTR, conversions, revenue, and spend are synchronized from the analytics report."
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Reporting filters</p>
              <div className="flex flex-wrap gap-2">
                {([7, 30, 90] as AnalyticsRangeDays[]).map((days) => (
                  <Button key={days} type="button" variant={analyticsRangeDays === days ? 'primary' : 'ghost'} onClick={() => setAnalyticsRangeDays(days)}>
                    Last {days} days
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="space-y-1 text-sm text-muted">
                <span className="block text-xs uppercase tracking-[0.2em] text-muted">Campaign filter</span>
                <select value={campaignLifecycleFilter} onChange={(event) => setCampaignLifecycleFilter(event.target.value as CampaignLifecycleFilter)} className="input-base min-w-44">
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-muted">
                <span className="block text-xs uppercase tracking-[0.2em] text-muted">Search</span>
                <input value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} className="input-base min-w-56" placeholder="Campaign name or type" />
              </label>
              <Button type="button" variant="ghost" onClick={exportCurrentPerformance} disabled={!visibleCampaignPerformance.length}>
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {analyticsMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{metric.value}</p>
                <p className="mt-2 text-sm text-muted">{metric.note}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {analyticsAlerts.map((alert) => (
              <div key={alert.title} className={`rounded-2xl border p-4 ${alert.tone === 'high' ? 'border-rose-500/20 bg-rose-500/10' : alert.tone === 'medium' ? 'border-amber-500/20 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Alert</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{alert.title}</p>
                <p className="mt-1 text-sm text-muted">{alert.description}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <AdPlatformStatePanel tone="loading" title="Loading analytics charts" description="Waiting for the reporting payload before rendering trend charts and performance rows." />
          ) : report ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {analyticsTrendSeries.map((chart) => (
                <MiniSeriesChart key={chart.title} title={chart.title} subtitle={chart.subtitle} series={chart.series} chartVar={chart.chartVar} />
              ))}
            </div>
          ) : (
            <AdPlatformStatePanel tone={emptyTone} title={emptyTitle} description={emptyDescription} />
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Campaign performance</p>
              {isLoading ? (
                <AdPlatformStatePanel tone="loading" title="Loading campaign performance" description="Waiting for the analytics window before showing campaign rows." />
              ) : visibleCampaignPerformance.length ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface-elevated text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Participants</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Submissions</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Approval</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Rewards</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Spend</th>
                        <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCampaignPerformance.slice(0, 5).map((item) => {
                        const linkedCampaign = campaigns.find((campaign) => campaign.title === item.campaignTitle);

                        return (
                          <tr key={item.campaignId} className="border-t border-border">
                            <td className="px-4 py-3 align-top">
                              <button type="button" className="text-left" onClick={() => setSelectedCampaignId(linkedCampaign?.id ?? null)}>
                                <span className="block font-medium text-foreground">{item.campaignTitle}</span>
                                <span className="block text-xs text-muted">Live reporting row</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 align-top text-foreground/85">{formatCompactNumber(item.participants)}</td>
                            <td className="px-4 py-3 align-top text-foreground/85">{formatCompactNumber(item.submissions)}</td>
                            <td className="px-4 py-3 align-top text-foreground/85">{item.approvalRate.toFixed(1)}%</td>
                            <td className="px-4 py-3 align-top text-foreground/85">{formatCompactNumber(item.rewardsIssued)}</td>
                            <td className="px-4 py-3 align-top text-foreground/85">{formatCurrency(item.spend)}</td>
                            <td className="px-4 py-3 align-top text-foreground/85">{normalizeLabel(linkedCampaign?.status ?? 'unlinked')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4">
                  <AdPlatformStatePanel tone={emptyTone} title="No matching performance rows" description="Adjust the status filter, search term, or analytics window to reveal campaign rows for export and review." />
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Recent optimization signals</p>
              <Timeline items={analyticsSignals} />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === 'fraud' ? (
        <SectionCard
          eyebrow="Fraud"
          title="Traffic quality controls"
          description="Live fraud signals and campaign policy checks surface the trust posture of the current inventory."
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {isLoading ? (
              <AdPlatformStatePanel tone="loading" title="Loading fraud policy data" description="Waiting for verification methods and risk checks before showing policy rows." />
            ) : hasLiveCampaigns ? (
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface-elevated text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Campaign</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Verification</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Risk checks</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Policy status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraudRows.map((row) => (
                      <tr key={row.campaign.id} className="border-t border-border">
                        <td className="px-4 py-3 align-top">
                          <button type="button" className="text-left" onClick={() => setSelectedCampaignId(row.campaign.id)}>
                            <span className="block font-medium text-foreground">{row.campaign.title}</span>
                            <span className="block text-xs text-muted">{normalizeLabel(row.campaign.campaignType)}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top text-foreground/85">{row.method}</td>
                        <td className="px-4 py-3 align-top text-foreground/85">{row.riskChecks}</td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(row.status)}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdPlatformStatePanel tone={emptyTone} title={emptyTitle} description={emptyDescription} />
            )}

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Approval and moderation</p>
                <p className="mt-2 text-sm text-muted">Use the selected campaign to move creative between draft, review, active, paused, and rejected states.</p>
                {selectedCampaign ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Selected: {selectedCampaign.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {moderationActions.map((action) => (
                        <Button
                          key={action.label}
                          type="button"
                          variant={selectedCampaign.status === action.status ? 'primary' : 'ghost'}
                          onClick={() => void updateCampaignStatus(selectedCampaign, action.status)}
                          disabled={statusSavingId === selectedCampaign.id}
                        >
                          {statusSavingId === selectedCampaign.id && selectedCampaign.status !== action.status ? 'Saving...' : action.label}
                        </Button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted">
                      Draft maps to inactive review, review maps to scheduled launch, approve maps to active delivery, and rejected maps to archived inventory in the current schema.
                    </div>
                  </div>
                ) : (
                  <AdPlatformStatePanel tone={emptyTone} title="No campaign selected" description="Pick a campaign row to expose moderation actions and status updates." />
                )}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Active controls</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {fraudControls.length ? (
                    fraudControls.map((control) => (
                      <span key={control.label} className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-sm text-foreground">
                        {control.label} · {control.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">No campaign policy checks detected yet.</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Review queue</p>
                <Timeline
                  items={fraudSignals.map((signal) => ({
                    title: normalizeLabel(signal.ruleKey),
                    description: `${signal.count} signal${signal.count === 1 ? '' : 's'} · ${normalizeLabel(signal.severity)} severity`,
                    meta: normalizeLabel(signal.status),
                  }))}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
