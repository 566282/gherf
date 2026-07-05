import { supabase } from '@/services/supabase/client';

const DAY_MS = 24 * 60 * 60 * 1000;

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

type ReferralProgramRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

type ReferralAttributionRow = {
  id: string;
  program_id: string;
  referred_profile_id: string;
  referrer_profile_id: string;
  qualification_status: string;
  fraud_status: string;
  is_duplicate_account: boolean;
  created_at: string;
};

type ReferralCommissionRow = {
  id: string;
  program_id: string;
  beneficiary_profile_id: string;
  tier_depth: number;
  commission_kind: string;
  amount: number | string;
  status: string;
  created_at: string;
};

type ReferralFraudFlagRow = {
  id: string;
  program_id: string | null;
  rule_key: string;
  severity: string;
  status: string;
  signal: string;
  created_at: string;
};

type ReferralLeaderboardRow = {
  id: string;
  program_id: string;
  profile_id: string;
  period_key: string;
  referral_count: number;
  commission_total: number | string;
  rank: number | null;
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

export interface ReferralProgramMetric {
  programId: string;
  programName: string;
  status: string;
  referredUsers: number;
  referralCommissions: number;
}

export interface ReferralLeaderboardMetric {
  programId: string;
  profileId: string;
  periodKey: string;
  rank: number | null;
  referralCount: number;
  commissionTotal: number;
}

export interface ReferralFraudMetric {
  ruleKey: string;
  severity: string;
  status: string;
  count: number;
}

export interface ReferralPerformance {
  referredUsers: number;
  qualifiedReferrals: number;
  referralCommissions: number;
  referralsByDay: TimeSeriesPoint[];
  activePrograms: number;
  fraudFlags: number;
  programsByActivity: ReferralProgramMetric[];
  leaderboard: ReferralLeaderboardMetric[];
  fraudSignals: ReferralFraudMetric[];
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
  taskCompletion: TimeSeriesPoint[];
  retention: TimeSeriesPoint[];
  campaignPerformance: CampaignPerformanceMetric[];
  rewardDistribution: CategoryMetric[];
  withdrawalStatistics: WithdrawalStats;
  referralPerformance: ReferralPerformance;
  geographicStatistics: CategoryMetric[];
  deviceStatistics: CategoryMetric[];
  browserStatistics: CategoryMetric[];
  conversionFunnels: ConversionStep[];
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function isoDayStart(value: string): number {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.getTime();
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

async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase.from('task_submissions').select('id,task_id,user_id,status,created_at,submission_data');
  if (error || !data) return [];
  return data as SubmissionRow[];
}

async function fetchRewards(): Promise<RewardRow[]> {
  const { data, error } = await supabase.from('rewards').select('id,user_id,campaign_id,status,amount,created_at');
  if (error || !data) return [];
  return data as RewardRow[];
}

async function fetchWithdrawals(): Promise<WithdrawalRow[]> {
  const { data, error } = await supabase.from('withdrawal_requests').select('id,status,method,amount,created_at');
  if (error || !data) return [];
  return data as WithdrawalRow[];
}

async function fetchWalletTransactions(): Promise<WalletTransactionRow[]> {
  const { data, error } = await supabase.from('wallet_transactions').select('id,transaction_type,amount,created_at');
  if (error || !data) return [];
  return data as WalletTransactionRow[];
}

async function fetchReferralPrograms(): Promise<ReferralProgramRow[]> {
  const { data, error } = await supabase.from('referral_programs').select('id,name,status,created_at');
  if (error || !data) return [];
  return data as ReferralProgramRow[];
}

async function fetchReferralAttributions(): Promise<ReferralAttributionRow[]> {
  const { data, error } = await supabase
    .from('referral_attributions')
    .select('id,program_id,referred_profile_id,referrer_profile_id,qualification_status,fraud_status,is_duplicate_account,created_at');
  if (error || !data) return [];
  return data as ReferralAttributionRow[];
}

async function fetchReferralCommissions(): Promise<ReferralCommissionRow[]> {
  const { data, error } = await supabase
    .from('referral_commission_ledger')
    .select('id,program_id,beneficiary_profile_id,tier_depth,commission_kind,amount,status,created_at');
  if (error || !data) return [];
  return data as ReferralCommissionRow[];
}

async function fetchReferralFraudFlags(): Promise<ReferralFraudFlagRow[]> {
  const { data, error } = await supabase.from('referral_fraud_flags').select('id,program_id,rule_key,severity,status,signal,created_at');
  if (error || !data) return [];
  return data as ReferralFraudFlagRow[];
}

async function fetchReferralLeaderboard(): Promise<ReferralLeaderboardRow[]> {
  const { data, error } = await supabase.from('referral_leaderboard_snapshots').select('id,program_id,profile_id,period_key,referral_count,commission_total,rank,created_at');
  if (error || !data) return [];
  return data as ReferralLeaderboardRow[];
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
  const [
    profiles,
    campaigns,
    campaignTasks,
    submissions,
    rewards,
    withdrawals,
    walletTransactions,
    referralPrograms,
    referralAttributions,
    referralCommissionsLedger,
    referralFraudFlags,
    referralLeaderboard,
  ] = await Promise.all([
    fetchProfiles(),
    fetchCampaigns(),
    fetchCampaignTasks(),
    fetchSubmissions(),
    fetchRewards(),
    fetchWithdrawals(),
    fetchWalletTransactions(),
    fetchReferralPrograms(),
    fetchReferralAttributions(),
    fetchReferralCommissions(),
    fetchReferralFraudFlags(),
    fetchReferralLeaderboard(),
  ]);

  const dateLabels = buildDateRange(rangeDays);
  const sinceTime = Date.now() - rangeDays * DAY_MS;

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

  const taskCompletionByDay = submissions.reduce<Record<string, number>>((accumulator, submission) => {
    if (!inWindow(submission.created_at, sinceTime)) return accumulator;
    if (submission.status !== 'approved') return accumulator;
    const key = isoDay(submission.created_at);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
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

  const activeReferralPrograms = referralPrograms.filter((program) => program.status === 'active');
  const referralAttributionsInWindow = referralAttributions.filter((attribution) => inWindow(attribution.created_at, sinceTime));
  const qualifiedAttributionsInWindow = referralAttributionsInWindow.filter((attribution) => attribution.qualification_status === 'qualified');

  const referralsByDayMap = qualifiedAttributionsInWindow.reduce<Record<string, number>>((accumulator, attribution) => {
    const key = isoDay(attribution.created_at);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const referralCommissions = referralCommissionsLedger
    .filter((commission) => inWindow(commission.created_at, sinceTime))
    .reduce((sum, commission) => sum + toNumber(commission.amount), 0);

  const referralsByProgram = referralPrograms.map((program) => {
    const attributionsForProgram = referralAttributionsInWindow.filter((attribution) => attribution.program_id === program.id && attribution.qualification_status === 'qualified');
    const commissionsForProgram = referralCommissionsLedger.filter(
      (commission) => commission.program_id === program.id && inWindow(commission.created_at, sinceTime),
    );

    return {
      programId: program.id,
      programName: program.name,
      status: program.status,
      referredUsers: attributionsForProgram.length,
      referralCommissions: commissionsForProgram.reduce((sum, commission) => sum + toNumber(commission.amount), 0),
    };
  }).sort((left, right) => right.referralCommissions - left.referralCommissions);

  const leaderboard = referralLeaderboard
    .filter((entry) => inWindow(entry.created_at, sinceTime))
    .sort((left, right) => {
      const rankLeft = left.rank ?? Number.MAX_SAFE_INTEGER;
      const rankRight = right.rank ?? Number.MAX_SAFE_INTEGER;
      return rankLeft - rankRight;
    })
    .slice(0, 8)
    .map((entry) => ({
      programId: entry.program_id,
      profileId: entry.profile_id,
      periodKey: entry.period_key,
      rank: entry.rank,
      referralCount: entry.referral_count,
      commissionTotal: toNumber(entry.commission_total),
    }));

  const fraudSignals = countByLabel(
    referralFraudFlags
      .filter((flag) => inWindow(flag.created_at, sinceTime))
      .map((flag) => `${flag.rule_key} · ${flag.severity} · ${flag.status}`),
  ).map((entry) => {
    const [ruleKey, severity, status] = entry.label.split(' · ');
    return { ruleKey: ruleKey ?? 'unknown', severity: severity ?? 'unknown', status: status ?? 'unknown', count: entry.value };
  });

  const fraudFlagsInWindow = referralFraudFlags.filter((flag) => inWindow(flag.created_at, sinceTime)).length;

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

  const retentionByDay = dateLabels.reduce<Record<string, number>>((accumulator, label) => {
    const dayStart = isoDayStart(label);
    const dayEnd = dayStart + DAY_MS;
    const returningUsers = profiles.filter((profile) => {
      if (!profile.last_login_at) return false;

      const loginTime = new Date(profile.last_login_at).getTime();
      const createdTime = new Date(profile.created_at).getTime();

      return loginTime >= dayStart && loginTime < dayEnd && createdTime < dayStart;
    }).length;

    const activeUsersForDay = activeByDay[label] ?? 0;
    accumulator[label] = activeUsersForDay > 0 ? roundPercent((returningUsers / activeUsersForDay) * 100) : 0;
    return accumulator;
  }, {});

  return {
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
    taskCompletion: toSeries(dateLabels, taskCompletionByDay),
    retention: toSeries(dateLabels, retentionByDay),
    campaignPerformance,
    rewardDistribution,
    withdrawalStatistics: withdrawalStats,
    referralPerformance: {
      referredUsers: referralAttributionsInWindow.length,
      qualifiedReferrals: qualifiedAttributionsInWindow.length,
      referralCommissions: roundPercent(referralCommissions),
      referralsByDay: toSeries(dateLabels, referralsByDayMap),
      activePrograms: activeReferralPrograms.length,
      fraudFlags: fraudFlagsInWindow,
      programsByActivity: referralsByProgram,
      leaderboard,
      fraudSignals,
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
}
