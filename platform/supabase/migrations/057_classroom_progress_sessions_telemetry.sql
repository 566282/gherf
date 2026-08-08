-- 057_classroom_progress_sessions_telemetry.sql
-- Phase 19.1 foundation: learning telemetry, progress checkpoints, anti-cheat sessions.

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  focus_seconds INTEGER NOT NULL DEFAULT 0,
  visibility_loss_count INTEGER NOT NULL DEFAULT 0,
  average_playback_speed NUMERIC(5, 2) NOT NULL DEFAULT 1,
  risk_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  risk_status TEXT NOT NULL DEFAULT 'clear' CHECK (risk_status IN ('clear', 'review', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES learning_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES learning_courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  completion_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'review', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_course ON learning_sessions(user_id, course_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_course_lesson ON learning_sessions(course_id, lesson_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_risk_status ON learning_sessions(risk_status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_session_time ON learning_events(session_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_time ON learning_events(user_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_type_time ON learning_events(event_type, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_learning_lesson_progress_user_status ON learning_lesson_progress(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_streaks_user_active_date ON learning_streaks(user_id, last_active_date DESC);

DROP TRIGGER IF EXISTS learning_sessions_updated_at ON learning_sessions;
CREATE TRIGGER learning_sessions_updated_at BEFORE UPDATE ON learning_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_lesson_progress_updated_at ON learning_lesson_progress;
CREATE TRIGGER learning_lesson_progress_updated_at BEFORE UPDATE ON learning_lesson_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_streaks_updated_at ON learning_streaks;
CREATE TRIGGER learning_streaks_updated_at BEFORE UPDATE ON learning_streaks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_sessions_user_or_admin_read ON learning_sessions;
CREATE POLICY learning_sessions_user_or_admin_read ON learning_sessions
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_sessions_user_or_admin_insert ON learning_sessions;
CREATE POLICY learning_sessions_user_or_admin_insert ON learning_sessions
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_sessions_user_or_admin_update ON learning_sessions;
CREATE POLICY learning_sessions_user_or_admin_update ON learning_sessions
  FOR UPDATE USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_events_user_or_admin_read ON learning_events;
CREATE POLICY learning_events_user_or_admin_read ON learning_events
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_events_user_or_admin_insert ON learning_events;
CREATE POLICY learning_events_user_or_admin_insert ON learning_events
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_lesson_progress_user_or_admin_read ON learning_lesson_progress;
CREATE POLICY learning_lesson_progress_user_or_admin_read ON learning_lesson_progress
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_lesson_progress_user_or_admin_insert ON learning_lesson_progress;
CREATE POLICY learning_lesson_progress_user_or_admin_insert ON learning_lesson_progress
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_lesson_progress_user_or_admin_update ON learning_lesson_progress;
CREATE POLICY learning_lesson_progress_user_or_admin_update ON learning_lesson_progress
  FOR UPDATE USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_streaks_user_or_admin_read ON learning_streaks;
CREATE POLICY learning_streaks_user_or_admin_read ON learning_streaks
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_streaks_user_or_admin_insert ON learning_streaks;
CREATE POLICY learning_streaks_user_or_admin_insert ON learning_streaks
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_streaks_user_or_admin_update ON learning_streaks;
CREATE POLICY learning_streaks_user_or_admin_update ON learning_streaks
  FOR UPDATE USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

INSERT INTO platform_settings (key, value, description)
VALUES (
  'classroom_anti_cheat_policy',
  '{"heartbeatIntervalSeconds":30,"minimumFocusRatio":0.7,"maxPlaybackSpeed":1.5,"sessionMinActiveSeconds":300,"riskThresholdReview":45,"riskThresholdBlock":75}'::jsonb,
  'Classroom anti-cheat baseline policy for telemetry-based reward eligibility.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
