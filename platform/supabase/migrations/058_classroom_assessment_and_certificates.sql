-- 058_classroom_assessment_and_certificates.sql
-- Phase 19.1 foundation: quizzes, assignments, and certificate issuance domains.

CREATE TABLE IF NOT EXISTS learning_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE CASCADE,
  course_id UUID REFERENCES learning_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score NUMERIC(5, 2) NOT NULL DEFAULT 70,
  attempt_limit INTEGER,
  question_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES learning_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE CASCADE,
  course_id UUID REFERENCES learning_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_score NUMERIC(7, 2) NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  artifact_url TEXT,
  submission_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(7, 2),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  certificate_id TEXT NOT NULL UNIQUE,
  verification_id TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  blockchain_hash TEXT,
  artifact_url TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked', 'invalid')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_quizzes_course_status ON learning_quizzes(course_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_quiz_attempts_user_quiz ON learning_quiz_attempts(user_id, quiz_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_assignment_course_status ON learning_assignments(course_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_assignment_submissions_user_status ON learning_assignment_submissions(user_id, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_certificates_user_status ON learning_certificates(user_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_certificates_verification ON learning_certificates(verification_id, status);

DROP TRIGGER IF EXISTS learning_quizzes_updated_at ON learning_quizzes;
CREATE TRIGGER learning_quizzes_updated_at BEFORE UPDATE ON learning_quizzes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_assignments_updated_at ON learning_assignments;
CREATE TRIGGER learning_assignments_updated_at BEFORE UPDATE ON learning_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_assignment_submissions_updated_at ON learning_assignment_submissions;
CREATE TRIGGER learning_assignment_submissions_updated_at BEFORE UPDATE ON learning_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_certificates_updated_at ON learning_certificates;
CREATE TRIGGER learning_certificates_updated_at BEFORE UPDATE ON learning_certificates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE learning_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_quizzes_read_authenticated ON learning_quizzes;
CREATE POLICY learning_quizzes_read_authenticated ON learning_quizzes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_quizzes_manage_admin ON learning_quizzes;
CREATE POLICY learning_quizzes_manage_admin ON learning_quizzes
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_quiz_attempts_user_or_admin_read ON learning_quiz_attempts;
CREATE POLICY learning_quiz_attempts_user_or_admin_read ON learning_quiz_attempts
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_quiz_attempts_user_or_admin_insert ON learning_quiz_attempts;
CREATE POLICY learning_quiz_attempts_user_or_admin_insert ON learning_quiz_attempts
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_assignments_read_authenticated ON learning_assignments;
CREATE POLICY learning_assignments_read_authenticated ON learning_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS learning_assignments_manage_admin ON learning_assignments;
CREATE POLICY learning_assignments_manage_admin ON learning_assignments
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_assignment_submissions_user_or_admin_read ON learning_assignment_submissions;
CREATE POLICY learning_assignment_submissions_user_or_admin_read ON learning_assignment_submissions
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_assignment_submissions_user_or_admin_insert ON learning_assignment_submissions;
CREATE POLICY learning_assignment_submissions_user_or_admin_insert ON learning_assignment_submissions
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_assignment_submissions_admin_update ON learning_assignment_submissions;
CREATE POLICY learning_assignment_submissions_admin_update ON learning_assignment_submissions
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_certificates_user_or_admin_read ON learning_certificates;
CREATE POLICY learning_certificates_user_or_admin_read ON learning_certificates
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_certificates_public_verify ON learning_certificates;
CREATE POLICY learning_certificates_public_verify ON learning_certificates
  FOR SELECT USING (status = 'issued');

DROP POLICY IF EXISTS learning_certificates_admin_write ON learning_certificates;
CREATE POLICY learning_certificates_admin_write ON learning_certificates
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
