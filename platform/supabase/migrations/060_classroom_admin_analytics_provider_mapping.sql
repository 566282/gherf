-- 060_classroom_admin_analytics_provider_mapping.sql
-- Phase 19.1 foundation: provider integrations, mapping, analytics summaries, leaderboard snapshots.

CREATE TABLE IF NOT EXISTS learning_provider_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES learning_institutions(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  integration_mode TEXT NOT NULL DEFAULT 'embedded' CHECK (integration_mode IN ('embedded', 'api', 'deep_link')),
  credential_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  policy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id, provider_name)
);

CREATE TABLE IF NOT EXISTS learning_course_provider_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  provider_integration_id UUID NOT NULL REFERENCES learning_provider_integrations(id) ON DELETE CASCADE,
  provider_course_ref TEXT NOT NULL,
  verification_mode TEXT NOT NULL DEFAULT 'provider_callback' CHECK (verification_mode IN ('provider_callback', 'signed_evidence', 'manual_review', 'not_rewardable')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, provider_integration_id)
);

CREATE TABLE IF NOT EXISTS learning_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date DATE NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  measures JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_date, dimensions)
);

CREATE TABLE IF NOT EXISTS learning_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score NUMERIC(15, 2) NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_key, user_id)
);

CREATE TABLE IF NOT EXISTS learning_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES learning_courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_provider_integrations_status ON learning_provider_integrations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_course_provider_mappings_course_status ON learning_course_provider_mappings(course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_daily_period ON learning_analytics_daily(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_learning_leaderboard_period_rank ON learning_leaderboard_snapshots(period_key, rank);
CREATE INDEX IF NOT EXISTS idx_learning_tutor_messages_user_created ON learning_tutor_messages(user_id, created_at DESC);

DROP TRIGGER IF EXISTS learning_provider_integrations_updated_at ON learning_provider_integrations;
CREATE TRIGGER learning_provider_integrations_updated_at BEFORE UPDATE ON learning_provider_integrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_course_provider_mappings_updated_at ON learning_course_provider_mappings;
CREATE TRIGGER learning_course_provider_mappings_updated_at BEFORE UPDATE ON learning_course_provider_mappings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_analytics_daily_updated_at ON learning_analytics_daily;
CREATE TRIGGER learning_analytics_daily_updated_at BEFORE UPDATE ON learning_analytics_daily
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE learning_provider_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_course_provider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_tutor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_provider_integrations_read_authenticated ON learning_provider_integrations;
CREATE POLICY learning_provider_integrations_read_authenticated ON learning_provider_integrations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_provider_integrations_manage_admin ON learning_provider_integrations;
CREATE POLICY learning_provider_integrations_manage_admin ON learning_provider_integrations
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_course_provider_mappings_read_authenticated ON learning_course_provider_mappings;
CREATE POLICY learning_course_provider_mappings_read_authenticated ON learning_course_provider_mappings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_course_provider_mappings_manage_admin ON learning_course_provider_mappings;
CREATE POLICY learning_course_provider_mappings_manage_admin ON learning_course_provider_mappings
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_analytics_daily_read_authenticated ON learning_analytics_daily;
CREATE POLICY learning_analytics_daily_read_authenticated ON learning_analytics_daily
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_analytics_daily_manage_admin ON learning_analytics_daily;
CREATE POLICY learning_analytics_daily_manage_admin ON learning_analytics_daily
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_leaderboard_snapshots_read_authenticated ON learning_leaderboard_snapshots;
CREATE POLICY learning_leaderboard_snapshots_read_authenticated ON learning_leaderboard_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_leaderboard_snapshots_manage_admin ON learning_leaderboard_snapshots;
CREATE POLICY learning_leaderboard_snapshots_manage_admin ON learning_leaderboard_snapshots
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_tutor_messages_user_or_admin_read ON learning_tutor_messages;
CREATE POLICY learning_tutor_messages_user_or_admin_read ON learning_tutor_messages
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_tutor_messages_user_or_admin_insert ON learning_tutor_messages;
CREATE POLICY learning_tutor_messages_user_or_admin_insert ON learning_tutor_messages
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());
