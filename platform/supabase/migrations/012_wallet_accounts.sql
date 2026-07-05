-- 012_wallet_accounts.sql
-- Phase 12 wallet expansion: multi-wallet balances, transfer history, and wallet audit support.

ALTER TABLE reward_ledger
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  available_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, wallet_type, currency)
);

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS wallet_account_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counterparty_wallet_type TEXT,
  ADD COLUMN IF NOT EXISTS transfer_id UUID;

CREATE TABLE IF NOT EXISTS wallet_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  to_wallet_account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed',
  transfer_category TEXT NOT NULL DEFAULT 'internal',
  note TEXT,
  reference_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_wallet_currency ON wallet_accounts(user_id, wallet_type, currency);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_created_at ON wallet_accounts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_user_created_at ON wallet_transfers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_status ON wallet_transfers(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_wallet_created_at ON wallet_transactions(user_id, wallet_type, created_at DESC);

ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_accounts_select_own_or_admin ON wallet_accounts;
CREATE POLICY wallet_accounts_select_own_or_admin ON wallet_accounts
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS wallet_accounts_insert_admin ON wallet_accounts;
CREATE POLICY wallet_accounts_insert_admin ON wallet_accounts
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS wallet_accounts_update_admin ON wallet_accounts;
CREATE POLICY wallet_accounts_update_admin ON wallet_accounts
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS wallet_transfers_select_own_or_admin ON wallet_transfers;
CREATE POLICY wallet_transfers_select_own_or_admin ON wallet_transfers
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS wallet_transfers_insert_own_or_admin ON wallet_transfers;
CREATE POLICY wallet_transfers_insert_own_or_admin ON wallet_transfers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS wallet_transfers_update_admin ON wallet_transfers;
CREATE POLICY wallet_transfers_update_admin ON wallet_transfers
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.ensure_wallet_accounts(
  p_user_id UUID,
  p_currency TEXT DEFAULT 'USD',
  p_main_balance NUMERIC DEFAULT 0,
  p_reward_balance NUMERIC DEFAULT 0,
  p_sync_balances BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
  VALUES
    (p_user_id, 'main', p_currency, COALESCE(p_main_balance, 0)),
    (p_user_id, 'bonus', p_currency, 0),
    (p_user_id, 'referral', p_currency, 0),
    (p_user_id, 'cashback', p_currency, 0),
    (p_user_id, 'reward', p_currency, COALESCE(p_reward_balance, 0))
  ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
    SET available_balance = CASE
          WHEN p_sync_balances AND wallet_accounts.wallet_type = 'main' THEN EXCLUDED.available_balance
          WHEN p_sync_balances AND wallet_accounts.wallet_type = 'reward' THEN EXCLUDED.available_balance
          ELSE wallet_accounts.available_balance
        END,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_wallet_accounts_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.ensure_wallet_accounts(
    NEW.id,
    'USD',
    COALESCE(NEW.wallet_balance, 0),
    COALESCE(NEW.reward_balance, 0)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_wallet_accounts ON profiles;
CREATE TRIGGER profiles_sync_wallet_accounts
  AFTER INSERT OR UPDATE OF wallet_balance, reward_balance ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_accounts_from_profile();

CREATE OR REPLACE FUNCTION public.record_wallet_adjustment(
  p_user_id UUID,
  p_wallet_type TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_transaction_type TEXT DEFAULT 'admin_adjustment',
  p_reason TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  account_row wallet_accounts%ROWTYPE;
  next_balance NUMERIC(15, 2);
  transaction_id UUID;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be non-zero.';
  END IF;

  PERFORM public.ensure_wallet_accounts(p_user_id, p_currency, 0, 0, FALSE);

  SELECT *
  INTO account_row
  FROM wallet_accounts
  WHERE user_id = p_user_id
    AND wallet_type = p_wallet_type
    AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet account not found.';
  END IF;

  next_balance := ROUND(account_row.available_balance + p_amount, 2);

  IF next_balance < 0 THEN
    RAISE EXCEPTION 'Wallet account balance cannot go below zero.';
  END IF;

  UPDATE wallet_accounts
  SET available_balance = next_balance,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = account_row.id;

  IF p_wallet_type = 'main' THEN
    UPDATE profiles SET wallet_balance = next_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  ELSIF p_wallet_type = 'reward' THEN
    UPDATE profiles SET reward_balance = next_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  END IF;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    currency,
    status,
    wallet_type,
    wallet_account_id,
    note,
    metadata
  )
  VALUES (
    p_user_id,
    p_transaction_type,
    p_amount,
    next_balance,
    p_currency,
    'available',
    p_wallet_type,
    account_row.id,
    p_reason,
    jsonb_build_object(
      'walletType', p_wallet_type,
      'performedBy', p_performed_by,
      'reason', p_reason
    )
  )
  RETURNING id INTO transaction_id;

  RETURN jsonb_build_object(
    'wallet_account_id', account_row.id,
    'transaction_id', transaction_id,
    'balance_after', next_balance,
    'wallet_type', p_wallet_type,
    'currency', p_currency
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_wallet_balance(
  p_user_id UUID,
  p_from_wallet_type TEXT,
  p_to_wallet_type TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_account wallet_accounts%ROWTYPE;
  destination_account wallet_accounts%ROWTYPE;
  transfer_row wallet_transfers%ROWTYPE;
  source_balance NUMERIC(15, 2);
  destination_balance NUMERIC(15, 2);
  source_transaction_id UUID;
  destination_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero.';
  END IF;

  IF p_from_wallet_type = p_to_wallet_type THEN
    RAISE EXCEPTION 'Source and destination wallet types must differ.';
  END IF;

  PERFORM public.ensure_wallet_accounts(p_user_id, p_currency, 0, 0, FALSE);

  SELECT * INTO source_account
  FROM wallet_accounts
  WHERE user_id = p_user_id AND wallet_type = p_from_wallet_type AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source wallet account not found.';
  END IF;

  SELECT * INTO destination_account
  FROM wallet_accounts
  WHERE user_id = p_user_id AND wallet_type = p_to_wallet_type AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination wallet account not found.';
  END IF;

  IF source_account.available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in the source wallet.';
  END IF;

  source_balance := ROUND(source_account.available_balance - p_amount, 2);
  destination_balance := ROUND(destination_account.available_balance + p_amount, 2);

  UPDATE wallet_accounts
  SET available_balance = source_balance,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = source_account.id;

  UPDATE wallet_accounts
  SET available_balance = destination_balance,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = destination_account.id;

  IF p_from_wallet_type = 'main' THEN
    UPDATE profiles SET wallet_balance = source_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  ELSIF p_from_wallet_type = 'reward' THEN
    UPDATE profiles SET reward_balance = source_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  END IF;

  IF p_to_wallet_type = 'main' THEN
    UPDATE profiles SET wallet_balance = destination_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  ELSIF p_to_wallet_type = 'reward' THEN
    UPDATE profiles SET reward_balance = destination_balance, updated_at = CURRENT_TIMESTAMP WHERE id = p_user_id;
  END IF;

  INSERT INTO wallet_transfers (
    user_id,
    from_wallet_account_id,
    to_wallet_account_id,
    amount,
    currency,
    status,
    transfer_category,
    note
  )
  VALUES (
    p_user_id,
    source_account.id,
    destination_account.id,
    p_amount,
    p_currency,
    'completed',
    'internal',
    p_note
  )
  RETURNING * INTO transfer_row;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    currency,
    status,
    wallet_type,
    wallet_account_id,
    counterparty_wallet_type,
    transfer_id,
    note,
    metadata
  )
  VALUES (
    p_user_id,
    'transfer_out',
    -p_amount,
    source_balance,
    p_currency,
    'completed',
    p_from_wallet_type,
    source_account.id,
    p_to_wallet_type,
    transfer_row.id,
    p_note,
    jsonb_build_object(
      'direction', 'out',
      'fromWalletType', p_from_wallet_type,
      'toWalletType', p_to_wallet_type,
      'transferId', transfer_row.id
    )
  )
  RETURNING id INTO source_transaction_id;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    currency,
    status,
    wallet_type,
    wallet_account_id,
    counterparty_wallet_type,
    transfer_id,
    note,
    metadata
  )
  VALUES (
    p_user_id,
    'transfer_in',
    p_amount,
    destination_balance,
    p_currency,
    'completed',
    p_to_wallet_type,
    destination_account.id,
    p_from_wallet_type,
    transfer_row.id,
    p_note,
    jsonb_build_object(
      'direction', 'in',
      'fromWalletType', p_from_wallet_type,
      'toWalletType', p_to_wallet_type,
      'transferId', transfer_row.id
    )
  )
  RETURNING id INTO destination_transaction_id;

  UPDATE wallet_transfers
  SET reference_transaction_id = source_transaction_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = transfer_row.id;

  RETURN jsonb_build_object(
    'transfer_id', transfer_row.id,
    'source_transaction_id', source_transaction_id,
    'destination_transaction_id', destination_transaction_id,
    'source_balance_after', source_balance,
    'destination_balance_after', destination_balance,
    'currency', p_currency
  );
END;
$$;

CREATE OR REPLACE VIEW wallet_audit_logs AS
  SELECT
    id,
    user_id,
    'transaction'::text AS entry_type,
    transaction_type AS event_type,
    wallet_type,
    amount,
    currency,
    balance_after,
    status,
    note,
    reference_id::text AS reference_id,
    metadata,
    created_at
  FROM wallet_transactions
  UNION ALL
  SELECT
    id,
    user_id,
    'transfer'::text AS entry_type,
    transfer_category AS event_type,
    NULL::text AS wallet_type,
    amount,
    currency,
    NULL::NUMERIC AS balance_after,
    status,
    note,
    reference_transaction_id::text AS reference_id,
    jsonb_build_object(
      'fromWalletAccountId', from_wallet_account_id,
      'toWalletAccountId', to_wallet_account_id
    ) AS metadata,
    created_at
  FROM wallet_transfers
  UNION ALL
  SELECT
    id,
    user_id,
    'ledger'::text AS entry_type,
    COALESCE(reason, 'ledger_entry') AS event_type,
    NULL::text AS wallet_type,
    amount,
    'USD'::text AS currency,
    balance_after,
    NULL::text AS status,
    note,
    NULL::text AS reference_id,
    jsonb_build_object('reason', reason) AS metadata,
    created_at
  FROM wallet_ledger
  UNION ALL
  SELECT
    id,
    user_id,
    'reward'::text AS entry_type,
    action AS event_type,
    NULL::text AS wallet_type,
    amount,
    currency,
    NULL::NUMERIC AS balance_after,
    status,
    reason AS note,
    reward_id::text AS reference_id,
    jsonb_build_object('performedBy', performed_by) AS metadata,
    created_at
  FROM reward_ledger
  UNION ALL
  SELECT
    id,
    user_id,
    'withdrawal'::text AS entry_type,
    status AS event_type,
    NULL::text AS wallet_type,
    amount,
    currency,
    net_amount AS balance_after,
    status,
    admin_notes AS note,
    wallet_transaction_id::text AS reference_id,
    jsonb_build_object(
      'method', method,
      'approvalWorkflow', approval_workflow,
      'destinationCurrency', destination_currency
    ) AS metadata,
    created_at
  FROM withdrawal_requests;

INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
SELECT id, 'main', 'USD', COALESCE(wallet_balance, 0)
FROM profiles
ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
  SET available_balance = EXCLUDED.available_balance,
      updated_at = CURRENT_TIMESTAMP;

INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
SELECT id, 'reward', 'USD', COALESCE(reward_balance, 0)
FROM profiles
ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
  SET available_balance = EXCLUDED.available_balance,
      updated_at = CURRENT_TIMESTAMP;

INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
SELECT id, 'bonus', 'USD', 0
FROM profiles
ON CONFLICT (user_id, wallet_type, currency) DO NOTHING;

INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
SELECT id, 'referral', 'USD', 0
FROM profiles
ON CONFLICT (user_id, wallet_type, currency) DO NOTHING;

INSERT INTO wallet_accounts (user_id, wallet_type, currency, available_balance)
SELECT id, 'cashback', 'USD', 0
FROM profiles
ON CONFLICT (user_id, wallet_type, currency) DO NOTHING;
