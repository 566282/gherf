import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/auth';
import { defaultFraudThresholds, describeFraudRiskChecks, fraudRiskChecks } from '@/services/api/fraud';
import { campaignToFormValues, listCampaigns, saveCampaign } from '@/services/api/campaigns';
import { sendAdminPaymentNotification } from '@/services/api/communications';
import type { Campaign } from '@/types';

type ActivityTone = 'info' | 'success' | 'warning';

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: ActivityTone;
  createdAt: string;
};

type CampaignMetrics = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  roi: number;
};

type BusinessEvent = ActivityItem;

type TimeWindow = '7d' | '30d' | '90d';

type ExportFormat = 'csv' | 'json';

type TrendPoint = {
  label: string;
  spend: number;
  revenue: number;
  conversions: number;
  ctr: number;
};

type ComparisonMetric = {
  label: string;
  selected: number;
  benchmark: number;
  selectedLabel: string;
  benchmarkLabel: string;
  format: 'currency' | 'number' | 'percent';
};

type HeatmapCell = {
  day: string;
  segment: string;
  value: number;
};

const timeWindowOptions: Array<{ value: TimeWindow; label: string; detail: string }> = [
  { value: '7d', label: '7 days', detail: 'Fast-moving view' },
  { value: '30d', label: '30 days', detail: 'Default planning window' },
  { value: '90d', label: '90 days', detail: 'Quarterly rollout' },
];

const exportOptions: Array<{ value: ExportFormat; label: string }> = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

const statusFilters = ['all', 'active', 'paused', 'scheduled', 'draft', 'completed', 'archived'] as const;

const chartSeriesColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatSignedPercent(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function getWindowMultipliers(window: TimeWindow) {
  if (window === '7d') return [0.54, 0.63, 0.72, 0.81, 0.93, 1.06];
  if (window === '90d') return [0.42, 0.51, 0.61, 0.73, 0.86, 1.03];
  return [0.48, 0.57, 0.67, 0.78, 0.9, 1.02];
}

function buildTrendSeries(summary: { totalSpend: number; totalRevenue: number; totalConversions: number; ctr: number }, window: TimeWindow): TrendPoint[] {
  const labels = window === '7d' ? ['M', 'T', 'W', 'T', 'F', 'S'] : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const multipliers = getWindowMultipliers(window);

  return labels.map((label, index) => ({
    label,
    spend: summary.totalSpend * multipliers[index],
    revenue: summary.totalRevenue * (multipliers[index] + 0.08),
    conversions: summary.totalConversions * (multipliers[index] * 0.88 + 0.12),
    ctr: clamp(summary.ctr * (0.88 + index * 0.04), 0, 100),
  }));
}

function buildHeatmap(campaignRows: Array<{ campaign: Campaign; metrics: CampaignMetrics }>) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const segments = ['Awareness', 'Engagement', 'Conversion', 'Retention'];
  const totalSpend = campaignRows.reduce((sum, row) => sum + row.metrics.spend, 0);
  const totalClicks = campaignRows.reduce((sum, row) => sum + row.metrics.clicks, 0);

  return days.flatMap((day, dayIndex) =>
    segments.map((segment, segmentIndex) => {
      const value = Math.round(
        (totalSpend * (0.03 + dayIndex * 0.004) + totalClicks * (0.5 + segmentIndex * 0.12) + (dayIndex + 1) * (segmentIndex + 1) * 11) /
          (campaignRows.length || 1),
      );

      return {
        day,
        segment,
        value,
      };
    }),
  );
}

function buildGeoRegions(campaignRows: Array<{ campaign: Campaign; metrics: CampaignMetrics }>) {
  const regionBuckets = new Map<string, number>();

  for (const { campaign, metrics } of campaignRows) {
    const regions = campaign.engineConfig.targetAudience.regions.length ? campaign.engineConfig.targetAudience.regions : ['Global'];
    for (const region of regions) {
      regionBuckets.set(region, (regionBuckets.get(region) ?? 0) + metrics.revenue);
    }
  }

  return Array.from(regionBuckets.entries())
    .map(([label, value], index) => ({ label, value, color: chartSeriesColors[index % chartSeriesColors.length] }))
    .sort((left, right) => right.value - left.value);
}

function buildBarData(campaignRows: Array<{ campaign: Campaign; metrics: CampaignMetrics }>) {
  return [...campaignRows]
    .map(({ campaign, metrics }) => ({
      label: campaign.title,
      value: metrics.conversions,
      secondary: metrics.revenue,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
}

function buildDonutSegments(campaignRows: Array<{ campaign: Campaign; metrics: CampaignMetrics }>) {
  const totals = campaignRows.reduce(
    (accumulator, { campaign, metrics }) => {
      accumulator[campaign.status] = (accumulator[campaign.status] ?? 0) + metrics.spend;
      return accumulator;
    },
    {} as Record<Campaign['status'], number>,
  );

  const entries = Object.entries(totals).filter(([, value]) => value > 0);
  const totalSpend = entries.reduce((sum, [, value]) => sum + value, 0);

  return entries.map(([label, value], index) => ({
    label,
    value,
    share: totalSpend > 0 ? (value / totalSpend) * 100 : 0,
    color: chartSeriesColors[index % chartSeriesColors.length],
  }));
}

function buildForecast(summary: { totalSpend: number; totalRevenue: number; totalConversions: number; roi: number }) {
  const spendGrowth = summary.totalSpend * 0.08;
  const revenueGrowth = summary.totalRevenue * 0.12;
  const conversionGrowth = summary.totalConversions * 0.1;

  return [
    { label: 'Projected spend', value: summary.totalSpend + spendGrowth, detail: 'Next cycle planning' },
    { label: 'Projected revenue', value: summary.totalRevenue + revenueGrowth, detail: 'Revenue lift from current pace' },
    { label: 'Projected conversions', value: summary.totalConversions + conversionGrowth, detail: 'Assuming stable CTR' },
    { label: 'Projected ROI', value: summary.roi + 4.2, detail: 'Expected efficiency delta' },
  ];
}

function createTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function createAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) return '';
  const start = `M ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)}`;
  const line = points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const end = `L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  return `${start} ${line} ${end}`;
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

function createEngineConfig(campaignType: Campaign['campaignType']): Campaign['engineConfig'] {
  const baseReward = campaignType === 'referral_campaigns' ? 4.5 : campaignType === 'watch_videos' ? 1.8 : 2.5;

  return {
    campaignType,
    instructions: 'Review the campaign instructions and launch the selected channel once the budget is approved.',
    rewardAmount: baseReward,
    durationValue: 14,
    durationUnit: 'days',
    completionLimit: 1200,
    dailyLimit: 120,
    countryRestrictions: ['US', 'CA'],
    deviceRestrictions: ['any'],
    browserRestrictions: ['any'],
    verificationMethod: campaignType === 'referral_campaigns' ? 'api_verification' : 'manual_review',
    autoApproval: false,
    manualApproval: true,
    budget: 10000,
    totalParticipants: 1200,
    targetAudience: {
      ageRange: '18-44',
      interests: ['mobile growth', 'product launches'],
      regions: ['North America'],
      languages: ['en'],
      tags: ['high-intent', 'new-audience'],
      notes: 'Performance-focused acquisition audience.',
    },
    activeFrom: '2026-06-24T00:00:00.000Z',
    activeTo: '2026-07-24T00:00:00.000Z',
    priority: 2,
    requiredScreenshots: campaignType === 'social_media_follows' ? 1 : 0,
    requiredProof: '',
    verificationPolicy: {
      primaryMethod: campaignType === 'referral_campaigns' ? 'api_verification' : 'manual_review',
      requiredEvidence: campaignType === 'social_media_follows' ? ['screenshot_upload'] : [],
      riskChecks: [...fraudRiskChecks],
      randomAuditRate: 5,
      fraudThreshold: defaultFraudThresholds.block,
      appealWindowHours: 72,
    },
    timeDelayBeforeReward: 0,
    cooldownPeriod: 0,
  };
}

function createDemoCampaign(
  overrides: Partial<Campaign> &
    Pick<
      Campaign,
      'id' | 'title' | 'campaignType' | 'status' | 'budget' | 'budgetCurrency' | 'startDate' | 'endDate' | 'totalRewardsAllocated' | 'currentParticipants'
    >,
): Campaign {
  const engineConfig = overrides.engineConfig ?? createEngineConfig(overrides.campaignType);

  return {
    id: overrides.id,
    businessId: overrides.businessId ?? 'business-northstar-media',
    title: overrides.title,
    description: overrides.description ?? 'Demo business campaign used to showcase advertiser controls.',
    bannerUrl: overrides.bannerUrl,
    campaignType: overrides.campaignType,
    instructions: overrides.instructions ?? engineConfig.instructions,
    engineConfig,
    status: overrides.status,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    budget: overrides.budget,
    budgetCurrency: overrides.budgetCurrency,
    totalRewardsAllocated: overrides.totalRewardsAllocated,
    maxParticipants: overrides.maxParticipants,
    currentParticipants: overrides.currentParticipants,
    createdAt: overrides.createdAt ?? overrides.startDate,
    updatedAt: overrides.updatedAt ?? overrides.endDate,
  };
}

const demoCampaigns: Campaign[] = [
  createDemoCampaign({
    id: 'demo-campaign-01',
    title: 'Spring referral sprint',
    campaignType: 'referral_campaigns',
    status: 'active',
    budget: 15000,
    budgetCurrency: 'USD',
    startDate: '2026-06-20T00:00:00.000Z',
    endDate: '2026-07-20T00:00:00.000Z',
    totalRewardsAllocated: 11250,
    currentParticipants: 842,
    maxParticipants: 2500,
    engineConfig: {
      ...createEngineConfig('referral_campaigns'),
      rewardAmount: 4.5,
      budget: 15000,
      totalParticipants: 2500,
      completionLimit: 2500,
      dailyLimit: 180,
      targetAudience: {
        ageRange: '20-45',
        interests: ['referrals', 'finance', 'growth loops'],
        regions: ['North America', 'Europe'],
        languages: ['en'],
        tags: ['high-conversion', 'retention'],
        notes: 'Referral participants with high conversion propensity.',
      },
    },
  }),
  createDemoCampaign({
    id: 'demo-campaign-02',
    title: 'App install rollout',
    campaignType: 'install_mobile_apps',
    status: 'paused',
    budget: 9800,
    budgetCurrency: 'USD',
    startDate: '2026-06-12T00:00:00.000Z',
    endDate: '2026-07-18T00:00:00.000Z',
    totalRewardsAllocated: 7600,
    currentParticipants: 514,
    maxParticipants: 1400,
    engineConfig: {
      ...createEngineConfig('install_mobile_apps'),
      rewardAmount: 3.75,
      budget: 9800,
      totalParticipants: 1400,
      verificationMethod: 'screenshot_upload',
      verificationPolicy: {
        ...createEngineConfig('install_mobile_apps').verificationPolicy,
        primaryMethod: 'screenshot_upload',
        requiredEvidence: ['screenshot_upload'],
      },
    },
  }),
  createDemoCampaign({
    id: 'demo-campaign-03',
    title: 'Video completion test',
    campaignType: 'watch_videos',
    status: 'scheduled',
    budget: 6200,
    budgetCurrency: 'USD',
    startDate: '2026-07-06T00:00:00.000Z',
    endDate: '2026-07-28T00:00:00.000Z',
    totalRewardsAllocated: 5200,
    currentParticipants: 298,
    maxParticipants: 900,
    engineConfig: {
      ...createEngineConfig('watch_videos'),
      rewardAmount: 1.8,
      budget: 6200,
      totalParticipants: 900,
      completionLimit: 900,
      dailyLimit: 90,
      verificationMethod: 'video_proof',
      verificationPolicy: {
        ...createEngineConfig('watch_videos').verificationPolicy,
        primaryMethod: 'video_proof',
        requiredEvidence: ['video_proof'],
      },
    },
  }),
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function statusClass(status: Campaign['status']) {
  if (status === 'active') return 'bg-mint/12 text-mint border-white/10';
  if (status === 'paused') return 'bg-white/6 text-mist/80 border-white/10';
  if (status === 'scheduled') return 'bg-white/6 text-mist/80 border-white/10';
  if (status === 'completed') return 'bg-white/6 text-mist/80 border-white/10';
  return 'bg-white/10 text-mist border-white/10';
}

function toneClass(tone: ActivityTone) {
  if (tone === 'success') return 'border-white/10 bg-white/5 text-mist/80';
  if (tone === 'warning') return 'border-white/10 bg-white/5 text-mist/80';
  return 'border-white/10 bg-white/5 text-mist';
}

function calculateMetrics(campaign: Campaign): CampaignMetrics {
  const statusFactor =
    campaign.status === 'active'
      ? 1
      : campaign.status === 'scheduled'
        ? 0.72
        : campaign.status === 'paused'
          ? 0.6
          : campaign.status === 'completed'
            ? 1.08
            : 0.35;

  const audienceFactor = Math.max(0.75, campaign.engineConfig.totalParticipants / 1000);
  const impressions = Math.round((campaign.budget * 110 + campaign.engineConfig.rewardAmount * 340) * statusFactor * audienceFactor);
  const ctr = Math.min(9.5, 1.25 + campaign.engineConfig.rewardAmount / 2.8 + campaign.engineConfig.priority * 0.22);
  const clicks = Math.round(impressions * (ctr / 100));
  const conversionRate = Math.min(35, 10 + campaign.engineConfig.rewardAmount * 1.8 + campaign.engineConfig.completionLimit / 220);
  const conversions = Math.round(clicks * (conversionRate / 100));
  const spend = Math.min(campaign.budget, Math.max(0, campaign.currentParticipants * campaign.engineConfig.rewardAmount * 0.88));
  const revenue = conversions * campaign.engineConfig.rewardAmount * 5.5 + clicks * 0.42 + impressions * 0.015;
  const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

  return {
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr,
    roi,
  };
}

function buildHistory(totalSpend: number) {
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const multipliers = [0.44, 0.56, 0.68, 0.74, 0.82, 0.95];

  return labels.map((label, index) => ({
    label,
    value: Math.round(totalSpend * multipliers[index]),
  }));
}

function formatReportValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function BusinessDashboardPage() {
  const navigate = useNavigate();
  const { data: loadedCampaigns = [], isLoading, error } = useQuery({
    queryKey: ['business-campaigns'],
    queryFn: listCampaigns,
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>(demoCampaigns);
  const [businessName, setBusinessName] = useState('Northstar Media');
  const [website, setWebsite] = useState('https://northstar.media');
  const [contactEmail, setContactEmail] = useState('growth@northstar.media');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [depositAmount, setDepositAmount] = useState('5000');
  const [reserveBalance, setReserveBalance] = useState(45000);
  const [selectedCampaignId, setSelectedCampaignId] = useState(demoCampaigns[0].id);
  const [budgetDraft, setBudgetDraft] = useState(String(demoCampaigns[0].budget));
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(100);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityLog, setActivityLog] = useState<BusinessEvent[]>([
    {
      id: 'event-registration',
      title: 'Business onboarding ready',
      detail: 'Register your business entity, verify ownership, then unlock funding and campaign creation.',
      tone: 'warning',
      createdAt: '2026-07-03T09:00:00.000Z',
    },
  ]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loadedCampaigns.length > 0) {
      setCampaigns(loadedCampaigns);
    }
  }, [loadedCampaigns]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null,
    [campaigns, selectedCampaignId],
  );

  const campaignRows = useMemo(
    () => campaigns.map((campaign) => ({ campaign, metrics: calculateMetrics(campaign) })),
    [campaigns],
  );

  const filteredCampaignRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return campaignRows.filter(({ campaign }) => {
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      const channelName = campaign.campaignType.replace(/_/g, ' ');
      const matchesChannel = channelFilter === 'all' || channelName === channelFilter;
      const searchable = [campaign.title, campaign.description ?? '', campaign.status, channelName, campaign.engineConfig.targetAudience.regions.join(' ')].join(' ').toLowerCase();
      const matchesSearch = normalizedQuery.length === 0 || searchable.includes(normalizedQuery);

      return matchesStatus && matchesChannel && matchesSearch;
    });
  }, [campaignRows, channelFilter, searchQuery, statusFilter]);

  useEffect(() => {
    if (selectedCampaign && selectedCampaign.id !== selectedCampaignId) {
      setSelectedCampaignId(selectedCampaign.id);
    }
  }, [selectedCampaign, selectedCampaignId]);

  useEffect(() => {
    if (selectedCampaign) {
      setBudgetDraft(String(selectedCampaign.budget));
    }
  }, [selectedCampaign?.id]);

  const summary = useMemo(() => {
    const sourceRows = filteredCampaignRows.length > 0 ? filteredCampaignRows : campaignRows;
    const totalBudget = sourceRows.reduce((sum, row) => sum + row.campaign.budget, 0);
    const activeBudget = sourceRows.filter(({ campaign }) => campaign.status === 'active').reduce((sum, row) => sum + row.campaign.budget, 0);
    const totalSpend = sourceRows.reduce((sum, row) => sum + row.metrics.spend, 0);
    const totalRevenue = sourceRows.reduce((sum, row) => sum + row.metrics.revenue, 0);
    const totalImpressions = sourceRows.reduce((sum, row) => sum + row.metrics.impressions, 0);
    const totalClicks = sourceRows.reduce((sum, row) => sum + row.metrics.clicks, 0);
    const totalConversions = sourceRows.reduce((sum, row) => sum + row.metrics.conversions, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const spendingHistory = buildHistory(totalSpend);
    const trendSeries = buildTrendSeries({ totalSpend, totalRevenue, totalConversions, ctr }, timeWindow);

    return {
      totalBudget,
      activeBudget,
      totalSpend,
      totalRevenue,
      totalImpressions,
      totalClicks,
      totalConversions,
      ctr,
      roi,
      spendingHistory,
      trendSeries,
    };
  }, [campaignRows, filteredCampaignRows, timeWindow]);

  const selectedMetrics = useMemo(() => {
    if (!selectedCampaign) {
      return null;
    }

    return calculateMetrics(selectedCampaign);
  }, [selectedCampaign]);

  const selectedFraudReasons = useMemo(
    () => describeFraudRiskChecks(selectedCampaign?.engineConfig.verificationPolicy.riskChecks ?? []),
    [selectedCampaign],
  );

  const conversionFeed = useMemo(() => {
    return (filteredCampaignRows.length > 0 ? filteredCampaignRows : campaignRows)
      .map(({ campaign, metrics }) => ({
        id: campaign.id,
        title: campaign.title,
        count: metrics.conversions,
        value: metrics.conversions * campaign.engineConfig.rewardAmount,
        channel: campaign.campaignType.replace(/_/g, ' '),
        updatedAt: campaign.updatedAt,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4);
  }, [campaignRows, filteredCampaignRows]);

  const chartCampaignRows = filteredCampaignRows.length > 0 ? filteredCampaignRows : campaignRows;
  const channelOptions = useMemo(
    () => ['all', ...Array.from(new Set(campaignRows.map(({ campaign }) => campaign.campaignType.replace(/_/g, ' '))))],
    [campaignRows],
  );
  const donutSegments = useMemo(() => buildDonutSegments(chartCampaignRows), [chartCampaignRows]);
  const barData = useMemo(() => buildBarData(chartCampaignRows), [chartCampaignRows]);
  const heatmapCells = useMemo(() => buildHeatmap(chartCampaignRows), [chartCampaignRows]);
  const geoRegions = useMemo(() => buildGeoRegions(chartCampaignRows), [chartCampaignRows]);
  const forecastCards = useMemo(() => buildForecast(summary), [summary]);

  const performanceComparison = useMemo<ComparisonMetric[]>(() => {
    const sourceRows = chartCampaignRows;
    const topRow = [...sourceRows].sort((left, right) => right.metrics.roi - left.metrics.roi)[0] ?? null;
    const averageSpend = sourceRows.length > 0 ? sourceRows.reduce((sum, row) => sum + row.metrics.spend, 0) / sourceRows.length : 0;
    const averageConversions = sourceRows.length > 0 ? sourceRows.reduce((sum, row) => sum + row.metrics.conversions, 0) / sourceRows.length : 0;

    return [
      {
        label: 'Spend',
        selected: selectedMetrics?.spend ?? 0,
        benchmark: averageSpend,
        selectedLabel: selectedCampaign ? selectedCampaign.title : 'Selected campaign',
        benchmarkLabel: 'Portfolio average',
        format: 'currency',
      },
      {
        label: 'ROI',
        selected: selectedMetrics?.roi ?? 0,
        benchmark: topRow?.metrics.roi ?? summary.roi,
        selectedLabel: selectedCampaign ? selectedCampaign.title : 'Selected campaign',
        benchmarkLabel: topRow ? topRow.campaign.title : 'Portfolio benchmark',
        format: 'percent',
      },
      {
        label: 'Conversions',
        selected: selectedMetrics?.conversions ?? 0,
        benchmark: averageConversions,
        selectedLabel: selectedCampaign ? selectedCampaign.title : 'Selected campaign',
        benchmarkLabel: 'Portfolio average',
        format: 'number',
      },
    ];
  }, [chartCampaignRows, selectedCampaign, selectedMetrics, summary.roi]);

  const availableBudget = reserveBalance - summary.totalSpend;
  const totalCampaigns = chartCampaignRows.length;
  const activeCampaigns = chartCampaignRows.filter((row) => row.campaign.status === 'active').length;
  const pausedCampaigns = chartCampaignRows.filter((row) => row.campaign.status === 'paused').length;
  const draftCampaigns = chartCampaignRows.filter((row) => row.campaign.status === 'draft').length;

  const pushActivity = (title: string, detail: string, tone: ActivityTone = 'info') => {
    setActivityLog((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        detail,
        tone,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 6));
  };

  const handleRegisterBusiness = () => {
    setIsRegistered(true);
    pushActivity('Business registered', `${businessName} has been registered and queued for verification.`, 'success');
    setStatusMessage('Business registration captured.');
  };

  const handleVerifyBusiness = () => {
    setIsVerified(true);
    pushActivity('Business verified', `${businessName} passed business verification and can launch funded campaigns.`, 'success');
    setStatusMessage('Business verification completed.');
  };

  const handleDepositFunds = () => {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatusMessage('Enter a valid deposit amount.');
      return;
    }

    setReserveBalance((current) => current + amount);
    pushActivity('Deposit posted', `${formatCurrency(amount, 'USD')} added to the advertiser reserve.`, 'success');
    setDepositAmount('');
    setStatusMessage(`${formatCurrency(amount, 'USD')} deposited into the business reserve.`);

    void sendAdminPaymentNotification({
      amount,
      currency: 'USD',
      source: 'deposit',
      title: 'Business deposit posted',
      message: `${businessName} posted a ${formatCurrency(amount, 'USD')} reserve deposit.`,
      metadata: {
        businessName,
        businessId: selectedCampaign?.businessId ?? null,
        sourcePage: 'business_dashboard',
      },
    }).catch(() => undefined);
  };

  const updateCampaignInState = (campaignId: string, updater: (campaign: Campaign) => Campaign) => {
    setCampaigns((current) => current.map((campaign) => (campaign.id === campaignId ? updater(campaign) : campaign)));
  };

  const persistCampaignUpdate = async (campaign: Campaign, nextStatus: Campaign['status'], nextBudget?: number) => {
    const formValues = campaignToFormValues(campaign);
    formValues.status = nextStatus;
    if (typeof nextBudget === 'number') {
      formValues.budget = nextBudget;
    }

    const saved = await saveCampaign(formValues, campaign.id);
    updateCampaignInState(campaign.id, () => saved);
    return saved;
  };

  const handleToggleCampaignStatus = async (campaign: Campaign) => {
    const nextStatus: Campaign['status'] = campaign.status === 'paused' ? 'active' : 'paused';
    updateCampaignInState(campaign.id, (current) => ({ ...current, status: nextStatus, updatedAt: new Date().toISOString() }));

    try {
      await persistCampaignUpdate(campaign, nextStatus);
      pushActivity(
        nextStatus === 'paused' ? 'Campaign paused' : 'Campaign resumed',
        `${campaign.title} is now ${nextStatus}.`,
        nextStatus === 'paused' ? 'warning' : 'success',
      );
      setStatusMessage(`${campaign.title} ${nextStatus === 'paused' ? 'paused' : 'resumed'}.`);
    } catch {
      pushActivity(
        nextStatus === 'paused' ? 'Paused locally' : 'Resumed locally',
        `${campaign.title} updated in the dashboard while offline from Supabase.`,
        'warning',
      );
      setStatusMessage(`Updated ${campaign.title} locally. Connect Supabase to persist changes.`);
    }
  };

  const handleSaveBudget = async () => {
    if (!selectedCampaign) {
      setStatusMessage('Select a campaign before saving a budget.');
      return;
    }

    const nextBudget = Number(budgetDraft);
    if (!Number.isFinite(nextBudget) || nextBudget <= 0) {
      setStatusMessage('Enter a valid campaign budget.');
      return;
    }

    updateCampaignInState(selectedCampaign.id, (current) => ({
      ...current,
      budget: nextBudget,
      totalRewardsAllocated: Math.min(current.totalRewardsAllocated, nextBudget),
      engineConfig: {
        ...current.engineConfig,
        budget: nextBudget,
      },
      updatedAt: new Date().toISOString(),
    }));

    try {
      await persistCampaignUpdate(selectedCampaign, selectedCampaign.status, nextBudget);
      pushActivity('Budget updated', `${selectedCampaign.title} budget set to ${formatCurrency(nextBudget, selectedCampaign.budgetCurrency)}.`, 'success');
      setStatusMessage(`${selectedCampaign.title} budget saved.`);
    } catch {
      pushActivity('Budget saved locally', `${selectedCampaign.title} budget updated in the dashboard.`, 'warning');
      setStatusMessage(`Saved ${selectedCampaign.title} budget locally.`);
    }
  };

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    const duplicateForm = campaignToFormValues(campaign);
    duplicateForm.title = `${campaign.title} Copy`;
    duplicateForm.status = 'draft';

    try {
      const saved = await saveCampaign(duplicateForm);
      setCampaigns((current) => [saved, ...current]);
      pushActivity('Campaign duplicated', `${saved.title} was cloned and opened for editing.`, 'success');
      setStatusMessage(`${campaign.title} duplicated successfully.`);
      navigate(`/business/campaigns/${saved.id}/edit`);
    } catch {
      const localDuplicate: Campaign = {
        ...campaign,
        id: `local-duplicate-${Date.now()}`,
        title: `${campaign.title} Copy`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCampaigns((current) => [localDuplicate, ...current]);
      pushActivity('Campaign duplicated locally', `${localDuplicate.title} is available in the dashboard copy list.`, 'warning');
      setStatusMessage(`Duplicated ${campaign.title} locally. Connect Supabase to persist the clone.`);
    }
  };

  const handleExportReport = (format: ExportFormat = exportFormat) => {
    const rows = chartCampaignRows.map(({ campaign, metrics }) => ({
      campaign: campaign.title,
      status: campaign.status,
      budget: campaign.budget,
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      ctr: metrics.ctr,
      roi: metrics.roi,
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `advertiser-report-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      pushActivity('Report exported', 'Campaign analytics were exported as JSON.', 'success');
      setStatusMessage('Analytics JSON downloaded.');
      return;
    }

    const csvRows = [
      ['Campaign', 'Status', 'Budget', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'ROI'],
      ...rows.map((row) => [row.campaign, row.status, row.budget, row.spend, row.impressions, row.clicks, row.conversions, row.ctr, row.roi]),
    ];

    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `advertiser-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    pushActivity('Report exported', 'Campaign analytics, ROI, CTR, and conversion performance were exported as CSV.', 'success');
    setStatusMessage('Analytics report downloaded.');
  };

  const trendWidth = 600;
  const trendHeight = 220;
  const trendPadding = 24;
  const trendSpendPoints = normalizeSeries(summary.trendSeries.map((point) => point.spend), trendWidth, trendHeight, trendPadding);
  const trendRevenuePoints = normalizeSeries(summary.trendSeries.map((point) => point.revenue), trendWidth, trendHeight, trendPadding);
  const trendConversionPoints = normalizeSeries(summary.trendSeries.map((point) => point.conversions), trendWidth, trendHeight, trendPadding);
  const trendBaseline = trendHeight - trendPadding;
  let donutOffset = 0;
  const donutGradient = donutSegments.length
    ? donutSegments
        .map((segment) => {
          const start = donutOffset;
          donutOffset += segment.share;
          return `${segment.color} ${start}% ${donutOffset}%`;
        })
        .join(', ')
    : 'hsl(var(--chart-1)) 0% 100%';

  return (
    <div className="space-y-6 p-6" style={{ fontSize: `${fontScale}%` }} data-contrast={highContrast ? 'high' : 'normal'}>
      {statusMessage ? (
        <Card className="border border-white/10 bg-white/5" role="status" aria-live="polite">
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Dashboard update</p>
          <p className="mt-2 text-white">{statusMessage}</p>
        </Card>
      ) : null}

      {/* Quick actions row for power users */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/business/analytics">
          <Button variant="ghost">Analytics</Button>
        </Link>
        <Link to="/business/communications">
          <Button variant="ghost">Communication</Button>
        </Link>
        <Link to="/business/gamification">
          <Button variant="ghost">Gamification</Button>
        </Link>
        <Link to="/admin">
          <Button variant="ghost">Platform settings</Button>
        </Link>
        <Button variant="ghost" onClick={() => setHighContrast((current) => !current)} aria-pressed={highContrast}>
          {highContrast ? 'High contrast on' : 'High contrast off'}
        </Button>
        <Button variant="ghost" onClick={() => setFontScale((current) => (current >= 112 ? 100 : current + 8))}>
          Font size {fontScale}%
        </Button>
      </div>

      <Card className="space-y-4 border border-white/5 bg-white/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Analytics studio</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Interactive filtering and export</h2>
            <p className="mt-2 text-sm text-mist/80">
              Narrow the portfolio by status, channel, and time window, then export the filtered set in the format your team needs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exportOptions.map((option) => (
              <Button key={option.value} variant={exportFormat === option.value ? 'primary' : 'ghost'} onClick={() => setExportFormat(option.value)} aria-pressed={exportFormat === option.value}>
                {option.label}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => void handleExportReport(exportFormat)}>
              Export {exportFormat.toUpperCase()}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <label className="grid gap-2 text-sm text-mist/80">
            <span>Search campaigns</span>
            <input
              className="input-base"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by campaign, status, or audience"
              aria-label="Search campaigns"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Time window</span>
              <select className="input-base" value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as TimeWindow)} aria-label="Select time window">
                {timeWindowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Status</span>
              <select className="input-base" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof statusFilters)[number])} aria-label="Filter campaigns by status">
                {statusFilters.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Channel</span>
              <select className="input-base capitalize" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} aria-label="Filter campaigns by channel">
                {channelOptions.map((channel) => (
                  <option key={channel} value={channel} className="capitalize">
                    {channel === 'all' ? 'All channels' : channel}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Time window filter">
          {timeWindowOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={timeWindow === option.value}
              aria-label={`${option.label}: ${option.detail}`}
              onClick={() => setTimeWindow(option.value)}
              className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                timeWindow === option.value ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">ROI dashboard</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Line and area trends</h2>
              <p className="mt-2 text-sm text-mist/80">Spend is rendered as the filled area, revenue as the solid line, and conversions as the dashed overlay.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist">
              {chartCampaignRows.length} filtered campaigns
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink/40 p-4">
            <svg viewBox={`0 0 ${trendWidth} ${trendHeight}`} className="h-[240px] w-full" role="img" aria-labelledby="trend-chart-title trend-chart-desc">
              <title id="trend-chart-title">Spending, revenue, and conversion trend chart</title>
              <desc id="trend-chart-desc">The filled area shows spend, the solid line shows revenue, and the dashed line shows conversions across the selected time window.</desc>
              {[0, 1, 2, 3].map((line) => (
                <line
                  key={line}
                  x1={trendPadding}
                  x2={trendWidth - trendPadding}
                  y1={trendPadding + line * ((trendHeight - trendPadding * 2) / 3)}
                  y2={trendPadding + line * ((trendHeight - trendPadding * 2) / 3)}
                  stroke="hsl(var(--color-border) / 0.5)"
                  strokeDasharray="4 10"
                />
              ))}
              <path d={createAreaPath(trendSpendPoints, trendBaseline)} fill="hsl(var(--chart-1) / 0.18)" />
              <path d={createTrendPath(trendSpendPoints)} fill="none" stroke="hsl(var(--chart-1))" strokeWidth="2" strokeLinecap="round" />
              <path d={createTrendPath(trendRevenuePoints)} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={createTrendPath(trendConversionPoints)} fill="none" stroke="hsl(var(--chart-3))" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />
              {summary.trendSeries.map((point, index) => (
                <g key={point.label}>
                  <circle cx={trendSpendPoints[index].x} cy={trendSpendPoints[index].y} r="4.5" fill="hsl(var(--chart-1))" />
                  <circle cx={trendRevenuePoints[index].x} cy={trendRevenuePoints[index].y} r="4" fill="hsl(var(--chart-2))" />
                  <circle cx={trendConversionPoints[index].x} cy={trendConversionPoints[index].y} r="3.5" fill="hsl(var(--chart-3))" />
                  <text x={trendSpendPoints[index].x} y={trendHeight - 4} textAnchor="middle" className="fill-muted text-[11px]">{point.label}</text>
                </g>
              ))}
            </svg>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Spend trend</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.trendSeries[summary.trendSeries.length - 1]?.spend ?? 0, 'USD')}</p>
              <p className="mt-1 text-sm text-mint/80">{formatSignedPercent(((summary.trendSeries[summary.trendSeries.length - 1]?.spend ?? 0) - (summary.trendSeries[0]?.spend ?? 0)) / Math.max(summary.trendSeries[0]?.spend ?? 1, 1) * 100)} vs start</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Revenue trend</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.trendSeries[summary.trendSeries.length - 1]?.revenue ?? 0, 'USD')}</p>
              <p className="mt-1 text-sm text-mint/80">{formatSignedPercent(((summary.trendSeries[summary.trendSeries.length - 1]?.revenue ?? 0) - (summary.trendSeries[0]?.revenue ?? 0)) / Math.max(summary.trendSeries[0]?.revenue ?? 1, 1) * 100)} vs start</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Conversion trend</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCompact(summary.trendSeries[summary.trendSeries.length - 1]?.conversions ?? 0)}</p>
              <p className="mt-1 text-sm text-mint/80">{formatSignedPercent(((summary.trendSeries[summary.trendSeries.length - 1]?.conversions ?? 0) - (summary.trendSeries[0]?.conversions ?? 0)) / Math.max(summary.trendSeries[0]?.conversions ?? 1, 1) * 100)} vs start</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Forecast cards</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Projected performance</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {forecastCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/60">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {card.label.toLowerCase().includes('roi') ? formatPercent(card.value) : card.label.toLowerCase().includes('conversions') ? formatCompact(card.value) : formatCurrency(card.value, 'USD')}
                  </p>
                  <p className="mt-1 text-sm text-mist/70">{card.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Performance comparison</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Selected versus benchmark</h2>
            </div>
            <div className="space-y-3">
              {performanceComparison.map((metric) => {
                const maxValue = Math.max(metric.selected, metric.benchmark, 1);
                const selectedWidth = Math.max(14, (metric.selected / maxValue) * 100);
                const benchmarkWidth = Math.max(14, (metric.benchmark / maxValue) * 100);
                const selectedValue = metric.format === 'currency' ? formatCurrency(metric.selected, 'USD') : metric.format === 'percent' ? formatPercent(metric.selected) : formatCompact(metric.selected);
                const benchmarkValue = metric.format === 'currency' ? formatCurrency(metric.benchmark, 'USD') : metric.format === 'percent' ? formatPercent(metric.benchmark) : formatCompact(metric.benchmark);

                return (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{metric.label}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-mist/60">{metric.selectedLabel} vs {metric.benchmarkLabel}</p>
                      </div>
                      <p className="text-right text-sm text-mist">
                        <span className="block text-white">{selectedValue}</span>
                        {benchmarkValue}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-mint to-ember" style={{ width: `${selectedWidth}%` }} />
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-chart-2 to-chart-3" style={{ width: `${benchmarkWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Budget composition</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Donut chart</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-center">
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border border-white/10 p-4" style={{ background: `conic-gradient(${donutGradient})` }}>
                <div className="grid h-32 w-32 place-items-center rounded-full border border-white/10 bg-ink/90 text-center">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-mist/60">Budget pool</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.totalBudget, 'USD')}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {donutSegments.map((segment) => (
                  <div key={segment.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                        <p className="font-medium text-white capitalize">{segment.label}</p>
                      </div>
                      <p className="text-sm text-mist">{formatSignedPercent(segment.share)}</p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${segment.share}%`, backgroundColor: segment.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 border border-white/5 bg-white/5">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Bar charts</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Campaign velocity</h2>
          </div>
          <div className="space-y-3">
            {barData.map((item, index) => {
              const maxValue = Math.max(...barData.map((entry) => entry.value), 1);
              const width = (item.value / maxValue) * 100;

              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm text-mist/80">
                    <span>{item.label}</span>
                    <span>{formatCompact(item.value)} conversions · {formatCurrency(item.secondary, 'USD')}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(14, width)}%`, backgroundColor: chartSeriesColors[index % chartSeriesColors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4 border border-white/5 bg-white/5">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Geo maps</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Audience distribution</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <svg viewBox="0 0 340 220" className="h-[220px] w-full" role="img" aria-labelledby="geo-title geo-desc">
              <title id="geo-title">Audience distribution by region</title>
              <desc id="geo-desc">A stylized geo map showing relative audience value across regions.</desc>
              <rect x="20" y="40" width="120" height="70" rx="18" fill="hsl(var(--chart-1) / 0.18)" stroke="hsl(var(--chart-1))" />
              <rect x="150" y="28" width="90" height="76" rx="18" fill="hsl(var(--chart-2) / 0.18)" stroke="hsl(var(--chart-2))" />
              <rect x="245" y="58" width="75" height="70" rx="18" fill="hsl(var(--chart-3) / 0.18)" stroke="hsl(var(--chart-3))" />
              <rect x="90" y="126" width="120" height="60" rx="18" fill="hsl(var(--chart-4) / 0.18)" stroke="hsl(var(--chart-4))" />
              <text x="80" y="80" textAnchor="middle" className="fill-white text-sm font-semibold">North America</text>
              <text x="195" y="72" textAnchor="middle" className="fill-white text-sm font-semibold">Europe</text>
              <text x="282" y="98" textAnchor="middle" className="fill-white text-sm font-semibold">APAC</text>
              <text x="150" y="160" textAnchor="middle" className="fill-white text-sm font-semibold">LATAM</text>
            </svg>

            <div className="space-y-3">
              {geoRegions.map((region) => (
                <div key={region.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{region.label}</p>
                    <p className="text-sm text-mist">{formatCurrency(region.value, 'USD')}</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(14, (region.value / Math.max(...geoRegions.map((entry) => entry.value), 1)) * 100)}%`, backgroundColor: region.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border border-white/5 bg-white/5 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Heat maps</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Engagement heat map</h2>
              <p className="mt-2 text-sm text-mist">Activity intensity by day and funnel segment.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist">Accessible grid</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))] bg-white/5 text-xs uppercase tracking-[0.18em] text-mist/70">
              <div className="px-4 py-3">Day</div>
              {['Awareness', 'Engagement', 'Conversion', 'Retention'].map((segment) => (
                <div key={segment} className="px-4 py-3 text-center">{segment}</div>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))]">
                  <div className="px-4 py-4 text-sm text-white">{day}</div>
                  {['Awareness', 'Engagement', 'Conversion', 'Retention'].map((segment) => {
                    const cell = heatmapCells.find((entry) => entry.day === day && entry.segment === segment) ?? { value: 0 };
                    const opacity = clamp(cell.value / Math.max(...heatmapCells.map((entry) => entry.value), 1), 0.1, 1);
                    return (
                      <div key={`${day}-${segment}`} className="px-2 py-2">
                        <div className="flex h-full items-center justify-center rounded-xl border border-white/10 px-3 py-4 text-sm text-white" style={{ backgroundColor: `hsl(var(--chart-2) / ${opacity})` }} aria-label={`${day} ${segment} intensity ${cell.value}`}>
                          {formatCompact(cell.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-mint/70">Advertiser control center</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Business dashboard</h1>
            <p className="max-w-3xl text-mist/80">
              Register and verify your business, fund campaigns, control budget allocations, pause or resume live
              activations, and export analytics from one operational console.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleRegisterBusiness}>{isRegistered ? 'Business registered' : 'Register business'}</Button>
            <Button variant="ghost" onClick={handleVerifyBusiness} disabled={!isRegistered || isVerified}>
              {isVerified ? 'Verified' : 'Verify business'}
            </Button>
            <Button variant="ghost" onClick={handleExportReport}>Export report</Button>
            <Link to="/business/campaigns/new">
              <Button variant="ghost">Create campaign</Button>
            </Link>
          </div>
        </Card>

        <Card className="space-y-4 border border-white/5 bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Business status</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{businessName}</h2>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${isVerified ? 'border-white/10 bg-white/5 text-mint' : 'border-white/10 bg-white/5 text-mist/70'}`}
            >
              {isVerified ? 'Verified' : isRegistered ? 'Pending review' : 'Unregistered'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Business name</span>
              <input className="input-base" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Website</span>
              <input className="input-base" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm text-mist/80 md:col-span-2">
              <span>Contact email</span>
              <input className="input-base" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-mist/80">
            <p className="font-medium text-white">Funding reserve</p>
            <p className="mt-2">Reserve balance: {formatCurrency(reserveBalance, 'USD')}</p>
            <p>Committed spend: {formatCurrency(summary.totalSpend, 'USD')}</p>
            <p>Available budget: {formatCurrency(availableBudget, 'USD')}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/70">Campaigns</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalCampaigns}</p>
          <p className="mt-1 text-xs text-mist/70">{error ? 'Using cached or demo data' : 'Live query ready'}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Active</p>
          <p className="mt-2 text-3xl font-bold text-white">{activeCampaigns}</p>
          <p className="mt-1 text-xs text-mist/70">{formatCurrency(summary.activeBudget, 'USD')} budget in motion</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Paused</p>
          <p className="mt-2 text-3xl font-bold text-white">{pausedCampaigns}</p>
          <p className="mt-1 text-xs text-mist/70">Ready to resume when funding is re-enabled</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">CTR</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatPercent(summary.ctr)}</p>
          <p className="mt-1 text-xs text-mist/70">Across all campaigns</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Conversions</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatCompact(summary.totalConversions)}</p>
          <p className="mt-1 text-xs text-mist/70">Tracked from approved campaign funnels</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">ROI</p>
          <p className="mt-2 text-3xl font-bold text-white">{formatPercent(summary.roi)}</p>
          <p className="mt-1 text-xs text-mist/70">Revenue versus spend</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Deposit funds</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Funding and budget planning</h2>
              <p className="mt-2 text-sm text-mist/80">
                Add reserve funds, track committed spend, and redirect budget to the campaigns that are still scaling.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist">
              {isRegistered ? 'Onboarded' : 'Setup pending'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm text-mist/80">
              <span>Deposit amount</span>
              <input className="input-base" type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
            </label>
            <div className="flex items-end">
              <Button onClick={handleDepositFunds}>Deposit funds</Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Reserve balance</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(reserveBalance, 'USD')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Committed spend</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.totalSpend, 'USD')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Available budget</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(availableBudget, 'USD')}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Budget history</h3>
                <p className="text-sm text-mist">Weekly spend trend calculated from the current campaign portfolio.</p>
              </div>
              <p className="text-sm text-mist">{formatCurrency(summary.totalSpend, 'USD')}</p>
            </div>
            <div className="space-y-3">
              {summary.spendingHistory.map((point) => {
                const maxValue = Math.max(...summary.spendingHistory.map((item) => item.value), 1);
                const width = Math.max(8, (point.value / maxValue) * 100);

                return (
                  <div key={point.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-mist/80">
                      <span>{point.label}</span>
                      <span>{formatCurrency(point.value, 'USD')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-ember to-mint" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Campaign command center</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Selected campaign</h2>
              <p className="mt-2 text-sm text-mist/80">Pause, resume, duplicate, and re-budget from one action panel.</p>
            </div>
            <Link to="/business/campaigns" className="text-sm text-ember/90 hover:text-ember">
              Open campaign manager
            </Link>
          </div>

          <label className="grid gap-2 text-sm text-mist/80">
            <span>Choose campaign</span>
            <select className="input-base" value={selectedCampaign?.id ?? ''} onChange={(event) => setSelectedCampaignId(event.target.value)}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </label>

          {selectedCampaign && selectedMetrics ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{selectedCampaign.title}</p>
                    <p className="mt-1 text-sm text-mist">{selectedCampaign.description ?? selectedCampaign.instructions}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusClass(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-ink/40 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Budget</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(selectedCampaign.budget, selectedCampaign.budgetCurrency)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-ink/40 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Spend</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(selectedMetrics.spend, selectedCampaign.budgetCurrency)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-ink/40 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/60">CTR</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatPercent(selectedMetrics.ctr)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-ink/40 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/60">ROI</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatPercent(selectedMetrics.roi)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-ink/40 p-4">
                  <p className="text-sm font-medium text-white">Blocked reasons</p>
                  <p className="mt-1 text-xs text-mist/70">These reasons are reused when the campaign verification policy refuses a submission.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedFraudReasons.length ? (
                      selectedFraudReasons.map((reason) => (
                        <span key={reason} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
                          {reason}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                        No fraud checks selected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-mist/60">Impressions</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(selectedMetrics.impressions)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-mist/60">Clicks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(selectedMetrics.clicks)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-mist/60">Conversions</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(selectedMetrics.conversions)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-mist/60">Revenue</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(selectedMetrics.revenue, selectedCampaign.budgetCurrency)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm text-mist/80">
                  <span>Campaign budget</span>
                  <input className="input-base" type="number" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <Button onClick={() => void handleToggleCampaignStatus(selectedCampaign)}>
                    {selectedCampaign.status === 'paused' ? 'Resume campaign' : 'Pause campaign'}
                  </Button>
                  <Button variant="ghost" onClick={() => void handleDuplicateCampaign(selectedCampaign)}>
                    Duplicate campaign
                  </Button>
                  <Button variant="ghost" onClick={() => void handleSaveBudget()}>
                    Save budget
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-mist">Select a campaign to manage its budget and lifecycle.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/80">Campaign analytics</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Campaign portfolio</h2>
              <p className="mt-2 text-sm text-mist">CTR, impressions, clicks, conversions, ROI, and spend by campaign.</p>
            </div>
            <p className="text-sm text-mist">
              {isLoading ? 'Refreshing live campaigns...' : `${campaigns.length} campaigns loaded`}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-mist/70">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Budget</th>
                    <th className="px-4 py-3">CTR</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">Conversions</th>
                    <th className="px-4 py-3">ROI</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaignRows.map(({ campaign, metrics }) => (
                    <tr key={campaign.id} className={`align-top transition ${campaign.id === selectedCampaign?.id ? 'bg-ember/5' : 'bg-transparent'}`}>
                      <td className="px-4 py-4">
                        <button className="text-left text-white hover:text-ember" onClick={() => setSelectedCampaignId(campaign.id)}>
                          <p className="font-medium">{campaign.title}</p>
                          <p className="mt-1 max-w-md text-xs text-mist/70">{campaign.description ?? campaign.instructions}</p>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusClass(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white">{formatCurrency(campaign.budget, campaign.budgetCurrency)}</td>
                      <td className="px-4 py-4 text-mist">{formatPercent(metrics.ctr)}</td>
                      <td className="px-4 py-4 text-mist">{formatCompact(metrics.clicks)}</td>
                      <td className="px-4 py-4 text-mist">{formatCompact(metrics.conversions)}</td>
                      <td className="px-4 py-4 text-mist">{formatPercent(metrics.roi)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => void handleToggleCampaignStatus(campaign)}>
                            {campaign.status === 'paused' ? 'Resume' : 'Pause'}
                          </Button>
                          <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => void handleDuplicateCampaign(campaign)}>
                            Duplicate
                          </Button>
                          <Link to={`/business/campaigns/${campaign.id}/edit`} className="text-sm text-ember/90 hover:text-ember">
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Conversions</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Recent conversion sources</h2>
            </div>
            <div className="space-y-3">
              {conversionFeed.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{entry.title}</p>
                      <p className="mt-1 text-sm text-mist">{entry.channel}</p>
                    </div>
                    <p className="text-right text-sm text-mist">
                      <span className="block text-lg font-semibold text-white">{formatCompact(entry.count)}</span>
                      {formatCurrency(entry.value, 'USD')}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-mist/60">Updated {formatDate(entry.updatedAt)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Spending history</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Budget utilization</h2>
              <p className="mt-2 text-sm text-mist">Monitor how funding has been consumed across the current campaign set.</p>
            </div>
            <div className="space-y-3">
              {summary.spendingHistory.map((point) => {
                const maxValue = Math.max(...summary.spendingHistory.map((item) => item.value), 1);
                const width = Math.max(8, (point.value / maxValue) * 100);

                return (
                  <div key={point.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-mist/80">
                      <span>{point.label}</span>
                      <span>{formatCurrency(point.value, 'USD')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-mint to-ember" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4 border border-white/5 bg-white/5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Activity feed</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Latest actions</h2>
            </div>
            <div className="space-y-3">
              {activityLog.map((entry) => (
                <div key={entry.id} className={`rounded-2xl border p-4 text-sm ${toneClass(entry.tone)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-white">{entry.title}</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-mist/60">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-mist/80">{entry.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="space-y-4 border border-white/5 bg-white/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Operations summary</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Business performance snapshot</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-mist">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Drafts: {draftCampaigns}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reserve: {formatCurrency(reserveBalance, 'USD')}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Impressions: {formatCompact(summary.totalImpressions)}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Clicks: {formatCompact(summary.totalClicks)}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-mist/60">Business registration</p>
            <p className="mt-2 text-lg font-semibold text-white">{isRegistered ? 'Captured' : 'Pending'}</p>
            <p className="mt-1 text-sm text-mist/70">{businessName}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-mist/60">Verification</p>
            <p className="mt-2 text-lg font-semibold text-white">{isVerified ? 'Verified' : 'Awaiting approval'}</p>
            <p className="mt-1 text-sm text-mist/70">{contactEmail}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-mist/60">Tracked conversions</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatCompact(summary.totalConversions)}</p>
            <p className="mt-1 text-sm text-mist/70">All business campaigns combined</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-mist/60">Portfolio ROI</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatPercent(summary.roi)}</p>
            <p className="mt-1 text-sm text-mist/70">Revenue versus media spend</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
