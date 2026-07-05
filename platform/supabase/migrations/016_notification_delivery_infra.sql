-- 016_notification_delivery_infra.sql
-- Notification delivery queues, retry history, and admin payment alerts.

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  channel TEXT NOT NULL DEFAULT 'in_app',
  category TEXT NOT NULL DEFAULT 'transactional',
  template_key TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created_at
  ON notification_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id_created_at
  ON notification_queue(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_retry_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'failed',
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_history_queue_id_attempted_at
  ON notification_retry_history(queue_id, attempted_at DESC);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_retry_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_queue_select_own_or_super_admin ON notification_queue;
CREATE POLICY notification_queue_select_own_or_super_admin ON notification_queue
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS notification_queue_manage_super_admin ON notification_queue;
CREATE POLICY notification_queue_manage_super_admin ON notification_queue
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS notification_retry_history_select_super_admin ON notification_retry_history;
CREATE POLICY notification_retry_history_select_super_admin ON notification_retry_history
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS notification_retry_history_manage_super_admin ON notification_retry_history;
CREATE POLICY notification_retry_history_manage_super_admin ON notification_retry_history
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER notification_queue_updated_at BEFORE UPDATE ON notification_queue
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.notify_super_admins(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_channel TEXT DEFAULT 'in_app',
  p_category TEXT DEFAULT 'transactional',
  p_template_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO user_notifications (
    user_id,
    title,
    message,
    type,
    channel,
    category,
    template_key,
    is_promotional,
    metadata
  )
  SELECT
    profiles.id,
    p_title,
    p_message,
    p_type,
    p_channel,
    p_category,
    p_template_key,
    FALSE,
    COALESCE(p_metadata, '{}'::jsonb)
  FROM profiles
  WHERE profiles.role = 'super_admin';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_super_admins(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
