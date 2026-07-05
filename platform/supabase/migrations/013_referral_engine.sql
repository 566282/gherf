-- 013_referral_engine.sql
-- Real referral backend: programs, attribution, commissions, milestones, fraud flags, and leaderboard snapshots.

CREATE TABLE IF NOT EXISTS referral_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_slug TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invite_bonus_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tier_one_commission_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  tier_two_commission_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  qualification_window_days INTEGER NOT NULL DEFAULT 14,
  payout_delay_days INTEGER NOT NULL DEFAULT 0,
  max_tier_depth INTEGER NOT NULL DEFAULT 2,
  milestone_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  leaderboard_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  fraud_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  analytics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  referred_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referrer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  source_campaign_slug TEXT,
  source_channel TEXT,
  qualification_status TEXT NOT NULL DEFAULT 'pending',
  fraud_status TEXT NOT NULL DEFAULT 'clear',
  is_duplicate_account BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_signal TEXT,
  fraud_score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (referred_profile_id)
);

CREATE TABLE IF NOT EXISTS referral_commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  attribution_id UUID NOT NULL REFERENCES referral_attributions(id) ON DELETE CASCADE,
  beneficiary_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_depth INTEGER NOT NULL DEFAULT 1,
  commission_kind TEXT NOT NULL DEFAULT 'commission',
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'available',
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_milestone_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  beneficiary_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  milestone_label TEXT NOT NULL,
  threshold_value INTEGER NOT NULL DEFAULT 0,
  current_value INTEGER NOT NULL DEFAULT 0,
  reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  achieved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (program_id, beneficiary_profile_id, milestone_key)
);

CREATE TABLE IF NOT EXISTS referral_fraud_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES referral_attributions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  related_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rule_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  signal TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  referral_count INTEGER NOT NULL DEFAULT 0,
  commission_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  rank INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (program_id, profile_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_referral_programs_status_created_at ON referral_programs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_program_referrer_created_at ON referral_attributions(program_id, referrer_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_program_referred_created_at ON referral_attributions(program_id, referred_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_commission_ledger_beneficiary_created_at ON referral_commission_ledger(beneficiary_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_milestone_progress_beneficiary_created_at ON referral_milestone_progress(beneficiary_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_fraud_flags_profile_created_at ON referral_fraud_flags(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_leaderboard_period_rank ON referral_leaderboard_snapshots(period_key, rank);

ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_milestone_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_programs_select_authenticated ON referral_programs;
CREATE POLICY referral_programs_select_authenticated ON referral_programs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS referral_programs_manage_super_admin ON referral_programs;
CREATE POLICY referral_programs_manage_super_admin ON referral_programs
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS referral_attributions_select_owner_or_admin ON referral_attributions;
CREATE POLICY referral_attributions_select_owner_or_admin ON referral_attributions
  FOR SELECT USING (
    auth.uid() = referred_profile_id
    OR auth.uid() = referrer_profile_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS referral_commission_ledger_select_owner_or_admin ON referral_commission_ledger;
CREATE POLICY referral_commission_ledger_select_owner_or_admin ON referral_commission_ledger
  FOR SELECT USING (
    auth.uid() = beneficiary_profile_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS referral_milestone_progress_select_owner_or_admin ON referral_milestone_progress;
CREATE POLICY referral_milestone_progress_select_owner_or_admin ON referral_milestone_progress
  FOR SELECT USING (
    auth.uid() = beneficiary_profile_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS referral_fraud_flags_select_owner_or_admin ON referral_fraud_flags;
CREATE POLICY referral_fraud_flags_select_owner_or_admin ON referral_fraud_flags
  FOR SELECT USING (
    auth.uid() = profile_id
    OR auth.uid() = related_profile_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS referral_leaderboard_snapshots_select_authenticated ON referral_leaderboard_snapshots;
CREATE POLICY referral_leaderboard_snapshots_select_authenticated ON referral_leaderboard_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.sync_referral_leaderboard_snapshot(
  p_program_id UUID,
  p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
  period_end DATE := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  target_period_key TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  referral_count INTEGER;
  commission_total NUMERIC(15, 2);
  snapshot_rank INTEGER;
BEGIN
  SELECT COUNT(DISTINCT attribution_id), COALESCE(SUM(amount), 0)
  INTO referral_count, commission_total
  FROM referral_commission_ledger
  WHERE program_id = p_program_id
    AND beneficiary_profile_id = p_profile_id
    AND created_at >= period_start::TIMESTAMPTZ;

  SELECT rank
  INTO snapshot_rank
  FROM (
    SELECT
      profile_id,
      RANK() OVER (ORDER BY commission_sum DESC, profile_id ASC) AS rank
    FROM (
      SELECT
        profile_id,
        COALESCE(SUM(amount), 0) AS commission_sum
      FROM referral_commission_ledger
      WHERE program_id = p_program_id
        AND created_at >= period_start::TIMESTAMPTZ
      GROUP BY profile_id
    ) leaderboard_totals
  ) ranked
  WHERE ranked.profile_id = p_profile_id;

  INSERT INTO referral_leaderboard_snapshots (
    program_id,
    profile_id,
    period_key,
    period_start,
    period_end,
    referral_count,
    commission_total,
    rank,
    metadata
  ) VALUES (
    p_program_id,
    p_profile_id,
    target_period_key,
    period_start,
    period_end,
    referral_count,
    commission_total,
    snapshot_rank,
    jsonb_build_object('updatedBy', 'referral_commission_trigger')
  )
  ON CONFLICT (program_id, profile_id, period_key) DO UPDATE
    SET referral_count = EXCLUDED.referral_count,
        commission_total = EXCLUDED.commission_total,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_referral_milestones(
  p_program_id UUID,
  p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  program_row referral_programs%ROWTYPE;
  milestone JSONB;
  milestone_key TEXT;
  milestone_label TEXT;
  threshold_value INTEGER;
  reward_amount NUMERIC(15, 2);
  current_value INTEGER;
  achieved_now BOOLEAN;
BEGIN
  SELECT * INTO program_row
  FROM referral_programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO current_value
  FROM referral_attributions
  WHERE program_id = p_program_id
    AND referrer_profile_id = p_profile_id
    AND qualification_status = 'qualified';

  FOR milestone IN SELECT * FROM jsonb_array_elements(program_row.milestone_config)
  LOOP
    milestone_key := COALESCE(NULLIF(milestone ->> 'key', ''), NULLIF(milestone ->> 'slug', ''), 'milestone');
    milestone_label := COALESCE(NULLIF(milestone ->> 'label', ''), milestone_key);
    threshold_value := COALESCE((milestone ->> 'threshold')::INTEGER, 0);
    reward_amount := COALESCE((milestone ->> 'rewardAmount')::NUMERIC, 0);
    achieved_now := current_value >= threshold_value;

    INSERT INTO referral_milestone_progress (
      program_id,
      beneficiary_profile_id,
      milestone_key,
      milestone_label,
      threshold_value,
      current_value,
      reward_amount,
      status,
      achieved_at,
      metadata
    ) VALUES (
      p_program_id,
      p_profile_id,
      milestone_key,
      milestone_label,
      threshold_value,
      current_value,
      reward_amount,
      CASE WHEN achieved_now THEN 'achieved' ELSE 'pending' END,
      CASE WHEN achieved_now THEN CURRENT_TIMESTAMP ELSE NULL END,
      milestone
    )
    ON CONFLICT (program_id, beneficiary_profile_id, milestone_key) DO UPDATE
      SET milestone_label = EXCLUDED.milestone_label,
          threshold_value = EXCLUDED.threshold_value,
          current_value = EXCLUDED.current_value,
          reward_amount = EXCLUDED.reward_amount,
          status = EXCLUDED.status,
          achieved_at = COALESCE(referral_milestone_progress.achieved_at, EXCLUDED.achieved_at),
          updated_at = CURRENT_TIMESTAMP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral_commission(
  p_program_id UUID,
  p_attribution_id UUID,
  p_beneficiary_profile_id UUID,
  p_tier_depth INTEGER,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_commission_kind TEXT DEFAULT 'referral_commission',
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  adjustment JSONB;
  transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('skipped', TRUE, 'reason', 'non_positive_amount');
  END IF;

  adjustment := public.record_wallet_adjustment(
    p_beneficiary_profile_id,
    'referral',
    ROUND(p_amount, 2),
    p_currency,
    'referral_commission',
    p_note,
    NULL
  );

  transaction_id := (adjustment ->> 'transaction_id')::UUID;

  INSERT INTO referral_commission_ledger (
    program_id,
    attribution_id,
    beneficiary_profile_id,
    tier_depth,
    commission_kind,
    amount,
    currency,
    status,
    wallet_transaction_id,
    note,
    metadata
  ) VALUES (
    p_program_id,
    p_attribution_id,
    p_beneficiary_profile_id,
    p_tier_depth,
    p_commission_kind,
    ROUND(p_amount, 2),
    p_currency,
    'available',
    transaction_id,
    p_note,
    p_metadata
  );

  PERFORM public.sync_referral_leaderboard_snapshot(p_program_id, p_beneficiary_profile_id);
  PERFORM public.evaluate_referral_milestones(p_program_id, p_beneficiary_profile_id);

  RETURN jsonb_build_object(
    'transaction_id', transaction_id,
    'amount', ROUND(p_amount, 2),
    'currency', p_currency,
    'tier_depth', p_tier_depth
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
  duplicate_count INTEGER := 0;
  duplicate_signal TEXT := NULL;
  normalized_code TEXT;
  invite_bonus NUMERIC(15, 2);
  tier_two_amount NUMERIC(15, 2);
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
      jsonb_build_object('referralCode', normalized_code)
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
      jsonb_build_object('referralCode', normalized_code)
    );
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM referral_attributions
  WHERE program_id = program_row.id
    AND referred_profile_id = NEW.id;

  IF duplicate_count > 0 THEN
    duplicate_signal := 'Duplicate referral attribution attempt for the same profile.';
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
    'qualified',
    CASE WHEN duplicate_count > 0 THEN 'flagged' ELSE 'clear' END,
    duplicate_count > 0,
    duplicate_signal,
    CASE WHEN duplicate_count > 0 THEN 80 ELSE 0 END,
    jsonb_build_object(
      'referralCode', normalized_code,
      'campaignSlug', program_row.campaign_slug,
      'sourceChannel', 'signup'
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
      jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup')
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
      jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup')
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
          jsonb_build_object('referralCode', normalized_code, 'trigger', 'signup')
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_referral_program_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_referral_record_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_referral_commission_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.sync_referral_leaderboard_snapshot(NEW.program_id, NEW.beneficiary_profile_id);
  PERFORM public.evaluate_referral_milestones(NEW.program_id, NEW.beneficiary_profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_programs_updated_at ON referral_programs;
CREATE TRIGGER referral_programs_updated_at
  BEFORE UPDATE ON referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.sync_referral_program_updated_at();

DROP TRIGGER IF EXISTS referral_attributions_updated_at ON referral_attributions;
CREATE TRIGGER referral_attributions_updated_at
  BEFORE UPDATE ON referral_attributions
  FOR EACH ROW EXECUTE FUNCTION public.sync_referral_record_updated_at();

DROP TRIGGER IF EXISTS referral_milestone_progress_updated_at ON referral_milestone_progress;
CREATE TRIGGER referral_milestone_progress_updated_at
  BEFORE UPDATE ON referral_milestone_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_referral_record_updated_at();

DROP TRIGGER IF EXISTS referral_leaderboard_snapshots_updated_at ON referral_leaderboard_snapshots;
CREATE TRIGGER referral_leaderboard_snapshots_updated_at
  BEFORE UPDATE ON referral_leaderboard_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.sync_referral_record_updated_at();

DROP TRIGGER IF EXISTS on_profile_referral_attribution ON profiles;
CREATE TRIGGER on_profile_referral_attribution
  AFTER INSERT OR UPDATE OF referred_by_code ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.process_referral_attribution_for_profile();

DROP TRIGGER IF EXISTS referral_commission_ledger_sync ON referral_commission_ledger;
CREATE TRIGGER referral_commission_ledger_sync
  AFTER INSERT ON referral_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_commission_insert();

INSERT INTO referral_programs (
  slug,
  name,
  description,
  campaign_slug,
  status,
  invite_bonus_amount,
  tier_one_commission_percent,
  tier_two_commission_percent,
  qualification_window_days,
  payout_delay_days,
  max_tier_depth,
  milestone_config,
  leaderboard_config,
  fraud_config,
  analytics_config,
  metadata
)
VALUES (
  'default-referral-program',
  'Referral program',
  'Signup referrals, multi-level commissions, milestones, leaderboard ranking, and fraud controls.',
  'referral_campaigns',
  'active',
  4.00,
  8.00,
  3.00,
  14,
  7,
  2,
  '[{"key":"first_referral","label":"First referral","threshold":1,"rewardAmount":4},{"key":"ten_referrals","label":"Ten referrals","threshold":10,"rewardAmount":25},{"key":"fifty_referrals","label":"Fifty referrals","threshold":50,"rewardAmount":100}]'::jsonb,
  '{"period":"monthly","metric":"commission_total"}'::jsonb,
  '{"rules":["self_referral","duplicate_referral_attempt","invalid_referral_code"]}'::jsonb,
  '{"metrics":["referralsByDay","referralCommissions","fraudFlags"]}'::jsonb,
  '{"source":"migration_013_referral_engine"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      campaign_slug = EXCLUDED.campaign_slug,
      status = EXCLUDED.status,
      invite_bonus_amount = EXCLUDED.invite_bonus_amount,
      tier_one_commission_percent = EXCLUDED.tier_one_commission_percent,
      tier_two_commission_percent = EXCLUDED.tier_two_commission_percent,
      qualification_window_days = EXCLUDED.qualification_window_days,
      payout_delay_days = EXCLUDED.payout_delay_days,
      max_tier_depth = EXCLUDED.max_tier_depth,
      milestone_config = EXCLUDED.milestone_config,
      leaderboard_config = EXCLUDED.leaderboard_config,
      fraud_config = EXCLUDED.fraud_config,
      analytics_config = EXCLUDED.analytics_config,
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP;