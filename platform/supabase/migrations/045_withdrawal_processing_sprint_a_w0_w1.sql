-- 045_withdrawal_processing_sprint_a_w0_w1.sql
-- Sprint A: W0 state contract alignment + W1 withdrawal schema completion

CREATE TABLE IF NOT EXISTS withdrawal_state_dictionary (
  state_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  actor_visibility TEXT[] NOT NULL DEFAULT ARRAY['admin', 'merchant', 'user', 'system'],
  legacy_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    legacy_status IN ('pending', 'pending_compliance', 'held', 'held_compliance', 'approved', 'rejected', 'processing', 'completed', 'cancelled')
  ),
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_state_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_state_key TEXT NOT NULL REFERENCES withdrawal_state_dictionary(state_key) ON DELETE RESTRICT,
  to_state_key TEXT NOT NULL REFERENCES withdrawal_state_dictionary(state_key) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'merchant', 'user', 'system')),
  action_key TEXT NOT NULL,
  requires_assignment BOOLEAN NOT NULL DEFAULT FALSE,
  requires_note BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_scope TEXT NOT NULL DEFAULT 'withdrawal' CHECK (idempotency_scope IN ('withdrawal', 'assignment')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_state_key, to_state_key, actor_type, action_key)
);

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS workflow_state_key TEXT,
  ADD COLUMN IF NOT EXISTS state_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_state_transition_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS active_assignment_id UUID,
  ADD COLUMN IF NOT EXISTS manual_assignment_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_assignment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0;

INSERT INTO withdrawal_state_dictionary (state_key, label, description, actor_visibility, legacy_status, is_terminal, sort_order, metadata)
VALUES
  ('pending_admin_approval', 'Pending Admin Approval', 'User submitted withdrawal request waiting for admin decision.', ARRAY['admin', 'user', 'system'], 'pending', FALSE, 10, '{"phase":"review"}'::jsonb),
  ('pending_merchant_assignment', 'Pending Merchant Assignment', 'Approved withdrawal waiting for explicit merchant assignment or auto-assignment.', ARRAY['admin', 'system'], 'pending', FALSE, 20, '{"phase":"assignment"}'::jsonb),
  ('merchant_assigned', 'Merchant Assigned', 'Withdrawal assigned to merchant and awaiting merchant acknowledgement.', ARRAY['admin', 'merchant', 'system'], 'processing', FALSE, 30, '{"phase":"assignment"}'::jsonb),
  ('merchant_acknowledged', 'Merchant Acknowledged', 'Merchant accepted assignment and is preparing payout.', ARRAY['admin', 'merchant', 'system'], 'processing', FALSE, 40, '{"phase":"execution"}'::jsonb),
  ('payout_sent', 'Payout Sent', 'Merchant marked payout as sent to user destination details.', ARRAY['admin', 'merchant', 'user', 'system'], 'processing', FALSE, 50, '{"phase":"execution"}'::jsonb),
  ('user_receipt_pending', 'User Receipt Pending', 'User must confirm receipt to complete settlement.', ARRAY['admin', 'merchant', 'user', 'system'], 'processing', FALSE, 60, '{"phase":"receipt"}'::jsonb),
  ('reassigning', 'Reassigning', 'Current assignment failed and withdrawal is awaiting reassignment.', ARRAY['admin', 'system'], 'processing', FALSE, 70, '{"phase":"reassignment"}'::jsonb),
  ('under_review', 'Under Review', 'Withdrawal moved to manual fraud/compliance review.', ARRAY['admin', 'user', 'merchant', 'system'], 'held_compliance', FALSE, 80, '{"phase":"review"}'::jsonb),
  ('timed_out', 'Timed Out', 'Assignment timed out and requires deterministic failover.', ARRAY['admin', 'system'], 'processing', FALSE, 90, '{"phase":"timeout"}'::jsonb),
  ('completed', 'Completed', 'Withdrawal fully completed and settled.', ARRAY['admin', 'merchant', 'user', 'system'], 'completed', TRUE, 100, '{"phase":"terminal"}'::jsonb),
  ('rejected', 'Rejected', 'Withdrawal rejected by admin review decision.', ARRAY['admin', 'user', 'system'], 'rejected', TRUE, 110, '{"phase":"terminal"}'::jsonb),
  ('cancelled', 'Cancelled', 'Withdrawal cancelled by allowed actor or system policy.', ARRAY['admin', 'merchant', 'user', 'system'], 'cancelled', TRUE, 120, '{"phase":"terminal"}'::jsonb),
  ('failed_no_liquidity', 'Failed No Liquidity', 'No eligible merchant liquidity available after retries.', ARRAY['admin', 'user', 'system'], 'held', TRUE, 130, '{"phase":"terminal"}'::jsonb),
  ('disputed', 'Disputed', 'Withdrawal entered dispute handling flow.', ARRAY['admin', 'merchant', 'user', 'system'], 'held_compliance', FALSE, 140, '{"phase":"dispute"}'::jsonb)
ON CONFLICT (state_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  actor_visibility = EXCLUDED.actor_visibility,
  legacy_status = EXCLUDED.legacy_status,
  is_terminal = EXCLUDED.is_terminal,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO withdrawal_state_transitions (from_state_key, to_state_key, actor_type, action_key, requires_assignment, requires_note, idempotency_scope, metadata)
VALUES
  ('pending_admin_approval', 'pending_merchant_assignment', 'admin', 'approve_withdrawal', FALSE, FALSE, 'withdrawal', '{"stage":"approval"}'::jsonb),
  ('pending_admin_approval', 'under_review', 'admin', 'flag_fraud_review', FALSE, TRUE, 'withdrawal', '{"stage":"approval"}'::jsonb),
  ('pending_admin_approval', 'rejected', 'admin', 'reject_withdrawal', FALSE, TRUE, 'withdrawal', '{"stage":"approval"}'::jsonb),

  ('pending_merchant_assignment', 'merchant_assigned', 'admin', 'assign_merchant', TRUE, FALSE, 'assignment', '{"stage":"assignment"}'::jsonb),
  ('pending_merchant_assignment', 'merchant_assigned', 'system', 'auto_assign_merchant', TRUE, FALSE, 'assignment', '{"stage":"assignment"}'::jsonb),
  ('pending_merchant_assignment', 'rejected', 'admin', 'reject_withdrawal', FALSE, TRUE, 'withdrawal', '{"stage":"assignment"}'::jsonb),

  ('merchant_assigned', 'merchant_acknowledged', 'merchant', 'accept_assignment', TRUE, FALSE, 'assignment', '{"stage":"execution"}'::jsonb),
  ('merchant_assigned', 'reassigning', 'merchant', 'decline_assignment', TRUE, TRUE, 'assignment', '{"stage":"execution"}'::jsonb),
  ('merchant_assigned', 'timed_out', 'system', 'assignment_timeout', TRUE, FALSE, 'assignment', '{"stage":"timeout"}'::jsonb),

  ('merchant_acknowledged', 'payout_sent', 'merchant', 'mark_payout_sent', TRUE, FALSE, 'assignment', '{"stage":"execution"}'::jsonb),
  ('payout_sent', 'user_receipt_pending', 'system', 'await_receipt_confirmation', TRUE, FALSE, 'withdrawal', '{"stage":"receipt"}'::jsonb),

  ('user_receipt_pending', 'completed', 'user', 'confirm_receipt', TRUE, FALSE, 'withdrawal', '{"stage":"receipt"}'::jsonb),
  ('user_receipt_pending', 'under_review', 'user', 'report_non_receipt', TRUE, TRUE, 'withdrawal', '{"stage":"receipt"}'::jsonb),

  ('timed_out', 'reassigning', 'system', 'trigger_reassignment', TRUE, FALSE, 'assignment', '{"stage":"reassignment"}'::jsonb),
  ('reassigning', 'merchant_assigned', 'admin', 'assign_merchant', TRUE, FALSE, 'assignment', '{"stage":"reassignment"}'::jsonb),
  ('reassigning', 'merchant_assigned', 'system', 'auto_assign_merchant', TRUE, FALSE, 'assignment', '{"stage":"reassignment"}'::jsonb),
  ('reassigning', 'failed_no_liquidity', 'system', 'mark_no_liquidity', FALSE, TRUE, 'withdrawal', '{"stage":"reassignment"}'::jsonb),

  ('under_review', 'completed', 'admin', 'resolve_release', TRUE, TRUE, 'withdrawal', '{"stage":"review"}'::jsonb),
  ('under_review', 'rejected', 'admin', 'resolve_reject', FALSE, TRUE, 'withdrawal', '{"stage":"review"}'::jsonb),
  ('under_review', 'disputed', 'admin', 'open_dispute', FALSE, TRUE, 'withdrawal', '{"stage":"review"}'::jsonb),
  ('disputed', 'completed', 'admin', 'resolve_dispute_release', TRUE, TRUE, 'withdrawal', '{"stage":"dispute"}'::jsonb),
  ('disputed', 'rejected', 'admin', 'resolve_dispute_reject', FALSE, TRUE, 'withdrawal', '{"stage":"dispute"}'::jsonb)
ON CONFLICT (from_state_key, to_state_key, actor_type, action_key) DO UPDATE
SET
  requires_assignment = EXCLUDED.requires_assignment,
  requires_note = EXCLUDED.requires_note,
  idempotency_scope = EXCLUDED.idempotency_scope,
  metadata = EXCLUDED.metadata,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS withdrawal_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  from_state_key TEXT NOT NULL REFERENCES withdrawal_state_dictionary(state_key) ON DELETE RESTRICT,
  to_state_key TEXT NOT NULL REFERENCES withdrawal_state_dictionary(state_key) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'merchant', 'user', 'system')),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_key TEXT NOT NULL,
  idempotency_key TEXT,
  expected_state_version BIGINT,
  applied_state_version BIGINT NOT NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (withdrawal_request_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS merchant_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE RESTRICT,
  assignment_status TEXT NOT NULL CHECK (assignment_status IN ('assigned', 'accepted', 'declined', 'expired', 'cancelled', 'completed', 'failed', 'reassigned')),
  assignment_sequence INTEGER NOT NULL DEFAULT 1,
  assigned_by_actor TEXT NOT NULL CHECK (assigned_by_actor IN ('admin', 'system')),
  assigned_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  decline_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (withdrawal_request_id, assignment_sequence)
);

ALTER TABLE withdrawal_requests
  ADD CONSTRAINT fk_withdrawal_requests_active_assignment
  FOREIGN KEY (active_assignment_id) REFERENCES merchant_assignments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS merchant_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE RESTRICT,
  assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit_pending', 'credit_confirmed', 'debit_reversal', 'adjustment')),
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'reversed', 'failed')),
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'merchant', 'user', 'system')),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  idempotency_key TEXT,
  ip_address INET,
  device_fingerprint TEXT,
  user_agent TEXT,
  reference_chain JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_audit_logs_idempotency
  ON withdrawal_audit_logs(withdrawal_request_id, action_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS merchant_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  assigned_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  declined_count INTEGER NOT NULL DEFAULT 0,
  timed_out_count INTEGER NOT NULL DEFAULT 0,
  dispute_count INTEGER NOT NULL DEFAULT 0,
  average_ack_seconds NUMERIC(12, 2) NOT NULL DEFAULT 0,
  average_completion_seconds NUMERIC(12, 2) NOT NULL DEFAULT 0,
  score NUMERIC(8, 3) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS merchant_timeout_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  timeout_stage TEXT NOT NULL CHECK (timeout_stage IN ('acceptance_window', 'payment_window', 'receipt_confirmation')),
  timeout_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'reassigned', 'cancelled', 'escalated')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_reassignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  from_assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  to_assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  requested_by_actor TEXT NOT NULL CHECK (requested_by_actor IN ('admin', 'merchant', 'user', 'system')),
  requested_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES merchant_assignments(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'under_review', 'resolved', 'rejected')),
  reason TEXT NOT NULL,
  resolution TEXT,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_state_dictionary_sort ON withdrawal_state_dictionary(sort_order, state_key);
CREATE INDEX IF NOT EXISTS idx_withdrawal_state_transitions_from_actor ON withdrawal_state_transitions(from_state_key, actor_type, action_key) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_workflow_state ON withdrawal_requests(workflow_state_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_assignment_flags ON withdrawal_requests(manual_assignment_required, auto_assignment_enabled);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status_history_request_created ON withdrawal_status_history(withdrawal_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_assignments_request_status ON merchant_assignments(withdrawal_request_id, assignment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_assignments_merchant_status ON merchant_assignments(merchant_id, assignment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_wallet_transactions_request_created ON merchant_wallet_transactions(withdrawal_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_notifications_status_scheduled ON merchant_notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_notifications_status_scheduled ON withdrawal_notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_audit_logs_request_created ON withdrawal_audit_logs(withdrawal_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_performance_snapshot ON merchant_performance(snapshot_date DESC, merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_timeout_events_stage_outcome ON merchant_timeout_events(timeout_stage, outcome, timeout_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_reassignments_request_created ON withdrawal_reassignments(withdrawal_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_disputes_state_created ON withdrawal_disputes(state, created_at DESC);

UPDATE withdrawal_requests
SET workflow_state_key = CASE
    WHEN status IN ('completed') THEN 'completed'
    WHEN status IN ('rejected') THEN 'rejected'
    WHEN status IN ('cancelled') THEN 'cancelled'
    WHEN status IN ('approved', 'processing') THEN 'pending_merchant_assignment'
    WHEN status IN ('held', 'held_compliance', 'pending_compliance') THEN 'under_review'
    ELSE 'pending_admin_approval'
  END,
  last_state_transition_at = COALESCE(last_state_transition_at, updated_at, created_at, CURRENT_TIMESTAMP)
WHERE workflow_state_key IS NULL;

ALTER TABLE withdrawal_requests
  ALTER COLUMN workflow_state_key SET DEFAULT 'pending_admin_approval';

ALTER TABLE withdrawal_requests
  ALTER COLUMN workflow_state_key SET NOT NULL;

UPDATE withdrawal_requests wr
SET risk_score = COALESCE(
      (
        SELECT score
        FROM compliance_risk_scores
        WHERE user_id = wr.user_id
        ORDER BY created_at DESC
        LIMIT 1
      ),
      wr.risk_score
    ),
    risk_level = COALESCE(
      (
        SELECT level
        FROM compliance_risk_scores
        WHERE user_id = wr.user_id
        ORDER BY created_at DESC
        LIMIT 1
      ),
      wr.risk_level
    )
WHERE wr.risk_level IS NULL;

UPDATE withdrawal_requests
SET risk_level = 'low'
WHERE risk_level IS NULL;

ALTER TABLE withdrawal_requests
  ALTER COLUMN risk_level SET DEFAULT 'low',
  ALTER COLUMN risk_level SET NOT NULL;

ALTER TABLE withdrawal_state_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_timeout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_reassignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawal_state_dictionary_select_authenticated ON withdrawal_state_dictionary;
CREATE POLICY withdrawal_state_dictionary_select_authenticated ON withdrawal_state_dictionary
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS withdrawal_state_dictionary_manage_super_admin ON withdrawal_state_dictionary;
CREATE POLICY withdrawal_state_dictionary_manage_super_admin ON withdrawal_state_dictionary
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_state_transitions_select_authenticated ON withdrawal_state_transitions;
CREATE POLICY withdrawal_state_transitions_select_authenticated ON withdrawal_state_transitions
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS withdrawal_state_transitions_manage_super_admin ON withdrawal_state_transitions;
CREATE POLICY withdrawal_state_transitions_manage_super_admin ON withdrawal_state_transitions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_status_history_select_involved ON withdrawal_status_history;
CREATE POLICY withdrawal_status_history_select_involved ON withdrawal_status_history
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM withdrawal_requests wr
      WHERE wr.id = withdrawal_status_history.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM merchant_assignments ma
      JOIN merchant_profiles mp ON mp.id = ma.merchant_id
      WHERE ma.id = (SELECT wr.active_assignment_id FROM withdrawal_requests wr WHERE wr.id = withdrawal_status_history.withdrawal_request_id)
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS withdrawal_status_history_manage_super_admin ON withdrawal_status_history;
CREATE POLICY withdrawal_status_history_manage_super_admin ON withdrawal_status_history
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_assignments_select_involved ON merchant_assignments;
CREATE POLICY merchant_assignments_select_involved ON merchant_assignments
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM withdrawal_requests wr
      WHERE wr.id = merchant_assignments.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_assignments.merchant_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchant_assignments_manage_super_admin ON merchant_assignments;
CREATE POLICY merchant_assignments_manage_super_admin ON merchant_assignments
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_wallet_transactions_select_involved ON merchant_wallet_transactions;
CREATE POLICY merchant_wallet_transactions_select_involved ON merchant_wallet_transactions
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_transactions.merchant_id
      AND mp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM withdrawal_requests wr
      WHERE wr.id = merchant_wallet_transactions.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchant_wallet_transactions_manage_super_admin ON merchant_wallet_transactions;
CREATE POLICY merchant_wallet_transactions_manage_super_admin ON merchant_wallet_transactions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_notifications_select_involved ON merchant_notifications;
CREATE POLICY merchant_notifications_select_involved ON merchant_notifications
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_notifications.merchant_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchant_notifications_manage_super_admin ON merchant_notifications;
CREATE POLICY merchant_notifications_manage_super_admin ON merchant_notifications
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_notifications_select_involved ON withdrawal_notifications;
CREATE POLICY withdrawal_notifications_select_involved ON withdrawal_notifications
  FOR SELECT USING (public.is_super_admin() OR auth.uid() = user_id);
DROP POLICY IF EXISTS withdrawal_notifications_manage_super_admin ON withdrawal_notifications;
CREATE POLICY withdrawal_notifications_manage_super_admin ON withdrawal_notifications
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_audit_logs_select_involved ON withdrawal_audit_logs;
CREATE POLICY withdrawal_audit_logs_select_involved ON withdrawal_audit_logs
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM withdrawal_requests wr
      WHERE wr.id = withdrawal_audit_logs.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM merchant_assignments ma
      JOIN merchant_profiles mp ON mp.id = ma.merchant_id
      WHERE ma.id = withdrawal_audit_logs.assignment_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS withdrawal_audit_logs_manage_super_admin ON withdrawal_audit_logs;
CREATE POLICY withdrawal_audit_logs_manage_super_admin ON withdrawal_audit_logs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_performance_select_involved ON merchant_performance;
CREATE POLICY merchant_performance_select_involved ON merchant_performance
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_performance.merchant_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchant_performance_manage_super_admin ON merchant_performance;
CREATE POLICY merchant_performance_manage_super_admin ON merchant_performance
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_timeout_events_select_involved ON merchant_timeout_events;
CREATE POLICY merchant_timeout_events_select_involved ON merchant_timeout_events
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM withdrawal_requests wr
      WHERE wr.id = merchant_timeout_events.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_timeout_events.merchant_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS merchant_timeout_events_manage_super_admin ON merchant_timeout_events;
CREATE POLICY merchant_timeout_events_manage_super_admin ON merchant_timeout_events
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_reassignments_select_involved ON withdrawal_reassignments;
CREATE POLICY withdrawal_reassignments_select_involved ON withdrawal_reassignments
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM withdrawal_requests wr
      WHERE wr.id = withdrawal_reassignments.withdrawal_request_id
      AND wr.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS withdrawal_reassignments_manage_super_admin ON withdrawal_reassignments;
CREATE POLICY withdrawal_reassignments_manage_super_admin ON withdrawal_reassignments
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS withdrawal_disputes_select_involved ON withdrawal_disputes;
CREATE POLICY withdrawal_disputes_select_involved ON withdrawal_disputes
  FOR SELECT USING (
    public.is_super_admin()
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = withdrawal_disputes.merchant_id
      AND mp.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS withdrawal_disputes_manage_super_admin ON withdrawal_disputes;
CREATE POLICY withdrawal_disputes_manage_super_admin ON withdrawal_disputes
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER withdrawal_state_dictionary_updated_at BEFORE UPDATE ON withdrawal_state_dictionary
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER withdrawal_state_transitions_updated_at BEFORE UPDATE ON withdrawal_state_transitions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER merchant_assignments_updated_at BEFORE UPDATE ON merchant_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER merchant_notifications_updated_at BEFORE UPDATE ON merchant_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER withdrawal_notifications_updated_at BEFORE UPDATE ON withdrawal_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER merchant_performance_updated_at BEFORE UPDATE ON merchant_performance
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER withdrawal_disputes_updated_at BEFORE UPDATE ON withdrawal_disputes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION transition_withdrawal_state(
  p_withdrawal_request_id UUID,
  p_actor_type TEXT,
  p_action_key TEXT,
  p_to_state_key TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_expected_state_version BIGINT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_assignment_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  applied BOOLEAN,
  withdrawal_state_key TEXT,
  state_version BIGINT,
  status_history_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current withdrawal_requests%ROWTYPE;
  v_transition withdrawal_state_transitions%ROWTYPE;
  v_existing withdrawal_status_history%ROWTYPE;
  v_next_state_version BIGINT;
  v_next_legacy_status TEXT;
  v_history_id UUID;
BEGIN
  IF p_actor_type NOT IN ('admin', 'merchant', 'user', 'system') THEN
    RAISE EXCEPTION 'Invalid actor_type: %', p_actor_type;
  END IF;

  IF p_actor_type = 'admin' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Admin actor requires super_admin privileges.';
  END IF;

  SELECT *
  INTO v_current
  FROM withdrawal_requests
  WHERE id = p_withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_withdrawal_request_id;
  END IF;

  IF p_expected_state_version IS NOT NULL AND v_current.state_version <> p_expected_state_version THEN
    RAISE EXCEPTION 'State version conflict for withdrawal %. expected=%, actual=%', p_withdrawal_request_id, p_expected_state_version, v_current.state_version;
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT *
    INTO v_existing
    FROM withdrawal_status_history
    WHERE withdrawal_request_id = p_withdrawal_request_id
      AND idempotency_key = p_idempotency_key
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT TRUE, v_existing.to_state_key, v_existing.applied_state_version, v_existing.id;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_transition
  FROM withdrawal_state_transitions
  WHERE from_state_key = v_current.workflow_state_key
    AND to_state_key = p_to_state_key
    AND actor_type = p_actor_type
    AND action_key = p_action_key
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Transition not allowed from % to % for actor % action %',
      v_current.workflow_state_key,
      p_to_state_key,
      p_actor_type,
      p_action_key;
  END IF;

  IF v_transition.requires_assignment AND p_assignment_id IS NULL AND v_current.active_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Transition % requires an active assignment.', p_action_key;
  END IF;

  IF v_transition.requires_note AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'Transition % requires a non-empty note.', p_action_key;
  END IF;

  SELECT legacy_status
  INTO v_next_legacy_status
  FROM withdrawal_state_dictionary
  WHERE state_key = p_to_state_key
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'State dictionary entry not found or inactive for key %', p_to_state_key;
  END IF;

  v_next_state_version := v_current.state_version + 1;

  UPDATE withdrawal_requests
  SET
    workflow_state_key = p_to_state_key,
    state_version = v_next_state_version,
    status = COALESCE(v_next_legacy_status, status),
    active_assignment_id = COALESCE(p_assignment_id, active_assignment_id),
    reviewed_by = CASE WHEN p_actor_type = 'admin' THEN COALESCE(p_actor_user_id, reviewed_by) ELSE reviewed_by END,
    reviewed_at = CASE WHEN p_actor_type = 'admin' THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
    admin_notes = CASE
      WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN p_note
      ELSE admin_notes
    END,
    last_state_transition_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_withdrawal_request_id;

  INSERT INTO withdrawal_status_history (
    withdrawal_request_id,
    from_state_key,
    to_state_key,
    actor_type,
    actor_user_id,
    action_key,
    idempotency_key,
    expected_state_version,
    applied_state_version,
    note,
    metadata
  )
  VALUES (
    p_withdrawal_request_id,
    v_current.workflow_state_key,
    p_to_state_key,
    p_actor_type,
    p_actor_user_id,
    p_action_key,
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    p_expected_state_version,
    v_next_state_version,
    p_note,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_history_id;

  INSERT INTO withdrawal_audit_logs (
    withdrawal_request_id,
    assignment_id,
    actor_type,
    actor_user_id,
    action_type,
    idempotency_key,
    reference_chain,
    payload
  )
  VALUES (
    p_withdrawal_request_id,
    COALESCE(p_assignment_id, v_current.active_assignment_id),
    p_actor_type,
    p_actor_user_id,
    'state_transition',
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    jsonb_build_object(
      'from_state', v_current.workflow_state_key,
      'to_state', p_to_state_key,
      'action_key', p_action_key
    ),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY
  SELECT TRUE, p_to_state_key, v_next_state_version, v_history_id;
END;
$$;

CREATE OR REPLACE FUNCTION assign_withdrawal_merchant(
  p_withdrawal_request_id UUID,
  p_merchant_id UUID DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'admin',
  p_actor_user_id UUID DEFAULT NULL,
  p_auto_assignment_enabled BOOLEAN DEFAULT FALSE,
  p_idempotency_key TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  withdrawal_state_key TEXT,
  state_version BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal withdrawal_requests%ROWTYPE;
  v_assignment_id UUID;
  v_assignment_sequence INTEGER;
  v_due_at TIMESTAMPTZ;
  v_transition RECORD;
BEGIN
  IF p_actor_type NOT IN ('admin', 'system') THEN
    RAISE EXCEPTION 'assign_withdrawal_merchant only supports admin/system actors.';
  END IF;

  IF p_actor_type = 'admin' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Admin actor requires super_admin privileges.';
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_withdrawal_request_id;
  END IF;

  IF p_merchant_id IS NULL AND p_auto_assignment_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Manual assignment requires merchant selection or explicit auto-assignment toggle.';
  END IF;

  IF p_merchant_id IS NULL THEN
    UPDATE withdrawal_requests
    SET
      auto_assignment_enabled = TRUE,
      manual_assignment_required = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_withdrawal_request_id;

    IF v_withdrawal.workflow_state_key <> 'pending_merchant_assignment' THEN
      SELECT * INTO v_transition
      FROM transition_withdrawal_state(
        p_withdrawal_request_id,
        p_actor_type,
        'approve_withdrawal',
        'pending_merchant_assignment',
        p_idempotency_key,
        v_withdrawal.state_version,
        p_actor_user_id,
        NULL,
        p_note,
        jsonb_build_object('auto_assignment_enabled', TRUE)
      );

      RETURN QUERY
      SELECT NULL::UUID, v_transition.withdrawal_state_key, v_transition.state_version;
      RETURN;
    END IF;

    RETURN QUERY
    SELECT NULL::UUID, v_withdrawal.workflow_state_key, v_withdrawal.state_version;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM merchant_profiles
    WHERE id = p_merchant_id
      AND status IN ('active', 'qualified', 'enabled')
  ) THEN
    RAISE EXCEPTION 'Merchant % is not active/eligible for assignment.', p_merchant_id;
  END IF;

  SELECT COALESCE(MAX(assignment_sequence), 0) + 1
  INTO v_assignment_sequence
  FROM merchant_assignments
  WHERE withdrawal_request_id = p_withdrawal_request_id;

  v_due_at := COALESCE(p_due_at, CURRENT_TIMESTAMP + INTERVAL '12 hours');

  INSERT INTO merchant_assignments (
    withdrawal_request_id,
    merchant_id,
    assignment_status,
    assignment_sequence,
    assigned_by_actor,
    assigned_by_user_id,
    due_at,
    metadata
  )
  VALUES (
    p_withdrawal_request_id,
    p_merchant_id,
    'assigned',
    v_assignment_sequence,
    p_actor_type,
    p_actor_user_id,
    v_due_at,
    jsonb_build_object('note', p_note)
  )
  RETURNING id INTO v_assignment_id;

  UPDATE withdrawal_requests
  SET
    active_assignment_id = v_assignment_id,
    auto_assignment_enabled = p_auto_assignment_enabled,
    manual_assignment_required = NOT p_auto_assignment_enabled,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_withdrawal_request_id;

  INSERT INTO merchant_notifications (
    merchant_id,
    withdrawal_request_id,
    assignment_id,
    template_key,
    channel,
    status,
    scheduled_at,
    payload
  )
  VALUES (
    p_merchant_id,
    p_withdrawal_request_id,
    v_assignment_id,
    'withdrawal_assignment_created',
    'in_app',
    'queued',
    CURRENT_TIMESTAMP,
    jsonb_build_object('due_at', v_due_at)
  );

  INSERT INTO withdrawal_notifications (
    withdrawal_request_id,
    user_id,
    template_key,
    channel,
    status,
    scheduled_at,
    payload
  )
  SELECT
    wr.id,
    wr.user_id,
    'withdrawal_assignment_in_progress',
    'in_app',
    'queued',
    CURRENT_TIMESTAMP,
    jsonb_build_object('assignment_id', v_assignment_id)
  FROM withdrawal_requests wr
  WHERE wr.id = p_withdrawal_request_id;

  IF v_withdrawal.workflow_state_key <> 'pending_merchant_assignment'
     AND v_withdrawal.workflow_state_key <> 'reassigning' THEN
    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      p_withdrawal_request_id,
      p_actor_type,
      'approve_withdrawal',
      'pending_merchant_assignment',
      NULL,
      v_withdrawal.state_version,
      p_actor_user_id,
      v_assignment_id,
      p_note,
      jsonb_build_object('auto_assignment_enabled', p_auto_assignment_enabled)
    );
  END IF;

  SELECT * INTO v_transition
  FROM transition_withdrawal_state(
    p_withdrawal_request_id,
    p_actor_type,
    CASE WHEN p_actor_type = 'system' THEN 'auto_assign_merchant' ELSE 'assign_merchant' END,
    'merchant_assigned',
    p_idempotency_key,
    NULL,
    p_actor_user_id,
    v_assignment_id,
    p_note,
    jsonb_build_object('assignment_id', v_assignment_id)
  );

  RETURN QUERY
  SELECT v_assignment_id, v_transition.withdrawal_state_key, v_transition.state_version;
END;
$$;

CREATE OR REPLACE FUNCTION list_withdrawal_operations_queue(
  p_limit INTEGER DEFAULT 100,
  p_state_keys TEXT[] DEFAULT NULL,
  p_risk_levels TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  withdrawal_request_id UUID,
  user_id UUID,
  user_display_name TEXT,
  user_email TEXT,
  amount NUMERIC,
  currency TEXT,
  method TEXT,
  destination_label TEXT,
  destination_value TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  workflow_state_key TEXT,
  workflow_state_label TEXT,
  legacy_status TEXT,
  risk_level TEXT,
  risk_score NUMERIC,
  compliance_state TEXT,
  state_version BIGINT,
  manual_assignment_required BOOLEAN,
  auto_assignment_enabled BOOLEAN,
  assignment_id UUID,
  assignment_status TEXT,
  assignment_due_at TIMESTAMPTZ,
  assigned_merchant_id UUID,
  assigned_merchant_code TEXT,
  assigned_merchant_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wr.id AS withdrawal_request_id,
    wr.user_id,
    COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(p.email), ''), wr.user_id::TEXT) AS user_display_name,
    p.email AS user_email,
    wr.amount,
    wr.currency,
    wr.method,
    wr.destination_label,
    wr.destination_value,
    wr.scheduled_for,
    wr.created_at,
    wr.workflow_state_key,
    COALESCE(wsd.label, wr.workflow_state_key) AS workflow_state_label,
    wr.status AS legacy_status,
    COALESCE(wr.risk_level, crs.level, 'low') AS risk_level,
    COALESCE(wr.risk_score, crs.score, 0) AS risk_score,
    wr.compliance_state,
    wr.state_version,
    wr.manual_assignment_required,
    wr.auto_assignment_enabled,
    ma.id AS assignment_id,
    ma.assignment_status,
    ma.due_at AS assignment_due_at,
    ma.merchant_id AS assigned_merchant_id,
    mp.merchant_code AS assigned_merchant_code,
    COALESCE(NULLIF(trim(mp.display_name), ''), NULLIF(trim(mp.legal_name), ''), mp.merchant_code) AS assigned_merchant_name
  FROM withdrawal_requests wr
  LEFT JOIN profiles p
    ON p.id = wr.user_id
  LEFT JOIN withdrawal_state_dictionary wsd
    ON wsd.state_key = wr.workflow_state_key
  LEFT JOIN LATERAL (
    SELECT score, level
    FROM compliance_risk_scores
    WHERE user_id = wr.user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) crs ON TRUE
  LEFT JOIN merchant_assignments ma
    ON ma.id = wr.active_assignment_id
  LEFT JOIN merchant_profiles mp
    ON mp.id = ma.merchant_id
  WHERE
    (p_state_keys IS NULL OR COALESCE(array_length(p_state_keys, 1), 0) = 0 OR wr.workflow_state_key = ANY(p_state_keys))
    AND (p_risk_levels IS NULL OR COALESCE(array_length(p_risk_levels, 1), 0) = 0 OR COALESCE(wr.risk_level, crs.level, 'low') = ANY(p_risk_levels))
  ORDER BY wr.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION admin_resolve_withdrawal_action(
  p_withdrawal_request_id UUID,
  p_action TEXT,
  p_actor_user_id UUID,
  p_note TEXT DEFAULT NULL,
  p_merchant_id UUID DEFAULT NULL,
  p_auto_assignment_enabled BOOLEAN DEFAULT FALSE,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  withdrawal_state_key TEXT,
  state_version BIGINT,
  assignment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current withdrawal_requests%ROWTYPE;
  v_transition RECORD;
  v_assignment RECORD;
  v_reversal_exists BOOLEAN;
  v_profile_balance NUMERIC;
  v_restored_balance NUMERIC;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'admin_resolve_withdrawal_action requires super_admin privileges.';
  END IF;

  SELECT *
  INTO v_current
  FROM withdrawal_requests
  WHERE id = p_withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_withdrawal_request_id;
  END IF;

  IF p_action = 'approve' THEN
    IF p_merchant_id IS NULL AND p_auto_assignment_enabled IS NOT TRUE THEN
      RAISE EXCEPTION 'Approve action requires merchant selection or explicit auto-assignment toggle.';
    END IF;

    IF v_current.workflow_state_key <> 'pending_merchant_assignment'
       AND v_current.workflow_state_key <> 'reassigning'
       AND v_current.workflow_state_key <> 'merchant_assigned' THEN
      SELECT * INTO v_transition
      FROM transition_withdrawal_state(
        p_withdrawal_request_id,
        'admin',
        'approve_withdrawal',
        'pending_merchant_assignment',
        CASE
          WHEN p_merchant_id IS NULL THEN p_idempotency_key
          ELSE NULL
        END,
        v_current.state_version,
        p_actor_user_id,
        NULL,
        p_note,
        jsonb_build_object('action', 'approve')
      );
    END IF;

    SELECT * INTO v_assignment
    FROM assign_withdrawal_merchant(
      p_withdrawal_request_id,
      p_merchant_id,
      'admin',
      p_actor_user_id,
      p_auto_assignment_enabled,
      p_idempotency_key,
      p_note,
      NULL
    );

    RETURN QUERY
    SELECT v_assignment.withdrawal_state_key, v_assignment.state_version, v_assignment.assignment_id;
    RETURN;
  END IF;

  IF p_action = 'fraud_review' THEN
    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      p_withdrawal_request_id,
      'admin',
      'flag_fraud_review',
      'under_review',
      p_idempotency_key,
      v_current.state_version,
      p_actor_user_id,
      v_current.active_assignment_id,
      p_note,
      jsonb_build_object('action', 'fraud_review')
    );

    RETURN QUERY
    SELECT v_transition.withdrawal_state_key, v_transition.state_version, v_current.active_assignment_id;
    RETURN;
  END IF;

  IF p_action = 'reject' THEN
    SELECT EXISTS (
      SELECT 1
      FROM wallet_transactions
      WHERE transaction_type = 'withdrawal_reversal'
        AND reference_id = p_withdrawal_request_id
        AND user_id = v_current.user_id
    ) INTO v_reversal_exists;

    IF NOT v_reversal_exists THEN
      SELECT wallet_balance
      INTO v_profile_balance
      FROM profiles
      WHERE id = v_current.user_id
      FOR UPDATE;

      v_restored_balance := ROUND(COALESCE(v_profile_balance, 0) + COALESCE(v_current.amount, 0), 2);

      UPDATE profiles
      SET wallet_balance = v_restored_balance
      WHERE id = v_current.user_id;

      INSERT INTO wallet_ledger (
        user_id,
        amount,
        balance_after,
        reason,
        note
      )
      VALUES (
        v_current.user_id,
        v_current.amount,
        v_restored_balance,
        COALESCE(NULLIF(trim(p_note), ''), 'Withdrawal request rejected and balance restored'),
        'Withdrawal reversal'
      );

      INSERT INTO wallet_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        currency,
        status,
        method,
        reference_id,
        note,
        metadata
      )
      VALUES (
        v_current.user_id,
        'withdrawal_reversal',
        v_current.amount,
        v_restored_balance,
        v_current.currency,
        'available',
        v_current.method,
        v_current.id,
        COALESCE(NULLIF(trim(p_note), ''), 'Withdrawal rejected'),
        jsonb_build_object(
          'destinationLabel', v_current.destination_label,
          'destinationCurrency', v_current.destination_currency
        )
      );
    END IF;

    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      p_withdrawal_request_id,
      'admin',
      'reject_withdrawal',
      'rejected',
      p_idempotency_key,
      v_current.state_version,
      p_actor_user_id,
      v_current.active_assignment_id,
      p_note,
      jsonb_build_object('action', 'reject')
    );

    RETURN QUERY
    SELECT v_transition.withdrawal_state_key, v_transition.state_version, v_current.active_assignment_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unsupported action: %', p_action;
END;
$$;

GRANT EXECUTE ON FUNCTION transition_withdrawal_state(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_withdrawal_merchant(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION list_withdrawal_operations_queue(INTEGER, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_resolve_withdrawal_action(UUID, TEXT, UUID, TEXT, UUID, BOOLEAN, TEXT) TO authenticated;
