-- 015_fraud_policy_enforcement.sql
-- Enforce the saved fraud policy during rewarded video claims and referral attribution.

CREATE OR REPLACE FUNCTION public.get_fraud_detection_policy()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT value
      FROM platform_settings
      WHERE key = 'fraud_detection_policy'
      LIMIT 1
    ),
    jsonb_build_object(
      'version', 1,
      'thresholds', jsonb_build_object(
        'review', 45,
        'quarantine', 65,
        'block', 85,
        'watchTimeMinutes', 2,
        'rapidClicksPerMinute', 8,
        'autoRefreshesPerMinute', 3,
        'sharedIpLimit', 1,
        'deviceReuseLimit', 1,
        'linkedAccountLimit', 1,
        'automationConfidence', 70,
        'referralLoopScore', 65
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_reward_video_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_row reward_video_sessions%ROWTYPE;
  fraud_policy JSONB := public.get_fraud_detection_policy();
  minimum_watch_minutes NUMERIC(15, 2) := COALESCE((fraud_policy -> 'thresholds' ->> 'watchTimeMinutes')::NUMERIC, 2);
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

  IF session_row.watch_seconds < (minimum_watch_minutes * 60) THEN
    RAISE EXCEPTION 'Reward video session does not meet the fraud policy watch-time threshold.';
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
      'xpReward', session_row.xp_reward,
      'fraudPolicy', fraud_policy
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

CREATE OR REPLACE FUNCTION public.process_referral_attribution_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  program_row referral_programs%ROWTYPE;
  referrer_row profiles%ROWTYPE;
  parent_row profiles%ROWTYPE;
  attribution_row referral_attributions%ROWTYPE;
  fraud_policy JSONB := public.get_fraud_detection_policy();
  review_threshold INTEGER := COALESCE((fraud_policy -> 'thresholds' ->> 'review')::INTEGER, 45);
  block_threshold INTEGER := COALESCE((fraud_policy -> 'thresholds' ->> 'block')::INTEGER, 85);
  duplicate_count INTEGER := 0;
  duplicate_signal TEXT := NULL;
  normalized_code TEXT;
  invite_bonus NUMERIC(15, 2);
  tier_two_amount NUMERIC(15, 2);
  fraud_score INTEGER := 0;
  qualification_status TEXT := 'qualified';
  fraud_status TEXT := 'clear';
BEGIN
  normalized_code := NULLIF(BTRIM(COALESCE(NEW.referred_by_code, '')), '');

  IF normalized_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO program_row
  FROM referral_programs
  WHERE status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO referrer_row
  FROM profiles
  WHERE referral_code = normalized_code
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO referral_fraud_flags (
      program_id,
      profile_id,
      rule_key,
      severity,
      signal,
      metadata
    ) VALUES (
      program_row.id,
      NEW.id,
      'invalid_referral_code',
      'medium',
      'Referral code was not found in profiles.',
      jsonb_build_object('referralCode', normalized_code, 'fraudPolicy', fraud_policy)
    );
    RETURN NEW;
  END IF;

  IF referrer_row.id = NEW.id THEN
    INSERT INTO referral_fraud_flags (
      program_id,
      profile_id,
      related_profile_id,
      rule_key,
      severity,
      signal,
      metadata
    ) VALUES (
      program_row.id,
      NEW.id,
      referrer_row.id,
      'self_referral',
      'high',
      'A profile attempted to refer itself.',
      jsonb_build_object('referralCode', normalized_code, 'fraudPolicy', fraud_policy)
    );
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM referral_attributions
  WHERE program_id = program_row.id
    AND referred_profile_id = NEW.id;

  IF duplicate_count > 0 THEN
    duplicate_signal := 'Duplicate referral attribution attempt for the same profile.';
    fraud_score := GREATEST(block_threshold, 80);
    qualification_status := CASE WHEN fraud_score >= block_threshold THEN 'rejected' ELSE 'review' END;
    fraud_status := CASE WHEN fraud_score >= review_threshold THEN 'flagged' ELSE 'clear' END;
  END IF;

  INSERT INTO referral_attributions (
    program_id,
    referred_profile_id,
    referrer_profile_id,
    referral_code,
    source_campaign_slug,
    source_channel,
    qualification_status,
    fraud_status,
    is_duplicate_account,
    duplicate_signal,
    fraud_score,
    metadata
  ) VALUES (
    program_row.id,
    NEW.id,
    referrer_row.id,
    normalized_code,
    program_row.campaign_slug,
    'signup',
    qualification_status,
    fraud_status,
    duplicate_count > 0,
    duplicate_signal,
    fraud_score,
    jsonb_build_object(
      'referralCode', normalized_code,
      'campaignSlug', program_row.campaign_slug,
      'sourceChannel', 'signup',
      'fraudPolicy', fraud_policy
    )
  )
  ON CONFLICT (referred_profile_id) DO NOTHING
  RETURNING * INTO attribution_row;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  invite_bonus := ROUND(COALESCE(program_row.invite_bonus_amount, 0), 2);
  IF invite_bonus > 0 THEN
    PERFORM public.apply_referral_commission(
      program_row.id,
      attribution_row.id,
      referrer_row.id,
      1,
      invite_bonus,
      'USD',
      'invite_bonus',
      format('Invite bonus for %s', COALESCE(NEW.full_name, NEW.email, NEW.id::TEXT)),
      jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup', 'fraudPolicy', fraud_policy)
    );
  END IF;

  IF COALESCE(program_row.tier_one_commission_percent, 0) > 0 THEN
    PERFORM public.apply_referral_commission(
      program_row.id,
      attribution_row.id,
      referrer_row.id,
      1,
      ROUND(program_row.invite_bonus_amount * program_row.tier_one_commission_percent / 100, 2),
      'USD',
      'tier_one_commission',
      format('Tier-1 commission for %s', COALESCE(NEW.full_name, NEW.email, NEW.id::TEXT)),
      jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup', 'fraudPolicy', fraud_policy)
    );
  END IF;

  IF program_row.max_tier_depth >= 2 AND COALESCE(referrer_row.referred_by_code, '') <> '' THEN
    SELECT * INTO parent_row
    FROM profiles
    WHERE referral_code = referrer_row.referred_by_code
    LIMIT 1;

    IF FOUND AND parent_row.id <> NEW.id AND parent_row.id <> referrer_row.id THEN
      tier_two_amount := ROUND(program_row.invite_bonus_amount * COALESCE(program_row.tier_two_commission_percent, 0) / 100, 2);
      IF tier_two_amount > 0 THEN
        PERFORM public.apply_referral_commission(
          program_row.id,
          attribution_row.id,
          parent_row.id,
          2,
          tier_two_amount,
          'USD',
          'tier_two_commission',
          format('Tier-2 commission for %s', COALESCE(NEW.full_name, NEW.email, NEW.id::TEXT)),
          jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup', 'fraudPolicy', fraud_policy)
        );
      END IF;
    END IF;
  END IF;

  PERFORM public.evaluate_referral_milestones(program_row.id, referrer_row.id);

  RETURN NEW;
END;
$$;