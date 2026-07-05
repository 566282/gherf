-- 019_withdrawal_request_backfill.sql
-- Explicit backfill for legacy withdrawal requests so fixed-date behavior is consistent.

UPDATE withdrawal_requests
SET scheduled_for = COALESCE(scheduled_for, created_at)
WHERE scheduled_for IS NULL;
