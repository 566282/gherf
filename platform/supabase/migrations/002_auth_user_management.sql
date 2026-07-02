-- 002_auth_user_management.sql
-- Phase 2 auth, identity, wallet, referral, notification, and activity tracking support

ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'banned';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'pending_verification';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_history_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_notifications_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reputation_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_label TEXT NOT NULL DEFAULT 'Starter',
  ADD COLUMN IF NOT EXISTS level_tier INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

UPDATE profiles
SET
  is_email_verified = COALESCE(is_email_verified, FALSE),
  two_factor_enabled = COALESCE(two_factor_enabled, FALSE),
  wallet_balance = COALESCE(wallet_balance, 0),
  reward_balance = COALESCE(reward_balance, 0),
  reward_history_count = COALESCE(reward_history_count, 0),
  unread_notifications_count = COALESCE(unread_notifications_count, 0),
  reputation_score = COALESCE(reputation_score, 0),
  level_label = COALESCE(level_label, 'Starter'),
  level_tier = COALESCE(level_tier, 1),
  badges = COALESCE(badges, '{}'::TEXT[])
WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_code ON profiles(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_created_at ON user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id_created_at ON wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id_created_at ON user_activity_logs(user_id, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notifications_select_own ON user_notifications
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY user_notifications_update_own ON user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY wallet_ledger_select_own ON wallet_ledger
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY user_activity_logs_select_own ON user_activity_logs
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_referral_code TEXT;
  generated_role user_role;
BEGIN
  generated_referral_code := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'referral_code', ''),
    UPPER(REGEXP_REPLACE(COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9]+', '', 'g')) || '-' || UPPER(SUBSTRING(MD5(NEW.id::text), 1, 4))
  );

  generated_role := CASE
    WHEN (NEW.raw_user_meta_data ->> 'role') IN ('super_admin', 'campaign_manager', 'moderator', 'advertiser', 'registered_user', 'guest')
      THEN (NEW.raw_user_meta_data ->> 'role')::user_role
    ELSE 'registered_user'::user_role
  END;

  INSERT INTO profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    status,
    is_active,
    is_email_verified,
    two_factor_enabled,
    referral_code,
    referred_by_code,
    wallet_balance,
    reward_balance,
    reward_history_count,
    unread_notifications_count,
    reputation_score,
    level_label,
    level_tier,
    badges,
    last_login_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    generated_role,
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'pending_verification'::user_status ELSE 'active'::user_status END,
    TRUE,
    NEW.email_confirmed_at IS NOT NULL,
    COALESCE((NEW.raw_user_meta_data ->> 'two_factor_enabled')::BOOLEAN, FALSE),
    generated_referral_code,
    NULLIF(NEW.raw_user_meta_data ->> 'referred_by_code', ''),
    0,
    0,
    0,
    0,
    0,
    'Starter',
    1,
    '{}'::TEXT[],
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        is_email_verified = EXCLUDED.is_email_verified,
        referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO user_activity_logs (user_id, event_type, metadata)
  VALUES (NEW.id, 'signup', jsonb_build_object('email', NEW.email, 'role', generated_role::text));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
