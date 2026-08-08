-- 055_membership_free_tier_onboarding_default.sql
-- Introduce Free tier (level 0) as default signup membership and keep Tier 1 as paid.

ALTER TABLE IF EXISTS public.membership_plan_catalog
  DROP CONSTRAINT IF EXISTS membership_plan_catalog_level_check;

ALTER TABLE IF EXISTS public.membership_plan_catalog
  ADD CONSTRAINT membership_plan_catalog_level_check CHECK (level >= 0);

ALTER TABLE IF EXISTS public.membership_upgrade_requests
  DROP CONSTRAINT IF EXISTS membership_upgrade_requests_target_tier_check;

ALTER TABLE IF EXISTS public.membership_upgrade_requests
  ADD CONSTRAINT membership_upgrade_requests_target_tier_check CHECK (target_tier >= 0);

INSERT INTO public.membership_plan_catalog (
  level,
  slug,
  label,
  price,
  currency,
  duration_days,
  category,
  benefits,
  is_active,
  archived_at,
  updated_at
)
VALUES (
  0,
  'free',
  'Free',
  0,
  'NGN',
  30,
  'free',
  '["Starter access", "Onboarding checklist", "Upgrade when ready"]'::jsonb,
  TRUE,
  NULL,
  CURRENT_TIMESTAMP
)
ON CONFLICT (level) DO UPDATE
SET
  slug = EXCLUDED.slug,
  label = EXCLUDED.label,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  duration_days = EXCLUDED.duration_days,
  category = EXCLUDED.category,
  benefits = EXCLUDED.benefits,
  is_active = EXCLUDED.is_active,
  archived_at = EXCLUDED.archived_at,
  updated_at = CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  generated_referral_code TEXT;
  requested_role TEXT;
  requested_level_tier INTEGER;
  generated_role public.user_role;
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
      THEN requested_role::public.user_role
    WHEN requested_role IN ('advertiser', 'registered_user', 'guest')
      THEN requested_role::public.user_role
    ELSE 'registered_user'::public.user_role
  END;

  requested_level_tier := CASE
    WHEN is_admin_managed AND COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'level_tier', ''), '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data ->> 'level_tier')::INTEGER
    ELSE 0
  END;

  generated_level_tier := GREATEST(0, COALESCE(requested_level_tier, 0));
  generated_level_label := COALESCE(
    (SELECT label FROM public.membership_plan_catalog WHERE level = generated_level_tier ORDER BY level LIMIT 1),
    format('Tier %s', generated_level_tier)
  );

  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, status, is_active, is_email_verified,
    two_factor_enabled, referral_code, referred_by_code, wallet_balance, reward_balance,
    reward_history_count, unread_notifications_count, reputation_score, level_label,
    level_tier, badges, last_login_at
  ) VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    generated_role,
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'pending_verification'::public.user_status ELSE 'active'::public.user_status END,
    TRUE, NEW.email_confirmed_at IS NOT NULL,
    COALESCE((NEW.raw_user_meta_data ->> 'two_factor_enabled')::BOOLEAN, FALSE),
    generated_referral_code,
    NULLIF(NEW.raw_user_meta_data ->> 'referred_by_code', ''),
    0, 0, 0, 0, 0, generated_level_label, generated_level_tier, '{}'::TEXT[], NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        is_email_verified = EXCLUDED.is_email_verified,
        referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
        level_label = EXCLUDED.level_label,
        level_tier = EXCLUDED.level_tier;

  INSERT INTO public.user_activity_logs (user_id, event_type, metadata)
  VALUES (NEW.id, 'signup', jsonb_build_object('email', NEW.email, 'role', generated_role::text, 'level_tier', generated_level_tier));

  RETURN NEW;
END;
$$;

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
  resolved_tier INTEGER := GREATEST(0, COALESCE(p_level_tier, 0));
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

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'wallet_paid_membership_min_tier',
  '1'::jsonb,
  'Minimum membership tier required for paid-wallet withdrawal eligibility.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
