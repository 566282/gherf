# Local Referral Validation

Use the local Supabase stack for the referral engine before touching any shared or older project.

1. Start the local stack and apply the referral migrations in order.
2. Seed the default referral program and backfill from existing profiles.
3. Verify the referral ops console reads `referral_programs`, `referral_attributions`, `referral_commission_ledger`, `referral_fraud_flags`, and `referral_leaderboard_snapshots`.
4. Run the referral-focused tests:
   - `platform/src/test/referralSignup.test.ts`
   - `platform/src/test/referralSignupPlan.test.ts`
   - `platform/src/test/referralOps.test.ts`
   - `platform/src/test/referralAnalytics.test.ts`
5. Confirm commission release windows respect each program's `payout_delay_days` before allowing a release action.

Notes:
- Do not apply these migrations to the older remote Supabase project.
- The referral signup flow should remain trigger-driven so attribution, commission ledger rows, and leaderboard snapshots stay atomic.