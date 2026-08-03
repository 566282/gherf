-- 043_task_compliance_phase0_policy_contract.sql
-- Phase 0: Task compliance domain contract and policy DSL persistence.

CREATE TABLE IF NOT EXISTS compliance_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  current_version TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_policy_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'task-compliance-policy.v1',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  policy JSONB NOT NULL,
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_key, version)
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_status_updated ON compliance_policies(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_policy_versions_policy_key ON compliance_policy_versions(policy_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_policy_versions_status ON compliance_policy_versions(status, published_at DESC);

CREATE TRIGGER compliance_policies_updated_at
BEFORE UPDATE ON compliance_policies
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER compliance_policy_versions_updated_at
BEFORE UPDATE ON compliance_policy_versions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_policy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_policies_select_authenticated ON compliance_policies;
CREATE POLICY compliance_policies_select_authenticated ON compliance_policies
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS compliance_policies_insert_super_admin ON compliance_policies;
CREATE POLICY compliance_policies_insert_super_admin ON compliance_policies
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_policies_update_super_admin ON compliance_policies;
CREATE POLICY compliance_policies_update_super_admin ON compliance_policies
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_policies_delete_super_admin ON compliance_policies;
CREATE POLICY compliance_policies_delete_super_admin ON compliance_policies
  FOR DELETE USING (public.is_super_admin());

DROP POLICY IF EXISTS compliance_policy_versions_select_authenticated ON compliance_policy_versions;
CREATE POLICY compliance_policy_versions_select_authenticated ON compliance_policy_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS compliance_policy_versions_insert_super_admin ON compliance_policy_versions;
CREATE POLICY compliance_policy_versions_insert_super_admin ON compliance_policy_versions
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_policy_versions_update_super_admin ON compliance_policy_versions;
CREATE POLICY compliance_policy_versions_update_super_admin ON compliance_policy_versions
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS compliance_policy_versions_delete_super_admin ON compliance_policy_versions;
CREATE POLICY compliance_policy_versions_delete_super_admin ON compliance_policy_versions
  FOR DELETE USING (public.is_super_admin());

INSERT INTO compliance_policies (
  policy_key,
  title,
  description,
  current_version,
  status,
  metadata
)
VALUES (
  'task_compliance_policy',
  'Task Compliance Baseline',
  'Policy DSL baseline for verification strategy, withdrawal gate, risk scoring, and enforcement transitions.',
  'v1-baseline',
  'active',
  jsonb_build_object('seeded_by', '043_task_compliance_phase0_policy_contract.sql')
)
ON CONFLICT (policy_key) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  current_version = EXCLUDED.current_version,
  status = EXCLUDED.status,
  metadata = COALESCE(compliance_policies.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO compliance_policy_versions (
  policy_id,
  policy_key,
  version,
  schema_version,
  status,
  policy,
  is_baseline,
  published_at,
  effective_from,
  updated_by
)
SELECT
  p.id,
  p.policy_key,
  'v1-baseline',
  'task-compliance-policy.v1',
  'published',
  jsonb_build_object(
    'schemaVersion', 'task-compliance-policy.v1',
    'metadata', jsonb_build_object(
      'version', 1,
      'label', 'Baseline task compliance policy',
      'description', 'Hybrid verification and withdrawal compliance baseline for rewarded tasks.',
      'updatedAt', '1970-01-01T00:00:00.000Z',
      'updatedBy', NULL
    ),
    'states', jsonb_build_object(
      'verification', jsonb_build_array('pending', 'queued', 'running', 'review_required', 'approved', 'rejected', 'expired'),
      'withdrawalCompliance', jsonb_build_array('draft', 'pending_compliance', 'held_compliance', 'approved', 'rejected', 'bypassed'),
      'enforcement', jsonb_build_array('none', 'warning', 'hold', 'suspend', 'ban'),
      'appeal', jsonb_build_array('not_eligible', 'eligible', 'submitted', 'fee_pending', 'in_review', 'resolved')
    ),
    'transitions', jsonb_build_object(
      'verification', jsonb_build_array(
        jsonb_build_object('from', 'pending', 'to', 'queued', 'via', 'enqueue'),
        jsonb_build_object('from', 'queued', 'to', 'running', 'via', 'start'),
        jsonb_build_object('from', 'running', 'to', 'approved', 'via', 'auto_pass'),
        jsonb_build_object('from', 'running', 'to', 'review_required', 'via', 'needs_manual_review'),
        jsonb_build_object('from', 'review_required', 'to', 'approved', 'via', 'manual_approve'),
        jsonb_build_object('from', 'review_required', 'to', 'rejected', 'via', 'manual_reject'),
        jsonb_build_object('from', 'running', 'to', 'expired', 'via', 'timeout')
      ),
      'withdrawalCompliance', jsonb_build_array(
        jsonb_build_object('from', 'draft', 'to', 'pending_compliance', 'via', 'withdrawal_requested'),
        jsonb_build_object('from', 'pending_compliance', 'to', 'held_compliance', 'via', 'policy_hold'),
        jsonb_build_object('from', 'pending_compliance', 'to', 'approved', 'via', 'policy_pass'),
        jsonb_build_object('from', 'held_compliance', 'to', 'approved', 'via', 'manual_release'),
        jsonb_build_object('from', 'held_compliance', 'to', 'rejected', 'via', 'manual_reject'),
        jsonb_build_object('from', 'pending_compliance', 'to', 'bypassed', 'via', 'policy_bypass')
      ),
      'enforcement', jsonb_build_array(
        jsonb_build_object('from', 'none', 'to', 'warning', 'via', 'low_severity_violation'),
        jsonb_build_object('from', 'warning', 'to', 'hold', 'via', 'repeat_violation'),
        jsonb_build_object('from', 'hold', 'to', 'suspend', 'via', 'high_risk_violation'),
        jsonb_build_object('from', 'suspend', 'to', 'ban', 'via', 'critical_violation')
      ),
      'appeal', jsonb_build_array(
        jsonb_build_object('from', 'not_eligible', 'to', 'eligible', 'via', 'policy_allows'),
        jsonb_build_object('from', 'eligible', 'to', 'submitted', 'via', 'appeal_created'),
        jsonb_build_object('from', 'submitted', 'to', 'fee_pending', 'via', 'fee_required'),
        jsonb_build_object('from', 'submitted', 'to', 'in_review', 'via', 'no_fee_required'),
        jsonb_build_object('from', 'fee_pending', 'to', 'in_review', 'via', 'fee_settled'),
        jsonb_build_object('from', 'in_review', 'to', 'resolved', 'via', 'decision_recorded')
      )
    ),
    'verificationStrategy', jsonb_build_object(
      'methods', jsonb_build_array('api_signal', 'oauth_link', 'webhook_event', 'evidence_upload', 'manual_review', 'random_audit'),
      'platformMethodAllowList', jsonb_build_object(
        'youtube', jsonb_build_array('api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'),
        'facebook', jsonb_build_array('api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'),
        'instagram', jsonb_build_array('api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'),
        'x', jsonb_build_array('api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'),
        'tiktok', jsonb_build_array('api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit')
      ),
      'fallbackOrder', jsonb_build_array('api_signal', 'oauth_link', 'webhook_event', 'evidence_upload', 'manual_review', 'random_audit'),
      'randomAuditRatePercent', 12,
      'manualReview', jsonb_build_object('minRiskScore', 60, 'minWithdrawalAmount', 500)
    ),
    'withdrawalGate', jsonb_build_object(
      'enabled', true,
      'bypass', jsonb_build_object('enabled', true, 'maxRiskScore', 24, 'minAccountAgeDays', 30),
      'holdState', 'held_compliance'
    ),
    'risk', jsonb_build_object(
      'range', jsonb_build_object('min', 0, 'max', 100),
      'weights', jsonb_build_object(
        'taskAnomaly', 25,
        'identityMismatch', 25,
        'deviceIpRisk', 20,
        'violationHistory', 20,
        'evidenceQuality', 10
      )
    ),
    'enforcement', jsonb_build_object(
      'rules', jsonb_build_array(
        jsonb_build_object('threshold', 40, 'action', 'warning', 'reversible', true, 'reasonCode', 'risk_warning'),
        jsonb_build_object('threshold', 60, 'action', 'hold', 'reversible', true, 'reasonCode', 'risk_hold'),
        jsonb_build_object('threshold', 80, 'action', 'suspend', 'reversible', true, 'reasonCode', 'risk_suspend'),
        jsonb_build_object('threshold', 95, 'action', 'ban', 'reversible', false, 'reasonCode', 'risk_ban')
      )
    )
  ),
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM compliance_policies p
WHERE p.policy_key = 'task_compliance_policy'
ON CONFLICT (policy_key, version) DO UPDATE
SET
  schema_version = EXCLUDED.schema_version,
  status = EXCLUDED.status,
  policy = EXCLUDED.policy,
  is_baseline = EXCLUDED.is_baseline,
  published_at = EXCLUDED.published_at,
  effective_from = EXCLUDED.effective_from,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO platform_settings (key, value, description)
VALUES (
  'task_compliance_policy_active',
  jsonb_build_object(
    'policyKey', 'task_compliance_policy',
    'version', 'v1-baseline',
    'schemaVersion', 'task-compliance-policy.v1'
  ),
  'Active policy key/version for task compliance orchestration'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
