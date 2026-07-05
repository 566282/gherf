import { supabase } from '@/services/supabase/client';

export interface ReferralMilestoneConfigItem {
  key: string;
  label: string;
  threshold: number;
  rewardAmount: number;
}

export interface ReferralProgram {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  campaignSlug: string | null;
  status: string;
  inviteBonusAmount: number;
  tierOneCommissionPercent: number;
  tierTwoCommissionPercent: number;
  qualificationWindowDays: number;
  payoutDelayDays: number;
  maxTierDepth: number;
  milestoneConfig: ReferralMilestoneConfigItem[];
  leaderboardConfig: Record<string, unknown>;
  fraudConfig: Record<string, unknown>;
  analyticsConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralProgramInput {
  slug: string;
  name: string;
  description: string;
  campaignSlug: string;
  status: string;
  inviteBonusAmount: number;
  tierOneCommissionPercent: number;
  tierTwoCommissionPercent: number;
  qualificationWindowDays: number;
  payoutDelayDays: number;
  maxTierDepth: number;
  milestoneConfig: ReferralMilestoneConfigItem[];
  leaderboardConfig: Record<string, unknown>;
  fraudConfig: Record<string, unknown>;
  analyticsConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ReferralAttribution {
  id: string;
  programId: string;
  referredProfileId: string;
  referrerProfileId: string;
  referralCode: string;
  sourceCampaignSlug: string | null;
  sourceChannel: string | null;
  qualificationStatus: string;
  fraudStatus: string;
  isDuplicateAccount: boolean;
  duplicateSignal: string | null;
  fraudScore: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralFraudFlag {
  id: string;
  programId: string | null;
  attributionId: string | null;
  profileId: string | null;
  relatedProfileId: string | null;
  ruleKey: string;
  severity: string;
  status: string;
  signal: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReferralLeaderboardSnapshot {
  id: string;
  programId: string;
  profileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  referralCount: number;
  commissionTotal: number;
  rank: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralCommissionLedgerItem {
  id: string;
  programId: string;
  attributionId: string;
  beneficiaryProfileId: string;
  tierDepth: number;
  commissionKind: string;
  amount: number;
  currency: string;
  status: string;
  walletTransactionId: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReferralFraudExplanation {
  summary: string;
  reasons: string[];
}

export interface ReferralSignupPlanCommission {
  beneficiaryProfileId: string;
  tierDepth: number;
  commissionKind: 'invite_bonus' | 'tier_one_commission' | 'tier_two_commission';
  amount: number;
  currency: string;
}

export interface ReferralSignupPlan {
  programId: string;
  attribution: {
    programId: string;
    referredProfileId: string;
    referrerProfileId: string;
    referralCode: string;
    sourceCampaignSlug: string | null;
    qualificationStatus: 'qualified';
    fraudStatus: 'clear' | 'flagged';
    isDuplicateAccount: boolean;
    fraudScore: number;
    metadata: Record<string, unknown>;
  };
  commissions: ReferralSignupPlanCommission[];
  leaderboardSnapshotKey: string;
  milestoneSeed: Array<{ key: string; label: string; threshold: number; rewardAmount: number }>;
}

export interface ReferralCommissionReleaseWindow {
  unlockAt: string;
  eligible: boolean;
}

export interface ReferralCommissionApprovalPolicy {
  releaseWindow: ReferralCommissionReleaseWindow;
  requiresHold: boolean;
  requiresEscalation: boolean;
  canRelease: boolean;
  reason: string;
}

export interface ReferralBackfillValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

type ReferralProgramRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  campaign_slug: string | null;
  status: string;
  invite_bonus_amount: number;
  tier_one_commission_percent: number;
  tier_two_commission_percent: number;
  qualification_window_days: number;
  payout_delay_days: number;
  max_tier_depth: number;
  milestone_config: unknown;
  leaderboard_config: unknown;
  fraud_config: unknown;
  analytics_config: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type ReferralAttributionRow = {
  id: string;
  program_id: string;
  referred_profile_id: string;
  referrer_profile_id: string;
  referral_code: string;
  source_campaign_slug: string | null;
  source_channel: string | null;
  qualification_status: string;
  fraud_status: string;
  is_duplicate_account: boolean;
  duplicate_signal: string | null;
  fraud_score: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type ReferralFraudFlagRow = {
  id: string;
  program_id: string | null;
  attribution_id: string | null;
  profile_id: string | null;
  related_profile_id: string | null;
  rule_key: string;
  severity: string;
  status: string;
  signal: string;
  metadata: unknown;
  created_at: string;
};

type ReferralLeaderboardSnapshotRow = {
  id: string;
  program_id: string;
  profile_id: string;
  period_key: string;
  period_start: string;
  period_end: string;
  referral_count: number;
  commission_total: number;
  rank: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type ReferralCommissionLedgerRow = {
  id: string;
  program_id: string;
  attribution_id: string;
  beneficiary_profile_id: string;
  tier_depth: number;
  commission_kind: string;
  amount: number;
  currency: string;
  status: string;
  wallet_transaction_id: string | null;
  note: string | null;
  metadata: unknown;
  created_at: string;
};

const referralFraudReasonByRule: Record<string, string> = {
  duplicate_detection: 'Duplicate accounts or mirrored profiles are blocked.',
  vpn_detection: 'VPN usage is blocked for referral attribution.',
  proxy_detection: 'Proxy usage is blocked for referral attribution.',
  bot_detection: 'Bot-driven referral activity is blocked.',
  fraud_detection: 'General fraud detection is enabled for referral activity.',
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toMilestoneConfig(value: unknown): ReferralMilestoneConfigItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const milestone = entry as Record<string, unknown>;

      return {
        key: String(milestone.key ?? milestone.slug ?? 'milestone'),
        label: String(milestone.label ?? milestone.key ?? 'Milestone'),
        threshold: Number(milestone.threshold ?? 0),
        rewardAmount: Number(milestone.rewardAmount ?? milestone.reward_amount ?? 0),
      } satisfies ReferralMilestoneConfigItem;
    })
    .filter((entry): entry is ReferralMilestoneConfigItem => Boolean(entry));
}

function mapProgram(row: ReferralProgramRow): ReferralProgram {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    campaignSlug: row.campaign_slug,
    status: row.status,
    inviteBonusAmount: Number(row.invite_bonus_amount ?? 0),
    tierOneCommissionPercent: Number(row.tier_one_commission_percent ?? 0),
    tierTwoCommissionPercent: Number(row.tier_two_commission_percent ?? 0),
    qualificationWindowDays: Number(row.qualification_window_days ?? 0),
    payoutDelayDays: Number(row.payout_delay_days ?? 0),
    maxTierDepth: Number(row.max_tier_depth ?? 0),
    milestoneConfig: toMilestoneConfig(row.milestone_config),
    leaderboardConfig: toRecord(row.leaderboard_config),
    fraudConfig: toRecord(row.fraud_config),
    analyticsConfig: toRecord(row.analytics_config),
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttribution(row: ReferralAttributionRow): ReferralAttribution {
  return {
    id: row.id,
    programId: row.program_id,
    referredProfileId: row.referred_profile_id,
    referrerProfileId: row.referrer_profile_id,
    referralCode: row.referral_code,
    sourceCampaignSlug: row.source_campaign_slug,
    sourceChannel: row.source_channel,
    qualificationStatus: row.qualification_status,
    fraudStatus: row.fraud_status,
    isDuplicateAccount: Boolean(row.is_duplicate_account),
    duplicateSignal: row.duplicate_signal,
    fraudScore: Number(row.fraud_score ?? 0),
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFraudFlag(row: ReferralFraudFlagRow): ReferralFraudFlag {
  return {
    id: row.id,
    programId: row.program_id,
    attributionId: row.attribution_id,
    profileId: row.profile_id,
    relatedProfileId: row.related_profile_id,
    ruleKey: row.rule_key,
    severity: row.severity,
    status: row.status,
    signal: row.signal,
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function mapLeaderboardSnapshot(row: ReferralLeaderboardSnapshotRow): ReferralLeaderboardSnapshot {
  return {
    id: row.id,
    programId: row.program_id,
    profileId: row.profile_id,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    referralCount: Number(row.referral_count ?? 0),
    commissionTotal: Number(row.commission_total ?? 0),
    rank: row.rank == null ? null : Number(row.rank),
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommissionLedger(row: ReferralCommissionLedgerRow): ReferralCommissionLedgerItem {
  return {
    id: row.id,
    programId: row.program_id,
    attributionId: row.attribution_id,
    beneficiaryProfileId: row.beneficiary_profile_id,
    tierDepth: Number(row.tier_depth ?? 0),
    commissionKind: row.commission_kind,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    status: row.status,
    walletTransactionId: row.wallet_transaction_id,
    note: row.note,
    metadata: toRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getReferralCommissionReleaseWindow(commissionCreatedAt: string, payoutDelayDays: number): ReferralCommissionReleaseWindow {
  const unlockAt = addDays(commissionCreatedAt, Math.max(0, payoutDelayDays));
  return {
    unlockAt,
    eligible: Date.now() >= new Date(unlockAt).getTime(),
  };
}

export function getReferralCommissionApprovalPolicy(input: {
  commissionCreatedAt: string;
  payoutDelayDays: number;
  amount: number;
  status: string;
  holdThreshold?: number;
  escalationThreshold?: number;
}): ReferralCommissionApprovalPolicy {
  const releaseWindow = getReferralCommissionReleaseWindow(input.commissionCreatedAt, input.payoutDelayDays);
  const holdThreshold = Math.max(0, Number(input.holdThreshold ?? 250));
  const escalationThreshold = Math.max(holdThreshold, Number(input.escalationThreshold ?? 1000));
  const amount = Math.max(0, Number(input.amount ?? 0));
  const lowerStatus = input.status.toLowerCase();
  const requiresHold = lowerStatus === 'held' || lowerStatus === 'pending' || amount >= holdThreshold || !releaseWindow.eligible;
  const requiresEscalation = amount >= escalationThreshold;

  return {
    releaseWindow,
    requiresHold,
    requiresEscalation,
    canRelease: releaseWindow.eligible && !requiresEscalation && lowerStatus !== 'blocked',
    reason: !releaseWindow.eligible
      ? `Release unlocks at ${releaseWindow.unlockAt}.`
      : requiresEscalation
        ? `Commission amount ${amount.toFixed(2)} requires escalation review.`
        : requiresHold
          ? 'Commission is still in hold review.'
          : 'Commission can be released.',
  };
}

export function buildReferralBackfillValidationChecks(input: {
  programs: Pick<ReferralProgram, 'slug' | 'metadata'>[];
  attributions: Pick<ReferralAttribution, 'metadata'>[];
  fraudFlags: Pick<ReferralFraudFlag, 'ruleKey' | 'metadata'>[];
  leaderboard: Pick<ReferralLeaderboardSnapshot, 'metadata'>[];
}): ReferralBackfillValidationCheck[] {
  const defaultProgramSeeded = input.programs.some((program) => program.slug === 'default-referral-program');
  const backfilledAttributions = input.attributions.some((attribution) => (attribution.metadata.source ?? attribution.metadata.origin) === 'backfill');
  const backfilledFraudFlags = input.fraudFlags.some((flag) => flag.ruleKey === 'invalid_referral_code');
  const backfilledLeaderboard = input.leaderboard.some((snapshot) => snapshot.metadata.source === 'backfill');

  return [
    {
      key: 'default-program',
      label: 'Default referral program seeded',
      passed: defaultProgramSeeded,
      detail: defaultProgramSeeded ? 'The default referral program exists in referral_programs.' : 'Seed the default referral program before running backfill checks.',
    },
    {
      key: 'attribution-backfill',
      label: 'Backfilled attributions present',
      passed: backfilledAttributions,
      detail: backfilledAttributions ? 'Backfill-created attributions were found.' : 'No attribution rows were marked as backfill sourced.',
    },
    {
      key: 'fraud-backfill',
      label: 'Invalid-code fraud flags present',
      passed: backfilledFraudFlags,
      detail: backfilledFraudFlags ? 'Invalid referral code fraud flags were created for unmatched codes.' : 'No invalid referral code fraud flags were detected.',
    },
    {
      key: 'leaderboard-backfill',
      label: 'Leaderboard snapshots seeded',
      passed: backfilledLeaderboard,
      detail: backfilledLeaderboard ? 'Backfill leaderboard snapshots were written.' : 'No leaderboard snapshot rows were marked as backfill sourced.',
    },
  ];
}

export function buildReferralSignupPlan(
  program: Pick<ReferralProgram, 'id' | 'campaignSlug' | 'inviteBonusAmount' | 'tierOneCommissionPercent' | 'tierTwoCommissionPercent' | 'maxTierDepth' | 'milestoneConfig'>,
  input: {
    referredProfileId: string;
    referrerProfileId: string;
    referralCode: string;
    createdAt?: string;
    referrerReferrerProfileId?: string | null;
    duplicateAccount?: boolean;
  },
): ReferralSignupPlan {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const inviteBonusAmount = Math.max(0, Number(program.inviteBonusAmount ?? 0));
  const tierOneAmount = Math.max(0, Number((inviteBonusAmount * Number(program.tierOneCommissionPercent ?? 0)) / 100));
  const tierTwoAmount = Math.max(0, Number((inviteBonusAmount * Number(program.tierTwoCommissionPercent ?? 0)) / 100));
  const commissions: ReferralSignupPlanCommission[] = [];

  if (inviteBonusAmount > 0) {
    commissions.push({
      beneficiaryProfileId: input.referrerProfileId,
      tierDepth: 1,
      commissionKind: 'invite_bonus',
      amount: Number(inviteBonusAmount.toFixed(2)),
      currency: 'USD',
    });
  }

  if (tierOneAmount > 0) {
    commissions.push({
      beneficiaryProfileId: input.referrerProfileId,
      tierDepth: 1,
      commissionKind: 'tier_one_commission',
      amount: Number(tierOneAmount.toFixed(2)),
      currency: 'USD',
    });
  }

  if (program.maxTierDepth >= 2 && input.referrerReferrerProfileId && input.referrerReferrerProfileId !== input.referrerProfileId && input.referrerReferrerProfileId !== input.referredProfileId && tierTwoAmount > 0) {
    commissions.push({
      beneficiaryProfileId: input.referrerReferrerProfileId,
      tierDepth: 2,
      commissionKind: 'tier_two_commission',
      amount: Number(tierTwoAmount.toFixed(2)),
      currency: 'USD',
    });
  }

  return {
    programId: program.id,
    attribution: {
      programId: program.id,
      referredProfileId: input.referredProfileId,
      referrerProfileId: input.referrerProfileId,
      referralCode: input.referralCode,
      sourceCampaignSlug: program.campaignSlug,
      qualificationStatus: 'qualified',
      fraudStatus: input.duplicateAccount ? 'flagged' : 'clear',
      isDuplicateAccount: Boolean(input.duplicateAccount),
      fraudScore: input.duplicateAccount ? 80 : 0,
      metadata: {
        source: 'signup',
        createdAt,
      },
    },
    commissions,
    leaderboardSnapshotKey: createdAt.slice(0, 7),
    milestoneSeed: program.milestoneConfig,
  };
}

export function explainReferralFraudFlag(flag: ReferralFraudFlag): ReferralFraudExplanation {
  return {
    summary:
      referralFraudReasonByRule[flag.ruleKey] ??
      `${flag.signal.split('_').join(' ')} is blocked by referral policy.`,
    reasons: [
      `Severity: ${flag.severity}`,
      `Status: ${flag.status}`,
      `Signal: ${flag.signal.split('_').join(' ')}`,
    ],
  };
}

export function explainReferralFraudFlags(flags: readonly ReferralFraudFlag[]): ReferralFraudExplanation[] {
  return flags.map((flag) => explainReferralFraudFlag(flag));
}

export async function listReferralPrograms(): Promise<ReferralProgram[]> {
  const { data, error } = await supabase
    .from('referral_programs')
    .select('id,slug,name,description,campaign_slug,status,invite_bonus_amount,tier_one_commission_percent,tier_two_commission_percent,qualification_window_days,payout_delay_days,max_tier_depth,milestone_config,leaderboard_config,fraud_config,analytics_config,metadata,created_at,updated_at')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row) => mapProgram(row as ReferralProgramRow));
}

export async function upsertReferralProgram(program: ReferralProgramInput, updatedBy?: string): Promise<ReferralProgram> {
  const { data, error } = await supabase
    .from('referral_programs')
    .upsert(
      {
        slug: program.slug,
        name: program.name,
        description: program.description,
        campaign_slug: program.campaignSlug,
        status: program.status,
        invite_bonus_amount: program.inviteBonusAmount,
        tier_one_commission_percent: program.tierOneCommissionPercent,
        tier_two_commission_percent: program.tierTwoCommissionPercent,
        qualification_window_days: program.qualificationWindowDays,
        payout_delay_days: program.payoutDelayDays,
        max_tier_depth: program.maxTierDepth,
        milestone_config: program.milestoneConfig,
        leaderboard_config: program.leaderboardConfig,
        fraud_config: program.fraudConfig,
        analytics_config: program.analyticsConfig,
        metadata: program.metadata,
        updated_by: updatedBy ?? null,
      },
      { onConflict: 'slug' },
    )
    .select('id,slug,name,description,campaign_slug,status,invite_bonus_amount,tier_one_commission_percent,tier_two_commission_percent,qualification_window_days,payout_delay_days,max_tier_depth,milestone_config,leaderboard_config,fraud_config,analytics_config,metadata,created_at,updated_at')
    .single();

  if (error || !data) throw error ?? new Error('Unable to save referral program.');
  return mapProgram(data as ReferralProgramRow);
}

export async function listReferralAttributions(limit = 25): Promise<ReferralAttribution[]> {
  const { data, error } = await supabase
    .from('referral_attributions')
    .select('id,program_id,referred_profile_id,referrer_profile_id,referral_code,source_campaign_slug,source_channel,qualification_status,fraud_status,is_duplicate_account,duplicate_signal,fraud_score,metadata,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapAttribution(row as ReferralAttributionRow));
}

export async function listReferralFraudFlags(limit = 25): Promise<ReferralFraudFlag[]> {
  const { data, error } = await supabase
    .from('referral_fraud_flags')
    .select('id,program_id,attribution_id,profile_id,related_profile_id,rule_key,severity,status,signal,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapFraudFlag(row as ReferralFraudFlagRow));
}

export async function listReferralLeaderboardSnapshots(periodKey?: string, limit = 25): Promise<ReferralLeaderboardSnapshot[]> {
  let query = supabase
    .from('referral_leaderboard_snapshots')
    .select('id,program_id,profile_id,period_key,period_start,period_end,referral_count,commission_total,rank,metadata,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (periodKey) {
    query = query.eq('period_key', periodKey);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => mapLeaderboardSnapshot(row as ReferralLeaderboardSnapshotRow));
}

export async function listReferralCommissions(limit = 25): Promise<ReferralCommissionLedgerItem[]> {
  const { data, error } = await supabase
    .from('referral_commission_ledger')
    .select('id,program_id,attribution_id,beneficiary_profile_id,tier_depth,commission_kind,amount,currency,status,wallet_transaction_id,note,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapCommissionLedger(row as ReferralCommissionLedgerRow));
}

export async function updateReferralCommissionStatus(
  commissionId: string,
  status: 'available' | 'held' | 'paid' | 'pending',
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('referral_commission_ledger')
    .update({ status, note: note ?? null })
    .eq('id', commissionId);

  if (error) throw error;
}

export async function updateReferralFraudFlagStatus(flagId: string, status: 'open' | 'investigating' | 'resolved' | 'blocked'): Promise<void> {
  const { error } = await supabase.from('referral_fraud_flags').update({ status }).eq('id', flagId);

  if (error) throw error;
}

export async function getReferralEngineSummary(): Promise<{
  programs: ReferralProgram[];
  attributions: ReferralAttribution[];
  fraudFlags: ReferralFraudFlag[];
  leaderboard: ReferralLeaderboardSnapshot[];
}> {
  const [programs, attributions, fraudFlags, leaderboard] = await Promise.all([
    listReferralPrograms(),
    listReferralAttributions(12),
    listReferralFraudFlags(12),
    listReferralLeaderboardSnapshots(undefined, 12),
  ]);

  return { programs, attributions, fraudFlags, leaderboard };
}

export async function getReferralOpsSummary(): Promise<{
  programs: ReferralProgram[];
  attributions: ReferralAttribution[];
  commissions: ReferralCommissionLedgerItem[];
  fraudFlags: ReferralFraudFlag[];
  leaderboard: ReferralLeaderboardSnapshot[];
}> {
  const [programs, attributions, commissions, fraudFlags, leaderboard] = await Promise.all([
    listReferralPrograms(),
    listReferralAttributions(25),
    listReferralCommissions(25),
    listReferralFraudFlags(25),
    listReferralLeaderboardSnapshots(undefined, 25),
  ]);

  return { programs, attributions, commissions, fraudFlags, leaderboard };
}