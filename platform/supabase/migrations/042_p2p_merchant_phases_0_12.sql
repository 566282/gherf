-- 042_p2p_merchant_phases_0_12.sql
-- Implements phase 0-12 foundation for data-driven fiat intents, P2P merchant routing,
-- merchant qualification, escrow lifecycle, disputes, compliance, risk, SLA, analytics,
-- and admin rollout controls.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================
-- Phase 0-1: Fiat intent + fee engine
-- =============================

CREATE TABLE IF NOT EXISTS fiat_payment_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL UNIQUE,
  provider_class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  rank_order INTEGER NOT NULL DEFAULT 100,
  supported_modules TEXT[] NOT NULL DEFAULT ARRAY['membership'],
  supported_countries TEXT[] NOT NULL DEFAULT ARRAY['*'],
  supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD'],
  fallback_chain TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (provider_class IN ('direct_gateway', 'p2p_merchant', 'hybrid')),
  CHECK (status IN ('active', 'paused', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_fiat_provider_active_rank
  ON fiat_payment_provider_settings(status, rank_order);

CREATE TABLE IF NOT EXISTS fiat_platform_fee_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  fee_model TEXT NOT NULL,
  applies_to_modules TEXT[] NOT NULL DEFAULT ARRAY['*'],
  applies_to_intent_types TEXT[] NOT NULL DEFAULT ARRAY['*'],
  countries TEXT[] NOT NULL DEFAULT ARRAY['*'],
  currencies TEXT[] NOT NULL DEFAULT ARRAY['USD'],
  min_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14,2),
  fixed_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  percent_fee NUMERIC(8,4) NOT NULL DEFAULT 0,
  waiver_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  CHECK (fee_model IN ('fixed', 'percentage', 'hybrid')),
  CHECK (fixed_fee >= 0),
  CHECK (percent_fee >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fiat_fee_policies_active
  ON fiat_platform_fee_policies(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS fiat_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  source_reference TEXT,
  amount NUMERIC(14,2) NOT NULL,
  fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  country_code TEXT,
  provider_key TEXT NOT NULL,
  fallback_chain TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'created',
  eta_minutes INTEGER,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, module_key, intent_type, idempotency_key),
  CHECK (status IN ('created', 'pending', 'processing', 'paid', 'failed', 'expired', 'cancelled')),
  CHECK (amount >= 0),
  CHECK (fee_amount >= 0),
  CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fiat_payment_intents_user_created
  ON fiat_payment_intents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiat_payment_intents_provider_status
  ON fiat_payment_intents(provider_key, status, created_at DESC);

INSERT INTO fiat_payment_provider_settings (
  provider_key,
  provider_class,
  status,
  rank_order,
  supported_modules,
  supported_currencies,
  fallback_chain,
  config
)
VALUES
  (
    'p2p_merchant',
    'p2p_merchant',
    'active',
    10,
    ARRAY['membership', 'wallet_funding', 'premium_features', 'membership_multiplier', 'membership_fee_settlement', 'promotional_purchase'],
    ARRAY['USD', 'NGN', 'EUR', 'GBP'],
    ARRAY['direct_gateway_primary'],
    jsonb_build_object('supports_escrow', true)
  ),
  (
    'direct_gateway_primary',
    'direct_gateway',
    'active',
    20,
    ARRAY['*'],
    ARRAY['USD', 'NGN', 'EUR', 'GBP'],
    ARRAY[]::TEXT[],
    jsonb_build_object('legacy_membership_registry_bridge', true)
  )
ON CONFLICT (provider_key) DO NOTHING;

INSERT INTO fiat_platform_fee_policies (
  policy_key,
  status,
  fee_model,
  applies_to_modules,
  applies_to_intent_types,
  countries,
  currencies,
  min_amount,
  fixed_fee,
  percent_fee,
  metadata
)
VALUES
  (
    'default_global_hybrid_fee',
    'active',
    'hybrid',
    ARRAY['*'],
    ARRAY['*'],
    ARRAY['*'],
    ARRAY['USD', 'NGN', 'EUR', 'GBP'],
    0,
    0.30,
    1.25,
    jsonb_build_object('description', 'Default baseline fee policy')
  )
ON CONFLICT (policy_key) DO NOTHING;

INSERT INTO platform_settings (key, value, description)
VALUES
  ('fiat_default_provider_key', '"p2p_merchant"'::jsonb, 'Default fiat provider key'),
  ('fiat_provider_fallback_chain', '["direct_gateway_primary"]'::jsonb, 'Provider fallback chain if default route fails'),
  ('p2p_rollout_mode', '"progressive"'::jsonb, 'P2P rollout mode: shadow/progressive/enforced'),
  ('p2p_rollout_percent', '20'::jsonb, 'P2P progressive rollout percentage'),
  ('p2p_shadow_mode', 'true'::jsonb, 'Run matching and decision traces without hard enforcement'),
  ('p2p_dispute_auto_escalation_hours', '6'::jsonb, 'Dispute auto escalation threshold in hours')
ON CONFLICT (key) DO NOTHING;

-- =============================
-- Phase 2-3: Merchant wallet + qualification
-- =============================

CREATE TABLE IF NOT EXISTS merchant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_code TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_qualification',
  region_code TEXT,
  country_code TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  risk_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  response_sla_seconds INTEGER NOT NULL DEFAULT 900,
  completion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  rating_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending_qualification', 'active', 'disabled', 'suspended', 'under_review', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_profiles_status_country
  ON merchant_profiles(status, country_code, preferred_currency);

CREATE TABLE IF NOT EXISTS merchant_kyc_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'required',
  level_required INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id, requirement_key),
  CHECK (status IN ('required', 'submitted', 'approved', 'rejected', 'expired', 'waived'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_kyc_status
  ON merchant_kyc_requirements(merchant_id, status, level_required);

CREATE TABLE IF NOT EXISTS merchant_qualification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 100,
  criteria JSONB NOT NULL,
  outcome_on_fail TEXT NOT NULL DEFAULT 'disable',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  CHECK (outcome_on_fail IN ('disable', 'suspend', 'review'))
);

CREATE TABLE IF NOT EXISTS merchant_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  reason TEXT,
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL,
  currency TEXT NOT NULL,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserved_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id, wallet_type, currency),
  CHECK (wallet_type IN ('available', 'reserved', 'pending', 'locked'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_wallet_accounts_merchant
  ON merchant_wallet_accounts(merchant_id, currency);

CREATE TABLE IF NOT EXISTS merchant_wallet_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  wallet_account_id UUID REFERENCES merchant_wallet_accounts(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (entry_type IN ('top_up', 'withdrawal', 'hold', 'release', 'reserve', 'settlement', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_wallet_ledgers_merchant_created
  ON merchant_wallet_ledgers(merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_wallet_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  wallet_account_id UUID REFERENCES merchant_wallet_accounts(id) ON DELETE SET NULL,
  hold_reason TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  release_reason TEXT,
  released_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'released', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_wallet_holds_active
  ON merchant_wallet_holds(merchant_id, status, created_at DESC);

INSERT INTO merchant_qualification_rules (rule_key, status, priority, criteria, outcome_on_fail, metadata)
VALUES
  (
    'merchant_kyc_mandatory',
    'active',
    10,
    jsonb_build_object('type', 'kyc_required', 'required_status', 'approved'),
    'disable',
    jsonb_build_object('description', 'All required KYC documents must be approved')
  ),
  (
    'merchant_min_available_balance',
    'active',
    20,
    jsonb_build_object('type', 'min_available_balance', 'amount', 100, 'currency', 'USD'),
    'disable',
    jsonb_build_object('description', 'Merchant must maintain minimum operating balance')
  ),
  (
    'merchant_risk_threshold',
    'active',
    30,
    jsonb_build_object('type', 'max_risk_score', 'score', 80),
    'review',
    jsonb_build_object('description', 'High-risk merchants are routed to manual review')
  )
ON CONFLICT (rule_key) DO NOTHING;

-- =============================
-- Phase 4-8: Matching + order lifecycle + liquidity/SLA
-- =============================

CREATE TABLE IF NOT EXISTS merchant_matching_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  version TEXT NOT NULL DEFAULT 'v1',
  criteria JSONB NOT NULL,
  scoring_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  reassignment_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'draft', 'paused', 'archived'))
);

INSERT INTO merchant_matching_policies (
  policy_key,
  status,
  version,
  criteria,
  scoring_weights,
  reassignment_strategy,
  metadata
)
VALUES
  (
    'default_p2p_matching_v1',
    'active',
    'v1',
    jsonb_build_object(
      'require_active_status', true,
      'currency_match', true,
      'country_match', true,
      'min_available_balance', true,
      'respect_daily_capacity', true,
      'max_risk_score', 80
    ),
    jsonb_build_object(
      'liquidity', 0.35,
      'rating', 0.15,
      'completion_rate', 0.20,
      'response_sla', 0.10,
      'risk', 0.20
    ),
    jsonb_build_object('max_retries', 3, 'retry_delay_seconds', 60),
    jsonb_build_object('description', 'Deterministic weighted matching policy')
  )
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS merchant_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES merchant_matching_policies(id) ON DELETE SET NULL,
  decision TEXT NOT NULL,
  score NUMERIC(10,4),
  reason_code TEXT,
  trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (decision IN ('assigned', 'reassigned', 'no_liquidity', 'shadow_only', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_assignment_events_order
  ON merchant_assignment_events(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  payment_intent_id UUID REFERENCES fiat_payment_intents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  module_key TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  country_code TEXT,
  current_state TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  sla_deadline_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_user_created
  ON p2p_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_merchant_state
  ON p2p_orders(merchant_id, current_state, created_at DESC);

CREATE TABLE IF NOT EXISTS p2p_order_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  role_actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS p2p_order_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_key TEXT NOT NULL UNIQUE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  allowed_actor_roles TEXT[] NOT NULL DEFAULT ARRAY['user', 'merchant', 'admin', 'system'],
  requires_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  requires_idempotency BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_transitions_from_state
  ON p2p_order_state_transitions(from_state, to_state);

CREATE TABLE IF NOT EXISTS p2p_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  payment_reference TEXT,
  bank_reference TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (proof_type IN ('bank_transfer_receipt', 'transaction_id', 'manual_note', 'other'))
);

CREATE TABLE IF NOT EXISTS p2p_escrow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (event_type IN ('reserve', 'release', 'refund', 'settle', 'penalty')),
  CHECK (status IN ('applied', 'reverted', 'failed'))
);

CREATE TABLE IF NOT EXISTS p2p_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  assignment_ack_seconds INTEGER NOT NULL DEFAULT 300,
  payment_confirmation_seconds INTEGER NOT NULL DEFAULT 900,
  escalation_seconds INTEGER NOT NULL DEFAULT 1200,
  max_reassignments INTEGER NOT NULL DEFAULT 3,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'draft', 'paused', 'archived'))
);

CREATE TABLE IF NOT EXISTS p2p_sla_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  sla_policy_id UUID REFERENCES p2p_sla_policies(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (event_type IN ('assignment_ack', 'payment_confirmation', 'escalation')),
  CHECK (status IN ('open', 'met', 'breached', 'escalated', 'closed'))
);

CREATE TABLE IF NOT EXISTS p2p_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  CHECK (status IN ('active', 'draft', 'paused', 'archived'))
);

CREATE TABLE IF NOT EXISTS p2p_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  template_key TEXT,
  channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  CHECK (delivery_status IN ('queued', 'sent', 'failed', 'skipped'))
);

INSERT INTO p2p_sla_policies (
  policy_key,
  status,
  assignment_ack_seconds,
  payment_confirmation_seconds,
  escalation_seconds,
  max_reassignments,
  metadata
)
VALUES
  (
    'default_sla_v1',
    'active',
    300,
    900,
    1200,
    3,
    jsonb_build_object('description', 'Default merchant SLA configuration')
  )
ON CONFLICT (policy_key) DO NOTHING;

INSERT INTO p2p_order_states (state_key, label, is_terminal, role_actions, metadata)
VALUES
  ('created', 'Created', false, jsonb_build_object('user', jsonb_build_array('cancel')), '{}'::jsonb),
  ('merchant_assigned', 'Merchant Assigned', false, jsonb_build_object('merchant', jsonb_build_array('acknowledge')), '{}'::jsonb),
  ('awaiting_payment', 'Awaiting Payment', false, jsonb_build_object('user', jsonb_build_array('i_have_paid')), '{}'::jsonb),
  ('payment_submitted', 'Payment Submitted', false, jsonb_build_object('merchant', jsonb_build_array('confirm_payment', 'report_issue')), '{}'::jsonb),
  ('awaiting_merchant_confirmation', 'Awaiting Merchant Confirmation', false, jsonb_build_object('merchant', jsonb_build_array('confirm_payment')), '{}'::jsonb),
  ('confirmed', 'Confirmed', false, jsonb_build_object('system', jsonb_build_array('complete')), '{}'::jsonb),
  ('completed', 'Completed', true, '{}'::jsonb, '{}'::jsonb),
  ('expired', 'Expired', true, '{}'::jsonb, '{}'::jsonb),
  ('cancelled', 'Cancelled', true, '{}'::jsonb, '{}'::jsonb),
  ('disputed', 'Disputed', false, jsonb_build_object('admin', jsonb_build_array('review')), '{}'::jsonb),
  ('under_review', 'Under Review', false, jsonb_build_object('admin', jsonb_build_array('release', 'refund')), '{}'::jsonb),
  ('refunded', 'Refunded', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (state_key) DO NOTHING;

INSERT INTO p2p_order_state_transitions (
  transition_key,
  from_state,
  to_state,
  allowed_actor_roles,
  requires_evidence,
  requires_idempotency,
  metadata
)
VALUES
  ('created_to_merchant_assigned', 'created', 'merchant_assigned', ARRAY['system', 'admin'], false, true, '{}'::jsonb),
  ('merchant_assigned_to_awaiting_payment', 'merchant_assigned', 'awaiting_payment', ARRAY['system', 'merchant', 'admin'], false, true, '{}'::jsonb),
  ('awaiting_payment_to_payment_submitted', 'awaiting_payment', 'payment_submitted', ARRAY['user', 'admin'], true, true, '{}'::jsonb),
  ('payment_submitted_to_awaiting_merchant_confirmation', 'payment_submitted', 'awaiting_merchant_confirmation', ARRAY['system', 'admin'], false, true, '{}'::jsonb),
  ('awaiting_merchant_confirmation_to_confirmed', 'awaiting_merchant_confirmation', 'confirmed', ARRAY['merchant', 'admin'], false, true, '{}'::jsonb),
  ('confirmed_to_completed', 'confirmed', 'completed', ARRAY['system', 'admin'], false, true, '{}'::jsonb),
  ('any_to_disputed', 'payment_submitted', 'disputed', ARRAY['user', 'merchant', 'admin'], true, true, '{}'::jsonb),
  ('disputed_to_under_review', 'disputed', 'under_review', ARRAY['admin', 'system'], false, true, '{}'::jsonb),
  ('under_review_to_refunded', 'under_review', 'refunded', ARRAY['admin', 'system'], false, true, '{}'::jsonb),
  ('awaiting_payment_to_expired', 'awaiting_payment', 'expired', ARRAY['system', 'admin'], false, true, '{}'::jsonb),
  ('created_to_cancelled', 'created', 'cancelled', ARRAY['user', 'admin', 'system'], false, true, '{}'::jsonb)
ON CONFLICT (transition_key) DO NOTHING;

-- =============================
-- Phase 7 + 10 + 11: Disputes, compliance, risk
-- =============================

CREATE TABLE IF NOT EXISTS p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES p2p_orders(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dispute_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_outcome TEXT,
  resolution_note TEXT,
  assigned_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('open', 'under_review', 'awaiting_evidence', 'resolved', 'closed')),
  CHECK (resolution_outcome IS NULL OR resolution_outcome IN ('release', 'refund', 'penalize', 'suspend'))
);

CREATE TABLE IF NOT EXISTS p2p_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES p2p_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  evidence_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (evidence_type IN ('image', 'document', 'bank_statement', 'transaction_log', 'text_note', 'other'))
);

CREATE TABLE IF NOT EXISTS p2p_dispute_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES p2p_disputes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (action_type IN ('open', 'request_evidence', 'review', 'release', 'refund', 'penalize', 'suspend', 'close'))
);

CREATE TABLE IF NOT EXISTS p2p_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  signal_value NUMERIC(10,4),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS p2p_velocity_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  window_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(actor_type, actor_id, window_key, window_start),
  CHECK (actor_type IN ('user', 'merchant', 'device', 'ip'))
);

CREATE TABLE IF NOT EXISTS p2p_fraud_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchant_profiles(id) ON DELETE SET NULL,
  score NUMERIC(8,4) NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'allow',
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (verdict IN ('allow', 'challenge', 'deny', 'review'))
);

-- =============================
-- Phase 9 + 12: Analytics + rollout controls
-- =============================

CREATE TABLE IF NOT EXISTS p2p_merchant_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  merchant_id UUID NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  assigned_orders INTEGER NOT NULL DEFAULT 0,
  completed_orders INTEGER NOT NULL DEFAULT 0,
  disputed_orders INTEGER NOT NULL DEFAULT 0,
  average_response_seconds NUMERIC(12,2) NOT NULL DEFAULT 0,
  completion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  earnings_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_date, merchant_id)
);

CREATE TABLE IF NOT EXISTS p2p_rollout_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL DEFAULT 'progressive',
  rollout_percent INTEGER NOT NULL DEFAULT 0,
  cohort_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  fallback_provider_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  CHECK (mode IN ('shadow', 'progressive', 'enforced')),
  CHECK (rollout_percent >= 0 AND rollout_percent <= 100)
);

INSERT INTO p2p_rollout_flags (
  flag_key,
  status,
  mode,
  rollout_percent,
  cohort_rule,
  fallback_provider_key,
  metadata
)
VALUES
  (
    'p2p_fiat_default_provider',
    'active',
    'progressive',
    20,
    jsonb_build_object('strategy', 'user_id_mod_percent'),
    'direct_gateway_primary',
    jsonb_build_object('description', 'Progressive rollout with direct gateway fallback')
  )
ON CONFLICT (flag_key) DO NOTHING;

-- =============================
-- Core RPCs
-- =============================

CREATE OR REPLACE FUNCTION public.resolve_default_fiat_provider(
  p_module_key TEXT,
  p_currency TEXT,
  p_country_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_provider TEXT;
  v_fallback_chain TEXT[] := ARRAY[]::TEXT[];
  v_selected_provider TEXT;
BEGIN
  SELECT value #>> '{}'
  INTO v_default_provider
  FROM platform_settings
  WHERE key = 'fiat_default_provider_key';

  SELECT ARRAY(SELECT jsonb_array_elements_text(value))
  INTO v_fallback_chain
  FROM platform_settings
  WHERE key = 'fiat_provider_fallback_chain';

  v_default_provider := COALESCE(NULLIF(v_default_provider, ''), 'direct_gateway_primary');

  SELECT provider_key
  INTO v_selected_provider
  FROM fiat_payment_provider_settings
  WHERE provider_key = v_default_provider
    AND status = 'active'
    AND (supported_modules @> ARRAY[p_module_key]::TEXT[] OR supported_modules @> ARRAY['*']::TEXT[])
    AND (supported_currencies @> ARRAY[UPPER(p_currency)]::TEXT[])
    AND (
      p_country_code IS NULL
      OR supported_countries @> ARRAY['*']::TEXT[]
      OR supported_countries @> ARRAY[UPPER(p_country_code)]::TEXT[]
    )
  LIMIT 1;

  IF v_selected_provider IS NULL THEN
    SELECT provider_key
    INTO v_selected_provider
    FROM fiat_payment_provider_settings
    WHERE status = 'active'
      AND (supported_modules @> ARRAY[p_module_key]::TEXT[] OR supported_modules @> ARRAY['*']::TEXT[])
      AND (supported_currencies @> ARRAY[UPPER(p_currency)]::TEXT[])
      AND (
        p_country_code IS NULL
        OR supported_countries @> ARRAY['*']::TEXT[]
        OR supported_countries @> ARRAY[UPPER(p_country_code)]::TEXT[]
      )
    ORDER BY rank_order ASC, updated_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'provider_key', COALESCE(v_selected_provider, v_default_provider),
    'fallback_chain', COALESCE(v_fallback_chain, ARRAY[]::TEXT[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_fiat_fee(
  p_user_id UUID,
  p_module_key TEXT,
  p_intent_type TEXT,
  p_country_code TEXT,
  p_currency TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy fiat_platform_fee_policies%ROWTYPE;
  v_fixed NUMERIC := 0;
  v_percent NUMERIC := 0;
  v_fee NUMERIC := 0;
  v_total NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_policy
  FROM fiat_platform_fee_policies
  WHERE status = 'active'
    AND (applies_to_modules @> ARRAY[p_module_key]::TEXT[] OR applies_to_modules @> ARRAY['*']::TEXT[])
    AND (applies_to_intent_types @> ARRAY[p_intent_type]::TEXT[] OR applies_to_intent_types @> ARRAY['*']::TEXT[])
    AND (countries @> ARRAY['*']::TEXT[] OR countries @> ARRAY[UPPER(COALESCE(p_country_code, '*'))]::TEXT[])
    AND currencies @> ARRAY[UPPER(p_currency)]::TEXT[]
    AND p_amount >= min_amount
    AND (max_amount IS NULL OR p_amount <= max_amount)
    AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
    AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'policy_key', NULL,
      'fee_amount', 0,
      'total_amount', COALESCE(p_amount, 0),
      'fixed_fee', 0,
      'percent_fee', 0
    );
  END IF;

  v_fixed := COALESCE(v_policy.fixed_fee, 0);
  v_percent := COALESCE(v_policy.percent_fee, 0);

  IF v_policy.fee_model = 'fixed' THEN
    v_fee := v_fixed;
  ELSIF v_policy.fee_model = 'percentage' THEN
    v_fee := ROUND(COALESCE(p_amount, 0) * (v_percent / 100.0), 2);
  ELSE
    v_fee := ROUND(v_fixed + (COALESCE(p_amount, 0) * (v_percent / 100.0)), 2);
  END IF;

  v_fee := GREATEST(0, COALESCE(v_fee, 0));
  v_total := ROUND(COALESCE(p_amount, 0) + v_fee, 2);

  RETURN jsonb_build_object(
    'policy_key', v_policy.policy_key,
    'fee_model', v_policy.fee_model,
    'fee_amount', v_fee,
    'total_amount', v_total,
    'fixed_fee', v_fixed,
    'percent_fee', v_percent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_fiat_payment_intent(
  p_user_id UUID,
  p_module_key TEXT,
  p_intent_type TEXT,
  p_source_reference TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_country_code TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider JSONB;
  v_fee JSONB;
  v_provider_key TEXT;
  v_fallback_chain TEXT[];
  v_fee_amount NUMERIC;
  v_total_amount NUMERIC;
  v_intent_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'You can only create payment intents for your own account';
  END IF;

  v_provider := public.resolve_default_fiat_provider(
    p_module_key,
    UPPER(COALESCE(p_currency, 'USD')),
    p_country_code
  );

  v_provider_key := COALESCE(v_provider->>'provider_key', 'direct_gateway_primary');
  v_fallback_chain := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(v_provider->'fallback_chain', '[]'::jsonb))
  );

  v_fee := public.quote_fiat_fee(
    p_user_id,
    p_module_key,
    p_intent_type,
    p_country_code,
    UPPER(COALESCE(p_currency, 'USD')),
    COALESCE(p_amount, 0)
  );

  v_fee_amount := COALESCE((v_fee->>'fee_amount')::NUMERIC, 0);
  v_total_amount := COALESCE((v_fee->>'total_amount')::NUMERIC, COALESCE(p_amount, 0));

  INSERT INTO fiat_payment_intents (
    user_id,
    module_key,
    intent_type,
    source_reference,
    amount,
    fee_amount,
    total_amount,
    currency,
    country_code,
    provider_key,
    fallback_chain,
    status,
    eta_minutes,
    idempotency_key,
    metadata
  )
  VALUES (
    p_user_id,
    p_module_key,
    p_intent_type,
    NULLIF(p_source_reference, ''),
    ROUND(COALESCE(p_amount, 0), 2),
    ROUND(v_fee_amount, 2),
    ROUND(v_total_amount, 2),
    UPPER(COALESCE(p_currency, 'USD')),
    UPPER(NULLIF(p_country_code, '')),
    v_provider_key,
    COALESCE(v_fallback_chain, ARRAY[]::TEXT[]),
    'created',
    15,
    NULLIF(p_idempotency_key, ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, module_key, intent_type, idempotency_key) DO UPDATE
  SET
    amount = EXCLUDED.amount,
    fee_amount = EXCLUDED.fee_amount,
    total_amount = EXCLUDED.total_amount,
    provider_key = EXCLUDED.provider_key,
    fallback_chain = EXCLUDED.fallback_chain,
    metadata = EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'payment_intent_id', v_intent_id,
    'provider_key', v_provider_key,
    'fee_amount', v_fee_amount,
    'total_amount', v_total_amount,
    'fallback_chain', COALESCE(v_fallback_chain, ARRAY[]::TEXT[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_wallet_apply_entry(
  p_merchant_id UUID,
  p_entry_type TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT := UPPER(COALESCE(p_currency, 'USD'));
  v_available_id UUID;
  v_reserved_id UUID;
  v_pending_id UUID;
  v_locked_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can apply merchant wallet entries directly';
  END IF;

  INSERT INTO merchant_wallet_accounts (merchant_id, wallet_type, currency)
  VALUES
    (p_merchant_id, 'available', v_currency),
    (p_merchant_id, 'reserved', v_currency),
    (p_merchant_id, 'pending', v_currency),
    (p_merchant_id, 'locked', v_currency)
  ON CONFLICT (merchant_id, wallet_type, currency) DO NOTHING;

  SELECT id INTO v_available_id FROM merchant_wallet_accounts WHERE merchant_id = p_merchant_id AND wallet_type = 'available' AND currency = v_currency;
  SELECT id INTO v_reserved_id FROM merchant_wallet_accounts WHERE merchant_id = p_merchant_id AND wallet_type = 'reserved' AND currency = v_currency;
  SELECT id INTO v_pending_id FROM merchant_wallet_accounts WHERE merchant_id = p_merchant_id AND wallet_type = 'pending' AND currency = v_currency;
  SELECT id INTO v_locked_id FROM merchant_wallet_accounts WHERE merchant_id = p_merchant_id AND wallet_type = 'locked' AND currency = v_currency;

  IF p_entry_type = 'top_up' THEN
    UPDATE merchant_wallet_accounts
    SET available_balance = available_balance + p_amount, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  ELSIF p_entry_type = 'withdrawal' THEN
    UPDATE merchant_wallet_accounts
    SET available_balance = GREATEST(0, available_balance - p_amount), updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  ELSIF p_entry_type = 'reserve' THEN
    UPDATE merchant_wallet_accounts
    SET available_balance = GREATEST(0, available_balance - p_amount), reserved_balance = reserved_balance + p_amount, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  ELSIF p_entry_type = 'release' THEN
    UPDATE merchant_wallet_accounts
    SET available_balance = available_balance + p_amount, reserved_balance = GREATEST(0, reserved_balance - p_amount), updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  ELSIF p_entry_type = 'hold' THEN
    UPDATE merchant_wallet_accounts
    SET available_balance = GREATEST(0, available_balance - p_amount), locked_balance = locked_balance + p_amount, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  ELSIF p_entry_type = 'settlement' THEN
    UPDATE merchant_wallet_accounts
    SET reserved_balance = GREATEST(0, reserved_balance - p_amount), pending_balance = pending_balance + p_amount, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_available_id;
  END IF;

  INSERT INTO merchant_wallet_ledgers (
    merchant_id,
    wallet_account_id,
    entry_type,
    amount,
    currency,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  VALUES (
    p_merchant_id,
    CASE
      WHEN p_entry_type IN ('reserve', 'release', 'top_up', 'withdrawal', 'settlement', 'adjustment') THEN v_available_id
      WHEN p_entry_type = 'hold' THEN v_locked_id
      ELSE v_pending_id
    END,
    p_entry_type,
    ROUND(COALESCE(p_amount, 0), 2),
    v_currency,
    NULLIF(p_reference_type, ''),
    NULLIF(p_reference_id, ''),
    NULLIF(p_note, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'merchant_id', p_merchant_id, 'entry_type', p_entry_type, 'amount', p_amount, 'currency', v_currency);
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_merchant_qualification(
  p_merchant_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_fail_reasons JSONB := '[]'::jsonb;
  v_has_kyc_gap BOOLEAN := FALSE;
  v_available_balance NUMERIC := 0;
  v_risk_score NUMERIC := 0;
  v_next_status TEXT := 'active';
BEGIN
  SELECT COALESCE(risk_score, 0) INTO v_risk_score
  FROM merchant_profiles
  WHERE id = p_merchant_id;

  SELECT EXISTS (
    SELECT 1
    FROM merchant_kyc_requirements
    WHERE merchant_id = p_merchant_id
      AND status NOT IN ('approved', 'waived')
  ) INTO v_has_kyc_gap;

  SELECT COALESCE(available_balance, 0)
  INTO v_available_balance
  FROM merchant_wallet_accounts
  WHERE merchant_id = p_merchant_id
    AND wallet_type = 'available'
  ORDER BY updated_at DESC
  LIMIT 1;

  FOR v_rule IN
    SELECT *
    FROM merchant_qualification_rules
    WHERE status = 'active'
    ORDER BY priority ASC, updated_at DESC
  LOOP
    IF (v_rule.criteria->>'type') = 'kyc_required' AND v_has_kyc_gap THEN
      v_fail_reasons := v_fail_reasons || jsonb_build_array(jsonb_build_object('rule_key', v_rule.rule_key, 'reason', 'kyc_incomplete'));
      v_next_status := CASE WHEN v_rule.outcome_on_fail = 'review' THEN 'under_review' ELSE 'disabled' END;
    ELSIF (v_rule.criteria->>'type') = 'min_available_balance' AND v_available_balance < COALESCE((v_rule.criteria->>'amount')::NUMERIC, 0) THEN
      v_fail_reasons := v_fail_reasons || jsonb_build_array(jsonb_build_object('rule_key', v_rule.rule_key, 'reason', 'insufficient_balance'));
      v_next_status := CASE WHEN v_rule.outcome_on_fail = 'review' THEN 'under_review' ELSE 'disabled' END;
    ELSIF (v_rule.criteria->>'type') = 'max_risk_score' AND v_risk_score > COALESCE((v_rule.criteria->>'score')::NUMERIC, 100) THEN
      v_fail_reasons := v_fail_reasons || jsonb_build_array(jsonb_build_object('rule_key', v_rule.rule_key, 'reason', 'risk_above_threshold'));
      v_next_status := CASE WHEN v_rule.outcome_on_fail = 'suspend' THEN 'suspended' ELSE 'under_review' END;
    END IF;
  END LOOP;

  UPDATE merchant_profiles
  SET status = v_next_status,
      activated_at = CASE WHEN v_next_status = 'active' THEN COALESCE(activated_at, CURRENT_TIMESTAMP) ELSE activated_at END,
      suspended_at = CASE WHEN v_next_status = 'suspended' THEN CURRENT_TIMESTAMP ELSE suspended_at END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_merchant_id;

  INSERT INTO merchant_status_audit (
    merchant_id,
    previous_status,
    next_status,
    reason,
    triggered_by,
    metadata
  )
  SELECT
    p_merchant_id,
    NULL,
    v_next_status,
    CASE WHEN jsonb_array_length(v_fail_reasons) = 0 THEN 'qualification_passed' ELSE 'qualification_failed' END,
    COALESCE(p_triggered_by, auth.uid()),
    jsonb_build_object('fail_reasons', v_fail_reasons)
  ;

  RETURN jsonb_build_object(
    'merchant_id', p_merchant_id,
    'qualified', jsonb_array_length(v_fail_reasons) = 0,
    'next_status', v_next_status,
    'fail_reasons', v_fail_reasons
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_p2p_order(
  p_order_id UUID,
  p_policy_key TEXT DEFAULT 'default_p2p_matching_v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order p2p_orders%ROWTYPE;
  v_policy merchant_matching_policies%ROWTYPE;
  v_selected_merchant UUID;
  v_best_score NUMERIC := -1;
  v_candidate RECORD;
  v_trace JSONB := '[]'::jsonb;
  v_shadow_mode BOOLEAN := TRUE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can trigger assignment directly';
  END IF;

  SELECT * INTO v_order FROM p2p_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_policy FROM merchant_matching_policies WHERE policy_key = p_policy_key AND status = 'active' LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching policy not found or inactive';
  END IF;

  SELECT COALESCE((value #>> '{}')::BOOLEAN, true)
  INTO v_shadow_mode
  FROM platform_settings
  WHERE key = 'p2p_shadow_mode';

  FOR v_candidate IN
    SELECT
      mp.id AS merchant_id,
      mp.rating_score,
      mp.completion_rate,
      mp.response_sla_seconds,
      mp.risk_score,
      COALESCE(mwa.available_balance, 0) AS available_balance,
      (
        COALESCE(mwa.available_balance, 0) * COALESCE((v_policy.scoring_weights->>'liquidity')::NUMERIC, 0.35)
        + COALESCE(mp.rating_score, 0) * COALESCE((v_policy.scoring_weights->>'rating')::NUMERIC, 0.15)
        + COALESCE(mp.completion_rate, 0) * COALESCE((v_policy.scoring_weights->>'completion_rate')::NUMERIC, 0.20)
        + (1000.0 / NULLIF(COALESCE(mp.response_sla_seconds, 1), 0)) * COALESCE((v_policy.scoring_weights->>'response_sla')::NUMERIC, 0.10)
        + (100 - COALESCE(mp.risk_score, 0)) * COALESCE((v_policy.scoring_weights->>'risk')::NUMERIC, 0.20)
      ) AS computed_score
    FROM merchant_profiles mp
    LEFT JOIN merchant_wallet_accounts mwa
      ON mwa.merchant_id = mp.id
      AND mwa.wallet_type = 'available'
      AND mwa.currency = v_order.currency
    WHERE mp.status = 'active'
      AND (mp.country_code = v_order.country_code OR v_order.country_code IS NULL)
      AND COALESCE(mwa.available_balance, 0) >= v_order.total_amount
      AND COALESCE(mp.risk_score, 0) <= COALESCE((v_policy.criteria->>'max_risk_score')::NUMERIC, 100)
  LOOP
    v_trace := v_trace || jsonb_build_array(jsonb_build_object(
      'merchant_id', v_candidate.merchant_id,
      'available_balance', v_candidate.available_balance,
      'computed_score', v_candidate.computed_score,
      'risk_score', v_candidate.risk_score
    ));

    IF v_candidate.computed_score > v_best_score THEN
      v_best_score := v_candidate.computed_score;
      v_selected_merchant := v_candidate.merchant_id;
    END IF;
  END LOOP;

  IF v_selected_merchant IS NULL THEN
    INSERT INTO merchant_assignment_events (
      order_id,
      merchant_id,
      policy_id,
      decision,
      score,
      reason_code,
      trace
    )
    VALUES (
      p_order_id,
      NULL,
      v_policy.id,
      CASE WHEN v_shadow_mode THEN 'shadow_only' ELSE 'no_liquidity' END,
      NULL,
      'no_eligible_merchant',
      v_trace
    );

    RETURN jsonb_build_object(
      'ok', false,
      'decision', CASE WHEN v_shadow_mode THEN 'shadow_only' ELSE 'no_liquidity' END,
      'reason', 'no_eligible_merchant'
    );
  END IF;

  INSERT INTO merchant_assignment_events (
    order_id,
    merchant_id,
    policy_id,
    decision,
    score,
    reason_code,
    trace
  )
  VALUES (
    p_order_id,
    v_selected_merchant,
    v_policy.id,
    CASE WHEN v_shadow_mode THEN 'shadow_only' ELSE 'assigned' END,
    v_best_score,
    'best_score',
    v_trace
  );

  IF NOT v_shadow_mode THEN
    UPDATE p2p_orders
    SET
      merchant_id = v_selected_merchant,
      current_state = 'merchant_assigned',
      assigned_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;

    PERFORM public.merchant_wallet_apply_entry(
      v_selected_merchant,
      'reserve',
      v_order.total_amount,
      v_order.currency,
      'p2p_order',
      p_order_id::TEXT,
      'Escrow reserve on merchant assignment',
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'decision', CASE WHEN v_shadow_mode THEN 'shadow_only' ELSE 'assigned' END,
    'merchant_id', v_selected_merchant,
    'score', v_best_score
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_p2p_order_state(
  p_order_id UUID,
  p_next_state TEXT,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order p2p_orders%ROWTYPE;
  v_transition p2p_order_state_transitions%ROWTYPE;
  v_transition_key TEXT;
BEGIN
  SELECT * INTO v_order FROM p2p_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF COALESCE(NULLIF(p_idempotency_key, ''), '') = '' THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  SELECT *
  INTO v_transition
  FROM p2p_order_state_transitions
  WHERE from_state = v_order.current_state
    AND to_state = p_next_state
    AND allowed_actor_roles @> ARRAY[p_actor_role]::TEXT[]
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid transition from % to % for actor role %', v_order.current_state, p_next_state, p_actor_role;
  END IF;

  v_transition_key := CONCAT(v_order.id::TEXT, ':', p_idempotency_key, ':', v_order.current_state, ':', p_next_state);

  INSERT INTO p2p_escrow_events (
    order_id,
    merchant_id,
    event_type,
    amount,
    currency,
    status,
    note,
    metadata
  )
  VALUES (
    v_order.id,
    v_order.merchant_id,
    CASE
      WHEN p_next_state = 'completed' THEN 'settle'
      WHEN p_next_state = 'refunded' THEN 'refund'
      WHEN p_next_state = 'disputed' THEN 'hold'
      ELSE 'release'
    END,
    v_order.total_amount,
    v_order.currency,
    'applied',
    CONCAT('Transition: ', v_order.current_state, ' -> ', p_next_state),
    jsonb_build_object('transition_key', v_transition_key, 'actor_id', p_actor_id, 'metadata', COALESCE(p_metadata, '{}'::jsonb))
  );

  UPDATE p2p_orders
  SET
    current_state = p_next_state,
    completed_at = CASE WHEN p_next_state = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
    cancelled_at = CASE WHEN p_next_state = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
    disputed_at = CASE WHEN p_next_state = 'disputed' THEN CURRENT_TIMESTAMP ELSE disputed_at END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_order.id;

  IF p_next_state = 'completed' AND v_order.merchant_id IS NOT NULL THEN
    PERFORM public.merchant_wallet_apply_entry(
      v_order.merchant_id,
      'settlement',
      v_order.total_amount,
      v_order.currency,
      'p2p_order',
      v_order.id::TEXT,
      'Escrow settlement after order completion',
      jsonb_build_object('order_id', v_order.id)
    );
  ELSIF p_next_state IN ('cancelled', 'expired', 'refunded') AND v_order.merchant_id IS NOT NULL THEN
    PERFORM public.merchant_wallet_apply_entry(
      v_order.merchant_id,
      'release',
      v_order.total_amount,
      v_order.currency,
      'p2p_order',
      v_order.id::TEXT,
      'Escrow release after cancellation/expiry/refund',
      jsonb_build_object('order_id', v_order.id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'previous_state', v_order.current_state,
    'next_state', p_next_state,
    'transition_key', v_transition_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_p2p_liquidity_health_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_balance NUMERIC := 0;
  v_disabled_count INTEGER := 0;
BEGIN
  SELECT COALESCE((value #>> '{}')::NUMERIC, 0)
  INTO v_min_balance
  FROM platform_settings
  WHERE key = 'p2p_min_operating_balance';

  WITH candidates AS (
    SELECT mp.id AS merchant_id,
           COALESCE(mwa.available_balance, 0) AS available_balance
    FROM merchant_profiles mp
    LEFT JOIN merchant_wallet_accounts mwa
      ON mwa.merchant_id = mp.id
      AND mwa.wallet_type = 'available'
    WHERE mp.status = 'active'
  )
  UPDATE merchant_profiles mp
  SET status = 'disabled',
      updated_at = CURRENT_TIMESTAMP
  FROM candidates c
  WHERE mp.id = c.merchant_id
    AND c.available_balance < v_min_balance;

  GET DIAGNOSTICS v_disabled_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'disabled_count', v_disabled_count, 'min_balance', v_min_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_p2p_compliance_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marked_count INTEGER := 0;
BEGIN
  UPDATE merchant_profiles mp
  SET status = 'under_review',
      updated_at = CURRENT_TIMESTAMP
  WHERE mp.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM merchant_kyc_requirements mk
      WHERE mk.merchant_id = mp.id
        AND (mk.status IN ('expired', 'rejected') OR (mk.expires_at IS NOT NULL AND mk.expires_at <= CURRENT_TIMESTAMP))
    );

  GET DIAGNOSTICS v_marked_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'marked_under_review', v_marked_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_p2p_merchant_analytics_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  INSERT INTO p2p_merchant_daily_analytics (
    report_date,
    merchant_id,
    assigned_orders,
    completed_orders,
    disputed_orders,
    average_response_seconds,
    completion_rate,
    earnings_total,
    metadata,
    updated_at
  )
  SELECT
    CURRENT_DATE,
    mp.id,
    COUNT(*) FILTER (WHERE po.current_state <> 'created')::INTEGER AS assigned_orders,
    COUNT(*) FILTER (WHERE po.current_state = 'completed')::INTEGER AS completed_orders,
    COUNT(*) FILTER (WHERE po.current_state IN ('disputed', 'under_review', 'refunded'))::INTEGER AS disputed_orders,
    AVG(EXTRACT(EPOCH FROM (COALESCE(po.completed_at, po.updated_at) - COALESCE(po.assigned_at, po.created_at))))::NUMERIC(12,2) AS average_response_seconds,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE po.current_state = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 4)
    END AS completion_rate,
    COALESCE(SUM(po.fee_amount) FILTER (WHERE po.current_state = 'completed'), 0)::NUMERIC(14,2) AS earnings_total,
    jsonb_build_object('generated_by', 'run_p2p_merchant_analytics_job'),
    CURRENT_TIMESTAMP
  FROM merchant_profiles mp
  LEFT JOIN p2p_orders po ON po.merchant_id = mp.id
  GROUP BY mp.id
  ON CONFLICT (report_date, merchant_id) DO UPDATE
  SET
    assigned_orders = EXCLUDED.assigned_orders,
    completed_orders = EXCLUDED.completed_orders,
    disputed_orders = EXCLUDED.disputed_orders,
    average_response_seconds = EXCLUDED.average_response_seconds,
    completion_rate = EXCLUDED.completion_rate,
    earnings_total = EXCLUDED.earnings_total,
    metadata = EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'rows_upserted', v_rows);
END;
$$;

-- =============================
-- RLS
-- =============================

ALTER TABLE fiat_payment_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_platform_fee_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_kyc_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_qualification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_status_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_wallet_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_wallet_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_matching_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_order_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_order_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_escrow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_sla_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_dispute_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_velocity_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_fraud_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_merchant_daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_rollout_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiat_payment_provider_settings_admin_only ON fiat_payment_provider_settings;
CREATE POLICY fiat_payment_provider_settings_admin_only ON fiat_payment_provider_settings
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS fiat_platform_fee_policies_admin_only ON fiat_platform_fee_policies;
CREATE POLICY fiat_platform_fee_policies_admin_only ON fiat_platform_fee_policies
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS fiat_payment_intents_user_or_admin ON fiat_payment_intents;
CREATE POLICY fiat_payment_intents_user_or_admin ON fiat_payment_intents
  FOR ALL USING (auth.uid() = user_id OR public.is_super_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS merchant_profiles_user_or_admin ON merchant_profiles;
CREATE POLICY merchant_profiles_user_or_admin ON merchant_profiles
  FOR ALL USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS merchant_kyc_requirements_user_or_admin ON merchant_kyc_requirements;
CREATE POLICY merchant_kyc_requirements_user_or_admin ON merchant_kyc_requirements
  FOR ALL USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_kyc_requirements.merchant_id
        AND mp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_kyc_requirements.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS merchant_qualification_rules_admin_only ON merchant_qualification_rules;
CREATE POLICY merchant_qualification_rules_admin_only ON merchant_qualification_rules
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_status_audit_admin_or_owner_read ON merchant_status_audit;
CREATE POLICY merchant_status_audit_admin_or_owner_read ON merchant_status_audit
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_status_audit.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS merchant_wallet_accounts_admin_or_owner ON merchant_wallet_accounts;
CREATE POLICY merchant_wallet_accounts_admin_or_owner ON merchant_wallet_accounts
  FOR ALL USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_accounts.merchant_id
        AND mp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_accounts.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS merchant_wallet_ledgers_admin_or_owner_read ON merchant_wallet_ledgers;
CREATE POLICY merchant_wallet_ledgers_admin_or_owner_read ON merchant_wallet_ledgers
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_ledgers.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS merchant_wallet_holds_admin_or_owner ON merchant_wallet_holds;
CREATE POLICY merchant_wallet_holds_admin_or_owner ON merchant_wallet_holds
  FOR ALL USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_holds.merchant_id
        AND mp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp
      WHERE mp.id = merchant_wallet_holds.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS merchant_matching_policies_admin_only ON merchant_matching_policies;
CREATE POLICY merchant_matching_policies_admin_only ON merchant_matching_policies
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS merchant_assignment_events_admin_or_owner_read ON merchant_assignment_events;
CREATE POLICY merchant_assignment_events_admin_or_owner_read ON merchant_assignment_events
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = merchant_assignment_events.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p2p_orders_user_merchant_admin ON p2p_orders;
CREATE POLICY p2p_orders_user_merchant_admin ON p2p_orders
  FOR ALL USING (
    public.is_super_admin() OR user_id = auth.uid() OR EXISTS (
      SELECT 1
      FROM merchant_profiles mp
      WHERE mp.id = p2p_orders.merchant_id
        AND mp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR user_id = auth.uid() OR EXISTS (
      SELECT 1
      FROM merchant_profiles mp
      WHERE mp.id = p2p_orders.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS p2p_order_states_authenticated_read ON p2p_order_states;
CREATE POLICY p2p_order_states_authenticated_read ON p2p_order_states
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_super_admin());

DROP POLICY IF EXISTS p2p_order_states_admin_write ON p2p_order_states;
CREATE POLICY p2p_order_states_admin_write ON p2p_order_states
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_order_state_transitions_authenticated_read ON p2p_order_state_transitions;
CREATE POLICY p2p_order_state_transitions_authenticated_read ON p2p_order_state_transitions
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_super_admin());

DROP POLICY IF EXISTS p2p_order_state_transitions_admin_write ON p2p_order_state_transitions;
CREATE POLICY p2p_order_state_transitions_admin_write ON p2p_order_state_transitions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_payment_submissions_user_merchant_admin ON p2p_payment_submissions;
CREATE POLICY p2p_payment_submissions_user_merchant_admin ON p2p_payment_submissions
  FOR ALL USING (
    public.is_super_admin() OR submitted_by = auth.uid() OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = p2p_payment_submissions.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin() OR submitted_by = auth.uid() OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = p2p_payment_submissions.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p2p_escrow_events_admin_or_related_read ON p2p_escrow_events;
CREATE POLICY p2p_escrow_events_admin_or_related_read ON p2p_escrow_events
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = p2p_escrow_events.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p2p_sla_policies_admin_only ON p2p_sla_policies;
CREATE POLICY p2p_sla_policies_admin_only ON p2p_sla_policies
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_sla_events_admin_or_related_read ON p2p_sla_events;
CREATE POLICY p2p_sla_events_admin_or_related_read ON p2p_sla_events
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1
      FROM merchant_profiles mp
      WHERE mp.id = p2p_sla_events.merchant_id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS p2p_notification_templates_admin_only ON p2p_notification_templates;
CREATE POLICY p2p_notification_templates_admin_only ON p2p_notification_templates
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_notification_events_admin_or_related_read ON p2p_notification_events;
CREATE POLICY p2p_notification_events_admin_or_related_read ON p2p_notification_events
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM merchant_profiles mp WHERE mp.id = p2p_notification_events.merchant_id AND mp.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS p2p_disputes_user_merchant_admin ON p2p_disputes;
CREATE POLICY p2p_disputes_user_merchant_admin ON p2p_disputes
  FOR ALL USING (
    public.is_super_admin()
    OR opened_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = p2p_disputes.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR opened_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM p2p_orders po
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE po.id = p2p_disputes.order_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p2p_dispute_evidence_user_merchant_admin ON p2p_dispute_evidence;
CREATE POLICY p2p_dispute_evidence_user_merchant_admin ON p2p_dispute_evidence
  FOR ALL USING (
    public.is_super_admin() OR uploaded_by = auth.uid() OR EXISTS (
      SELECT 1
      FROM p2p_disputes d
      JOIN p2p_orders po ON po.id = d.order_id
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE d.id = p2p_dispute_evidence.dispute_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin() OR uploaded_by = auth.uid() OR EXISTS (
      SELECT 1
      FROM p2p_disputes d
      JOIN p2p_orders po ON po.id = d.order_id
      LEFT JOIN merchant_profiles mp ON mp.id = po.merchant_id
      WHERE d.id = p2p_dispute_evidence.dispute_id
        AND (po.user_id = auth.uid() OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p2p_dispute_actions_admin_only ON p2p_dispute_actions;
CREATE POLICY p2p_dispute_actions_admin_only ON p2p_dispute_actions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_risk_signals_admin_only ON p2p_risk_signals;
CREATE POLICY p2p_risk_signals_admin_only ON p2p_risk_signals
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_velocity_windows_admin_only ON p2p_velocity_windows;
CREATE POLICY p2p_velocity_windows_admin_only ON p2p_velocity_windows
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_fraud_scores_admin_only ON p2p_fraud_scores;
CREATE POLICY p2p_fraud_scores_admin_only ON p2p_fraud_scores
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS p2p_merchant_daily_analytics_admin_or_owner_read ON p2p_merchant_daily_analytics;
CREATE POLICY p2p_merchant_daily_analytics_admin_or_owner_read ON p2p_merchant_daily_analytics
  FOR SELECT USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM merchant_profiles mp WHERE mp.id = p2p_merchant_daily_analytics.merchant_id AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS p2p_rollout_flags_admin_only ON p2p_rollout_flags;
CREATE POLICY p2p_rollout_flags_admin_only ON p2p_rollout_flags
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

REVOKE ALL ON FUNCTION public.resolve_default_fiat_provider(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_default_fiat_provider(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.quote_fiat_fee(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_fiat_fee(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.create_fiat_payment_intent(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fiat_payment_intent(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.merchant_wallet_apply_entry(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_wallet_apply_entry(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.evaluate_merchant_qualification(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_merchant_qualification(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_p2p_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_p2p_order(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.transition_p2p_order_state(UUID, TEXT, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_p2p_order_state(UUID, TEXT, UUID, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.run_p2p_liquidity_health_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_p2p_liquidity_health_job() TO authenticated;

REVOKE ALL ON FUNCTION public.run_p2p_compliance_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_p2p_compliance_job() TO authenticated;

REVOKE ALL ON FUNCTION public.run_p2p_merchant_analytics_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_p2p_merchant_analytics_job() TO authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('p2p-liquidity-health-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('p2p-compliance-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('p2p-merchant-analytics-job');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END
$$;

SELECT cron.schedule(
  'p2p-liquidity-health-job',
  '*/10 * * * *',
  $$SELECT public.run_p2p_liquidity_health_job();$$
);

SELECT cron.schedule(
  'p2p-compliance-job',
  '15 * * * *',
  $$SELECT public.run_p2p_compliance_job();$$
);

SELECT cron.schedule(
  'p2p-merchant-analytics-job',
  '0 2 * * *',
  $$SELECT public.run_p2p_merchant_analytics_job();$$
);
