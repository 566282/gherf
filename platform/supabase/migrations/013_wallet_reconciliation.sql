-- 013_wallet_reconciliation.sql
-- Reconciles legacy profile wallet balances into the wallet_accounts and wallet_transactions model.

CREATE OR REPLACE FUNCTION public.reconcile_wallet_accounts(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_row profiles%ROWTYPE;
  main_account wallet_accounts%ROWTYPE;
  reward_account wallet_accounts%ROWTYPE;
  main_diff NUMERIC(15, 2);
  reward_diff NUMERIC(15, 2);
  reconciled_count INTEGER := 0;
  adjusted_count INTEGER := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can run wallet reconciliation.';
  END IF;

  FOR profile_row IN
    SELECT *
    FROM profiles
    WHERE p_user_id IS NULL OR id = p_user_id
  LOOP
    PERFORM public.ensure_wallet_accounts(
      profile_row.id,
      'USD',
      COALESCE(profile_row.wallet_balance, 0),
      COALESCE(profile_row.reward_balance, 0),
      FALSE
    );

    SELECT * INTO main_account
    FROM wallet_accounts
    WHERE user_id = profile_row.id
      AND wallet_type = 'main'
      AND currency = 'USD'
    FOR UPDATE;

    SELECT * INTO reward_account
    FROM wallet_accounts
    WHERE user_id = profile_row.id
      AND wallet_type = 'reward'
      AND currency = 'USD'
    FOR UPDATE;

    main_diff := ROUND(COALESCE(profile_row.wallet_balance, 0) - COALESCE(main_account.available_balance, 0), 2);
    reward_diff := ROUND(COALESCE(profile_row.reward_balance, 0) - COALESCE(reward_account.available_balance, 0), 2);

    IF main_diff <> 0 THEN
      PERFORM public.record_wallet_adjustment(
        profile_row.id,
        'main',
        main_diff,
        'USD',
        'exchange_adjustment',
        'Reconciled from profile wallet balance',
        auth.uid()
      );
      adjusted_count := adjusted_count + 1;
    END IF;

    IF reward_diff <> 0 THEN
      PERFORM public.record_wallet_adjustment(
        profile_row.id,
        'reward',
        reward_diff,
        'USD',
        'exchange_adjustment',
        'Reconciled from profile reward balance',
        auth.uid()
      );
      adjusted_count := adjusted_count + 1;
    END IF;

    reconciled_count := reconciled_count + 1;
  END LOOP;

  INSERT INTO admin_action_audit (
    admin_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    reason
  ) VALUES (
    auth.uid(),
    'wallet_reconcile',
    'wallet',
    COALESCE(p_user_id::text, 'all'),
    NULL,
    jsonb_build_object(
      'reconciledCount', reconciled_count,
      'adjustedCount', adjusted_count,
      'userId', p_user_id
    ),
    'Wallet reconciliation run'
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'reconciled_count', reconciled_count,
    'adjusted_count', adjusted_count
  );
END;
$$;
