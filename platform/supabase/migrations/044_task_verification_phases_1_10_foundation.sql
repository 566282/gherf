-- 044_task_verification_phases_1_10_foundation.sql
-- Phase 1 foundation + shared structures for phases 2-10.

CREATE TABLE IF NOT EXISTS social_platform_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  field_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_rule_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_key TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rule_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_key, rule_key)
);

CREATE TABLE IF NOT EXISTS task_compliance_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_task_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  social_profiles JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  task_id UUID REFERENCES campaign_tasks(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES task_submissions(id) ON DELETE SET NULL,
  verification_method TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK (verification_state IN ('pending', 'queued', 'running', 'review_required', 'approved', 'rejected', 'expired')),
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_verification_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_event_id UUID NOT NULL REFERENCES task_verification_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  storage_url TEXT,
  evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_sha256 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_verification_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_event_id UUID NOT NULL REFERENCES task_verification_events(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_more_evidence')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_verification_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_event_id UUID NOT NULL REFERENCES task_verification_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_compliance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL UNIQUE REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'pending_compliance', 'held_compliance', 'approved', 'rejected', 'bypassed')),
  risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_compliance_review_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES withdrawal_compliance_reviews(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning', 'manual_review')),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_compliance_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES withdrawal_compliance_reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'held', 'bypassed')),
  reason TEXT,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  task_id UUID REFERENCES campaign_tasks(id) ON DELETE SET NULL,
  verification_event_id UUID REFERENCES task_verification_events(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  violation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'appealed', 'dismissed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_enforcement_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_id UUID REFERENCES compliance_violations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'hold', 'suspend', 'ban', 'reward_reversal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'reverted')),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_suspension_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enforcement_action_id UUID REFERENCES compliance_enforcement_actions(id) ON DELETE SET NULL,
  notice_state TEXT NOT NULL DEFAULT 'active' CHECK (notice_state IN ('active', 'resolved')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  appeal_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES compliance_violations(id) ON DELETE SET NULL,
  enforcement_action_id UUID REFERENCES compliance_enforcement_actions(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('submitted', 'fee_pending', 'in_review', 'approved', 'rejected', 'closed')),
  reason TEXT NOT NULL,
  fee_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'USD',
  payment_required BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded')),
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_appeal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appeal_id UUID NOT NULL REFERENCES compliance_appeals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_appeal_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appeal_id UUID NOT NULL REFERENCES compliance_appeals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_intent_id UUID REFERENCES fiat_payment_intents(id) ON DELETE SET NULL,
  provider_key TEXT,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  provider_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_appeal_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appeal_id UUID NOT NULL REFERENCES compliance_appeals(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'request_more_info')),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_by TEXT NOT NULL DEFAULT 'task_compliance_runner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS identity_consistency_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'warning', 'failed')),
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS identity_consistency_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_id UUID NOT NULL REFERENCES identity_consistency_checks(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_audit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS compliance_review_id UUID REFERENCES withdrawal_compliance_reviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_state TEXT NOT NULL DEFAULT 'draft' CHECK (compliance_state IN ('draft', 'pending_compliance', 'held_compliance', 'approved', 'rejected', 'bypassed'));

CREATE INDEX IF NOT EXISTS idx_social_platform_definitions_status ON social_platform_definitions(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_rule_definitions_policy ON compliance_rule_definitions(policy_key, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_compliance_profiles_user ON task_compliance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_task_verification_events_user_state ON task_verification_events(user_id, verification_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_verification_events_task ON task_verification_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_verification_evidence_event ON task_verification_evidence(verification_event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_compliance_reviews_user_state ON withdrawal_compliance_reviews(user_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_compliance_reviews_withdrawal ON withdrawal_compliance_reviews(withdrawal_request_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_user_status ON compliance_violations(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_enforcement_actions_user_status ON compliance_enforcement_actions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_suspension_notices_user_state ON compliance_suspension_notices(user_id, notice_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_appeals_user_state ON compliance_appeals(user_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_appeal_payments_appeal_status ON compliance_appeal_payments(appeal_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_risk_scores_user_created ON compliance_risk_scores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_consistency_checks_user_created ON identity_consistency_checks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_ledger_entity ON compliance_audit_ledger(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_compliance_state ON withdrawal_requests(compliance_state, created_at DESC);

CREATE TRIGGER social_platform_definitions_updated_at BEFORE UPDATE ON social_platform_definitions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER compliance_rule_definitions_updated_at BEFORE UPDATE ON compliance_rule_definitions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER task_compliance_profiles_updated_at BEFORE UPDATE ON task_compliance_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER task_verification_events_updated_at BEFORE UPDATE ON task_verification_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER withdrawal_compliance_reviews_updated_at BEFORE UPDATE ON withdrawal_compliance_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER compliance_violations_updated_at BEFORE UPDATE ON compliance_violations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER compliance_enforcement_actions_updated_at BEFORE UPDATE ON compliance_enforcement_actions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER compliance_appeals_updated_at BEFORE UPDATE ON compliance_appeals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER compliance_appeal_payments_updated_at BEFORE UPDATE ON compliance_appeal_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER identity_consistency_checks_updated_at BEFORE UPDATE ON identity_consistency_checks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE social_platform_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rule_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_verification_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_verification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_verification_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_compliance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_compliance_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_compliance_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_suspension_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_appeal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_appeal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_appeal_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_consistency_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_consistency_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_platform_definitions_select_authenticated ON social_platform_definitions;
CREATE POLICY social_platform_definitions_select_authenticated ON social_platform_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS social_platform_definitions_manage_super_admin ON social_platform_definitions;
CREATE POLICY social_platform_definitions_manage_super_admin ON social_platform_definitions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_rule_definitions_select_authenticated ON compliance_rule_definitions;
CREATE POLICY compliance_rule_definitions_select_authenticated ON compliance_rule_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS compliance_rule_definitions_manage_super_admin ON compliance_rule_definitions;
CREATE POLICY compliance_rule_definitions_manage_super_admin ON compliance_rule_definitions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS task_compliance_profiles_select_own ON task_compliance_profiles;
CREATE POLICY task_compliance_profiles_select_own ON task_compliance_profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS task_compliance_profiles_upsert_own ON task_compliance_profiles;
CREATE POLICY task_compliance_profiles_upsert_own ON task_compliance_profiles
  FOR ALL USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS task_verification_events_select_own ON task_verification_events;
CREATE POLICY task_verification_events_select_own ON task_verification_events
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS task_verification_events_insert_own ON task_verification_events;
CREATE POLICY task_verification_events_insert_own ON task_verification_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS task_verification_events_update_super_admin ON task_verification_events;
CREATE POLICY task_verification_events_update_super_admin ON task_verification_events
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS task_verification_evidence_select_own ON task_verification_evidence;
CREATE POLICY task_verification_evidence_select_own ON task_verification_evidence
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS task_verification_evidence_insert_own ON task_verification_evidence;
CREATE POLICY task_verification_evidence_insert_own ON task_verification_evidence
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS task_verification_reviews_select_authenticated ON task_verification_reviews;
CREATE POLICY task_verification_reviews_select_authenticated ON task_verification_reviews
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS task_verification_reviews_manage_super_admin ON task_verification_reviews;
CREATE POLICY task_verification_reviews_manage_super_admin ON task_verification_reviews
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS task_verification_audits_select_authenticated ON task_verification_audits;
CREATE POLICY task_verification_audits_select_authenticated ON task_verification_audits
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS task_verification_audits_insert_authenticated ON task_verification_audits;
CREATE POLICY task_verification_audits_insert_authenticated ON task_verification_audits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS withdrawal_compliance_reviews_select_own ON withdrawal_compliance_reviews;
CREATE POLICY withdrawal_compliance_reviews_select_own ON withdrawal_compliance_reviews
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS withdrawal_compliance_reviews_insert_own ON withdrawal_compliance_reviews;
CREATE POLICY withdrawal_compliance_reviews_insert_own ON withdrawal_compliance_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS withdrawal_compliance_reviews_update_super_admin_or_owner ON withdrawal_compliance_reviews;
CREATE POLICY withdrawal_compliance_reviews_update_super_admin_or_owner ON withdrawal_compliance_reviews
  FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_compliance_review_items_select_own ON withdrawal_compliance_review_items;
CREATE POLICY withdrawal_compliance_review_items_select_own ON withdrawal_compliance_review_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM withdrawal_compliance_reviews r
      WHERE r.id = review_id
        AND (r.user_id = auth.uid() OR public.is_super_admin())
    )
  );
DROP POLICY IF EXISTS withdrawal_compliance_review_items_manage_super_admin ON withdrawal_compliance_review_items;
CREATE POLICY withdrawal_compliance_review_items_manage_super_admin ON withdrawal_compliance_review_items
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_compliance_decisions_select_own ON withdrawal_compliance_decisions;
CREATE POLICY withdrawal_compliance_decisions_select_own ON withdrawal_compliance_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM withdrawal_compliance_reviews r
      WHERE r.id = review_id
        AND (r.user_id = auth.uid() OR public.is_super_admin())
    )
  );
DROP POLICY IF EXISTS withdrawal_compliance_decisions_manage_super_admin ON withdrawal_compliance_decisions;
CREATE POLICY withdrawal_compliance_decisions_manage_super_admin ON withdrawal_compliance_decisions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_violations_select_own ON compliance_violations;
CREATE POLICY compliance_violations_select_own ON compliance_violations
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_violations_manage_super_admin ON compliance_violations;
CREATE POLICY compliance_violations_manage_super_admin ON compliance_violations
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_enforcement_actions_select_own ON compliance_enforcement_actions;
CREATE POLICY compliance_enforcement_actions_select_own ON compliance_enforcement_actions
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_enforcement_actions_manage_super_admin ON compliance_enforcement_actions;
CREATE POLICY compliance_enforcement_actions_manage_super_admin ON compliance_enforcement_actions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_suspension_notices_select_own ON compliance_suspension_notices;
CREATE POLICY compliance_suspension_notices_select_own ON compliance_suspension_notices
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_suspension_notices_manage_super_admin ON compliance_suspension_notices;
CREATE POLICY compliance_suspension_notices_manage_super_admin ON compliance_suspension_notices
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_appeals_select_own ON compliance_appeals;
CREATE POLICY compliance_appeals_select_own ON compliance_appeals
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_appeals_insert_own ON compliance_appeals;
CREATE POLICY compliance_appeals_insert_own ON compliance_appeals
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_appeals_update_own_or_super_admin ON compliance_appeals;
CREATE POLICY compliance_appeals_update_own_or_super_admin ON compliance_appeals
  FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS compliance_appeal_documents_select_own ON compliance_appeal_documents;
CREATE POLICY compliance_appeal_documents_select_own ON compliance_appeal_documents
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_appeal_documents_insert_own ON compliance_appeal_documents;
CREATE POLICY compliance_appeal_documents_insert_own ON compliance_appeal_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS compliance_appeal_payments_select_own ON compliance_appeal_payments;
CREATE POLICY compliance_appeal_payments_select_own ON compliance_appeal_payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_appeal_payments_manage_super_admin ON compliance_appeal_payments;
CREATE POLICY compliance_appeal_payments_manage_super_admin ON compliance_appeal_payments
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_appeal_decisions_select_own ON compliance_appeal_decisions;
CREATE POLICY compliance_appeal_decisions_select_own ON compliance_appeal_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM compliance_appeals a
      WHERE a.id = appeal_id
        AND (a.user_id = auth.uid() OR public.is_super_admin())
    )
  );
DROP POLICY IF EXISTS compliance_appeal_decisions_manage_super_admin ON compliance_appeal_decisions;
CREATE POLICY compliance_appeal_decisions_manage_super_admin ON compliance_appeal_decisions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_risk_scores_select_own ON compliance_risk_scores;
CREATE POLICY compliance_risk_scores_select_own ON compliance_risk_scores
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS compliance_risk_scores_insert_super_admin ON compliance_risk_scores;
CREATE POLICY compliance_risk_scores_insert_super_admin ON compliance_risk_scores
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS identity_consistency_checks_select_own ON identity_consistency_checks;
CREATE POLICY identity_consistency_checks_select_own ON identity_consistency_checks
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
DROP POLICY IF EXISTS identity_consistency_checks_insert_super_admin ON identity_consistency_checks;
CREATE POLICY identity_consistency_checks_insert_super_admin ON identity_consistency_checks
  FOR INSERT WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS identity_consistency_checks_update_super_admin ON identity_consistency_checks;
CREATE POLICY identity_consistency_checks_update_super_admin ON identity_consistency_checks
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS identity_consistency_signals_select_own ON identity_consistency_signals;
CREATE POLICY identity_consistency_signals_select_own ON identity_consistency_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM identity_consistency_checks c
      WHERE c.id = check_id
        AND (c.user_id = auth.uid() OR public.is_super_admin())
    )
  );
DROP POLICY IF EXISTS identity_consistency_signals_manage_super_admin ON identity_consistency_signals;
CREATE POLICY identity_consistency_signals_manage_super_admin ON identity_consistency_signals
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_audit_ledger_select_own_or_super_admin ON compliance_audit_ledger;
CREATE POLICY compliance_audit_ledger_select_own_or_super_admin ON compliance_audit_ledger
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS compliance_audit_ledger_insert_authenticated ON compliance_audit_ledger;
CREATE POLICY compliance_audit_ledger_insert_authenticated ON compliance_audit_ledger
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.prevent_compliance_audit_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'compliance_audit_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_compliance_audit_ledger_update ON compliance_audit_ledger;
CREATE TRIGGER trg_prevent_compliance_audit_ledger_update
BEFORE UPDATE ON compliance_audit_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_compliance_audit_ledger_mutation();

DROP TRIGGER IF EXISTS trg_prevent_compliance_audit_ledger_delete ON compliance_audit_ledger;
CREATE TRIGGER trg_prevent_compliance_audit_ledger_delete
BEFORE DELETE ON compliance_audit_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_compliance_audit_ledger_mutation();

CREATE OR REPLACE FUNCTION public.task_compliance_audit_append(
  p_user_id UUID,
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_id UUID;
BEGIN
  INSERT INTO compliance_audit_ledger (
    user_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload
  )
  VALUES (
    p_user_id,
    auth.uid(),
    p_event_type,
    p_entity_type,
    p_entity_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO created_id;

  RETURN created_id;
END;
$$;

INSERT INTO social_platform_definitions (platform_key, display_name, field_schema, verification_capabilities, metadata)
VALUES
  ('youtube', 'YouTube', '{"fields":[{"key":"handle","type":"text","required":true},{"key":"channelUrl","type":"url","required":false}]}'::jsonb, '["api_signal","oauth_link","evidence_upload","manual_review","random_audit"]'::jsonb, '{"seeded_by":"044"}'::jsonb),
  ('facebook', 'Facebook', '{"fields":[{"key":"profileUrl","type":"url","required":true},{"key":"username","type":"text","required":false}]}'::jsonb, '["api_signal","oauth_link","evidence_upload","manual_review","random_audit"]'::jsonb, '{"seeded_by":"044"}'::jsonb),
  ('instagram', 'Instagram', '{"fields":[{"key":"handle","type":"text","required":true},{"key":"profileUrl","type":"url","required":false}]}'::jsonb, '["api_signal","oauth_link","evidence_upload","manual_review","random_audit"]'::jsonb, '{"seeded_by":"044"}'::jsonb),
  ('x', 'X', '{"fields":[{"key":"handle","type":"text","required":true},{"key":"profileUrl","type":"url","required":false}]}'::jsonb, '["api_signal","oauth_link","evidence_upload","manual_review","random_audit"]'::jsonb, '{"seeded_by":"044"}'::jsonb),
  ('tiktok', 'TikTok', '{"fields":[{"key":"handle","type":"text","required":true},{"key":"profileUrl","type":"url","required":false}]}'::jsonb, '["api_signal","oauth_link","evidence_upload","manual_review","random_audit"]'::jsonb, '{"seeded_by":"044"}'::jsonb)
ON CONFLICT (platform_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  field_schema = EXCLUDED.field_schema,
  verification_capabilities = EXCLUDED.verification_capabilities,
  metadata = COALESCE(social_platform_definitions.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO platform_settings (key, value, description)
VALUES
  ('task_compliance_feature_flags', '{"phase2_withdrawal_gate":true,"phase3_hybrid_verification":true,"phase4_risk_priority_queue":true,"phase5_enforcement":true,"phase6_appeals":true,"phase7_onboarding":true,"phase8_dashboard":true,"phase9_notifications":true,"phase10_rollout":false}'::jsonb, 'Task verification and compliance feature flags'),
  ('task_compliance_rollout', '{"mode":"shadow","percent":0,"guardrails":{"max_auto_action_risk":75}}'::jsonb, 'Progressive rollout controls for task compliance pipeline')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
