-- 054_launch_phases_0_5_foundation.sql
-- Launch-readiness foundation for phases 0-5.

ALTER TABLE task_compliance_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_block_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_task_compliance_profiles_onboarding_gate
  ON task_compliance_profiles(onboarding_completed, onboarding_completed_at DESC);

CREATE TABLE IF NOT EXISTS onboarding_gate_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  previous_state TEXT,
  next_state TEXT NOT NULL,
  reason TEXT,
  actor_source TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (next_state IN ('blocked', 'unblocked'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_gate_audits_user_created
  ON onboarding_gate_audits(user_id, created_at DESC);

ALTER TABLE onboarding_gate_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_gate_audits_user_or_admin_read ON onboarding_gate_audits;
CREATE POLICY onboarding_gate_audits_user_or_admin_read ON onboarding_gate_audits
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS onboarding_gate_audits_system_or_admin_write ON onboarding_gate_audits;
CREATE POLICY onboarding_gate_audits_system_or_admin_write ON onboarding_gate_audits
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

ALTER TABLE merchant_kyc_requirements
  ADD COLUMN IF NOT EXISTS submission_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS membership_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_tier INTEGER NOT NULL DEFAULT 1,
  target_tier INTEGER NOT NULL,
  payment_intent_id UUID,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (target_tier >= 1),
  CHECK (status IN ('pending', 'settled', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_membership_upgrade_requests_user_created
  ON membership_upgrade_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_upgrade_requests_status
  ON membership_upgrade_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_upgrade_requests_reference
  ON membership_upgrade_requests(payment_reference, payment_intent_id);

CREATE TRIGGER membership_upgrade_requests_updated_at
BEFORE UPDATE ON membership_upgrade_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE membership_upgrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_upgrade_requests_user_or_admin_read ON membership_upgrade_requests;
CREATE POLICY membership_upgrade_requests_user_or_admin_read ON membership_upgrade_requests
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS membership_upgrade_requests_user_or_admin_write ON membership_upgrade_requests;
CREATE POLICY membership_upgrade_requests_user_or_admin_write ON membership_upgrade_requests
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS membership_upgrade_requests_admin_update ON membership_upgrade_requests;
CREATE POLICY membership_upgrade_requests_admin_update ON membership_upgrade_requests
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS assignment_orchestrator_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE SET NULL,
  failure_stage TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignment_orchestrator_dead_letters_retry
  ON assignment_orchestrator_dead_letters(resolved_at, next_retry_at, created_at DESC);

CREATE TRIGGER assignment_orchestrator_dead_letters_updated_at
BEFORE UPDATE ON assignment_orchestrator_dead_letters
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE assignment_orchestrator_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_orchestrator_dead_letters_admin_read ON assignment_orchestrator_dead_letters;
CREATE POLICY assignment_orchestrator_dead_letters_admin_read ON assignment_orchestrator_dead_letters
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS assignment_orchestrator_dead_letters_admin_write ON assignment_orchestrator_dead_letters;
CREATE POLICY assignment_orchestrator_dead_letters_admin_write ON assignment_orchestrator_dead_letters
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS assignment_orchestrator_dead_letters_admin_update ON assignment_orchestrator_dead_letters;
CREATE POLICY assignment_orchestrator_dead_letters_admin_update ON assignment_orchestrator_dead_letters
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO platform_settings (key, value, description)
VALUES
  ('onboarding_gate_enforced', 'true'::jsonb, 'Enable onboarding gate enforcement for protected user modules'),
  ('merchant_kyc_flow_enabled', 'true'::jsonb, 'Enable merchant KYC self-service and admin review flow'),
  ('membership_settlement_gate_enforced', 'true'::jsonb, 'Require settlement before membership tier activation'),
  ('assignment_orchestrator_enabled', 'true'::jsonb, 'Enable automatic merchant assignment orchestration')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;