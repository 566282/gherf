-- 037_membership_lifecycle_phases_6_13.sql
-- Foundation schema for phases 6-13: upgrade lifecycle, multiplier module,
-- fee compliance, workflow definitions, gateway routing, analytics, and rollout controls.

CREATE TABLE IF NOT EXISTS membership_upgrade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_level INTEGER NOT NULL CHECK (from_level >= 1),
  to_level INTEGER NOT NULL CHECK (to_level >= 1),
  trigger_type TEXT NOT NULL,
  trigger_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  execution_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_multiplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_level INTEGER NOT NULL CHECK (plan_level >= 1),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_provider TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_fee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fee_cycle_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'unpaid',
  due_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fee_cycle_key)
);

CREATE TABLE IF NOT EXISTS membership_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_key, version)
);

CREATE TABLE IF NOT EXISTS membership_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id UUID NOT NULL REFERENCES membership_workflow_definitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}'::JSONB,
  current_state TEXT NOT NULL,
  trace JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_gateway_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rank_order INTEGER NOT NULL DEFAULT 100,
  supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['NGN'],
  max_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_rollout_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'shadow',
  rollout_percent INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  total_members INTEGER NOT NULL DEFAULT 0,
  paid_members INTEGER NOT NULL DEFAULT 0,
  pending_upgrades INTEGER NOT NULL DEFAULT 0,
  active_multipliers INTEGER NOT NULL DEFAULT 0,
  fee_delinquent_members INTEGER NOT NULL DEFAULT 0,
  top_plan_level INTEGER NOT NULL DEFAULT 1,
  top_plan_label TEXT NOT NULL DEFAULT 'Starter',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_date)
);

CREATE INDEX IF NOT EXISTS idx_membership_upgrade_events_user_created
  ON membership_upgrade_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_multiplier_orders_user_created
  ON membership_multiplier_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_fee_invoices_user_status
  ON membership_fee_invoices(user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_membership_workflow_definitions_key_status
  ON membership_workflow_definitions(workflow_key, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_workflow_runs_definition_created
  ON membership_workflow_runs(workflow_definition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_gateway_registry_active_rank
  ON membership_gateway_registry(is_active, rank_order);

CREATE INDEX IF NOT EXISTS idx_membership_daily_analytics_report_date
  ON membership_daily_analytics(report_date DESC);

INSERT INTO membership_rollout_flags (flag_key, mode, rollout_percent, metadata)
VALUES
  ('membership_rules_engine_v2', 'progressive', 20, '{"phase":"13","notes":"progressive shadow rollout"}'::JSONB)
ON CONFLICT (flag_key) DO NOTHING;

INSERT INTO platform_settings (key, value, description)
VALUES
  ('wallet_paid_membership_min_tier', '2'::jsonb, 'Minimum membership tier required for withdrawals'),
  ('wallet_withdrawal_hold_threshold', '4'::jsonb, 'Successful withdrawals before hold is applied'),
  ('membership_fee_enforce_from_withdrawal_count', '2'::jsonb, 'Withdrawal count from which fee settlement enforcement starts'),
  ('membership_fee_block_without_settlement', 'false'::jsonb, 'Block withdrawals when a membership fee invoice remains unpaid')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE membership_upgrade_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_multiplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_gateway_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_rollout_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_daily_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_upgrade_events_user_or_admin_read ON membership_upgrade_events;
CREATE POLICY membership_upgrade_events_user_or_admin_read ON membership_upgrade_events
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS membership_upgrade_events_admin_write ON membership_upgrade_events;
CREATE POLICY membership_upgrade_events_admin_write ON membership_upgrade_events
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_multiplier_orders_user_or_admin_read ON membership_multiplier_orders;
CREATE POLICY membership_multiplier_orders_user_or_admin_read ON membership_multiplier_orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS membership_multiplier_orders_user_or_admin_write ON membership_multiplier_orders;
CREATE POLICY membership_multiplier_orders_user_or_admin_write ON membership_multiplier_orders
  FOR ALL USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS membership_fee_invoices_user_or_admin_read ON membership_fee_invoices;
CREATE POLICY membership_fee_invoices_user_or_admin_read ON membership_fee_invoices
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS membership_fee_invoices_admin_write ON membership_fee_invoices;
CREATE POLICY membership_fee_invoices_admin_write ON membership_fee_invoices
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_workflow_definitions_admin_only ON membership_workflow_definitions;
CREATE POLICY membership_workflow_definitions_admin_only ON membership_workflow_definitions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_workflow_runs_admin_read ON membership_workflow_runs;
CREATE POLICY membership_workflow_runs_admin_read ON membership_workflow_runs
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS membership_workflow_runs_admin_write ON membership_workflow_runs;
CREATE POLICY membership_workflow_runs_admin_write ON membership_workflow_runs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_gateway_registry_admin_only ON membership_gateway_registry;
CREATE POLICY membership_gateway_registry_admin_only ON membership_gateway_registry
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_rollout_flags_admin_only ON membership_rollout_flags;
CREATE POLICY membership_rollout_flags_admin_only ON membership_rollout_flags
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_daily_analytics_admin_read ON membership_daily_analytics;
CREATE POLICY membership_daily_analytics_admin_read ON membership_daily_analytics
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS membership_daily_analytics_admin_write ON membership_daily_analytics;
CREATE POLICY membership_daily_analytics_admin_write ON membership_daily_analytics
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
