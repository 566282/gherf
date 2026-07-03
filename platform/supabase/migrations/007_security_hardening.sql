-- 007_security_hardening.sql
-- Phase 11: security controls (RLS hardening, rate limiting, CAPTCHA, CSRF, audit, session/IP/device monitoring, encryption, backup policy)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper used in multiple policies and functions.
CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id uuid DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = target_user_id
      AND role = 'super_admin'
  );
$$;

-- Enforce RLS on core data tables.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'businesses',
    'campaigns',
    'campaign_rules',
    'campaign_tasks',
    'task_submissions',
    'rewards',
    'reward_ledger',
    'admin_action_audit',
    'platform_settings',
    'user_notifications',
    'wallet_ledger',
    'user_activity_logs',
    'wallet_transactions',
    'withdrawal_requests',
    'gamification_modules',
    'gamification_user_state',
    'gamification_progress',
    'gamification_activity_log',
    'gamification_leaderboard_snapshots',
    'communication_templates',
    'communication_campaigns'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$$;

-- Profiles RLS baseline.
DROP POLICY IF EXISTS profiles_select_own_or_admin ON profiles;
CREATE POLICY profiles_select_own_or_admin ON profiles
  FOR SELECT USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS profiles_update_own_or_admin ON profiles;
CREATE POLICY profiles_update_own_or_admin ON profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

-- Security telemetry and control tables.
CREATE TABLE IF NOT EXISTS security_rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, identifier_hash)
);

CREATE TABLE IF NOT EXISTS security_captcha_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  score NUMERIC(4, 3),
  action TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, token_hash)
);

CREATE TABLE IF NOT EXISTS security_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE,
  ip_hash TEXT,
  device_hash TEXT,
  user_agent_hash TEXT,
  is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_ip_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_count INTEGER NOT NULL DEFAULT 1,
  risk_score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS security_device_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  device_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_count INTEGER NOT NULL DEFAULT 1,
  risk_score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, device_hash)
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_hash TEXT,
  device_hash TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limit_scope_identifier ON security_rate_limit_buckets(scope, identifier_hash);
CREATE INDEX IF NOT EXISTS idx_security_rate_limit_blocked_until ON security_rate_limit_buckets(blocked_until);
CREATE INDEX IF NOT EXISTS idx_security_captcha_events_user_created ON security_captcha_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_csrf_tokens_session_expiry ON security_csrf_tokens(session_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_sessions_user_last_seen ON security_sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_ip_observations_user_last_seen ON security_ip_observations(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_device_observations_user_last_seen ON security_device_observations(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_created ON security_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_created ON security_audit_logs(event_type, created_at DESC);

CREATE TRIGGER security_rate_limit_buckets_updated_at BEFORE UPDATE ON security_rate_limit_buckets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER security_sessions_updated_at BEFORE UPDATE ON security_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE security_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_rate_limit_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE security_captcha_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_captcha_events FORCE ROW LEVEL SECURITY;
ALTER TABLE security_csrf_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_csrf_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE security_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE security_ip_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_ip_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE security_device_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_device_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_rate_limit_buckets_super_admin_only ON security_rate_limit_buckets;
CREATE POLICY security_rate_limit_buckets_super_admin_only ON security_rate_limit_buckets
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS security_captcha_events_select_own_or_admin ON security_captcha_events;
CREATE POLICY security_captcha_events_select_own_or_admin ON security_captcha_events
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_csrf_tokens_select_own_or_admin ON security_csrf_tokens;
CREATE POLICY security_csrf_tokens_select_own_or_admin ON security_csrf_tokens
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_sessions_select_own_or_admin ON security_sessions;
CREATE POLICY security_sessions_select_own_or_admin ON security_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_sessions_insert_own_or_admin ON security_sessions;
CREATE POLICY security_sessions_insert_own_or_admin ON security_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_sessions_update_own_or_admin ON security_sessions;
CREATE POLICY security_sessions_update_own_or_admin ON security_sessions
  FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_ip_observations_select_own_or_admin ON security_ip_observations;
CREATE POLICY security_ip_observations_select_own_or_admin ON security_ip_observations
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_device_observations_select_own_or_admin ON security_device_observations;
CREATE POLICY security_device_observations_select_own_or_admin ON security_device_observations
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS security_audit_logs_super_admin_only ON security_audit_logs;
CREATE POLICY security_audit_logs_super_admin_only ON security_audit_logs
  FOR SELECT USING (public.is_super_admin());

-- DB-level rate limiting helper.
CREATE OR REPLACE FUNCTION public.security_check_rate_limit(
  p_scope TEXT,
  p_identifier TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hashed_identifier TEXT;
  current_bucket security_rate_limit_buckets%ROWTYPE;
  now_utc TIMESTAMPTZ;
BEGIN
  now_utc := CURRENT_TIMESTAMP;
  hashed_identifier := ENCODE(DIGEST(COALESCE(p_identifier, ''), 'sha256'), 'hex');

  INSERT INTO security_rate_limit_buckets (scope, identifier_hash, window_started_at, request_count, blocked_until)
  VALUES (p_scope, hashed_identifier, now_utc, 0, NULL)
  ON CONFLICT (scope, identifier_hash) DO NOTHING;

  SELECT *
  INTO current_bucket
  FROM security_rate_limit_buckets
  WHERE scope = p_scope
    AND identifier_hash = hashed_identifier
  FOR UPDATE;

  IF current_bucket.blocked_until IS NOT NULL AND current_bucket.blocked_until > now_utc THEN
    RETURN QUERY SELECT FALSE, 0, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_bucket.blocked_until - now_utc)))::INTEGER);
    RETURN;
  END IF;

  IF EXTRACT(EPOCH FROM (now_utc - current_bucket.window_started_at)) >= p_window_seconds THEN
    UPDATE security_rate_limit_buckets
    SET window_started_at = now_utc,
        request_count = 1,
        blocked_until = NULL,
        updated_at = now_utc
    WHERE id = current_bucket.id;

    RETURN QUERY SELECT TRUE, GREATEST(0, p_limit - 1), 0;
    RETURN;
  END IF;

  IF current_bucket.request_count + 1 > p_limit THEN
    UPDATE security_rate_limit_buckets
    SET request_count = current_bucket.request_count + 1,
        blocked_until = now_utc + make_interval(secs => p_block_seconds),
        updated_at = now_utc
    WHERE id = current_bucket.id;

    RETURN QUERY SELECT FALSE, 0, p_block_seconds;
    RETURN;
  END IF;

  UPDATE security_rate_limit_buckets
  SET request_count = current_bucket.request_count + 1,
      updated_at = now_utc
  WHERE id = current_bucket.id;

  RETURN QUERY SELECT TRUE, GREATEST(0, p_limit - (current_bucket.request_count + 1)), 0;
END;
$$;

-- CAPTCHA verification event storage.
CREATE OR REPLACE FUNCTION public.security_log_captcha_event(
  p_provider TEXT,
  p_token TEXT,
  p_success BOOLEAN,
  p_score NUMERIC DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_captcha_events (user_id, provider, token_hash, success, score, action, metadata)
  VALUES (
    auth.uid(),
    p_provider,
    ENCODE(DIGEST(COALESCE(p_token, ''), 'sha256'), 'hex'),
    p_success,
    p_score,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- CSRF lifecycle helpers.
CREATE OR REPLACE FUNCTION public.security_issue_csrf_token(
  p_session_id UUID,
  p_ttl_seconds INTEGER DEFAULT 3600
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  raw_token TEXT;
BEGIN
  raw_token := ENCODE(gen_random_bytes(32), 'hex');

  INSERT INTO security_csrf_tokens (user_id, session_id, token_hash, expires_at)
  VALUES (
    auth.uid(),
    p_session_id,
    ENCODE(DIGEST(raw_token, 'sha256'), 'hex'),
    CURRENT_TIMESTAMP + make_interval(secs => p_ttl_seconds)
  );

  RETURN raw_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_validate_csrf_token(
  p_session_id UUID,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_row_id UUID;
BEGIN
  SELECT id
  INTO token_row_id
  FROM security_csrf_tokens
  WHERE session_id = p_session_id
    AND token_hash = ENCODE(DIGEST(COALESCE(p_token, ''), 'sha256'), 'hex')
    AND consumed_at IS NULL
    AND expires_at > CURRENT_TIMESTAMP
  ORDER BY issued_at DESC
  LIMIT 1
  FOR UPDATE;

  IF token_row_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE security_csrf_tokens
  SET consumed_at = CURRENT_TIMESTAMP
  WHERE id = token_row_id;

  RETURN TRUE;
END;
$$;

-- Session and telemetry helpers.
CREATE OR REPLACE FUNCTION public.security_register_session(
  p_session_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_ip TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_is_trusted BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_sessions (
    user_id,
    session_id,
    ip_hash,
    device_hash,
    user_agent_hash,
    is_trusted,
    expires_at,
    last_seen_at
  )
  VALUES (
    auth.uid(),
    p_session_id,
    CASE WHEN p_ip IS NULL THEN NULL ELSE ENCODE(DIGEST(p_ip, 'sha256'), 'hex') END,
    CASE WHEN p_device_fingerprint IS NULL THEN NULL ELSE ENCODE(DIGEST(p_device_fingerprint, 'sha256'), 'hex') END,
    CASE WHEN p_user_agent IS NULL THEN NULL ELSE ENCODE(DIGEST(p_user_agent, 'sha256'), 'hex') END,
    COALESCE(p_is_trusted, FALSE),
    p_expires_at,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (session_id) DO UPDATE
    SET ip_hash = EXCLUDED.ip_hash,
        device_hash = EXCLUDED.device_hash,
        user_agent_hash = EXCLUDED.user_agent_hash,
        is_trusted = EXCLUDED.is_trusted,
        expires_at = EXCLUDED.expires_at,
        is_revoked = FALSE,
        revoked_reason = NULL,
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_revoke_session(
  p_session_id UUID,
  p_reason TEXT DEFAULT 'manual_revocation'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE security_sessions
  SET is_revoked = TRUE,
      revoked_reason = p_reason,
      updated_at = CURRENT_TIMESTAMP
  WHERE session_id = p_session_id
    AND (user_id = auth.uid() OR public.is_super_admin());
END;
$$;

CREATE OR REPLACE FUNCTION public.security_observe_ip(
  p_ip TEXT,
  p_risk_delta INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hashed_ip TEXT;
BEGIN
  hashed_ip := ENCODE(DIGEST(COALESCE(p_ip, ''), 'sha256'), 'hex');

  INSERT INTO security_ip_observations (user_id, ip_hash, first_seen_at, last_seen_at, event_count, risk_score, metadata)
  VALUES (auth.uid(), hashed_ip, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, GREATEST(0, p_risk_delta), COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, ip_hash) DO UPDATE
    SET event_count = security_ip_observations.event_count + 1,
        risk_score = GREATEST(0, security_ip_observations.risk_score + p_risk_delta),
        last_seen_at = CURRENT_TIMESTAMP,
        metadata = jsonb_strip_nulls(COALESCE(security_ip_observations.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.security_observe_device(
  p_device_fingerprint TEXT,
  p_risk_delta INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hashed_device TEXT;
BEGIN
  hashed_device := ENCODE(DIGEST(COALESCE(p_device_fingerprint, ''), 'sha256'), 'hex');

  INSERT INTO security_device_observations (user_id, device_hash, first_seen_at, last_seen_at, event_count, risk_score, metadata)
  VALUES (auth.uid(), hashed_device, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, GREATEST(0, p_risk_delta), COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, device_hash) DO UPDATE
    SET event_count = security_device_observations.event_count + 1,
        risk_score = GREATEST(0, security_device_observations.risk_score + p_risk_delta),
        last_seen_at = CURRENT_TIMESTAMP,
        metadata = jsonb_strip_nulls(COALESCE(security_device_observations.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.security_write_audit(
  p_event_type TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_audit_logs (
    actor_user_id,
    event_type,
    resource_type,
    resource_id,
    ip_hash,
    device_hash,
    details
  )
  VALUES (
    auth.uid(),
    p_event_type,
    p_resource_type,
    p_resource_id,
    CASE WHEN p_ip IS NULL THEN NULL ELSE ENCODE(DIGEST(p_ip, 'sha256'), 'hex') END,
    CASE WHEN p_device_fingerprint IS NULL THEN NULL ELSE ENCODE(DIGEST(p_device_fingerprint, 'sha256'), 'hex') END,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

-- Seed security defaults, including backup strategy controls.
INSERT INTO platform_settings (key, value, description)
VALUES
  (
    'security_rate_limits',
    '{
      "auth_login_attempts": 6,
      "auth_login_window_seconds": 300,
      "auth_signup_attempts": 5,
      "auth_signup_window_seconds": 3600,
      "password_reset_attempts": 4,
      "password_reset_window_seconds": 3600
    }'::jsonb,
    'Phase 11: configurable server-side rate limits for sensitive endpoints'
  ),
  (
    'security_session_policy',
    '{
      "idle_timeout_minutes": 30,
      "max_session_hours": 24,
      "remember_me_max_days": 7,
      "max_concurrent_sessions": 5
    }'::jsonb,
    'Phase 11: secure session and token lifecycle controls'
  ),
  (
    'security_backup_policy',
    '{
      "enabled": true,
      "strategy": "daily_full_plus_point_in_time_recovery",
      "retention_days": 35,
      "cross_region_replication": true,
      "weekly_restore_drill": true,
      "encryption": "aes256",
      "last_reviewed": "2026-07-03"
    }'::jsonb,
    'Phase 11: backup and recovery strategy requirements'
  ),
  (
    'security_captcha_policy',
    '{
      "enabled": true,
      "provider": "turnstile",
      "required_actions": ["signup", "login", "password_reset"],
      "minimum_score": 0.5
    }'::jsonb,
    'Phase 11: CAPTCHA enforcement policy'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = CURRENT_TIMESTAMP;
