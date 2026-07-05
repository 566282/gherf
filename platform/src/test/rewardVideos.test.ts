import { describe, expect, it } from 'vitest';
import { defaultFraudThresholds } from '@/services/api/fraud';
import { evaluateRewardVideoClaim, type RewardVideoSessionRow } from '@/services/api/rewardVideos';

const baseSession: RewardVideoSessionRow = {
  id: 'session-1',
  user_id: 'user-1',
  campaign_key: 'campaign-1',
  campaign_title: 'Campaign 1',
  provider: 'self_hosted',
  video_url: 'https://example.com/video.mp4',
  session_token: 'token-1',
  status: 'verified',
  started_at: '2026-07-05T10:00:00.000Z',
  verified_at: '2026-07-05T10:02:00.000Z',
  claimable_at: '2026-07-05T10:02:10.000Z',
  claimed_at: null,
  watch_seconds: 130,
  heartbeat_count: 9,
  hidden_events: 0,
  focus_loss_count: 0,
  seek_violations: 0,
  completion_percent: 92,
  anti_cheat_flags: [],
  reward_amount: 1.8,
  currency: 'USD',
  xp_reward: 42,
  reward_delay_seconds: 10,
  threshold_percent: 90,
  frequency_minutes: 60,
  created_at: '2026-07-05T10:00:00.000Z',
  updated_at: '2026-07-05T10:02:00.000Z',
};

describe('evaluateRewardVideoClaim', () => {
  it('allows a verified session that satisfies fraud controls', () => {
    const result = evaluateRewardVideoClaim({
      session: baseSession,
      policy: {
        fraudThresholds: defaultFraudThresholds,
        rewardDelaySeconds: 10,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('explains the block reason when fraud controls fail', () => {
    const result = evaluateRewardVideoClaim({
      session: {
        ...baseSession,
        anti_cheat_flags: ['seek_attempt_detected'],
      },
      policy: {
        fraudThresholds: defaultFraudThresholds,
        rewardDelaySeconds: 10,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('fraud controls');
  });
});