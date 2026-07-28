-- Operational CMS: public documents, draft/publish lifecycle, revisions, scheduling, and audit events.

CREATE TABLE IF NOT EXISTS cms_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT UNIQUE NOT NULL,
  site_name TEXT NOT NULL DEFAULT 'Go4Wealth',
  draft_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  scheduled_publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES cms_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  change_summary TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, version)
);

CREATE TABLE IF NOT EXISTS cms_publication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES cms_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('saved', 'published', 'scheduled', 'unscheduled', 'rolled_back', 'archived')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  version INTEGER NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cms_documents_status ON cms_documents(status);
CREATE INDEX IF NOT EXISTS idx_cms_documents_schedule ON cms_documents(scheduled_publish_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_cms_revisions_document_created ON cms_document_revisions(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_publication_events_document_created ON cms_publication_events(document_id, created_at DESC);

CREATE TRIGGER cms_documents_updated_at BEFORE UPDATE ON cms_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cms_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE cms_document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_document_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE cms_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_publication_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_documents_public_read ON cms_documents;
CREATE POLICY cms_documents_public_read ON cms_documents
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS cms_documents_admin_read ON cms_documents;
CREATE POLICY cms_documents_admin_read ON cms_documents
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS cms_documents_admin_insert ON cms_documents;
CREATE POLICY cms_documents_admin_insert ON cms_documents
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS cms_documents_admin_update ON cms_documents;
CREATE POLICY cms_documents_admin_update ON cms_documents
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS cms_documents_admin_delete ON cms_documents;
CREATE POLICY cms_documents_admin_delete ON cms_documents
  FOR DELETE USING (public.is_super_admin());

DROP POLICY IF EXISTS cms_revisions_public_read ON cms_document_revisions;
CREATE POLICY cms_revisions_public_read ON cms_document_revisions
  FOR SELECT USING (EXISTS (SELECT 1 FROM cms_documents d WHERE d.id = document_id AND d.status = 'published' AND d.version = version));

DROP POLICY IF EXISTS cms_revisions_admin_read ON cms_document_revisions;
CREATE POLICY cms_revisions_admin_read ON cms_document_revisions
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS cms_revisions_admin_insert ON cms_document_revisions;
CREATE POLICY cms_revisions_admin_insert ON cms_document_revisions
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS cms_events_admin_read ON cms_publication_events;
CREATE POLICY cms_events_admin_read ON cms_publication_events
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS cms_events_admin_insert ON cms_publication_events;
CREATE POLICY cms_events_admin_insert ON cms_publication_events
  FOR INSERT WITH CHECK (public.is_super_admin());

-- Scheduler entry point for Supabase Edge Functions, pg_cron, or another trusted worker.
CREATE OR REPLACE FUNCTION public.publish_scheduled_cms_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  document RECORD;
  published_count INTEGER := 0;
BEGIN
  FOR document IN
    SELECT * FROM cms_documents
    WHERE status = 'scheduled'
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= CURRENT_TIMESTAMP
    FOR UPDATE
  LOOP
    UPDATE cms_documents
    SET published_content = document.draft_content,
        status = 'published',
        published_at = CURRENT_TIMESTAMP,
        scheduled_publish_at = NULL,
        version = document.version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = document.id;

    INSERT INTO cms_document_revisions (document_id, version, content, status, change_summary)
    VALUES (document.id, document.version + 1, document.draft_content, 'published', 'Scheduled CMS publication');

    INSERT INTO cms_publication_events (document_id, event_type, from_status, to_status, version, scheduled_for, metadata)
    VALUES (document.id, 'published', 'scheduled', 'published', document.version + 1, document.scheduled_publish_at, '{"source":"scheduler"}'::jsonb);

    published_count := published_count + 1;
  END LOOP;

  RETURN published_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_scheduled_cms_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_scheduled_cms_documents() TO service_role;

-- Preserve any already-configured CMS pages when this migration is introduced.
INSERT INTO cms_documents (page_key, site_name, draft_content, published_content, status, version, published_at)
SELECT page_key,
       COALESCE(settings.value->>'siteName', 'Go4Wealth'),
       page_content,
       page_content,
       'published',
       1,
       CURRENT_TIMESTAMP
FROM platform_settings settings
CROSS JOIN LATERAL jsonb_each(COALESCE(settings.value->'pages', '{}'::jsonb)) AS pages(page_key, page_content)
WHERE settings.key = 'cms_content_config'
ON CONFLICT (page_key) DO NOTHING;
