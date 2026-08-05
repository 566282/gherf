-- 048_phase_17_promotional_admin_controls.sql
-- Extends Phase 17 with configurable membership requirements, eligibility checks,
-- and explicit admin approve/revoke controls for promotional rewards.

CREATE OR REPLACE FUNCTION public.promotional_spin_start(
  p_guest_token TEXT,
  p_trigger_surface TEXT,
  p_request_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := CURRENT_TIMESTAMP;
  v_campaign spin_campaigns%ROWTYPE;
  v_daily_limit INTEGER := 1;
  v_attempt_count INTEGER := 0;
  v_first_spin BOOLEAN := FALSE;
  v_guaranteed BOOLEAN := FALSE;
  v_attempt_id UUID;
  v_outcome_id UUID;
  v_prize_id UUID;
  v_reward NUMERIC(15,2) := 0;
  v_country TEXT := UPPER(COALESCE(TRIM(p_request_meta ->> 'country'), ''));
  v_eligible_countries TEXT[] := ARRAY[]::TEXT[];
  v_minimum_account_age_hours INTEGER := 0;
  v_profile_created_at TIMESTAMPTZ;
BEGIN
  IF COALESCE(TRIM(p_guest_token), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'guest_token_required');
  END IF;

  SELECT * INTO v_campaign
  FROM spin_campaigns
  WHERE status = 'active'
    AND (starts_at IS NULL OR starts_at <= v_now)
    AND (ends_at IS NULL OR ends_at >= v_now)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_campaign');
  END IF;

  IF jsonb_typeof(v_campaign.settings -> 'eligible_countries') = 'array' THEN
    SELECT COALESCE(array_agg(UPPER(value)), ARRAY[]::TEXT[])
    INTO v_eligible_countries
    FROM jsonb_array_elements_text(v_campaign.settings -> 'eligible_countries') AS value;
  END IF;

  IF COALESCE(array_length(v_eligible_countries, 1), 0) > 0 THEN
    IF v_country = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ineligible_country_missing');
    END IF;

    IF NOT (v_country = ANY(v_eligible_countries)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ineligible_country');
    END IF;
  END IF;

  v_minimum_account_age_hours := GREATEST(0, COALESCE((v_campaign.settings ->> 'minimum_account_age_hours')::INTEGER, 0));

  IF v_minimum_account_age_hours > 0 AND auth.uid() IS NOT NULL THEN
    SELECT created_at INTO v_profile_created_at
    FROM profiles
    WHERE id = auth.uid();

    IF v_profile_created_at IS NOT NULL
      AND v_profile_created_at > (v_now - make_interval(hours => v_minimum_account_age_hours)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'minimum_account_age_not_met');
    END IF;
  END IF;

  v_daily_limit := GREATEST(1, COALESCE((v_campaign.settings ->> 'daily_spin_limit')::INTEGER, 1));

  SELECT COUNT(*) INTO v_attempt_count
  FROM spin_attempts
  WHERE campaign_id = v_campaign.id
    AND guest_token = p_guest_token
    AND created_at >= date_trunc('day', v_now);

  IF v_attempt_count >= v_daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_limit_reached');
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM spin_attempts
    WHERE campaign_id = v_campaign.id AND guest_token = p_guest_token
  ) INTO v_first_spin;

  v_guaranteed := COALESCE((v_campaign.settings ->> 'guaranteed_non_losing_first_spin')::BOOLEAN, FALSE);

  INSERT INTO spin_attempts (
    campaign_id,
    guest_token,
    user_id,
    trigger_surface,
    attempt_status,
    is_first_eligible_spin,
    request_meta
  )
  VALUES (
    v_campaign.id,
    p_guest_token,
    auth.uid(),
    p_trigger_surface,
    'resolved',
    v_first_spin,
    COALESCE(p_request_meta, '{}'::jsonb)
  )
  RETURNING id INTO v_attempt_id;

  WITH weighted AS (
    SELECT
      p.id,
      p.reward_amount,
      p.weight,
      SUM(p.weight) OVER (ORDER BY p.id) AS cumulative_weight,
      SUM(p.weight) OVER () AS total_weight
    FROM spin_prize_inventory p
    WHERE p.campaign_id = v_campaign.id
      AND p.is_active = TRUE
      AND p.weight > 0
      AND (p.stock_remaining IS NULL OR p.stock_remaining > 0)
      AND (
        NOT (v_guaranteed AND v_first_spin)
        OR p.reward_amount > 0
      )
  ), pick AS (
    SELECT *
    FROM weighted
    WHERE cumulative_weight >= (RANDOM() * total_weight)
    ORDER BY cumulative_weight
    LIMIT 1
  )
  SELECT id, reward_amount
  INTO v_prize_id, v_reward
  FROM pick;

  IF v_prize_id IS NULL THEN
    INSERT INTO spin_outcomes (spin_attempt_id, prize_id, outcome_status, reward_amount, currency, outcome_payload)
    VALUES (
      v_attempt_id,
      NULL,
      'no_prize',
      0,
      'USD',
      jsonb_build_object('reason', 'no_inventory')
    )
    RETURNING id INTO v_outcome_id;

    RETURN jsonb_build_object(
      'ok', true,
      'attempt_id', v_attempt_id,
      'outcome_id', v_outcome_id,
      'campaign_id', v_campaign.id,
      'prize_id', null,
      'reward_amount', 0,
      'currency', 'USD',
      'can_reserve', false,
      'first_spin', v_first_spin
    );
  END IF;

  INSERT INTO spin_outcomes (spin_attempt_id, prize_id, outcome_status, reward_amount, currency, outcome_payload)
  VALUES (
    v_attempt_id,
    v_prize_id,
    CASE WHEN v_reward > 0 THEN 'won' ELSE 'no_prize' END,
    v_reward,
    COALESCE(v_campaign.settings ->> 'currency', 'USD'),
    jsonb_build_object('guaranteed_non_losing', v_guaranteed AND v_first_spin)
  )
  RETURNING id INTO v_outcome_id;

  UPDATE spin_prize_inventory
  SET stock_remaining = CASE WHEN stock_remaining IS NULL THEN NULL ELSE GREATEST(0, stock_remaining - 1) END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_prize_id;

  RETURN jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt_id,
    'outcome_id', v_outcome_id,
    'campaign_id', v_campaign.id,
    'prize_id', v_prize_id,
    'reward_amount', v_reward,
    'currency', COALESCE(v_campaign.settings ->> 'currency', 'USD'),
    'can_reserve', v_reward > 0,
    'first_spin', v_first_spin
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.promotional_spin_claim_reserve(
  p_attempt_id UUID,
  p_guest_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt spin_attempts%ROWTYPE;
  v_outcome spin_outcomes%ROWTYPE;
  v_campaign spin_campaigns%ROWTYPE;
  v_reservation_id UUID;
  v_reservation_token TEXT;
  v_referral_required NUMERIC(15,2);
  v_membership_required NUMERIC(15,2);
  v_expiry_hours INTEGER;
BEGIN
  SELECT * INTO v_attempt
  FROM spin_attempts
  WHERE id = p_attempt_id
    AND guest_token = p_guest_token
  LIMIT 1;

  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;

  SELECT * INTO v_outcome FROM spin_outcomes WHERE spin_attempt_id = v_attempt.id;
  IF v_outcome.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outcome_not_found');
  END IF;

  IF v_outcome.reward_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'non_winning_outcome');
  END IF;

  SELECT * INTO v_campaign FROM spin_campaigns WHERE id = v_attempt.campaign_id;

  SELECT id, reservation_token INTO v_reservation_id, v_reservation_token
  FROM promotional_reward_reservations
  WHERE spin_attempt_id = v_attempt.id
  LIMIT 1;

  IF v_reservation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reservation_id', v_reservation_id, 'reservation_token', v_reservation_token, 'already_exists', true);
  END IF;

  v_expiry_hours := GREATEST(1, COALESCE((v_campaign.settings ->> 'reservation_expiry_hours')::INTEGER, 72));
  v_referral_required := GREATEST(0, COALESCE((v_campaign.settings ->> 'required_verified_referrals')::NUMERIC, 2));
  v_membership_required := GREATEST(0, COALESCE((v_campaign.settings ->> 'required_membership_orders')::NUMERIC, 1));
  v_reservation_token := encode(gen_random_bytes(12), 'hex');

  INSERT INTO promotional_reward_reservations (
    reservation_token,
    campaign_id,
    spin_attempt_id,
    spin_outcome_id,
    guest_token,
    user_id,
    amount,
    currency,
    status,
    expires_at,
    metadata
  )
  VALUES (
    v_reservation_token,
    v_attempt.campaign_id,
    v_attempt.id,
    v_outcome.id,
    p_guest_token,
    v_attempt.user_id,
    v_outcome.reward_amount,
    v_outcome.currency,
    CASE WHEN v_attempt.user_id IS NULL THEN 'reserved' ELSE 'pending_unlock' END,
    CURRENT_TIMESTAMP + make_interval(hours => v_expiry_hours),
    jsonb_build_object('trigger_surface', v_attempt.trigger_surface)
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO promotional_reward_requirements (reservation_id, requirement_key, requirement_status, required_value, completed_value)
  VALUES
    (v_reservation_id, 'registration_complete', CASE WHEN v_attempt.user_id IS NULL THEN 'pending' ELSE 'completed' END, 1, CASE WHEN v_attempt.user_id IS NULL THEN 0 ELSE 1 END),
    (v_reservation_id, 'verification_complete', 'pending', 1, 0),
    (v_reservation_id, 'qualifying_referrals', CASE WHEN v_referral_required <= 0 THEN 'completed' ELSE 'pending' END, v_referral_required, CASE WHEN v_referral_required <= 0 THEN v_referral_required ELSE 0 END),
    (v_reservation_id, 'membership_purchase', CASE WHEN v_membership_required <= 0 THEN 'completed' ELSE 'pending' END, v_membership_required, CASE WHEN v_membership_required <= 0 THEN v_membership_required ELSE 0 END),
    (v_reservation_id, 'not_expired', 'completed', 1, 1);

  PERFORM public.promotional_spin_log_event(v_reservation_id, 'reservation_created', v_attempt.user_id, jsonb_build_object('amount', v_outcome.reward_amount));

  RETURN jsonb_build_object(
    'ok', true,
    'reservation_id', v_reservation_id,
    'reservation_token', v_reservation_token,
    'amount', v_outcome.reward_amount,
    'currency', v_outcome.currency,
    'expires_at', (SELECT expires_at FROM promotional_reward_reservations WHERE id = v_reservation_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.promotional_reward_refresh_requirements(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrals INTEGER;
  v_membership_orders INTEGER;
  v_verified BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_required');
  END IF;

  SELECT COALESCE(COUNT(*), 0)
  INTO v_referrals
  FROM referral_attributions
  WHERE referrer_profile_id = p_user_id
    AND qualification_status = 'qualified'
    AND fraud_status IN ('clear', 'resolved');

  SELECT COALESCE(COUNT(*), 0)
  INTO v_membership_orders
  FROM membership_multiplier_orders
  WHERE user_id = p_user_id
    AND status = 'paid';

  SELECT COALESCE(is_email_verified, false)
  INTO v_verified
  FROM profiles
  WHERE id = p_user_id;

  UPDATE promotional_reward_requirements prq
  SET requirement_status = CASE WHEN v_verified THEN 'completed' ELSE 'pending' END,
      completed_value = CASE WHEN v_verified THEN 1 ELSE 0 END,
      updated_at = CURRENT_TIMESTAMP
  FROM promotional_reward_reservations prr
  WHERE prr.id = prq.reservation_id
    AND prr.user_id = p_user_id
    AND prr.status IN ('pending_unlock', 'reserved')
    AND prq.requirement_key = 'verification_complete';

  UPDATE promotional_reward_requirements prq
  SET requirement_status = CASE WHEN v_referrals >= prq.required_value THEN 'completed' ELSE 'pending' END,
      completed_value = v_referrals,
      updated_at = CURRENT_TIMESTAMP
  FROM promotional_reward_reservations prr
  WHERE prr.id = prq.reservation_id
    AND prr.user_id = p_user_id
    AND prr.status IN ('pending_unlock', 'reserved')
    AND prq.requirement_key = 'qualifying_referrals';

  UPDATE promotional_reward_requirements prq
  SET requirement_status = CASE WHEN v_membership_orders >= prq.required_value THEN 'completed' ELSE 'pending' END,
      completed_value = v_membership_orders,
      updated_at = CURRENT_TIMESTAMP
  FROM promotional_reward_reservations prr
  WHERE prr.id = prq.reservation_id
    AND prr.user_id = p_user_id
    AND prr.status IN ('pending_unlock', 'reserved')
    AND prq.requirement_key = 'membership_purchase';

  UPDATE promotional_reward_reservations
  SET status = 'expired',
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id
    AND status IN ('reserved', 'pending_unlock')
    AND expires_at < CURRENT_TIMESTAMP;

  UPDATE promotional_reward_requirements prq
  SET requirement_status = CASE WHEN prr.status = 'expired' THEN 'failed' ELSE 'completed' END,
      completed_value = CASE WHEN prr.status = 'expired' THEN 0 ELSE 1 END,
      updated_at = CURRENT_TIMESTAMP
  FROM promotional_reward_reservations prr
  WHERE prr.id = prq.reservation_id
    AND prr.user_id = p_user_id
    AND prq.requirement_key = 'not_expired';

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.promotional_reward_admin_decision(
  p_reservation_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation promotional_reward_reservations%ROWTYPE;
  v_decision TEXT := LOWER(COALESCE(TRIM(p_decision), ''));
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_reservation
  FROM promotional_reward_reservations
  WHERE id = p_reservation_id
  LIMIT 1;

  IF v_reservation.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;

  IF v_decision = 'revoke' THEN
    IF v_reservation.status = 'released' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cannot_revoke_released_reward');
    END IF;

    UPDATE promotional_reward_reservations
    SET status = 'revoked',
        revoked_at = CURRENT_TIMESTAMP,
        revoke_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'admin_revoke'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_reservation.id;

    PERFORM public.promotional_spin_log_event(
      v_reservation.id,
      'reward_revoked_admin',
      p_actor_user_id,
      jsonb_build_object('reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'admin_revoke'))
    );

    RETURN jsonb_build_object('ok', true, 'reservation_id', v_reservation.id, 'status', 'revoked');
  END IF;

  IF v_decision = 'approve' THEN
    IF v_reservation.user_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_bound_to_user');
    END IF;

    IF v_reservation.status <> 'released' THEN
      UPDATE promotional_reward_requirements
      SET requirement_status = 'completed',
          completed_value = GREATEST(required_value, completed_value),
          updated_at = CURRENT_TIMESTAMP
      WHERE reservation_id = v_reservation.id;

      UPDATE promotional_reward_reservations
      SET status = 'released',
          released_at = COALESCE(released_at, CURRENT_TIMESTAMP),
          revoked_at = NULL,
          revoke_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = v_reservation.id;

      UPDATE profiles
      SET reward_balance = COALESCE(reward_balance, 0) + v_reservation.amount,
          wallet_balance = COALESCE(wallet_balance, 0) + v_reservation.amount
      WHERE id = v_reservation.user_id;
    END IF;

    PERFORM public.promotional_spin_log_event(
      v_reservation.id,
      'reward_released_admin',
      p_actor_user_id,
      jsonb_build_object('reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'admin_approve'))
    );

    RETURN jsonb_build_object('ok', true, 'reservation_id', v_reservation.id, 'status', 'released');
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision');
END;
$$;
