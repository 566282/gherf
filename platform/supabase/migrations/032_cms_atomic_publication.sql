-- Atomic operational CMS publish and schedule helpers.

CREATE OR REPLACE FUNCTION public.publish_cms_documents(
  p_config JSONB,
  p_change_summary TEXT DEFAULT 'Published CMS content'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  page RECORD;
  current_document RECORD;
  saved_document RECORD;
  site_name TEXT;
  published_count INTEGER := 0;
  actor_user_id UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin privileges required to publish CMS documents';
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config->'pages') <> 'object' THEN
    RAISE EXCEPTION 'CMS config payload must include pages';
  END IF;

  site_name := COALESCE(NULLIF(TRIM(p_config->>'siteName'), ''), 'Go4Wealth');

  FOR page IN
    SELECT key, value
    FROM jsonb_each(p_config->'pages')
  LOOP
    SELECT id, status, version
    INTO current_document
    FROM cms_documents
    WHERE page_key = page.key
    FOR UPDATE;

    INSERT INTO cms_documents (
      page_key,
      site_name,
      draft_content,
      published_content,
      status,
      version,
      published_at,
      scheduled_publish_at,
      updated_by,
      published_by
    )
    VALUES (
      page.key,
      site_name,
      page.value,
      page.value,
      'published',
      COALESCE(current_document.version, 0) + 1,
      CURRENT_TIMESTAMP,
      NULL,
      actor_user_id,
      actor_user_id
    )
    ON CONFLICT (page_key) DO UPDATE
    SET site_name = EXCLUDED.site_name,
        draft_content = EXCLUDED.draft_content,
        published_content = EXCLUDED.published_content,
        status = EXCLUDED.status,
        version = cms_documents.version + 1,
        published_at = CURRENT_TIMESTAMP,
        scheduled_publish_at = NULL,
        updated_by = EXCLUDED.updated_by,
        published_by = EXCLUDED.published_by
    RETURNING id, version, status
    INTO saved_document;

    INSERT INTO cms_document_revisions (
      document_id,
      version,
      content,
      status,
      change_summary,
      created_by
    )
    VALUES (
      saved_document.id,
      saved_document.version,
      page.value,
      'published',
      COALESCE(p_change_summary, 'Published CMS content'),
      actor_user_id
    );

    INSERT INTO cms_publication_events (
      document_id,
      event_type,
      from_status,
      to_status,
      version,
      actor_user_id,
      metadata
    )
    VALUES (
      saved_document.id,
      'published',
      current_document.status,
      'published',
      saved_document.version,
      actor_user_id,
      jsonb_build_object('changeSummary', COALESCE(p_change_summary, 'Published CMS content'))
    );

    published_count := published_count + 1;
  END LOOP;

  RETURN published_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_cms_documents(
  p_config JSONB,
  p_scheduled_publish_at TIMESTAMPTZ,
  p_change_summary TEXT DEFAULT 'Scheduled CMS publication'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  page RECORD;
  current_document RECORD;
  saved_document RECORD;
  site_name TEXT;
  scheduled_count INTEGER := 0;
  actor_user_id UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin privileges required to schedule CMS documents';
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config->'pages') <> 'object' THEN
    RAISE EXCEPTION 'CMS config payload must include pages';
  END IF;

  IF p_scheduled_publish_at IS NULL OR p_scheduled_publish_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Scheduled publish time must be in the future';
  END IF;

  site_name := COALESCE(NULLIF(TRIM(p_config->>'siteName'), ''), 'Go4Wealth');

  FOR page IN
    SELECT key, value
    FROM jsonb_each(p_config->'pages')
  LOOP
    SELECT id, status, version, published_content
    INTO current_document
    FROM cms_documents
    WHERE page_key = page.key
    FOR UPDATE;

    INSERT INTO cms_documents (
      page_key,
      site_name,
      draft_content,
      published_content,
      status,
      version,
      scheduled_publish_at,
      updated_by
    )
    VALUES (
      page.key,
      site_name,
      page.value,
      COALESCE(current_document.published_content, page.value),
      'scheduled',
      COALESCE(current_document.version, 0) + 1,
      p_scheduled_publish_at,
      actor_user_id
    )
    ON CONFLICT (page_key) DO UPDATE
    SET site_name = EXCLUDED.site_name,
        draft_content = EXCLUDED.draft_content,
        published_content = COALESCE(cms_documents.published_content, EXCLUDED.published_content),
        status = EXCLUDED.status,
        version = cms_documents.version + 1,
        scheduled_publish_at = EXCLUDED.scheduled_publish_at,
        updated_by = EXCLUDED.updated_by
    RETURNING id, version, status
    INTO saved_document;

    INSERT INTO cms_document_revisions (
      document_id,
      version,
      content,
      status,
      change_summary,
      created_by
    )
    VALUES (
      saved_document.id,
      saved_document.version,
      page.value,
      'scheduled',
      COALESCE(p_change_summary, 'Scheduled CMS publication'),
      actor_user_id
    );

    INSERT INTO cms_publication_events (
      document_id,
      event_type,
      from_status,
      to_status,
      version,
      actor_user_id,
      scheduled_for,
      metadata
    )
    VALUES (
      saved_document.id,
      'scheduled',
      current_document.status,
      'scheduled',
      saved_document.version,
      actor_user_id,
      p_scheduled_publish_at,
      jsonb_build_object('changeSummary', COALESCE(p_change_summary, 'Scheduled CMS publication'))
    );

    scheduled_count := scheduled_count + 1;
  END LOOP;

  RETURN scheduled_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_cms_documents(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_cms_documents(JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.schedule_cms_documents(JSONB, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_cms_documents(JSONB, TIMESTAMPTZ, TEXT) TO authenticated;
