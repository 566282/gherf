import { supabase } from '@/services/supabase/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_CACHE_TTL_MS = 60 * 1000;

type RangeOption = 7 | 30 | 90;

type ProfileRow = {
  id: string;
  created_at: string;
  last_login_at: string | null;
  referred_by_code: string | null;
};

type CampaignRow = {
  id: string;
  title: string;
  budget: number | string;
  total_rewards_allocated: number | string | null;
  current_participants: number | null;
  status: string;
};

type CampaignTaskRow = {
  id: string;
  campaign_id: string;
};

type SubmissionRow = {
  id: string;
  task_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  submission_data: Record<string, unknown> | null;
};

type RewardRow = {
  id: string;
  user_id: string;
  campaign_id: string;
  status: 'pending' | 'approved' | 'claimed' | 'refunded';
  amount: number | string;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'paid';
  method: string;
  amount: number | string;
  created_at: string;
};

type WalletTransactionRow = {
  id: string;
  transaction_type: string;
  amount: number | string;
  created_at: string;
};

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface CategoryMetric {
  label: string;
  value: number;
}

export interface CampaignPerformanceMetric {
  campaignId: string;
  campaignTitle: string;
  participants: number;
  submissions: number;
  approvalRate: number;
  rewardsIssued: number;
  spend: number;
}

export interface ConversionStep {
  step: string;
  users: number;
  conversionFromPrevious: number;
}

export interface WithdrawalStats {
  totalRequests: number;
  totalVolume: number;
  approvedRate: number;
  byStatus: CategoryMetric[];
  byMethod: CategoryMetric[];
}

export interface ReferralPerformance {
  referredUsers: number;
  referralCommissions: number;
  referralsByDay: TimeSeriesPoint[];
}

export interface AnalyticsKpi {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  activeCampaigns: number;
  rewardsIssued: number;
  withdrawalsVolume: number;
}

export interface AnalyticsReport {
  generatedAt: string;
  rangeDays: RangeOption;
  kpis: AnalyticsKpi;
  userGrowth: TimeSeriesPoint[];
  activeUsers: TimeSeriesPoint[];
  revenue: TimeSeriesPoint[];
  campaignPerformance: CampaignPerformanceMetric[];
  rewardDistribution: CategoryMetric[];
  withdrawalStatistics: WithdrawalStats;
  referralPerformance: ReferralPerformance;
  geographicStatistics: CategoryMetric[];
  deviceStatistics: CategoryMetric[];
  browserStatistics: CategoryMetric[];
  conversionFunnels: ConversionStep[];
}

type CachedAnalyticsReport = {
  report: AnalyticsReport;
  expiresAt: number;
};

const analyticsReportCache = new Map<RangeOption, CachedAnalyticsReport>();

function getCachedReport(rangeDays: RangeOption): AnalyticsReport | null {
  const cached = analyticsReportCache.get(rangeDays);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    analyticsReportCache.delete(rangeDays);
    return null;
  }

  return cached.report;
}

function setCachedReport(rangeDays: RangeOption, report: AnalyticsReport): void {
  analyticsReportCache.set(rangeDays, {
    report,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
  });
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function buildDateRange(days: number): string[] {
  const labels: string[] = [];
  const now = new Date();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now.getTime() - index * DAY_MS);
    labels.push(date.toISOString().slice(0, 10));
  }

  return labels;
}

function countByLabel(values: string[]): CategoryMetric[] {
  const map = values.reduce<Record<string, number>>((accumulator, label) => {
    const key = label.trim() || 'Unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function toSeries(labels: string[], valuesByDay: Record<string, number>): TimeSeriesPoint[] {
  return labels.map((label) => ({ label, value: valuesByDay[label] ?? 0 }));
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractCountry(payload: Record<string, unknown> | null): string {
  if (!payload) return 'Unknown';

  const direct = parseString(payload.country) ?? parseString(payload.region) ?? parseString(payload.location);
  if (direct) return direct;

  const geo = payload.geo;
  if (geo && typeof geo === 'object' && !Array.isArray(geo)) {
    const geoRecord = geo as Record<string, unknown>;
    return parseString(geoRecord.country) ?? parseString(geoRecord.region) ?? 'Unknown';
  }

  return 'Unknown';
}

function extractDevice(payload: Record<string, unknown> | null): string {
  if (!payload) return 'Unknown';

  return parseString(payload.device) ?? parseString(payload.deviceType) ?? parseString(payload.platform) ?? 'Unknown';
}

function extractBrowser(payload: Record<string, unknown> | null): string {
  if (!payload) return 'Unknown';

  return parseString(payload.browser) ?? parseString(payload.userAgentBrowser) ?? 'Unknown';
}

async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from('profiles').select('id,created_at,last_login_at,referred_by_code');
  if (error || !data) return [];
  return data as ProfileRow[];
}

async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabase.from('campaigns').select('id,title,budget,total_rewards_allocated,current_participants,status');
  if (error || !data) return [];
  return data as CampaignRow[];
}

async function fetchCampaignTasks(): Promise<CampaignTaskRow[]> {
  const { data, error } = await supabase.from('campaign_tasks').select('id,campaign_id');
  if (error || !data) return [];
  return data as CampaignTaskRow[];
}

async function fetchSubmissions(sinceIso?: string): Promise<SubmissionRow[]> {
  let query = supabase.from('task_submissions').select('id,task_id,user_id,status,created_at,submission_data');
  if (sinceIso) {
    query = query.gte('created_at', sinceIso);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as SubmissionRow[];
}

async function fetchRewards(): Promise<RewardRow[]> {
  const { data, error } = await supabase.from('rewards').select('id,user_id,campaign_id,status,amount,created_at');
  if (error || !data) return [];
  return data as RewardRow[];
}

async function fetchWithdrawals(sinceIso?: string): Promise<WithdrawalRow[]> {
  let query = supabase.from('withdrawal_requests').select('id,status,method,amount,created_at');
  if (sinceIso) {
    query = query.gte('created_at', sinceIso);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as WithdrawalRow[];
}

async function fetchWalletTransactions(sinceIso?: string): Promise<WalletTransactionRow[]> {
  let query = supabase.from('wallet_transactions').select('id,transaction_type,amount,created_at');
  if (sinceIso) {
    query = query.gte('created_at', sinceIso);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as WalletTransactionRow[];
}

function inWindow(value: string, sinceTime: number): boolean {
  return new Date(value).getTime() >= sinceTime;
}

function buildConversionSteps(signups: number, active: number, submissions: number, approvedSubmissions: number, claimedRewards: number): ConversionStep[] {
  const steps: Array<{ step: string; users: number }> = [
    { step: 'Signups', users: signups },
    { step: 'Active users', users: active },
    { step: 'Task submissions', users: submissions },
    { step: 'Approved submissions', users: approvedSubmissions },
    { step: 'Reward claims', users: claimedRewards },
  ];

  return steps.map((entry, index) => {
    if (index === 0) {
      return { ...entry, conversionFromPrevious: 100 };
    }

    const previous = steps[index - 1].users;
    const ratio = previous > 0 ? (entry.users / previous) * 100 : 0;

    return {
      ...entry,
      conversionFromPrevious: roundPercent(ratio),
    };
  });
}

export async function listAnalyticsReport(rangeDays: RangeOption = 30): Promise<AnalyticsReport> {
  const cachedReport = getCachedReport(rangeDays);
  if (cachedReport) {
    return cachedReport;
  }

  const sinceTime = Date.now() - rangeDays * DAY_MS;
  const sinceIso = new Date(sinceTime).toISOString();

  const [profiles, campaigns, campaignTasks, submissions, rewards, withdrawals, walletTransactions] = await Promise.all([
    fetchProfiles(),
    fetchCampaigns(),
    fetchCampaignTasks(),
    fetchSubmissions(sinceIso),
    fetchRewards(),
    fetchWithdrawals(sinceIso),
    fetchWalletTransactions(sinceIso),
  ]);

  const dateLabels = buildDateRange(rangeDays);

  const growthByDay = profiles.reduce<Record<string, number>>((accumulator, profile) => {
    if (!inWindow(profile.created_at, sinceTime)) return accumulator;
    const key = isoDay(profile.created_at);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const activeByDay = profiles.reduce<Record<string, number>>((accumulator, profile) => {
    if (!profile.last_login_at || !inWindow(profile.last_login_at, sinceTime)) return accumulator;
    const key = isoDay(profile.last_login_at);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const revenueByDay = rewards.reduce<Record<string, number>>((accumulator, reward) => {
    if (!inWindow(reward.created_at, sinceTime)) return accumulator;
    if (reward.status !== 'approved' && reward.status !== 'claimed') return accumulator;
    const key = isoDay(reward.created_at);
    accumulator[key] = (accumulator[key] ?? 0) + toNumber(reward.amount);
    return accumulator;
  }, {});

  const taskToCampaign = campaignTasks.reduce<Record<string, string>>((accumulator, task) => {
    accumulator[task.id] = task.campaign_id;
    return accumulator;
  }, {});

  const submissionsByCampaign = submissions.reduce<Record<string, SubmissionRow[]>>((accumulator, submission) => {
    const campaignId = taskToCampaign[submission.task_id];
    if (!campaignId) return accumulator;
    accumulator[campaignId] = accumulator[campaignId] ?? [];
    accumulator[campaignId].push(submission);
    return accumulator;
  }, {});

  const rewardsByCampaign = rewards.reduce<Record<string, RewardRow[]>>((accumulator, reward) => {
    accumulator[reward.campaign_id] = accumulator[reward.campaign_id] ?? [];
    accumulator[reward.campaign_id].push(reward);
    return accumulator;
  }, {});

  const campaignPerformance = campaigns
    .map((campaign) => {
      const campaignSubmissions = submissionsByCampaign[campaign.id] ?? [];
      const approvedSubmissions = campaignSubmissions.filter((submission) => submission.status === 'approved').length;
      const campaignRewards = rewardsByCampaign[campaign.id] ?? [];
      const rewardsIssued = campaignRewards.filter((reward) => reward.status === 'approved' || reward.status === 'claimed').length;

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        participants: campaign.current_participants ?? 0,
        submissions: campaignSubmissions.length,
        approvalRate: campaignSubmissions.length ? roundPercent((approvedSubmissions / campaignSubmissions.length) * 100) : 0,
        rewardsIssued,
        spend: toNumber(campaign.total_rewards_allocated ?? campaignRewards.reduce((sum, reward) => sum + toNumber(reward.amount), 0)),
      };
    })
    .sort((left, right) => right.spend - left.spend)
    .slice(0, 10);

  const rewardDistribution = countByLabel(rewards.map((reward) => reward.status));

  const withdrawalsInWindow = withdrawals.filter((withdrawal) => inWindow(withdrawal.created_at, sinceTime));
  const approvedWithdrawals = withdrawalsInWindow.filter((withdrawal) => withdrawal.status === 'approved' || withdrawal.status === 'paid');
  const withdrawalStats: WithdrawalStats = {
    totalRequests: withdrawalsInWindow.length,
    totalVolume: withdrawalsInWindow.reduce((sum, row) => sum + toNumber(row.amount), 0),
    approvedRate: withdrawalsInWindow.length ? roundPercent((approvedWithdrawals.length / withdrawalsInWindow.length) * 100) : 0,
    byStatus: countByLabel(withdrawalsInWindow.map((withdrawal) => withdrawal.status)),
    byMethod: countByLabel(withdrawalsInWindow.map((withdrawal) => withdrawal.method || 'Unknown')),
  };

  const referredProfiles = profiles.filter((profile) => Boolean(profile.referred_by_code));
  const referralsByDayMap = referredProfiles.reduce<Record<string, number>>((accumulator, profile) => {
    if (!inWindow(profile.created_at, sinceTime)) return accumulator;
    const key = isoDay(profile.created_at);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const referralCommissions = walletTransactions
    .filter((transaction) => transaction.transaction_type === 'referral_commission' && inWindow(transaction.created_at, sinceTime))
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

  const geoStats = countByLabel(submissions.map((submission) => extractCountry(submission.submission_data)));
  const deviceStats = countByLabel(submissions.map((submission) => extractDevice(submission.submission_data)));
  const browserStats = countByLabel(submissions.map((submission) => extractBrowser(submission.submission_data)));

  const profilesInWindow = profiles.filter((profile) => inWindow(profile.created_at, sinceTime));
  const activeUserCount = profiles.filter((profile) => profile.last_login_at && inWindow(profile.last_login_at, sinceTime)).length;
  const submissionsInWindow = submissions.filter((submission) => inWindow(submission.created_at, sinceTime));
  const approvedSubmissionsInWindow = submissionsInWindow.filter((submission) => submission.status === 'approved');
  const claimedRewardsInWindow = rewards.filter(
    (reward) => inWindow(reward.created_at, sinceTime) && reward.status === 'claimed',
  );

  const report: AnalyticsReport = {
    generatedAt: new Date().toISOString(),
    rangeDays,
    kpis: {
      totalUsers: profiles.length,
      activeUsers: activeUserCount,
      totalRevenue: rewards
        .filter((reward) => reward.status === 'approved' || reward.status === 'claimed')
        .reduce((sum, reward) => sum + toNumber(reward.amount), 0),
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      rewardsIssued: rewards.filter((reward) => reward.status === 'approved' || reward.status === 'claimed').length,
      withdrawalsVolume: withdrawalsInWindow.reduce((sum, row) => sum + toNumber(row.amount), 0),
    },
    userGrowth: toSeries(dateLabels, growthByDay),
    activeUsers: toSeries(dateLabels, activeByDay),
    revenue: toSeries(dateLabels, revenueByDay),
    campaignPerformance,
    rewardDistribution,
    withdrawalStatistics: withdrawalStats,
    referralPerformance: {
      referredUsers: referredProfiles.length,
      referralCommissions: roundPercent(referralCommissions),
      referralsByDay: toSeries(dateLabels, referralsByDayMap),
    },
    geographicStatistics: geoStats,
    deviceStatistics: deviceStats,
    browserStatistics: browserStats,
    conversionFunnels: buildConversionSteps(
      profilesInWindow.length,
      activeUserCount,
      submissionsInWindow.length,
      approvedSubmissionsInWindow.length,
      claimedRewardsInWindow.length,
    ),
  };

  setCachedReport(rangeDays, report);
  return report;
}

export function invalidateAnalyticsReportCache(): void {
  analyticsReportCache.clear();
}
