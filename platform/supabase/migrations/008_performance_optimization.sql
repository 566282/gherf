-- 008_performance_optimization.sql
-- Phase 14: database indexing and query optimization support.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Profiles: admin listing/order + search optimization.
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at_desc
  ON profiles(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON profiles USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON profiles USING GIN (email gin_trgm_ops);

-- Campaign management lists and date/status filtering.
CREATE INDEX IF NOT EXISTS idx_campaigns_updated_at_desc
  ON campaigns(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_updated_at_desc
  ON campaigns(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_business_status_updated_at_desc
  ON campaigns(business_id, status, updated_at DESC);

-- Submission review and analytics filtering.
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_created_at_desc
  ON task_submissions(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_submissions_status_created_at_desc
  ON task_submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_submissions_user_status_created_at_desc
  ON task_submissions(user_id, status, created_at DESC);

-- Reward analytics and user wallet views.
CREATE INDEX IF NOT EXISTS idx_rewards_status_created_at_desc
  ON rewards(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_campaign_status_created_at_desc
  ON rewards(campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_user_status_created_at_desc
  ON rewards(user_id, status, created_at DESC);

-- Wallet/withdrawal processing queues.
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type_created_at_desc
  ON wallet_transactions(transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status_created_at_desc
  ON withdrawal_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_reviewed_at_desc
  ON withdrawal_requests(status, reviewed_at DESC);

-- Notification inbox reads.
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_created_at_desc
  ON user_notifications(user_id, is_read, created_at DESC);

-- Communication queue scheduling.
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_status_scheduled_for
  ON communication_campaigns(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_communication_campaigns_sent_at_desc
  ON communication_campaigns(sent_at DESC);
