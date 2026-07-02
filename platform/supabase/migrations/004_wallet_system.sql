-- 004_wallet_system.sql
-- Phase 5 wallet, withdrawal, and admin payout control support

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'available',
  method TEXT,
  reference_id UUID,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  destination_value TEXT,
  destination_currency TEXT NOT NULL DEFAULT 'USD',
  currency TEXT NOT NULL DEFAULT 'USD',
  amount NUMERIC(15, 2) NOT NULL,
  processing_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(18, 8) NOT NULL DEFAULT 1,
  net_amount NUMERIC(15, 2) NOT NULL,
  approval_workflow TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created_at ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_created_at ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created_at ON withdrawal_requests(status, created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_transactions_select_own ON wallet_transactions;
CREATE POLICY wallet_transactions_select_own ON wallet_transactions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS wallet_transactions_insert_own ON wallet_transactions;
CREATE POLICY wallet_transactions_insert_own ON wallet_transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS withdrawal_requests_select_own ON withdrawal_requests;
CREATE POLICY withdrawal_requests_select_own ON withdrawal_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS withdrawal_requests_insert_own ON withdrawal_requests;
CREATE POLICY withdrawal_requests_insert_own ON withdrawal_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS withdrawal_requests_update_super_admin ON withdrawal_requests;
CREATE POLICY withdrawal_requests_update_super_admin ON withdrawal_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS platform_settings_select_authenticated ON platform_settings;
CREATE POLICY platform_settings_select_authenticated ON platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS platform_settings_insert_super_admin ON platform_settings;
CREATE POLICY platform_settings_insert_super_admin ON platform_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS platform_settings_update_super_admin ON platform_settings;
CREATE POLICY platform_settings_update_super_admin ON platform_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS platform_settings_delete_super_admin ON platform_settings;
CREATE POLICY platform_settings_delete_super_admin ON platform_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

CREATE TRIGGER withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO platform_settings (key, value, description)
VALUES
  ('wallet_min_withdrawal', '25'::jsonb, 'Minimum withdrawal amount'),
  ('wallet_max_withdrawal', '5000'::jsonb, 'Maximum withdrawal amount'),
  ('wallet_processing_fee_percent', '1.5'::jsonb, 'Processing fee percentage applied to withdrawals'),
  ('wallet_currency', '"USD"'::jsonb, 'Base wallet currency'),
  ('wallet_approval_workflow', '"manual"'::jsonb, 'Withdrawal approval workflow'),
  (
    'wallet_exchange_rates',
    '[{"currency":"USD","rate":1,"label":"US Dollar"},{"currency":"EUR","rate":0.92,"label":"Euro"},{"currency":"GBP","rate":0.79,"label":"British Pound"},{"currency":"NGN","rate":1500,"label":"Nigerian Naira"},{"currency":"USDT","rate":1,"label":"Tether"}]'::jsonb,
    'Configured payout exchange rates'
  ),
  (
    'wallet_supported_methods',
    '["bank_transfer","crypto","paypal","gift_cards","manual_payout"]'::jsonb,
    'Supported withdrawal methods'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
