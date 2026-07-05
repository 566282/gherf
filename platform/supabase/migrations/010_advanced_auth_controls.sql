-- 010_advanced_auth_controls.sql
-- Advanced Supabase Auth controls: account lock state, login attempt tracking, and auth state helpers.

CREATE TABLE IF NOT EXISTS security_auth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_hash TEXT NOT NULL UNIQUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  lock_reason TEXT,
  last_failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_auth_states_user_id ON security_auth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_security_auth_states_locked_until ON security_auth_states(locked_until);

ALTER TABLE security_auth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_auth_states FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_auth_states_select_own_or_admin ON security_auth_states;
CREATE POLICY security_auth_states_select_own_or_admin ON security_auth_states
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS security_auth_states_update_admin_only ON security_auth_states;
CREATE POLICY security_auth_states_update_admin_only ON security_auth_states
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS security_auth_states_insert_admin_only ON security_auth_states;
CREATE POLICY security_auth_states_insert_admin_only ON security_auth_states
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS security_auth_states_updated_at ON security_auth_states;
CREATE TRIGGER security_auth_states_updated_at BEFORE UPDATE ON security_auth_states
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.security_attach_auth_state_user(
  p_email TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_email TEXT;
BEGIN
  normalized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF normalized_email = '' OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE security_auth_states
  SET user_id = p_user_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE email_hash = ENCODE(DIGEST(normalized_email, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.security_handle_auth_failure(
  p_email TEXT,
  p_reason TEXT DEFAULT 'invalid_credentials',
  p_attempt_limit INTEGER DEFAULT 6,
  p_lock_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(failed_attempts INTEGER, locked_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_email TEXT;
  email_digest TEXT;
  next_attempts INTEGER;
  next_locked_until TIMESTAMPTZ;
BEGIN
  normalized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF normalized_email = '' THEN
    RETURN QUERY SELECT 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  email_digest := ENCODE(DIGEST(normalized_email, 'sha256'), 'hex');

  INSERT INTO security_auth_states (email_hash, failed_attempts, last_failed_at, lock_reason)
  VALUES (email_digest, 0, CURRENT_TIMESTAMP, p_reason)
  ON CONFLICT (email_hash) DO NOTHING;

  SELECT GREATEST(0, failed_attempts) + 1
  INTO next_attempts
  FROM security_auth_states
  WHERE email_hash = email_digest
  FOR UPDATE;

  next_locked_until := CASE
    WHEN next_attempts >= GREATEST(1, p_attempt_limit)
      THEN CURRENT_TIMESTAMP + make_interval(mins => GREATEST(1, p_lock_minutes))
    ELSE NULL
  END;

  UPDATE security_auth_states
  SET failed_attempts = next_attempts,
      locked_until = next_locked_until,
      lock_reason = p_reason,
      last_failed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE email_hash = email_digest;

  RETURN QUERY SELECT next_attempts, next_locked_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_handle_auth_success(
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_email TEXT;
BEGIN
  normalized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF normalized_email = '' THEN
    RETURN;
  END IF;

  UPDATE security_auth_states
  SET failed_attempts = 0,
      locked_until = NULL,
      lock_reason = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE email_hash = ENCODE(DIGEST(normalized_email, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.security_is_auth_locked(
  p_email TEXT
)
RETURNS TABLE(
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  remaining_seconds INTEGER,
  failed_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_email TEXT;
  current_state security_auth_states%ROWTYPE;
  seconds_remaining INTEGER;
BEGIN
  normalized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF normalized_email = '' THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 0;
    RETURN;
  END IF;

  SELECT *
  INTO current_state
  FROM security_auth_states
  WHERE email_hash = ENCODE(DIGEST(normalized_email, 'sha256'), 'hex');

  IF current_state.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 0;
    RETURN;
  END IF;

  IF current_state.locked_until IS NULL OR current_state.locked_until <= CURRENT_TIMESTAMP THEN
    RETURN QUERY SELECT FALSE, current_state.locked_until, 0, current_state.failed_attempts;
    RETURN;
  END IF;

  seconds_remaining := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_state.locked_until - CURRENT_TIMESTAMP)))::INTEGER);
  RETURN QUERY SELECT TRUE, current_state.locked_until, seconds_remaining, current_state.failed_attempts;
END;
$$;
