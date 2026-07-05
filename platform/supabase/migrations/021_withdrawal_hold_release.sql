-- 021_withdrawal_hold_release.sql
-- Persist withdrawal hold metadata and add a server-side release helper for upgraded member plans.

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS hold_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_hold_reason
  ON withdrawal_requests(status, hold_reason);

CREATE OR REPLACE FUNCTION release_user_withdrawal_holds(p_user_id UUID)
RETURNS TABLE(released_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  UPDATE withdrawal_requests
    SET status = 'pending',
        hold_released_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id
    AND status = 'held';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN QUERY SELECT affected_count;
END;
$$;
