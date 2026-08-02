-- 040_membership_automation_and_gateway_orchestration.sql
-- Adds membership automation job runners, scheduling hooks, and gateway event normalization.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS membership_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'running',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_job_runs_unique_day
  ON membership_job_runs(job_key, run_date);

CREATE TABLE IF NOT EXISTS membership_gateway_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_key, event_type, payment_reference)
);

CREATE INDEX IF NOT EXISTS idx_membership_gateway_events_provider_reference
  ON membership_gateway_events(provider_key, payment_reference, created_at DESC);

CREATE OR REPLACE FUNCTION public.ingest_membership_gateway_event(
  p_provider_key TEXT,
  p_event_type TEXT,
  p_reference TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO membership_gateway_events (provider_key, event_type, payment_reference, payload)
  VALUES (p_provider_key, p_event_type, p_reference, COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (provider_key, event_type, payment_reference) DO UPDATE
  SET payload = EXCLUDED.payload
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_membership_reward_cycle_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  INSERT INTO membership_job_runs (job_key, run_date, status, details)
  VALUES ('membership_reward_cycle', CURRENT_DATE, 'running', '{}'::jsonb)
  ON CONFLICT (job_key, run_date) DO UPDATE SET status = 'running', updated_at = CURRENT_TIMESTAMP;

  INSERT INTO membership_reward_cycles (user_id, cycle_day, daily_percent, target_wallet, amount, status)
  SELECT
    p.id,
    1,
    10,
    'main_wallet',
    ROUND(COALESCE(p.wallet_balance, 0) * 0.10, 2),
    'pending'
  FROM profiles p
  WHERE p.status = 'active'
    AND COALESCE(p.level_tier, 1) >= 2
    AND NOT EXISTS (
      SELECT 1
      FROM membership_reward_cycles rc
      WHERE rc.user_id = p.id
        AND DATE(rc.created_at) = CURRENT_DATE
    );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE membership_job_runs
  SET
    status = 'completed',
    details = jsonb_build_object('cycles_inserted', v_inserted_count),
    finished_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE job_key = 'membership_reward_cycle' AND run_date = CURRENT_DATE;

  RETURN jsonb_build_object('ok', true, 'cycles_inserted', v_inserted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_membership_workflow_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marked_count INTEGER := 0;
BEGIN
  INSERT INTO membership_job_runs (job_key, run_date, status, details)
  VALUES ('membership_workflow_executor', CURRENT_DATE, 'running', '{}'::jsonb)
  ON CONFLICT (job_key, run_date) DO UPDATE SET status = 'running', updated_at = CURRENT_TIMESTAMP;

  UPDATE membership_upgrade_events
  SET execution_status = 'processed', updated_at = CURRENT_TIMESTAMP
  WHERE execution_status = 'pending';

  GET DIAGNOSTICS v_marked_count = ROW_COUNT;

  UPDATE membership_job_runs
  SET
    status = 'completed',
    details = jsonb_build_object('upgrade_events_processed', v_marked_count),
    finished_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE job_key = 'membership_workflow_executor' AND run_date = CURRENT_DATE;

  RETURN jsonb_build_object('ok', true, 'upgrade_events_processed', v_marked_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_membership_fee_invoice_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold INTEGER := 2;
  v_inserted_count INTEGER := 0;
BEGIN
  SELECT COALESCE((value #>> '{}')::INTEGER, 2)
  INTO v_threshold
  FROM platform_settings
  WHERE key = 'membership_fee_enforce_from_withdrawal_count';

  v_threshold := GREATEST(1, COALESCE(v_threshold, 2));

  INSERT INTO membership_job_runs (job_key, run_date, status, details)
  VALUES ('membership_fee_invoice', CURRENT_DATE, 'running', jsonb_build_object('threshold', v_threshold))
  ON CONFLICT (job_key, run_date) DO UPDATE SET status = 'running', updated_at = CURRENT_TIMESTAMP;

  INSERT INTO membership_fee_invoices (user_id, fee_cycle_key, amount, currency, status, due_at)
  SELECT
    wr.user_id,
    CONCAT('auto-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD')),
    ROUND(COALESCE(p.wallet_balance, 0) * 0.02, 2),
    'NGN',
    'unpaid',
    CURRENT_TIMESTAMP + INTERVAL '7 days'
  FROM profiles p
  JOIN (
    SELECT user_id, COUNT(*)::INTEGER AS successful_withdrawals
    FROM withdrawal_requests
    WHERE status IN ('approved', 'completed')
    GROUP BY user_id
  ) wr ON wr.user_id = p.id
  WHERE wr.successful_withdrawals >= v_threshold
    AND COALESCE(p.level_tier, 1) >= 2
    AND NOT EXISTS (
      SELECT 1
      FROM membership_fee_invoices fi
      WHERE fi.user_id = p.id
        AND fi.fee_cycle_key = CONCAT('auto-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD'))
    );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE membership_job_runs
  SET
    status = 'completed',
    details = jsonb_build_object('invoices_inserted', v_inserted_count, 'threshold', v_threshold),
    finished_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE job_key = 'membership_fee_invoice' AND run_date = CURRENT_DATE;

  RETURN jsonb_build_object('ok', true, 'invoices_inserted', v_inserted_count, 'threshold', v_threshold);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_membership_daily_analytics_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_members INTEGER := 0;
  v_paid_members INTEGER := 0;
  v_pending_upgrades INTEGER := 0;
  v_active_multipliers INTEGER := 0;
  v_fee_delinquent INTEGER := 0;
  v_top_plan_level INTEGER := 1;
  v_top_plan_label TEXT := 'Starter';
BEGIN
  INSERT INTO membership_job_runs (job_key, run_date, status, details)
  VALUES ('membership_daily_analytics', CURRENT_DATE, 'running', '{}'::jsonb)
  ON CONFLICT (job_key, run_date) DO UPDATE SET status = 'running', updated_at = CURRENT_TIMESTAMP;

  SELECT COUNT(*)::INTEGER INTO v_total_members FROM profiles;
  SELECT COUNT(*)::INTEGER INTO v_paid_members FROM profiles WHERE COALESCE(level_tier, 1) >= 2;
  SELECT COUNT(*)::INTEGER INTO v_pending_upgrades FROM membership_upgrade_events WHERE execution_status = 'pending';
  SELECT COUNT(*)::INTEGER INTO v_active_multipliers FROM membership_multiplier_orders WHERE status = 'paid';
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_fee_delinquent FROM membership_fee_invoices WHERE status = 'unpaid';

  SELECT COALESCE(level_tier, 1), COALESCE(level_label, 'Starter')
  INTO v_top_plan_level, v_top_plan_label
  FROM profiles
  GROUP BY level_tier, level_label
  ORDER BY COUNT(*) DESC, COALESCE(level_tier, 1) DESC
  LIMIT 1;

  INSERT INTO membership_daily_analytics (
    report_date,
    total_members,
    paid_members,
    pending_upgrades,
    active_multipliers,
    fee_delinquent_members,
    top_plan_level,
    top_plan_label,
    metadata,
    updated_at
  )
  VALUES (
    CURRENT_DATE,
    v_total_members,
    v_paid_members,
    v_pending_upgrades,
    v_active_multipliers,
    v_fee_delinquent,
    v_top_plan_level,
    v_top_plan_label,
    jsonb_build_object('generated_by', 'run_membership_daily_analytics_job'),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (report_date) DO UPDATE
  SET
    total_members = EXCLUDED.total_members,
    paid_members = EXCLUDED.paid_members,
    pending_upgrades = EXCLUDED.pending_upgrades,
    active_multipliers = EXCLUDED.active_multipliers,
    fee_delinquent_members = EXCLUDED.fee_delinquent_members,
    top_plan_level = EXCLUDED.top_plan_level,
    top_plan_label = EXCLUDED.top_plan_label,
    metadata = EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP;

  UPDATE membership_job_runs
  SET
    status = 'completed',
    details = jsonb_build_object(
      'total_members', v_total_members,
      'paid_members', v_paid_members,
      'pending_upgrades', v_pending_upgrades,
      'active_multipliers', v_active_multipliers,
      'fee_delinquent_members', v_fee_delinquent
    ),
    finished_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE job_key = 'membership_daily_analytics' AND run_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'ok', true,
    'total_members', v_total_members,
    'paid_members', v_paid_members,
    'pending_upgrades', v_pending_upgrades,
    'active_multipliers', v_active_multipliers,
    'fee_delinquent_members', v_fee_delinquent
  );
END;
$$;

ALTER TABLE membership_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_gateway_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_job_runs_admin_only ON membership_job_runs;
CREATE POLICY membership_job_runs_admin_only ON membership_job_runs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_gateway_events_admin_only ON membership_gateway_events;
CREATE POLICY membership_gateway_events_admin_only ON membership_gateway_events
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('membership-reward-cycle-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('membership-workflow-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('membership-fee-invoice-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('membership-daily-analytics-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END
$$;

SELECT cron.schedule(
  'membership-reward-cycle-job',
  '0 1 * * *',
  $$SELECT public.run_membership_reward_cycle_job();$$
);

SELECT cron.schedule(
  'membership-workflow-job',
  '*/30 * * * *',
  $$SELECT public.run_membership_workflow_job();$$
);

SELECT cron.schedule(
  'membership-fee-invoice-job',
  '15 1 * * *',
  $$SELECT public.run_membership_fee_invoice_job();$$
);

SELECT cron.schedule(
  'membership-daily-analytics-job',
  '30 1 * * *',
  $$SELECT public.run_membership_daily_analytics_job();$$
);
