-- Configure a trusted pg_cron job to invoke the CMS publication RPC every minute.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_scheduled_cms_documents'
  ) THEN
    PERFORM cron.unschedule('publish-scheduled-cms-documents');
    PERFORM cron.schedule(
      'publish-scheduled-cms-documents',
      '* * * * *',
      $$SELECT public.publish_scheduled_cms_documents();$$
    );
  ELSE
    RAISE EXCEPTION 'public.publish_scheduled_cms_documents() must exist before scheduling it';
  END IF;
END
$$;
