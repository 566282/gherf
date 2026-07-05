-- 020_notification_paging_indexes.sql
-- Support efficient paging and unread lookups for notification surfaces.

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
  ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_is_read_created_at
  ON user_notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created_at
  ON notification_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_created_at
  ON notification_queue (user_id, created_at DESC);
