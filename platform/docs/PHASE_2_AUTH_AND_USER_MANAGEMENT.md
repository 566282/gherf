# Phase 2: Authentication and User Management

## Delivered

- Email signup and login with password recovery
- Google OAuth sign-in entry point
- Email verification resend flow
- Password reset flow
- Profile page with wallet balance, rewards, referrals, notifications, levels, badges, reputation, and two-factor preference display
- Admin user management console with suspend, ban, verify, balance adjustment, profile editing, and password reset actions
- Activity log feed for admin actions

## Schema Additions

- Extended `profiles` with referral, wallet, verification, badge, reputation, and security columns
- Added `user_notifications`
- Added `wallet_ledger`
- Added `user_activity_logs`
- Added profile bootstrap trigger for `auth.users` inserts
- Added RLS policies for the new user-facing tables

## Notes

- Google login depends on Supabase OAuth provider configuration.
- Admin password reset is implemented as a reset-email dispatch.
- Advanced auth controls (Facebook, Apple, phone OTP, MFA enrollment/challenge, account locking, device/session management) are implemented in Phase 16. See `docs/PHASE_16_ADVANCED_AUTH.md`.
