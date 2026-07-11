-- 026_admin_bootstrap_and_signup_hardening.sql
-- Prevent client-driven privileged signup roles and add a database-only bootstrap path for the first super admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_referral_code TEXT;
  requested_role TEXT;
  generated_role user_role;
BEGIN
  generated_referral_code := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'referral_code', ''),
    UPPER(REGEXP_REPLACE(COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9]+', '', 'g')) || '-' || UPPER(SUBSTRING(MD5(NEW.id::text), 1, 4))
  );

  requested_role := NEW.raw_user_meta_data ->> 'role';
  generated_role := CASE
    WHEN requested_role IN ('advertiser', 'registered_user', 'guest')
      THEN requested_role::user_role
    ELSE 'registered_user'::user_role
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
    0, 0, 0, 0, 0, 'Starter', 1, '{}'::TEXT[], NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url, role = EXCLUDED.role,
        status = EXCLUDED.status, is_active = EXCLUDED.is_active,
        is_email_verified = EXCLUDED.is_email_verified,
        referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO user_activity_logs (user_id, event_type, metadata)
  VALUES (NEW.id, 'signup', jsonb_build_object('email', NEW.email, 'role', generated_role::text));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'super_admin already exists';
  END IF;

  UPDATE profiles SET role = 'super_admin'::user_role, updated_at = NOW() WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid) FROM PUBLIC;