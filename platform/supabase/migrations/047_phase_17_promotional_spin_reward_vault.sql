-- 047_phase_17_promotional_spin_reward_vault.sql
-- Phase 17 foundational schema, policy contract, and lifecycle RPC functions.

CREATE TABLE IF NOT EXISTS spin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spin_prize_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES spin_campaigns(id) ON DELETE CASCADE,
  prize_key TEXT NOT NULL,
  label TEXT NOT NULL,
  reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  weight NUMERIC(10, 4) NOT NULL DEFAULT 1,
  stock_remaining INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, prize_key)
);

CREATE TABLE IF NOT EXISTS spin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES spin_campaigns(id) ON DELETE CASCADE,
  guest_token TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  trigger_surface TEXT NOT NULL,
  attempt_status TEXT NOT NULL DEFAULT 'resolved' CHECK (attempt_status IN ('resolved', 'blocked', 'abuse_blocked')),
  is_first_eligible_spin BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  fraud_reason TEXT,
  request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spin_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spin_attempt_id UUID NOT NULL UNIQUE REFERENCES spin_attempts(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES spin_prize_inventory(id) ON DELETE SET NULL,
  outcome_status TEXT NOT NULL DEFAULT 'won' CHECK (outcome_status IN ('won', 'no_prize', 'rejected')),
  reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  outcome_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotional_reward_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_token TEXT NOT NULL UNIQUE,
  campaign_id UUID NOT NULL REFERENCES spin_campaigns(id) ON DELETE CASCADE,
  spin_attempt_id UUID NOT NULL UNIQUE REFERENCES spin_attempts(id) ON DELETE CASCADE,
  spin_outcome_id UUID NOT NULL UNIQUE REFERENCES spin_outcomes(id) ON DELETE CASCADE,
  guest_token TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending_unlock' CHECK (status IN ('reserved', 'pending_unlock', 'released', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotional_reward_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES promotional_reward_reservations(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL CHECK (requirement_key IN ('registration_complete', 'verification_complete', 'qualifying_referrals', 'membership_purchase', 'not_expired')),
  requirement_status TEXT NOT NULL DEFAULT 'pending' CHECK (requirement_status IN ('pending', 'completed', 'failed')),
  required_value NUMERIC(15, 2) NOT NULL DEFAULT 1,
  completed_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reservation_id, requirement_key)
);

CREATE TABLE IF NOT EXISTS promotional_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES promotional_reward_reservations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spin_abuse_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spin_attempt_id UUID NOT NULL REFERENCES spin_attempts(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spin_campaigns_status ON spin_campaigns(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_spin_prize_inventory_campaign_active ON spin_prize_inventory(campaign_id, is_active);
CREATE INDEX IF NOT EXISTS idx_spin_attempts_guest_created ON spin_attempts(guest_token, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_attempts_user_created ON spin_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_reservations_user_status ON promotional_reward_reservations(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_reservations_guest_status ON promotional_reward_reservations(guest_token, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_requirements_reservation ON promotional_reward_requirements(reservation_id, requirement_key);
CREATE INDEX IF NOT EXISTS idx_reward_events_reservation_created ON promotional_reward_events(reservation_id, created_at DESC);

ALTER TABLE spin_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_prize_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_reward_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_reward_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_abuse_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spin_campaigns_admin_read ON spin_campaigns;
CREATE POLICY spin_campaigns_admin_read ON spin_campaigns
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS spin_campaigns_admin_manage ON spin_campaigns;
CREATE POLICY spin_campaigns_admin_manage ON spin_campaigns
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS spin_prize_inventory_admin_manage ON spin_prize_inventory;
CREATE POLICY spin_prize_inventory_admin_manage ON spin_prize_inventory
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS spin_attempts_owner_read ON spin_attempts;
CREATE POLICY spin_attempts_owner_read ON spin_attempts
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_super_admin()
  );

DROP POLICY IF EXISTS spin_outcomes_owner_read ON spin_outcomes;
CREATE POLICY spin_outcomes_owner_read ON spin_outcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM spin_attempts sa
      WHERE sa.id = spin_outcomes.spin_attempt_id
        AND (sa.user_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS reward_reservations_owner_read ON promotional_reward_reservations;
CREATE POLICY reward_reservations_owner_read ON promotional_reward_reservations
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_super_admin()
  );

DROP POLICY IF EXISTS reward_requirements_owner_read ON promotional_reward_requirements;
CREATE POLICY reward_requirements_owner_read ON promotional_reward_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM promotional_reward_reservations prr
      WHERE prr.id = promotional_reward_requirements.reservation_id
        AND (prr.user_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS reward_events_owner_read ON promotional_reward_events;
CREATE POLICY reward_events_owner_read ON promotional_reward_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM promotional_reward_reservations prr
      WHERE prr.id = promotional_reward_events.reservation_id
        AND (prr.user_id = auth.uid() OR public.is_super_admin())
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS spin_abuse_signals_admin_read ON spin_abuse_signals;
CREATE POLICY spin_abuse_signals_admin_read ON spin_abuse_signals
  FOR SELECT USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.promotional_spin_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_spin_campaigns_updated_at ON spin_campaigns;
CREATE TRIGGER set_spin_campaigns_updated_at
BEFORE UPDATE ON spin_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.promotional_spin_set_updated_at();

DROP TRIGGER IF EXISTS set_spin_prize_inventory_updated_at ON spin_prize_inventory;
CREATE TRIGGER set_spin_prize_inventory_updated_at
BEFORE UPDATE ON spin_prize_inventory
FOR EACH ROW
EXECUTE FUNCTION public.promotional_spin_set_updated_at();

DROP TRIGGER IF EXISTS set_reward_reservations_updated_at ON promotional_reward_reservations;
CREATE TRIGGER set_reward_reservations_updated_at
BEFORE UPDATE ON promotional_reward_reservations
FOR EACH ROW
EXECUTE FUNCTION public.promotional_spin_set_updated_at();

CREATE OR REPLACE FUNCTION public.promotional_spin_log_event(
  p_reservation_id UUID,
  p_event_type TEXT,
  p_actor_user_id UUID,
  p_event_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO promotional_reward_events (reservation_id, event_type, actor_user_id, event_payload)
  VALUES (p_reservation_id, p_event_type, p_actor_user_id, COALESCE(p_event_payload, '{}'::jsonb));
END;
$$;

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
  v_random NUMERIC;
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
    (v_reservation_id, 'qualifying_referrals', 'pending', v_referral_required, 0),
    (v_reservation_id, 'membership_purchase', 'pending', 1, 0),
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

CREATE OR REPLACE FUNCTION public.promotional_spin_bind_guest_reservation(
  p_reservation_token TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation promotional_reward_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_reservation
  FROM promotional_reward_reservations
  WHERE reservation_token = p_reservation_token
  LIMIT 1;

  IF v_reservation.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;

  UPDATE promotional_reward_reservations
  SET user_id = p_user_id,
      status = CASE WHEN status = 'reserved' THEN 'pending_unlock' ELSE status END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_reservation.id;

  UPDATE promotional_reward_requirements
  SET requirement_status = 'completed',
      completed_value = 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE reservation_id = v_reservation.id
    AND requirement_key = 'registration_complete';

  PERFORM public.promotional_spin_log_event(v_reservation.id, 'reservation_bound_to_user', p_user_id, jsonb_build_object('user_id', p_user_id));

  RETURN jsonb_build_object('ok', true, 'reservation_id', v_reservation.id);
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
  SET requirement_status = CASE WHEN v_membership_orders >= 1 THEN 'completed' ELSE 'pending' END,
      completed_value = CASE WHEN v_membership_orders >= 1 THEN 1 ELSE 0 END,
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

CREATE OR REPLACE FUNCTION public.promotional_reward_vault_status(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_required');
  END IF;

  PERFORM public.promotional_reward_refresh_requirements(p_user_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'reservation_id', prr.id,
        'amount', prr.amount,
        'currency', prr.currency,
        'status', prr.status,
        'expires_at', prr.expires_at,
        'created_at', prr.created_at,
        'requirements', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'key', prq.requirement_key,
            'status', prq.requirement_status,
            'required', prq.required_value,
            'completed', prq.completed_value
          ) ORDER BY prq.requirement_key), '[]'::jsonb)
          FROM promotional_reward_requirements prq
          WHERE prq.reservation_id = prr.id
        ),
        'next_blocking_step', (
          SELECT prq.requirement_key
          FROM promotional_reward_requirements prq
          WHERE prq.reservation_id = prr.id
            AND prq.requirement_status <> 'completed'
          ORDER BY CASE prq.requirement_key
            WHEN 'registration_complete' THEN 1
            WHEN 'verification_complete' THEN 2
            WHEN 'qualifying_referrals' THEN 3
            WHEN 'membership_purchase' THEN 4
            WHEN 'not_expired' THEN 5
            ELSE 99
          END
          LIMIT 1
        )
      )
      ORDER BY prr.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_payload
  FROM promotional_reward_reservations prr
  WHERE prr.user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'reservations', v_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.promotional_reward_release(
  p_reservation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation promotional_reward_reservations%ROWTYPE;
  v_blocking_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_required');
  END IF;

  SELECT * INTO v_reservation
  FROM promotional_reward_reservations
  WHERE id = p_reservation_id
    AND user_id = p_user_id
  LIMIT 1;

  IF v_reservation.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;

  IF v_reservation.status IN ('released', 'expired', 'revoked') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_releasable', 'status', v_reservation.status);
  END IF;

  PERFORM public.promotional_reward_refresh_requirements(p_user_id);

  SELECT COUNT(*) INTO v_blocking_count
  FROM promotional_reward_requirements
  WHERE reservation_id = v_reservation.id
    AND requirement_status <> 'completed';

  IF v_blocking_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'requirements_incomplete');
  END IF;

  UPDATE promotional_reward_reservations
  SET status = 'released',
      released_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_reservation.id;

  UPDATE profiles
  SET reward_balance = COALESCE(reward_balance, 0) + v_reservation.amount,
      wallet_balance = COALESCE(wallet_balance, 0) + v_reservation.amount
  WHERE id = p_user_id;

  PERFORM public.promotional_spin_log_event(v_reservation.id, 'reward_released', p_user_id, jsonb_build_object('amount', v_reservation.amount));

  RETURN jsonb_build_object('ok', true, 'reservation_id', v_reservation.id, 'released_amount', v_reservation.amount, 'currency', v_reservation.currency);
END;
$$;

CREATE OR REPLACE FUNCTION public.promotional_reward_reinstate(
  p_reservation_id UUID,
  p_reason TEXT,
  p_actor_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE promotional_reward_reservations
  SET status = 'pending_unlock',
      revoked_at = NULL,
      revoke_reason = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_reservation_id;

  PERFORM public.promotional_spin_log_event(
    p_reservation_id,
    'reward_reinstated',
    p_actor_user_id,
    jsonb_build_object('reason', COALESCE(p_reason, 'manual_reinstate'))
  );

  RETURN jsonb_build_object('ok', true, 'reservation_id', p_reservation_id);
END;
$$;

INSERT INTO spin_campaigns (campaign_key, title, status, settings)
SELECT
  'onboarding_spin_wheel',
  'Onboarding Spin Wheel',
  'draft',
  jsonb_build_object(
    'daily_spin_limit', 1,
    'required_verified_referrals', 2,
    'reservation_expiry_hours', 72,
    'guaranteed_non_losing_first_spin', false,
    'currency', 'USD'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM spin_campaigns WHERE campaign_key = 'onboarding_spin_wheel'
);
