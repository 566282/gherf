CREATE TABLE IF NOT EXISTS cms_custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  eyebrow TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '/',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_custom_pages_sort_order ON cms_custom_pages(sort_order, slug);

CREATE TRIGGER cms_custom_pages_updated_at
BEFORE UPDATE ON cms_custom_pages
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cms_custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_custom_pages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_custom_pages_public_read ON cms_custom_pages;
CREATE POLICY cms_custom_pages_public_read ON cms_custom_pages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS cms_custom_pages_admin_insert ON cms_custom_pages;
CREATE POLICY cms_custom_pages_admin_insert ON cms_custom_pages
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS cms_custom_pages_admin_update ON cms_custom_pages;
CREATE POLICY cms_custom_pages_admin_update ON cms_custom_pages
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS cms_custom_pages_admin_delete ON cms_custom_pages;
CREATE POLICY cms_custom_pages_admin_delete ON cms_custom_pages
  FOR DELETE USING (public.is_super_admin());
