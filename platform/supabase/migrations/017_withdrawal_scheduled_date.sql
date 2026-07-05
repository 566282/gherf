-- 017_withdrawal_scheduled_date.sql
-- Add a scheduled withdrawal date to withdrawal requests so notifications can reference it.

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_scheduled_for
  ON withdrawal_requests(scheduled_for DESC);