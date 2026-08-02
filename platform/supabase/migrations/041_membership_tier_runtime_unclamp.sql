-- 041_membership_tier_runtime_unclamp.sql
-- Remove the legacy 3-tier clamp from membership runtime functions so higher tiers flow through the catalog.

ALTER TABLE membership_plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plan_catalog FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_plan_catalog_select_authenticated ON membership_plan_catalog;
CREATE POLICY membership_plan_catalog_select_authenticated ON membership_plan_catalog
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_super_admin());

DROP POLICY IF EXISTS membership_plan_catalog_manage_super_admin ON membership_plan_catalog;
CREATE POLICY membership_plan_catalog_manage_super_admin ON membership_plan_catalog
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_referral_code TEXT;
  requested_role TEXT;
  requested_level_tier INTEGER;
  generated_role user_role;
  generated_level_tier INTEGER;
  generated_level_label TEXT;
  is_admin_managed BOOLEAN;
BEGIN
  is_admin_managed := COALESCE((NEW.raw_app_meta_data ->> 'admin_managed')::BOOLEAN, FALSE);

  generated_referral_code := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'referral_code', ''),
    UPPER(REGEXP_REPLACE(COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9]+', '', 'g')) || '-' || UPPER(SUBSTRING(MD5(NEW.id::text), 1, 4))
  );

  requested_role := NEW.raw_user_meta_data ->> 'role';
  generated_role := CASE
    WHEN is_admin_managed AND requested_role IN ('super_admin', 'campaign_manager', 'moderator', 'advertiser', 'registered_user', 'guest')
      THEN requested_role::user_role
    WHEN requested_role IN ('advertiser', 'registered_user', 'guest')
      THEN requested_role::user_role
    ELSE 'registered_user'::user_role
  END;

  requested_level_tier := CASE
    WHEN is_admin_managed AND COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'level_tier', ''), '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data ->> 'level_tier')::INTEGER
    ELSE 1
  END;

  generated_level_tier := GREATEST(1, COALESCE(requested_level_tier, 1));
  generated_level_label := COALESCE(
    (SELECT label FROM public.membership_plan_catalog WHERE level = generated_level_tier ORDER BY level LIMIT 1),
    format('Tier %s', generated_level_tier)
  );

  INSERT INTO profiles (
    id, email, full_name, avatar_url, role, status, is_active, is_email_verified,
    two_factor_enabled, referral_code, referred_by_code, wallet_balance, reward_balance,
    reward_history_count, unread_notifications_count, reputation_score, level_label,
    level_tier, badges, last_login_at
  ) VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    generated_role,
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'pending_verification'::user_status ELSE 'active'::user_status END,
    TRUE, NEW.email_confirmed_at IS NOT NULL,
    COALESCE((NEW.raw_user_meta_data ->> 'two_factor_enabled')::BOOLEAN, FALSE),
    generated_referral_code,
    NULLIF(NEW.raw_user_meta_data ->> 'referred_by_code', ''),
    0, 0, 0, 0, 0, generated_level_label, generated_level_tier, '{}'::TEXT[], NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url, role = EXCLUDED.role,
        status = EXCLUDED.status, is_active = EXCLUDED.is_active,
        is_email_verified = EXCLUDED.is_email_verified,
        referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code),
        level_label = EXCLUDED.level_label,
        level_tier = EXCLUDED.level_tier;

  INSERT INTO user_activity_logs (user_id, event_type, metadata)
  VALUES (NEW.id, 'signup', jsonb_build_object('email', NEW.email, 'role', generated_role::text, 'level_tier', generated_level_tier));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_member_plan_change(
  p_user_id UUID,
  p_level_tier INTEGER,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'USD',
  p_source TEXT DEFAULT 'membership_plan_update',
  p_reference_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_tier INTEGER := GREATEST(1, COALESCE(p_level_tier, 1));
  resolved_label TEXT;
  payment_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'You can only change your own membership plan';
  END IF;

  resolved_label := COALESCE(
    (SELECT label FROM public.membership_plan_catalog WHERE level = resolved_tier ORDER BY level LIMIT 1),
    format('Tier %s', resolved_tier)
  );

  UPDATE profiles
  SET level_tier = resolved_tier,
      level_label = resolved_label,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  INSERT INTO membership_payments (
    user_id,
    level_tier,
    level_label,
    amount,
    currency,
    source,
    reference_id,
    note,
    recorded_by
  ) VALUES (
    p_user_id,
    resolved_tier,
    resolved_label,
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_currency, ''), 'USD'),
    COALESCE(NULLIF(p_source, ''), 'membership_plan_update'),
    NULLIF(p_reference_id, ''),
    NULLIF(p_note, ''),
    CASE WHEN public.is_super_admin() THEN auth.uid() ELSE auth.uid() END
  )
  RETURNING id INTO payment_id;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'levelTier', resolved_tier,
    'levelLabel', resolved_label,
    'paymentId', payment_id,
    'amount', COALESCE(p_amount, 0),
    'currency', COALESCE(NULLIF(p_currency, ''), 'USD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_member_plan_change(UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_member_plan_change(UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
