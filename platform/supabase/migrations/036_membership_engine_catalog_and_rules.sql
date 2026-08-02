-- 036_membership_engine_catalog_and_rules.sql
-- Phase 0-5 foundation for data-driven membership plans, rules, rewards, and withdrawals.

CREATE TABLE IF NOT EXISTS membership_plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL UNIQUE CHECK (level >= 1),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  duration_days INTEGER NOT NULL DEFAULT 30,
  category TEXT NOT NULL DEFAULT 'starter',
  benefits JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  version TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rule_key, version)
);

CREATE TABLE IF NOT EXISTS membership_rule_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  version TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_reward_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_day INTEGER NOT NULL DEFAULT 1,
  daily_percent NUMERIC(6,2) NOT NULL DEFAULT 10,
  target_wallet TEXT NOT NULL DEFAULT 'main_wallet',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_withdrawal_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_level INTEGER NOT NULL DEFAULT 1,
  min_threshold NUMERIC(12,2) NOT NULL DEFAULT 10000,
  max_withdrawal NUMERIC(12,2) NOT NULL DEFAULT 500000,
  hold_days INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO membership_plan_catalog (level, slug, label, price, currency, duration_days, category, benefits)
VALUES
  (1, 'starter', 'Starter', 5000, 'NGN', 30, 'starter', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (2, 'starter-plus', 'Starter Plus', 7500, 'NGN', 30, 'starter', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (3, 'bronze', 'Bronze', 10000, 'NGN', 30, 'starter', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (4, 'bronze-plus', 'Bronze Plus', 15000, 'NGN', 30, 'starter', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (5, 'bronze-elite', 'Bronze Elite', 20000, 'NGN', 30, 'starter', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (10, 'gold-elite', 'Gold Elite', 50000, 'NGN', 30, 'growth', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (25, 'ruby-elite', 'Ruby Elite', 275000, 'NGN', 30, 'growth', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (50, 'legacy-elite', 'Legacy Elite', 1500000, 'NGN', 30, 'enterprise', '["Priority support","Reward multiplier access","Withdrawal eligibility"]'),
  (100, 'ultimate-founder', 'Ultimate Founder', 13000000, 'NGN', 30, 'enterprise', '["Priority support","Reward multiplier access","Withdrawal eligibility"]')
ON CONFLICT (level) DO NOTHING;

INSERT INTO membership_rule_versions (rule_key, version, payload, status, effective_from)
VALUES
  ('reward_policy', 'v1', '{"dailyPercent":10,"cycleDays":31,"targetWallet":"main_wallet"}', 'published', CURRENT_TIMESTAMP),
  ('withdrawal_policy', 'v1', '{"minThreshold":10000,"maxWithdrawal":500000,"holdDays":1}', 'published', CURRENT_TIMESTAMP)
ON CONFLICT (rule_key, version) DO NOTHING;

INSERT INTO membership_withdrawal_schedules (plan_level, min_threshold, max_withdrawal, hold_days)
VALUES
  (1, 10000, 250000, 1),
  (25, 10000, 500000, 2),
  (100, 10000, 2000000, 3)
ON CONFLICT DO NOTHING;
