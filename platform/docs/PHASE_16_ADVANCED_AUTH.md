# Phase 16: Advanced Authentication (Supabase Auth)

## Scope

This phase finalizes authentication requirements on top of the production architecture:

- Email login
- Google login
- Facebook login
- Apple login
- Phone OTP login
- Password reset
- Email verification
- Two-factor authentication (MFA, TOTP)
- Session management
- JWT and refresh token handling
- Account locking
- Device management
- Remember login
- User profile and admin profile access controls
- Role permissions with route middleware and RLS

## What Was Added

### Frontend Auth API

Updated `src/services/api/auth.ts` with:

- OAuth providers:
  - `signInWithGoogle()`
  - `signInWithFacebook()`
  - `signInWithApple()`
- Phone OTP:
  - `requestPhoneOtp(phone)`
  - `verifyPhoneOtp(phone, token, rememberLogin?)`
- MFA (Supabase TOTP):
  - `listMfaFactors()`
  - `enrollTotpFactor(friendlyName?)`
  - `verifyTotpEnrollment(factorId, code)`
  - `challengeMfa(factorId)`
  - `verifyMfaChallenge(factorId, challengeId, code)`
  - `unenrollMfaFactor(factorId)`
- Session/device operations:
  - `listActiveSessions()`
  - `revokeSession(sessionId, reason?)`
- Account lock support:
  - login checks `security_is_auth_locked(...)`
  - failed attempts call `security_handle_auth_failure(...)`
  - successful auth calls `security_handle_auth_success(...)`
- Remember login:
  - password and OTP login accept `rememberLogin` and register trusted sessions.

### Route Middleware

Added `src/app/router/middleware.ts`:

- `guestOnlyMiddleware()` blocks auth pages for already signed-in users.
- `requireAuthMiddleware(requiredRoles?)` protects route trees using session + profile role checks.

Applied middleware in `src/app/router/index.tsx` to:

- `/login`, `/signup`, `/forgot-password`, `/reset-password` (guest only)
- `/app` (authenticated user)
- `/business` (advertiser or campaign manager)
- `/admin` (super admin)

### Security Center UI

Updated `src/features/profile/pages/ProfilePage.tsx` to include:

- MFA enrollment and verification workflow (TOTP)
- MFA factor list and removal
- Active device/session list
- Session revoke actions

### Login UI

Updated `src/features/auth/pages/LoginPage.tsx` to include:

- Remember login checkbox
- Facebook and Apple OAuth actions
- Phone OTP request/verify flow
- Existing email/password + Google + reset support

### Session Telemetry

Updated `src/app/providers/AuthProvider.tsx` to register security session metadata on:

- `SIGNED_IN`
- `TOKEN_REFRESHED`

## SQL / Migration

Added migration:

- `supabase/migrations/010_advanced_auth_controls.sql`

Migration contents:

- `security_auth_states` table for authentication lock state
- indexes and RLS policies
- `security_handle_auth_failure(...)`
- `security_handle_auth_success(...)`
- `security_is_auth_locked(...)`
- `security_attach_auth_state_user(...)`

## Supabase Dashboard Configuration Checklist

These app features require corresponding Supabase configuration:

1. Authentication Providers
- Enable Google provider
- Enable Facebook provider
- Enable Apple provider

2. Phone Auth
- Enable phone auth and SMS provider credentials

3. MFA
- Enable MFA for the project
- Enable TOTP factor

4. Redirect URLs
- Include application URLs for OAuth and email recovery redirects

5. Email Templates
- Verify signup confirmation template
- Verify password reset template

## Security Practices Used

- PKCE flow enabled in Supabase client
- persisted sessions + auto refresh token handling
- route middleware + UI guards + RLS checks
- lockout throttling with DB-backed failure state
- hashed storage for sensitive security telemetry in prior migrations
- session/device observability and revocation controls

## Notes

- Supabase issues and rotates JWT/refresh tokens automatically via client SDK.
- Social and phone auth paths will fail until corresponding providers are configured in the Supabase project.
- Account locking is applied at app auth entry points and can be tuned in SQL function parameters.
