-- 029_restore_security_is_auth_locked_rpc.sql
-- Restores auth lock status RPC for environments where prior migration drift left it missing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.security_auth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_hash TEXT NOT NULL UNIQUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  lock_reason TEXT,
  last_failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_auth_states_user_id
  ON public.security_auth_states(user_id);

CREATE INDEX IF NOT EXISTS idx_security_auth_states_locked_until
  ON public.security_auth_states(locked_until);

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
SET search_path = public, extensions
AS $$
DECLARE
  normalized_email TEXT;
  email_digest TEXT;
  state_locked_until TIMESTAMPTZ;
  state_failed_attempts INTEGER;
  seconds_remaining INTEGER;
BEGIN
  normalized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF normalized_email = '' THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 0;
    RETURN;
  END IF;

  email_digest := ENCODE(extensions.DIGEST(normalized_email, 'sha256'), 'hex');

  SELECT s.locked_until, s.failed_attempts
    INTO state_locked_until, state_failed_attempts
  FROM public.security_auth_states s
  WHERE s.email_hash = email_digest
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 0;
    RETURN;
  END IF;

  IF state_locked_until IS NULL OR state_locked_until <= CURRENT_TIMESTAMP THEN
    RETURN QUERY
      SELECT FALSE, state_locked_until, 0, COALESCE(state_failed_attempts, 0);
    RETURN;
  END IF;

  seconds_remaining := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (state_locked_until - CURRENT_TIMESTAMP)))::INTEGER
  );

  RETURN QUERY
    SELECT TRUE, state_locked_until, seconds_remaining, COALESCE(state_failed_attempts, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.security_is_auth_locked(TEXT)
  TO anon, authenticated, service_role;
