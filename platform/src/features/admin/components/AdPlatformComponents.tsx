import { Card } from '@/components/ui/Card';
import type { AnalyticsReport } from '@/services/api/analytics';
import type { Campaign } from '@/types';

type TrendPoint = {
  label: string;
  value: number;
};

type StateTone = 'loading' | 'error' | 'empty';

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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function normalizeLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function normalizeList(values: string[] | undefined, fallback = 'All'): string {
  return values?.length ? values.join(', ') : fallback;
}

function stateToneClasses(tone: StateTone): string {
  if (tone === 'loading') {
    return 'border-sky-500/20 bg-sky-500/10 text-sky-100';
  }

  if (tone === 'error') {
    return 'border-rose-500/20 bg-rose-500/10 text-rose-100';
  }

  return 'border-border bg-surface text-muted';
}

function createTrendPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function createAreaPath(points: Array<{ x: number; y: number }>, baselineY: number): string {
  if (!points.length) return '';

  return `M ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} ${points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

function normalizeSeries(values: number[], width: number, height: number, padding: number) {
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = Math.max(1, maxValue - minValue);

  return values.map((value, index) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1),
    y: height - padding - ((value - minValue) / span) * (height - padding * 2),
  }));
}

export function MiniSeriesChart({ title, subtitle, series, chartVar }: { title: string; subtitle: string; series: TrendPoint[]; chartVar: string }): JSX.Element {
  const width = 320;
  const height = 160;
  const padding = 20;
  const points = normalizeSeries(series.map((entry) => entry.value), width, height, padding);
  const maxValue = Math.max(...series.map((entry) => entry.value), 1);
  const baselineY = height - padding;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{title}</p>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-40 w-full" role="img" aria-labelledby={`${title}-chart-title ${title}-chart-desc`}>
        <title id={`${title}-chart-title`}>{title} trend chart</title>
        <desc id={`${title}-chart-desc`}>{subtitle}</desc>
        <path d={createAreaPath(points, baselineY)} fill={`hsl(var(${chartVar}) / 0.18)`} />
        <path d={createTrendPath(points)} fill="none" stroke={`hsl(var(${chartVar}))`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={series[index]?.label ?? index}>
            <circle cx={point.x} cy={point.y} r="4" fill={`hsl(var(${chartVar}))`} />
            <text x={point.x} y={height - 4} textAnchor="middle" className="fill-muted text-[11px]">
              {series[index]?.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Latest value</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCompactNumber(series[series.length - 1]?.value ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Peak value</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCompactNumber(maxValue)}</p>
        </div>
      </div>
    </div>
  );
}

export function CampaignDetailPanel({ campaign, report }: { campaign: Campaign | null; report: AnalyticsReport | null }): JSX.Element {
  if (!campaign) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Campaign detail drawer</p>
        <p className="mt-2 text-sm text-muted">Select any live campaign to inspect creative review, audience overrides, budget caps, pacing, and fraud review.</p>
      </div>
    );
  }

  const audience = campaign.engineConfig.targetAudience;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Campaign detail drawer</p>
        <h3 className="mt-1 text-xl font-semibold text-foreground">{campaign.title}</h3>
        <p className="text-sm text-muted">{campaign.description || campaign.instructions}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Creative review</p>
          <p className="mt-1 text-sm text-foreground">{campaign.campaignImageUrl || campaign.bannerUrl || campaign.videoUrl || 'No creative URL provided yet.'}</p>
          <p className="mt-1 text-xs text-muted">Landing URL: {campaign.landingUrl || 'Not set'}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Audience overrides</p>
          <p className="mt-1 text-sm text-foreground">{audience.ageRange}</p>
          <p className="mt-1 text-xs text-muted">Regions: {normalizeList(audience.regions)}</p>
          <p className="mt-1 text-xs text-muted">Languages: {normalizeList(audience.languages)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Budget caps</p>
          <p className="mt-1 text-sm text-foreground">Budget {formatCurrency(campaign.budget, campaign.budgetCurrency)}</p>
          <p className="mt-1 text-xs text-muted">Rewards allocated {formatCurrency(campaign.totalRewardsAllocated, campaign.budgetCurrency)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Pacing</p>
          <p className="mt-1 text-sm text-foreground">{formatShortDate(campaign.startDate)} to {formatShortDate(campaign.endDate)}</p>
          <p className="mt-1 text-xs text-muted">{campaign.currentParticipants} participants · {campaign.status}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3 sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Fraud review</p>
          <p className="mt-1 text-sm text-foreground">{normalizeList(campaign.engineConfig.verificationPolicy.riskChecks.map((check) => normalizeLabel(check)))}</p>
          <p className="mt-1 text-xs text-muted">Verification method: {normalizeLabel(campaign.engineConfig.verificationMethod)} · Auto approval {campaign.engineConfig.autoApproval ? 'on' : 'off'}</p>
          <p className="mt-1 text-xs text-muted">{report?.referralPerformance.fraudFlags ?? 0} open fraud flags in reporting.</p>
        </div>
      </div>
    </div>
  );
}

export function AdPlatformStatePanel({ tone, title, description }: { tone: StateTone; title: string; description: string }): JSX.Element {
  return (
    <div className={`rounded-2xl border p-8 text-center ${stateToneClasses(tone)}`}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}
