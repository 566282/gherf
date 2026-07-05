import { supabase } from '@/services/supabase/client';
import type { FraudThresholds } from '@/services/api/fraud';

export type RewardVideoProvider = 'self_hosted' | 'youtube' | 'vimeo';
export type RewardVideoSessionStatus = 'idle' | 'playing' | 'paused' | 'verified' | 'blocked' | 'claimed';

export interface RewardVideoCampaignInput {
  campaignKey: string;
  campaignTitle: string;
  provider: RewardVideoProvider;
  videoUrl: string;
  rewardAmount: number;
  currency: string;
  xpReward: number;
  rewardDelaySeconds: number;
  thresholdPercent: number;
  frequencyMinutes: number;
  maxViewsPerDay: number;
}

export interface RewardVideoSessionRow {
  id: string;
  user_id: string;
  campaign_key: string;
  campaign_title: string;
  provider: RewardVideoProvider;
  video_url: string;
  session_token: string;
  status: RewardVideoSessionStatus;
  started_at: string | null;
  verified_at: string | null;
  claimable_at: string | null;
  claimed_at: string | null;
  watch_seconds: number;
  heartbeat_count: number;
  hidden_events: number;
  focus_loss_count: number;
  seek_violations: number;
  completion_percent: number;
  anti_cheat_flags: string[];
  reward_amount: number;
  currency: string;
  xp_reward: number;
  reward_delay_seconds: number;
  threshold_percent: number;
  frequency_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface RewardVideoSessionPatch {
  status?: RewardVideoSessionStatus;
  startedAt?: string | null;
  verifiedAt?: string | null;
  claimableAt?: string | null;
  claimedAt?: string | null;
  watchSeconds?: number;
  heartbeatCount?: number;
  hiddenEvents?: number;
  focusLossCount?: number;
  seekViolations?: number;
  completionPercent?: number;
  antiCheatFlags?: string[];
}

export interface RewardVideoClaimResult {
  sessionId: string;
  walletBalance: number;
  walletTransactionId: string;
  rewardAmount: number;
  claimedAt: string;
}

export interface RewardVideoClaimPolicy {
  fraudThresholds: FraudThresholds;
  rewardDelaySeconds: number;
}

export interface RewardVideoClaimGuardInput {
  session: RewardVideoSessionRow;
  policy: RewardVideoClaimPolicy;
}

export interface RewardVideoClaimGuardResult {
  allowed: boolean;
  reason: string | null;
}

function mapSessionRow(row: Record<string, unknown>): RewardVideoSessionRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    campaign_key: String(row.campaign_key),
    campaign_title: String(row.campaign_title),
    provider: row.provider as RewardVideoProvider,
    video_url: String(row.video_url),
    session_token: String(row.session_token),
    status: row.status as RewardVideoSessionStatus,
    started_at: (row.started_at as string | null) ?? null,
    verified_at: (row.verified_at as string | null) ?? null,
    claimable_at: (row.claimable_at as string | null) ?? null,
    claimed_at: (row.claimed_at as string | null) ?? null,
    watch_seconds: Number(row.watch_seconds ?? 0),
    heartbeat_count: Number(row.heartbeat_count ?? 0),
    hidden_events: Number(row.hidden_events ?? 0),
    focus_loss_count: Number(row.focus_loss_count ?? 0),
    seek_violations: Number(row.seek_violations ?? 0),
    completion_percent: Number(row.completion_percent ?? 0),
    anti_cheat_flags: Array.isArray(row.anti_cheat_flags) ? (row.anti_cheat_flags as string[]) : [],
    reward_amount: Number(row.reward_amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    xp_reward: Number(row.xp_reward ?? 0),
    reward_delay_seconds: Number(row.reward_delay_seconds ?? 0),
    threshold_percent: Number(row.threshold_percent ?? 0),
    frequency_minutes: Number(row.frequency_minutes ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function evaluateRewardVideoClaim(input: RewardVideoClaimGuardInput): RewardVideoClaimGuardResult {
  const { session, policy } = input;
  const minimumWatchSeconds = Math.max(1, Math.ceil(policy.fraudThresholds.watchTimeMinutes * 60));

  if (session.status !== 'verified') {
    return {
      allowed: false,
      reason: 'Reward claim is still pending verification.',
    };
  }

  if (session.seek_violations > 0 || session.hidden_events > 0 || session.focus_loss_count > 0 || session.anti_cheat_flags.length > 0) {
    const flags = session.anti_cheat_flags.length ? session.anti_cheat_flags.join(', ') : 'anti-cheat events';

    return {
      allowed: false,
      reason: `Reward claim is blocked by fraud controls: ${flags}.`,
    };
  }

  if (session.watch_seconds < minimumWatchSeconds) {
    return {
      allowed: false,
      reason: `Reward claim is blocked until at least ${minimumWatchSeconds} seconds of watch time are recorded.`,
    };
  }

  if (session.claimable_at && new Date(session.claimable_at).getTime() > Date.now()) {
    return {
      allowed: false,
      reason: `Reward claim is locked for ${policy.rewardDelaySeconds} seconds after verification.`,
    };
  }

  return { allowed: true, reason: null };
}

export async function listRewardVideoSessions(userId: string): Promise<RewardVideoSessionRow[]> {
  const { data, error } = await supabase
    .from('reward_video_sessions')
    .select('id,user_id,campaign_key,campaign_title,provider,video_url,session_token,status,started_at,verified_at,claimable_at,claimed_at,watch_seconds,heartbeat_count,hidden_events,focus_loss_count,seek_violations,completion_percent,anti_cheat_flags,reward_amount,currency,xp_reward,reward_delay_seconds,threshold_percent,frequency_minutes,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row) => mapSessionRow(row as Record<string, unknown>));
}

export async function createRewardVideoSession(userId: string, campaign: RewardVideoCampaignInput, sessionToken: string): Promise<RewardVideoSessionRow> {
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('reward_video_sessions')
    .insert({
      user_id: userId,
      campaign_key: campaign.campaignKey,
      campaign_title: campaign.campaignTitle,
      provider: campaign.provider,
      video_url: campaign.videoUrl,
      session_token: sessionToken,
      status: 'playing',
      started_at: startedAt,
      verified_at: null,
      claimable_at: null,
      claimed_at: null,
      watch_seconds: 0,
      heartbeat_count: 0,
      hidden_events: 0,
      focus_loss_count: 0,
      seek_violations: 0,
      completion_percent: 0,
      anti_cheat_flags: [],
      reward_amount: campaign.rewardAmount,
      currency: campaign.currency,
      xp_reward: campaign.xpReward,
      reward_delay_seconds: campaign.rewardDelaySeconds,
      threshold_percent: campaign.thresholdPercent,
      frequency_minutes: campaign.frequencyMinutes,
    })
    .select('id,user_id,campaign_key,campaign_title,provider,video_url,session_token,status,started_at,verified_at,claimable_at,claimed_at,watch_seconds,heartbeat_count,hidden_events,focus_loss_count,seek_violations,completion_percent,anti_cheat_flags,reward_amount,currency,xp_reward,reward_delay_seconds,threshold_percent,frequency_minutes,created_at,updated_at')
    .single();

  if (error || !data) throw error ?? new Error('Unable to create rewarded video session.');

  return mapSessionRow(data as Record<string, unknown>);
}

export async function updateRewardVideoSession(sessionId: string, patch: RewardVideoSessionPatch): Promise<RewardVideoSessionRow> {
  const payload: Record<string, unknown> = {};

  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.startedAt !== undefined) payload.started_at = patch.startedAt;
  if (patch.verifiedAt !== undefined) payload.verified_at = patch.verifiedAt;
  if (patch.claimableAt !== undefined) payload.claimable_at = patch.claimableAt;
  if (patch.claimedAt !== undefined) payload.claimed_at = patch.claimedAt;
  if (patch.watchSeconds !== undefined) payload.watch_seconds = patch.watchSeconds;
  if (patch.heartbeatCount !== undefined) payload.heartbeat_count = patch.heartbeatCount;
  if (patch.hiddenEvents !== undefined) payload.hidden_events = patch.hiddenEvents;
  if (patch.focusLossCount !== undefined) payload.focus_loss_count = patch.focusLossCount;
  if (patch.seekViolations !== undefined) payload.seek_violations = patch.seekViolations;
  if (patch.completionPercent !== undefined) payload.completion_percent = patch.completionPercent;
  if (patch.antiCheatFlags !== undefined) payload.anti_cheat_flags = patch.antiCheatFlags;

  const { data, error } = await supabase
    .from('reward_video_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select('id,user_id,campaign_key,campaign_title,provider,video_url,session_token,status,started_at,verified_at,claimable_at,claimed_at,watch_seconds,heartbeat_count,hidden_events,focus_loss_count,seek_violations,completion_percent,anti_cheat_flags,reward_amount,currency,xp_reward,reward_delay_seconds,threshold_percent,frequency_minutes,created_at,updated_at')
    .single();

  if (error || !data) throw error ?? new Error('Unable to update rewarded video session.');

  return mapSessionRow(data as Record<string, unknown>);
}

export async function claimRewardVideoSession(sessionId: string): Promise<RewardVideoClaimResult> {
  const { data, error } = await supabase.rpc('claim_reward_video_session', {
    p_session_id: sessionId,
  });

  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Unable to claim rewarded video payout.');
  }

  const result = data as Record<string, unknown>;

  return {
    sessionId: String(result.session_id),
    walletBalance: Number(result.wallet_balance ?? 0),
    walletTransactionId: String(result.wallet_transaction_id),
    rewardAmount: Number(result.reward_amount ?? 0),
    claimedAt: String(result.claimed_at),
  };
}