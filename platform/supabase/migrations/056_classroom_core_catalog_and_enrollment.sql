-- 056_classroom_core_catalog_and_enrollment.sql
-- Phase 19.1 foundation: classroom catalog, provider controls, enrollment, and rollout settings.

INSERT INTO campaign_type_definitions (
  slug,
  label,
  description,
  default_instructions,
  default_verification_method,
  is_active,
  is_system,
  sort_order,
  metadata
)
VALUES (
  'classroom_learning',
  'Classroom learning',
  'Learn-to-earn campaign vertical with lesson telemetry and milestone rewards.',
  'Complete lessons, pass assessments, and satisfy anti-cheat checks before reward payout.',
  'api_verification',
  TRUE,
  TRUE,
  205,
  '{"domain":"learning"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  default_instructions = EXCLUDED.default_instructions,
  default_verification_method = EXCLUDED.default_verification_method,
  is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS learning_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  institution_type TEXT NOT NULL DEFAULT 'provider',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES learning_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES learning_institutions(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES learning_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT,
  language TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  pricing_type TEXT NOT NULL DEFAULT 'free' CHECK (pricing_type IN ('free', 'paid', 'premium_only')),
  reward_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES learning_course_modules(id) ON DELETE CASCADE,
  lesson_type TEXT NOT NULL DEFAULT 'video',
  title TEXT NOT NULL,
  content_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  verification_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'dropped', 'blocked')),
  progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_institutions_status ON learning_institutions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_categories_parent_status ON learning_categories(parent_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_courses_status_category ON learning_courses(status, category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_courses_institution ON learning_courses(institution_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_course_modules_course_sort ON learning_course_modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_module_sort ON learning_lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_user_status ON learning_enrollments(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_course_status ON learning_enrollments(course_id, status, created_at DESC);

DROP TRIGGER IF EXISTS learning_institutions_updated_at ON learning_institutions;
CREATE TRIGGER learning_institutions_updated_at BEFORE UPDATE ON learning_institutions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_categories_updated_at ON learning_categories;
CREATE TRIGGER learning_categories_updated_at BEFORE UPDATE ON learning_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_courses_updated_at ON learning_courses;
CREATE TRIGGER learning_courses_updated_at BEFORE UPDATE ON learning_courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_course_modules_updated_at ON learning_course_modules;
CREATE TRIGGER learning_course_modules_updated_at BEFORE UPDATE ON learning_course_modules
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_lessons_updated_at ON learning_lessons;
CREATE TRIGGER learning_lessons_updated_at BEFORE UPDATE ON learning_lessons
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_enrollments_updated_at ON learning_enrollments;
CREATE TRIGGER learning_enrollments_updated_at BEFORE UPDATE ON learning_enrollments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE learning_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_institutions_read_authenticated ON learning_institutions;
CREATE POLICY learning_institutions_read_authenticated ON learning_institutions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_institutions_manage_admin ON learning_institutions;
CREATE POLICY learning_institutions_manage_admin ON learning_institutions
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_categories_read_authenticated ON learning_categories;
CREATE POLICY learning_categories_read_authenticated ON learning_categories
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_categories_manage_admin ON learning_categories;
CREATE POLICY learning_categories_manage_admin ON learning_categories
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_courses_read_authenticated ON learning_courses;
CREATE POLICY learning_courses_read_authenticated ON learning_courses
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_courses_manage_admin ON learning_courses;
CREATE POLICY learning_courses_manage_admin ON learning_courses
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_course_modules_read_authenticated ON learning_course_modules;
CREATE POLICY learning_course_modules_read_authenticated ON learning_course_modules
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_course_modules_manage_admin ON learning_course_modules;
CREATE POLICY learning_course_modules_manage_admin ON learning_course_modules
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_lessons_read_authenticated ON learning_lessons;
CREATE POLICY learning_lessons_read_authenticated ON learning_lessons
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_lessons_manage_admin ON learning_lessons;
CREATE POLICY learning_lessons_manage_admin ON learning_lessons
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_enrollments_user_or_admin_read ON learning_enrollments;
CREATE POLICY learning_enrollments_user_or_admin_read ON learning_enrollments
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_enrollments_user_or_admin_insert ON learning_enrollments;
CREATE POLICY learning_enrollments_user_or_admin_insert ON learning_enrollments
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_enrollments_user_or_admin_update ON learning_enrollments;
CREATE POLICY learning_enrollments_user_or_admin_update ON learning_enrollments
  FOR UPDATE USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

INSERT INTO platform_settings (key, value, description)
VALUES (
  'classroom_rollout_settings',
  '{"enabled":false,"cohort":"internal","allowLearnerRoutes":false,"allowAdminRoutes":false,"allowRewardPayouts":false,"allowWalletTransfers":false,"allowTutor":false,"eventSchemaVersion":"classroom_learning_event_v1","apiSchemaVersion":"classroom_learning_api_v1"}'::jsonb,
  'Classroom rollout, cohorting, and schema contract controls.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
