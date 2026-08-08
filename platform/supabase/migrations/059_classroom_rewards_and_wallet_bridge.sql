-- 059_classroom_rewards_and_wallet_bridge.sql
-- Phase 19.1 foundation: learning reward events, isolated wallet ledgers, transfer bridge.

CREATE TABLE IF NOT EXISTS learning_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  xp_balance BIGINT NOT NULL DEFAULT 0,
  skill_points BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES learning_lessons(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'COIN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'claimed', 'rejected', 'reversed')),
  hold_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_wallet_account_id UUID NOT NULL REFERENCES learning_wallet_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('accrual', 'hold', 'release', 'transfer_out', 'transfer_in', 'reversal', 'xp_credit', 'skill_point_credit')),
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  learning_amount NUMERIC(15, 2) NOT NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  transfer_status TEXT NOT NULL DEFAULT 'pending' CHECK (transfer_status IN ('pending', 'approved', 'rejected', 'completed')),
  risk_status TEXT NOT NULL DEFAULT 'clear' CHECK (risk_status IN ('clear', 'review', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_wallet_accounts_user ON learning_wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_reward_events_user_status ON learning_reward_events(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_reward_events_enrollment ON learning_reward_events(enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_wallet_transactions_account_type ON learning_wallet_transactions(learning_wallet_account_id, transaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_wallet_transfers_user_status ON learning_wallet_transfers(user_id, transfer_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_wallet_transfers_risk_status ON learning_wallet_transfers(risk_status, created_at DESC);

DROP TRIGGER IF EXISTS learning_wallet_accounts_updated_at ON learning_wallet_accounts;
CREATE TRIGGER learning_wallet_accounts_updated_at BEFORE UPDATE ON learning_wallet_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_reward_events_updated_at ON learning_reward_events;
CREATE TRIGGER learning_reward_events_updated_at BEFORE UPDATE ON learning_reward_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS learning_wallet_transfers_updated_at ON learning_wallet_transfers;
CREATE TRIGGER learning_wallet_transfers_updated_at BEFORE UPDATE ON learning_wallet_transfers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE learning_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_wallet_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_wallet_accounts_user_or_admin_read ON learning_wallet_accounts;
CREATE POLICY learning_wallet_accounts_user_or_admin_read ON learning_wallet_accounts
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_wallet_accounts_user_or_admin_insert ON learning_wallet_accounts;
CREATE POLICY learning_wallet_accounts_user_or_admin_insert ON learning_wallet_accounts
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_wallet_accounts_user_or_admin_update ON learning_wallet_accounts;
CREATE POLICY learning_wallet_accounts_user_or_admin_update ON learning_wallet_accounts
  FOR UPDATE USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_reward_events_user_or_admin_read ON learning_reward_events;
CREATE POLICY learning_reward_events_user_or_admin_read ON learning_reward_events
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_reward_events_system_or_admin_insert ON learning_reward_events;
CREATE POLICY learning_reward_events_system_or_admin_insert ON learning_reward_events
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_reward_events_admin_update ON learning_reward_events;
CREATE POLICY learning_reward_events_admin_update ON learning_reward_events
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS learning_wallet_transactions_user_or_admin_read ON learning_wallet_transactions;
CREATE POLICY learning_wallet_transactions_user_or_admin_read ON learning_wallet_transactions
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM learning_wallet_accounts a
      WHERE a.id = learning_wallet_transactions.learning_wallet_account_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS learning_wallet_transactions_system_or_admin_insert ON learning_wallet_transactions;
CREATE POLICY learning_wallet_transactions_system_or_admin_insert ON learning_wallet_transactions
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM learning_wallet_accounts a
      WHERE a.id = learning_wallet_transactions.learning_wallet_account_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS learning_wallet_transfers_user_or_admin_read ON learning_wallet_transfers;
CREATE POLICY learning_wallet_transfers_user_or_admin_read ON learning_wallet_transfers
  FOR SELECT USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_wallet_transfers_user_or_admin_insert ON learning_wallet_transfers;
CREATE POLICY learning_wallet_transfers_user_or_admin_insert ON learning_wallet_transfers
  FOR INSERT WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS learning_wallet_transfers_admin_update ON learning_wallet_transfers;
CREATE POLICY learning_wallet_transfers_admin_update ON learning_wallet_transfers
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO platform_settings (key, value, description)
VALUES (
  'classroom_wallet_policy',
  '{"minimumTransferAmount":100,"cooldownHours":24,"requireFraudClearance":true,"requireRewardRelease":true}'::jsonb,
  'Classroom wallet transfer thresholds and fraud gating controls.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;
