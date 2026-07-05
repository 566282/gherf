-- 011_rewarded_video_sessions.sql
-- Tracks rewarded video sessions and claims with server-side payout handling.

CREATE TABLE IF NOT EXISTS reward_video_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_key TEXT NOT NULL,
  campaign_title TEXT NOT NULL,
  provider TEXT NOT NULL,
  video_url TEXT NOT NULL,
  session_token UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  started_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  claimable_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  heartbeat_count INTEGER NOT NULL DEFAULT 0,
  hidden_events INTEGER NOT NULL DEFAULT 0,
  focus_loss_count INTEGER NOT NULL DEFAULT 0,
  seek_violations INTEGER NOT NULL DEFAULT 0,
  completion_percent INTEGER NOT NULL DEFAULT 0,
  anti_cheat_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  xp_reward INTEGER NOT NULL DEFAULT 0,
  reward_delay_seconds INTEGER NOT NULL DEFAULT 0,
  threshold_percent INTEGER NOT NULL DEFAULT 0,
  frequency_minutes INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reward_video_sessions_user_created_at
  ON reward_video_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_video_sessions_user_campaign_created_at
  ON reward_video_sessions(user_id, campaign_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_video_sessions_status
  ON reward_video_sessions(status, updated_at DESC);

ALTER TABLE reward_video_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_video_sessions_select_own_or_admin ON reward_video_sessions;
CREATE POLICY reward_video_sessions_select_own_or_admin ON reward_video_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS reward_video_sessions_insert_own_or_admin ON reward_video_sessions;
CREATE POLICY reward_video_sessions_insert_own_or_admin ON reward_video_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS reward_video_sessions_update_own_or_admin ON reward_video_sessions;
CREATE POLICY reward_video_sessions_update_own_or_admin ON reward_video_sessions
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

CREATE TRIGGER reward_video_sessions_updated_at BEFORE UPDATE ON reward_video_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.claim_reward_video_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_row reward_video_sessions%ROWTYPE;
  current_wallet_balance NUMERIC(15, 2);
  current_reward_history INTEGER;
  previous_claim TIMESTAMPTZ;
  transaction_id UUID;
BEGIN
  SELECT *
  INTO session_row
  FROM reward_video_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward video session not found.';
  END IF;

  IF session_row.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'You do not have access to this reward video session.';
  END IF;

  IF session_row.status = 'claimed' THEN
    RAISE EXCEPTION 'This reward video session has already been claimed.';
  END IF;

  IF session_row.status <> 'verified' THEN
    RAISE EXCEPTION 'Reward video session is not verified yet.';
  END IF;

  IF session_row.claimable_at IS NOT NULL AND CURRENT_TIMESTAMP < session_row.claimable_at THEN
    RAISE EXCEPTION 'Reward video payout is still locked by the reward timer.';
  END IF;

  IF COALESCE(jsonb_array_length(session_row.anti_cheat_flags), 0) > 0 THEN
    RAISE EXCEPTION 'Reward video session is blocked by anti-cheat rules.';
  END IF;

  SELECT claimed_at
  INTO previous_claim
  FROM reward_video_sessions
  WHERE user_id = session_row.user_id
    AND campaign_key = session_row.campaign_key
    AND status = 'claimed'
    AND id <> session_row.id
  ORDER BY claimed_at DESC
  LIMIT 1;

  IF previous_claim IS NOT NULL AND previous_claim > CURRENT_TIMESTAMP - make_interval(mins => GREATEST(session_row.frequency_minutes, 1)) THEN
    RAISE EXCEPTION 'Reward video frequency limit has not expired yet.';
  END IF;

  SELECT COALESCE(wallet_balance, 0), COALESCE(reward_history_count, 0)
  INTO current_wallet_balance, current_reward_history
  FROM profiles
  WHERE id = session_row.user_id;

  current_wallet_balance := ROUND(current_wallet_balance + session_row.reward_amount, 2);

  UPDATE profiles
  SET wallet_balance = current_wallet_balance,
      reward_history_count = current_reward_history + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = session_row.user_id;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    currency,
    status,
    method,
    reference_id,
    note,
    metadata
  )
  VALUES (
    session_row.user_id,
    'video_reward',
    session_row.reward_amount,
    current_wallet_balance,
    session_row.currency,
    'available',
    'rewarded_video',
    session_row.id,
    'Rewarded video payout',
    jsonb_build_object(
      'campaignKey', session_row.campaign_key,
      'campaignTitle', session_row.campaign_title,
      'provider', session_row.provider,
      'watchSeconds', session_row.watch_seconds,
      'completionPercent', session_row.completion_percent,
      'heartbeatCount', session_row.heartbeat_count,
      'antiCheatFlags', session_row.anti_cheat_flags,
      'xpReward', session_row.xp_reward
    )
  )
  RETURNING id INTO transaction_id;

  UPDATE reward_video_sessions
  SET status = 'claimed',
      claimed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = session_row.id;

  RETURN jsonb_build_object(
    'session_id', session_row.id,
    'wallet_balance', current_wallet_balance,
    'wallet_transaction_id', transaction_id,
    'reward_amount', session_row.reward_amount,
    'claimed_at', CURRENT_TIMESTAMP
  );
END;
$$;