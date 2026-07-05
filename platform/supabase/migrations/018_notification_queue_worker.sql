-- 018_notification_queue_worker.sql
-- Backfill withdrawal dates and add a queue worker for notification delivery and retries.

UPDATE withdrawal_requests
SET scheduled_for = COALESCE(scheduled_for, created_at)
WHERE scheduled_for IS NULL;

CREATE OR REPLACE FUNCTION public.process_notification_queue(p_limit INTEGER DEFAULT 25)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queue_row RECORD;
  processed_count INTEGER := 0;
  next_status TEXT;
BEGIN
  FOR queue_row IN
    SELECT *
    FROM notification_queue
    WHERE status IN ('queued', 'retry')
      AND (scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP)
    ORDER BY scheduled_for NULLS FIRST, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
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
      VALUES (
        queue_row.user_id,
        queue_row.title,
        queue_row.message,
        queue_row.type,
        queue_row.channel,
        queue_row.category,
        queue_row.template_key,
        FALSE,
        COALESCE(queue_row.metadata, '{}'::jsonb)
      );

      UPDATE notification_queue
      SET status = 'sent',
          sent_at = CURRENT_TIMESTAMP,
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = queue_row.id;

      processed_count := processed_count + 1;
    EXCEPTION
      WHEN others THEN
        next_status := CASE WHEN queue_row.retry_count + 1 >= queue_row.max_retries THEN 'failed' ELSE 'retry' END;

        UPDATE notification_queue
        SET status = next_status,
            retry_count = retry_count + 1,
            last_error = SQLERRM,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = queue_row.id;

        INSERT INTO notification_retry_history (
          queue_id,
          attempt_number,
          status,
          error_message,
          metadata
        )
        VALUES (
          queue_row.id,
          queue_row.retry_count + 1,
          'failed',
          SQLERRM,
          jsonb_build_object(
            'user_id', queue_row.user_id,
            'title', queue_row.title,
            'channel', queue_row.channel,
            'category', queue_row.category,
            'scheduled_for', queue_row.scheduled_for
          ) || COALESCE(queue_row.metadata, '{}'::jsonb)
        );
    END;
  END LOOP;

  RETURN processed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_notification_queue_item(p_queue_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notification_queue
  SET status = 'queued',
      retry_count = retry_count + 1,
      last_error = NULL,
      scheduled_for = COALESCE(scheduled_for, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_queue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_notification_queue(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_notification_queue_item(UUID) TO authenticated;
