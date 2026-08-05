-- 046_withdrawal_processing_sprint_b_w4_w5.sql
-- Sprint B: W4 merchant assignment/acceptance + W5 payout execution and user receipt settlement

ALTER TABLE merchant_assignments
  ADD COLUMN IF NOT EXISTS payout_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_reference TEXT,
  ADD COLUMN IF NOT EXISTS payout_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_wallet_transactions_assignment_type
  ON merchant_wallet_transactions(assignment_id, transaction_type)
  WHERE assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_withdrawal_runtime_setting_numeric(
  p_key TEXT,
  p_default NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
  v_numeric NUMERIC;
BEGIN
  SELECT value
  INTO v_value
  FROM platform_settings
  WHERE key = p_key
  LIMIT 1;

  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;

  BEGIN
    v_numeric := (v_value #>> '{}')::NUMERIC;
  EXCEPTION WHEN others THEN
    v_numeric := p_default;
  END;

  RETURN COALESCE(v_numeric, p_default);
END;
$$;

INSERT INTO platform_settings (key, value, description)
VALUES
  ('withdrawal_assignment_acceptance_minutes', to_jsonb(15), 'Minutes a merchant has to accept an assignment before timeout.'),
  ('withdrawal_assignment_timeout_hours', to_jsonb(12), 'Hours before assignment payout is considered timed out.'),
  ('withdrawal_max_reassignments', to_jsonb(5), 'Maximum number of reassignments before no-liquidity failure.')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.list_withdrawal_operations_queue(
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
    (
      public.is_super_admin()
      OR wr.user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM merchant_profiles mp_access
        WHERE mp_access.id = ma.merchant_id
          AND mp_access.user_id = auth.uid()
      )
    )
    AND (p_state_keys IS NULL OR COALESCE(array_length(p_state_keys, 1), 0) = 0 OR wr.workflow_state_key = ANY(p_state_keys))
    AND (p_risk_levels IS NULL OR COALESCE(array_length(p_risk_levels, 1), 0) = 0 OR COALESCE(wr.risk_level, crs.level, 'low') = ANY(p_risk_levels))
  ORDER BY wr.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_next_withdrawal_merchant(
  p_withdrawal_request_id UUID,
  p_excluded_merchant_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_note TEXT DEFAULT NULL
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
  v_candidate_merchant_id UUID;
  v_assignment RECORD;
  v_transition RECORD;
  v_acceptance_minutes INTEGER := GREATEST(1, ROUND(public.get_withdrawal_runtime_setting_numeric('withdrawal_assignment_acceptance_minutes', 15))::INTEGER);
  v_max_reassignments INTEGER := GREATEST(0, ROUND(public.get_withdrawal_runtime_setting_numeric('withdrawal_max_reassignments', 5))::INTEGER);
  v_reassignment_count INTEGER;
BEGIN
  SELECT *
  INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_withdrawal_request_id;
  END IF;

  SELECT COUNT(*)
  INTO v_reassignment_count
  FROM merchant_assignments
  WHERE withdrawal_request_id = p_withdrawal_request_id
    AND assignment_status IN ('declined', 'expired', 'failed', 'reassigned');

  IF v_reassignment_count >= v_max_reassignments THEN
    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      p_withdrawal_request_id,
      'system',
      'mark_no_liquidity',
      'failed_no_liquidity',
      format('auto-no-liquidity:%s:%s', p_withdrawal_request_id::TEXT, extract(epoch from now())::BIGINT),
      v_withdrawal.state_version,
      NULL,
      v_withdrawal.active_assignment_id,
      COALESCE(p_note, 'Exceeded maximum reassignment attempts.'),
      jsonb_build_object('reassignment_count', v_reassignment_count, 'max_reassignments', v_max_reassignments)
    );

    RETURN QUERY
    SELECT NULL::UUID, v_transition.withdrawal_state_key, v_transition.state_version;
    RETURN;
  END IF;

  SELECT mp.id
  INTO v_candidate_merchant_id
  FROM merchant_profiles mp
  JOIN merchant_wallet_accounts mwa
    ON mwa.merchant_id = mp.id
    AND mwa.wallet_type = 'available'
    AND UPPER(mwa.currency) = UPPER(v_withdrawal.currency)
  WHERE mp.status IN ('active', 'qualified', 'enabled')
    AND mp.id <> ALL(COALESCE(p_excluded_merchant_ids, ARRAY[]::UUID[]))
    AND mwa.available_balance >= COALESCE(v_withdrawal.net_amount, v_withdrawal.amount)
  ORDER BY
    mp.completion_rate DESC,
    mp.rating_score DESC,
    mp.risk_score ASC,
    mwa.available_balance DESC,
    mp.updated_at ASC
  LIMIT 1;

  IF v_candidate_merchant_id IS NULL THEN
    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      p_withdrawal_request_id,
      'system',
      'mark_no_liquidity',
      'failed_no_liquidity',
      format('auto-no-liquidity:%s:%s', p_withdrawal_request_id::TEXT, extract(epoch from now())::BIGINT),
      v_withdrawal.state_version,
      NULL,
      v_withdrawal.active_assignment_id,
      COALESCE(p_note, 'No eligible merchant liquidity available.'),
      jsonb_build_object('excluded_merchant_ids', COALESCE(p_excluded_merchant_ids, ARRAY[]::UUID[]))
    );

    RETURN QUERY
    SELECT NULL::UUID, v_transition.withdrawal_state_key, v_transition.state_version;
    RETURN;
  END IF;

  SELECT * INTO v_assignment
  FROM assign_withdrawal_merchant(
    p_withdrawal_request_id,
    v_candidate_merchant_id,
    'system',
    NULL,
    TRUE,
    format('auto-assign:%s:%s', p_withdrawal_request_id::TEXT, v_candidate_merchant_id::TEXT),
    p_note,
    CURRENT_TIMESTAMP + make_interval(mins => v_acceptance_minutes)
  );

  INSERT INTO merchant_timeout_events (
    withdrawal_request_id,
    assignment_id,
    merchant_id,
    timeout_stage,
    timeout_at,
    outcome,
    metadata
  )
  VALUES (
    p_withdrawal_request_id,
    v_assignment.assignment_id,
    v_candidate_merchant_id,
    'acceptance_window',
    CURRENT_TIMESTAMP + make_interval(mins => v_acceptance_minutes),
    'pending',
    jsonb_build_object('source', 'auto_assign_next_withdrawal_merchant')
  );

  RETURN QUERY
  SELECT v_assignment.assignment_id, v_assignment.withdrawal_state_key, v_assignment.state_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_respond_withdrawal_assignment(
  p_assignment_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  withdrawal_state_key TEXT,
  state_version BIGINT,
  reassigned_assignment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment merchant_assignments%ROWTYPE;
  v_withdrawal withdrawal_requests%ROWTYPE;
  v_transition RECORD;
  v_reassign RECORD;
  v_auto_result RECORD;
  v_excluded UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Unsupported merchant action: %', p_action;
  END IF;

  SELECT ma.*
  INTO v_assignment
  FROM merchant_assignments ma
  JOIN merchant_profiles mp ON mp.id = ma.merchant_id
  WHERE ma.id = p_assignment_id
    AND (public.is_super_admin() OR mp.user_id = auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or not accessible.';
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = v_assignment.withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found for assignment.';
  END IF;

  IF p_action = 'accept' THEN
    IF v_assignment.assignment_status NOT IN ('assigned', 'reassigned') THEN
      RAISE EXCEPTION 'Assignment is not in an accept-able state: %', v_assignment.assignment_status;
    END IF;

    UPDATE merchant_assignments
    SET
      assignment_status = 'accepted',
      responded_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('accept_note', p_note)
    WHERE id = v_assignment.id;

    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      v_assignment.withdrawal_request_id,
      'merchant',
      'accept_assignment',
      'merchant_acknowledged',
      COALESCE(NULLIF(trim(COALESCE(p_idempotency_key, '')), ''), format('merchant-accept:%s', v_assignment.id::TEXT)),
      v_withdrawal.state_version,
      auth.uid(),
      v_assignment.id,
      p_note,
      jsonb_build_object('assignment_id', v_assignment.id)
    );

    INSERT INTO withdrawal_audit_logs (
      withdrawal_request_id,
      assignment_id,
      actor_type,
      actor_user_id,
      action_type,
      idempotency_key,
      payload
    )
    VALUES (
      v_assignment.withdrawal_request_id,
      v_assignment.id,
      'merchant',
      auth.uid(),
      'assignment_accept',
      p_idempotency_key,
      jsonb_build_object('note', p_note)
    );

    RETURN QUERY
    SELECT v_assignment.id, v_transition.withdrawal_state_key, v_transition.state_version, NULL::UUID;
    RETURN;
  END IF;

  IF v_assignment.assignment_status NOT IN ('assigned', 'reassigned', 'accepted') THEN
    RAISE EXCEPTION 'Assignment is not in a decline-able state: %', v_assignment.assignment_status;
  END IF;

  UPDATE merchant_assignments
  SET
    assignment_status = 'declined',
    decline_reason = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), 'merchant_declined'),
    responded_at = CURRENT_TIMESTAMP,
    resolved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_assignment.id;

  SELECT * INTO v_transition
  FROM transition_withdrawal_state(
    v_assignment.withdrawal_request_id,
    'merchant',
    'decline_assignment',
    'reassigning',
    COALESCE(NULLIF(trim(COALESCE(p_idempotency_key, '')), ''), format('merchant-decline:%s', v_assignment.id::TEXT)),
    v_withdrawal.state_version,
    auth.uid(),
    v_assignment.id,
    p_note,
    jsonb_build_object('assignment_id', v_assignment.id)
  );

  INSERT INTO withdrawal_reassignments (
    withdrawal_request_id,
    from_assignment_id,
    reason,
    status,
    requested_by_actor,
    requested_by_user_id,
    metadata
  )
  VALUES (
    v_assignment.withdrawal_request_id,
    v_assignment.id,
    COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), 'merchant_declined'),
    'pending',
    'merchant',
    auth.uid(),
    jsonb_build_object('source', 'merchant_respond_withdrawal_assignment')
  )
  RETURNING * INTO v_reassign;

  SELECT ARRAY_AGG(ma.merchant_id)
  INTO v_excluded
  FROM merchant_assignments ma
  WHERE ma.withdrawal_request_id = v_assignment.withdrawal_request_id
    AND ma.assignment_status IN ('declined', 'expired', 'failed', 'reassigned', 'cancelled');

  v_excluded := COALESCE(v_excluded, ARRAY[]::UUID[]) || ARRAY[v_assignment.merchant_id];

  SELECT * INTO v_auto_result
  FROM auto_assign_next_withdrawal_merchant(
    v_assignment.withdrawal_request_id,
    v_excluded,
    COALESCE(p_note, 'Merchant declined assignment')
  );

  UPDATE withdrawal_reassignments
  SET
    to_assignment_id = v_auto_result.assignment_id,
    status = CASE WHEN v_auto_result.assignment_id IS NULL THEN 'failed' ELSE 'completed' END,
    metadata = metadata || jsonb_build_object('result_state', v_auto_result.withdrawal_state_key),
    created_at = created_at
  WHERE id = v_reassign.id;

  RETURN QUERY
  SELECT v_assignment.id, v_auto_result.withdrawal_state_key, v_auto_result.state_version, v_auto_result.assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_mark_withdrawal_payout_sent(
  p_assignment_id UUID,
  p_payment_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  withdrawal_request_id UUID,
  assignment_id UUID,
  withdrawal_state_key TEXT,
  state_version BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment merchant_assignments%ROWTYPE;
  v_withdrawal withdrawal_requests%ROWTYPE;
  v_transition RECORD;
  v_user_transition RECORD;
  v_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT ma.*
  INTO v_assignment
  FROM merchant_assignments ma
  JOIN merchant_profiles mp ON mp.id = ma.merchant_id
  WHERE ma.id = p_assignment_id
    AND (public.is_super_admin() OR mp.user_id = auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or not accessible.';
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = v_assignment.withdrawal_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found for assignment.';
  END IF;

  IF v_assignment.assignment_status NOT IN ('accepted', 'assigned', 'reassigned') THEN
    RAISE EXCEPTION 'Assignment status does not allow payout sent action: %', v_assignment.assignment_status;
  END IF;

  IF v_assignment.payout_sent_at IS NOT NULL THEN
    RETURN QUERY
    SELECT v_withdrawal.id, v_assignment.id, v_withdrawal.workflow_state_key, v_withdrawal.state_version;
    RETURN;
  END IF;

  UPDATE merchant_assignments
  SET
    assignment_status = 'accepted',
    payout_sent_at = CURRENT_TIMESTAMP,
    payout_reference = NULLIF(trim(COALESCE(p_payment_reference, '')), ''),
    payout_note = p_note,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_assignment.id;

  INSERT INTO merchant_wallet_accounts (merchant_id, wallet_type, currency)
  VALUES
    (v_assignment.merchant_id, 'available', UPPER(v_withdrawal.currency)),
    (v_assignment.merchant_id, 'reserved', UPPER(v_withdrawal.currency)),
    (v_assignment.merchant_id, 'pending', UPPER(v_withdrawal.currency)),
    (v_assignment.merchant_id, 'locked', UPPER(v_withdrawal.currency))
  ON CONFLICT (merchant_id, wallet_type, currency) DO NOTHING;

  v_amount := ROUND(COALESCE(v_withdrawal.net_amount, v_withdrawal.amount), 2);

  INSERT INTO merchant_wallet_transactions (
    withdrawal_request_id,
    merchant_id,
    assignment_id,
    transaction_type,
    amount,
    currency,
    status,
    reference_id,
    metadata
  )
  VALUES (
    v_withdrawal.id,
    v_assignment.merchant_id,
    v_assignment.id,
    'credit_pending',
    v_amount,
    UPPER(v_withdrawal.currency),
    'pending',
    v_withdrawal.id::TEXT,
    jsonb_build_object('payment_reference', p_payment_reference, 'note', p_note)
  )
  ON CONFLICT (assignment_id, transaction_type) DO NOTHING;

  UPDATE merchant_wallet_accounts
  SET
    pending_balance = pending_balance + v_amount,
    updated_at = CURRENT_TIMESTAMP
  WHERE merchant_id = v_assignment.merchant_id
    AND wallet_type = 'available'
    AND UPPER(currency) = UPPER(v_withdrawal.currency);

  SELECT * INTO v_transition
  FROM transition_withdrawal_state(
    v_withdrawal.id,
    'merchant',
    'mark_payout_sent',
    'payout_sent',
    COALESCE(NULLIF(trim(COALESCE(p_idempotency_key, '')), ''), format('merchant-payout-sent:%s', v_assignment.id::TEXT)),
    v_withdrawal.state_version,
    auth.uid(),
    v_assignment.id,
    p_note,
    jsonb_build_object('payment_reference', p_payment_reference)
  );

  SELECT * INTO v_user_transition
  FROM transition_withdrawal_state(
    v_withdrawal.id,
    'system',
    'await_receipt_confirmation',
    'user_receipt_pending',
    format('system-await-receipt:%s:%s', v_withdrawal.id::TEXT, v_assignment.id::TEXT),
    v_transition.state_version,
    NULL,
    v_assignment.id,
    p_note,
    jsonb_build_object('payment_reference', p_payment_reference)
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
  VALUES (
    v_withdrawal.id,
    v_withdrawal.user_id,
    'withdrawal_user_receipt_pending',
    'in_app',
    'queued',
    CURRENT_TIMESTAMP,
    jsonb_build_object('assignment_id', v_assignment.id, 'payment_reference', p_payment_reference)
  );

  RETURN QUERY
  SELECT v_withdrawal.id, v_assignment.id, v_user_transition.withdrawal_state_key, v_user_transition.state_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_confirm_withdrawal_receipt(
  p_withdrawal_request_id UUID,
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  withdrawal_request_id UUID,
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
  v_assignment merchant_assignments%ROWTYPE;
  v_transition RECORD;
  v_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_request_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found for user.';
  END IF;

  IF v_withdrawal.workflow_state_key = 'completed' THEN
    RETURN QUERY
    SELECT v_withdrawal.id, v_withdrawal.active_assignment_id, v_withdrawal.workflow_state_key, v_withdrawal.state_version;
    RETURN;
  END IF;

  IF v_withdrawal.workflow_state_key <> 'user_receipt_pending' THEN
    RAISE EXCEPTION 'Withdrawal state % cannot be receipt-confirmed.', v_withdrawal.workflow_state_key;
  END IF;

  SELECT *
  INTO v_assignment
  FROM merchant_assignments
  WHERE id = v_withdrawal.active_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active merchant assignment is required for receipt confirmation.';
  END IF;

  SELECT * INTO v_transition
  FROM transition_withdrawal_state(
    v_withdrawal.id,
    'user',
    'confirm_receipt',
    'completed',
    COALESCE(NULLIF(trim(COALESCE(p_idempotency_key, '')), ''), format('user-confirm-receipt:%s', v_withdrawal.id::TEXT)),
    v_withdrawal.state_version,
    auth.uid(),
    v_assignment.id,
    p_note,
    jsonb_build_object('source', 'user_confirm_withdrawal_receipt')
  );

  UPDATE merchant_assignments
  SET
    assignment_status = 'completed',
    resolved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_assignment.id;

  v_amount := ROUND(COALESCE(v_withdrawal.net_amount, v_withdrawal.amount), 2);

  UPDATE merchant_wallet_transactions
  SET status = 'posted'
  WHERE assignment_id = v_assignment.id
    AND transaction_type = 'credit_pending'
    AND status = 'pending';

  INSERT INTO merchant_wallet_transactions (
    withdrawal_request_id,
    merchant_id,
    assignment_id,
    transaction_type,
    amount,
    currency,
    status,
    reference_id,
    metadata
  )
  VALUES (
    v_withdrawal.id,
    v_assignment.merchant_id,
    v_assignment.id,
    'credit_confirmed',
    v_amount,
    UPPER(v_withdrawal.currency),
    'posted',
    v_withdrawal.id::TEXT,
    jsonb_build_object('source', 'user_confirm_withdrawal_receipt')
  )
  ON CONFLICT (assignment_id, transaction_type) DO NOTHING;

  UPDATE merchant_wallet_accounts
  SET
    available_balance = available_balance + v_amount,
    pending_balance = GREATEST(0, pending_balance - v_amount),
    updated_at = CURRENT_TIMESTAMP
  WHERE merchant_id = v_assignment.merchant_id
    AND wallet_type = 'available'
    AND UPPER(currency) = UPPER(v_withdrawal.currency);

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
    v_assignment.merchant_id,
    v_withdrawal.id,
    v_assignment.id,
    'withdrawal_settlement_confirmed',
    'in_app',
    'queued',
    CURRENT_TIMESTAMP,
    jsonb_build_object('amount', v_amount, 'currency', UPPER(v_withdrawal.currency))
  );

  RETURN QUERY
  SELECT v_withdrawal.id, v_assignment.id, v_transition.withdrawal_state_key, v_transition.state_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_withdrawal_assignment_timeouts(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  processed_count INTEGER,
  reassigned_count INTEGER,
  failed_no_liquidity_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_processed INTEGER := 0;
  v_reassigned INTEGER := 0;
  v_failed INTEGER := 0;
  v_transition RECORD;
  v_result RECORD;
  v_excluded UUID[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'process_withdrawal_assignment_timeouts requires super_admin privileges.';
  END IF;

  FOR v_row IN
    SELECT
      ma.id AS assignment_id,
      ma.withdrawal_request_id,
      ma.merchant_id
    FROM merchant_assignments ma
    JOIN withdrawal_requests wr
      ON wr.id = ma.withdrawal_request_id
    WHERE ma.assignment_status IN ('assigned', 'reassigned')
      AND ma.due_at IS NOT NULL
      AND ma.due_at <= CURRENT_TIMESTAMP
      AND wr.workflow_state_key = 'merchant_assigned'
    ORDER BY ma.due_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  LOOP
    v_processed := v_processed + 1;

    UPDATE merchant_assignments
    SET
      assignment_status = 'expired',
      resolved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = v_row.assignment_id;

    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      v_row.withdrawal_request_id,
      'system',
      'assignment_timeout',
      'timed_out',
      format('timeout-expired:%s', v_row.assignment_id::TEXT),
      NULL,
      NULL,
      v_row.assignment_id,
      'Merchant did not accept assignment within configured window.',
      jsonb_build_object('assignment_id', v_row.assignment_id)
    );

    SELECT * INTO v_transition
    FROM transition_withdrawal_state(
      v_row.withdrawal_request_id,
      'system',
      'trigger_reassignment',
      'reassigning',
      format('timeout-reassign:%s', v_row.assignment_id::TEXT),
      v_transition.state_version,
      NULL,
      v_row.assignment_id,
      'Auto reassignment triggered after timeout.',
      jsonb_build_object('assignment_id', v_row.assignment_id)
    );

    SELECT ARRAY_AGG(ma.merchant_id)
    INTO v_excluded
    FROM merchant_assignments ma
    WHERE ma.withdrawal_request_id = v_row.withdrawal_request_id
      AND ma.assignment_status IN ('declined', 'expired', 'failed', 'reassigned', 'cancelled');

    v_excluded := COALESCE(v_excluded, ARRAY[]::UUID[]) || ARRAY[v_row.merchant_id];

    SELECT * INTO v_result
    FROM auto_assign_next_withdrawal_merchant(
      v_row.withdrawal_request_id,
      v_excluded,
      'Auto reassignment after assignment timeout'
    );

    INSERT INTO withdrawal_reassignments (
      withdrawal_request_id,
      from_assignment_id,
      to_assignment_id,
      reason,
      status,
      requested_by_actor,
      metadata
    )
    VALUES (
      v_row.withdrawal_request_id,
      v_row.assignment_id,
      v_result.assignment_id,
      'assignment_timeout',
      CASE WHEN v_result.assignment_id IS NULL THEN 'failed' ELSE 'completed' END,
      'system',
      jsonb_build_object('result_state', v_result.withdrawal_state_key)
    );

    IF v_result.assignment_id IS NULL THEN
      v_failed := v_failed + 1;
    ELSE
      v_reassigned := v_reassigned + 1;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT v_processed, v_reassigned, v_failed;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_merchant_withdrawal_assignments(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  assignment_id UUID,
  withdrawal_request_id UUID,
  assignment_status TEXT,
  assignment_sequence INTEGER,
  assigned_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  payout_sent_at TIMESTAMPTZ,
  payout_reference TEXT,
  amount NUMERIC,
  net_amount NUMERIC,
  currency TEXT,
  workflow_state_key TEXT,
  destination_label TEXT,
  destination_value TEXT,
  user_id UUID,
  user_display_name TEXT,
  user_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ma.id AS assignment_id,
    ma.withdrawal_request_id,
    ma.assignment_status,
    ma.assignment_sequence,
    ma.assigned_at,
    ma.due_at,
    ma.payout_sent_at,
    ma.payout_reference,
    wr.amount,
    wr.net_amount,
    wr.currency,
    wr.workflow_state_key,
    wr.destination_label,
    wr.destination_value,
    wr.user_id,
    COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(p.email), ''), wr.user_id::TEXT) AS user_display_name,
    p.email AS user_email
  FROM merchant_assignments ma
  JOIN withdrawal_requests wr ON wr.id = ma.withdrawal_request_id
  JOIN merchant_profiles mp ON mp.id = ma.merchant_id
  LEFT JOIN profiles p ON p.id = wr.user_id
  WHERE public.is_super_admin() OR mp.user_id = auth.uid()
  ORDER BY ma.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.list_user_withdrawal_receipt_queue(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  withdrawal_request_id UUID,
  amount NUMERIC,
  net_amount NUMERIC,
  currency TEXT,
  workflow_state_key TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  assignment_id UUID,
  assignment_status TEXT,
  payout_sent_at TIMESTAMPTZ,
  payout_reference TEXT,
  merchant_id UUID,
  merchant_code TEXT,
  merchant_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wr.id AS withdrawal_request_id,
    wr.amount,
    wr.net_amount,
    wr.currency,
    wr.workflow_state_key,
    wr.scheduled_for,
    wr.created_at,
    ma.id AS assignment_id,
    ma.assignment_status,
    ma.payout_sent_at,
    ma.payout_reference,
    mp.id AS merchant_id,
    mp.merchant_code,
    COALESCE(NULLIF(trim(mp.display_name), ''), NULLIF(trim(mp.legal_name), ''), mp.merchant_code) AS merchant_name
  FROM withdrawal_requests wr
  LEFT JOIN merchant_assignments ma ON ma.id = wr.active_assignment_id
  LEFT JOIN merchant_profiles mp ON mp.id = ma.merchant_id
  WHERE wr.user_id = auth.uid()
    AND wr.workflow_state_key IN ('payout_sent', 'user_receipt_pending', 'under_review', 'disputed', 'completed')
  ORDER BY wr.updated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_withdrawal_action(
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
  v_acceptance_minutes INTEGER := GREATEST(1, ROUND(public.get_withdrawal_runtime_setting_numeric('withdrawal_assignment_acceptance_minutes', 15))::INTEGER);
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
      CURRENT_TIMESTAMP + make_interval(mins => v_acceptance_minutes)
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

GRANT EXECUTE ON FUNCTION get_withdrawal_runtime_setting_numeric(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_assign_next_withdrawal_merchant(UUID, UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION merchant_respond_withdrawal_assignment(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION merchant_mark_withdrawal_payout_sent(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_confirm_withdrawal_receipt(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_withdrawal_assignment_timeouts(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION list_merchant_withdrawal_assignments(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION list_user_withdrawal_receipt_queue(INTEGER) TO authenticated;
