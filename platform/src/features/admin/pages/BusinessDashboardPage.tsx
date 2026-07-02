import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/auth';
import { campaignToFormValues, listCampaigns, saveCampaign } from '@/services/api/campaigns';
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
      riskChecks: ['fraud_detection', 'duplicate_detection', 'vpn_detection', 'proxy_detection', 'bot_detection'],
      randomAuditRate: 5,
      fraudThreshold: 70,
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
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  if (status === 'paused') return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  if (status === 'scheduled') return 'bg-sky-500/15 text-sky-300 border-sky-500/20';
  if (status === 'completed') return 'bg-mint/15 text-mint border-mint/20';
  return 'bg-white/10 text-mist border-white/10';
}

function toneClass(tone: ActivityTone) {
  if (tone === 'success') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
  if (tone === 'warning') return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
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

  const campaignRows = useMemo(
    () => campaigns.map((campaign) => ({ campaign, metrics: calculateMetrics(campaign) })),
    [campaigns],
  );

  const summary = useMemo(() => {
    const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
    const activeBudget = campaignRows.filter(({ campaign }) => campaign.status === 'active').reduce((sum, row) => sum + row.campaign.budget, 0);
    const totalSpend = campaignRows.reduce((sum, row) => sum + row.metrics.spend, 0);
    const totalRevenue = campaignRows.reduce((sum, row) => sum + row.metrics.revenue, 0);
    const totalImpressions = campaignRows.reduce((sum, row) => sum + row.metrics.impressions, 0);
    const totalClicks = campaignRows.reduce((sum, row) => sum + row.metrics.clicks, 0);
    const totalConversions = campaignRows.reduce((sum, row) => sum + row.metrics.conversions, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const spendingHistory = buildHistory(totalSpend);

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
    };
  }, [campaignRows, campaigns]);

  const selectedMetrics = useMemo(() => {
    if (!selectedCampaign) {
      return null;
    }

    return calculateMetrics(selectedCampaign);
  }, [selectedCampaign]);

  const conversionFeed = useMemo(() => {
    return campaignRows
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
  }, [campaignRows]);

  const availableBudget = reserveBalance - summary.totalSpend;
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const pausedCampaigns = campaigns.filter((campaign) => campaign.status === 'paused').length;
  const draftCampaigns = campaigns.filter((campaign) => campaign.status === 'draft').length;

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

  const handleExportReport = () => {
    const rows = [
      ['Campaign', 'Status', 'Budget', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'ROI'],
      ...campaignRows.map(({ campaign, metrics }) => [
        campaign.title,
        campaign.status,
        formatReportValue(campaign.budget),
        formatReportValue(metrics.spend),
        formatReportValue(metrics.impressions),
        formatReportValue(metrics.clicks),
        formatReportValue(metrics.conversions),
        formatReportValue(metrics.ctr),
        formatReportValue(metrics.roi),
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
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

  return (
    <div className="space-y-6 p-6">
      {statusMessage ? (
        <Card className="border border-ember/30 bg-ember/10">
          <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Dashboard update</p>
          <p className="mt-2 text-white">{statusMessage}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5 border border-white/5 bg-white/5">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-mint/80">Advertiser control center</p>
            <h1 className="text-4xl font-bold text-ember">Business dashboard</h1>
            <p className="max-w-3xl text-mist">
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
              <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Business status</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{businessName}</h2>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${isVerified ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/20 bg-amber-500/10 text-amber-200'}`}
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
          <p className="text-sm text-mist">Campaigns</p>
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
              <p className="text-sm uppercase tracking-[0.24em] text-mint/80">Deposit funds</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Funding and budget planning</h2>
              <p className="mt-2 text-sm text-mist">
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
              <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Campaign command center</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Selected campaign</h2>
              <p className="mt-2 text-sm text-mist">Pause, resume, duplicate, and re-budget from one action panel.</p>
            </div>
            <Link to="/business/campaigns" className="text-sm text-ember hover:text-[#ffb56b]">
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
                          <Link to={`/business/campaigns/${campaign.id}/edit`} className="text-sm text-ember hover:text-[#ffb56b]">
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
              <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Conversions</p>
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
              <p className="text-sm uppercase tracking-[0.24em] text-mint/80">Spending history</p>
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
              <p className="text-sm uppercase tracking-[0.24em] text-mint/80">Activity feed</p>
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
            <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Operations summary</p>
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
