# Wallet Reconciliation Runbook

Use the admin-only reconciliation control in the Wallet Management page when wallet accounts and legacy profile balances drift out of sync.

## When to run

- After importing legacy wallet data.
- After a failed payout or reversal that touched profiles directly.
- After any manual data patch to `profiles.wallet_balance` or `profiles.reward_balance`.

## What it does

- Reconciles `profiles.wallet_balance` into the `main` wallet account.
- Reconciles `profiles.reward_balance` into the `reward` wallet account.
- Records audit entries in `admin_action_audit`.
- Leaves bonus, referral, and cashback accounts unchanged unless they already diverged for another reason.

## How to run

1. Open `/admin/wallet`.
2. Enter a specific user ID to reconcile only that account, or leave it blank to reconcile all profiles.
3. Click `Reconcile wallets`.
4. Verify the confirmation message and spot-check the wallet account rows and audit log.

## Validation checklist

- `profiles.wallet_balance` matches the `main` wallet account.
- `profiles.reward_balance` matches the `reward` wallet account.
- The wallet audit log shows a reconciliation entry.
- No unintended balance changes appear in `wallet_transactions`.
