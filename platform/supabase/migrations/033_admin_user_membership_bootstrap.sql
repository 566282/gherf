-- 033_admin_user_membership_bootstrap.sql
-- Allow the authenticated admin-management path to seed both profile roles and membership tier during bootstrap.

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

  generated_level_tier := GREATEST(1, LEAST(3, COALESCE(requested_level_tier, 1)));
  generated_level_label := CASE
    WHEN generated_level_tier >= 3 THEN 'Premium'
    WHEN generated_level_tier >= 2 THEN 'Balanced'
    ELSE 'Starter'
  END;

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
