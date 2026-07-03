# Phase 11: Security Hardening

## Scope Delivered

This phase implements defense-in-depth controls across database, auth workflows, client request handling, and deployment headers.

## Controls Implemented

### 1) Row-Level Security (RLS)
- Added FORCE RLS enforcement for all core business and security tables.
- Added baseline `profiles` policies for own-record access plus super-admin override.
- Added strict RLS policies for security telemetry and audit tables.

### 2) Rate Limiting
- Added `security_rate_limit_buckets` table.
- Added RPC function `security_check_rate_limit(...)`:
  - per-scope + per-identifier counters
  - sliding window reset behavior
  - temporary block windows for repeated abuse
- Integrated into client auth service for login, signup, and password reset.
- Added local in-memory fallback limiter in browser.

### 3) CAPTCHA
- Added CAPTCHA event storage table `security_captcha_events`.
- Added RPC function `security_log_captcha_event(...)`.
- Added optional CAPTCHA token flow in login/signup service methods.
- Added UI plumbing in auth pages to pass CAPTCHA token when enabled.

### 4) CSRF Protection
- Added `security_csrf_tokens` table.
- Added RPC functions:
  - `security_issue_csrf_token(...)`
  - `security_validate_csrf_token(...)`
- Added `X-CSRF-Token` header attachment in Supabase client fetch wrapper.

### 5) XSS Prevention
- Added sanitization utility module:
  - plain-text sanitization
  - email normalization
  - search-term sanitization
  - HTML escaping helper
- Applied sanitization to auth/profile/admin free-text paths.

### 6) SQL Injection Prevention
- Removed direct unsanitized interpolation in admin user search.
- Added wildcard escaping and strict character filtering for `ilike` query patterns.
- Kept Supabase query builder usage for parameterized operations.

### 7) Audit Logs
- Added `security_audit_logs` table for security events.
- Added RPC function `security_write_audit(...)`.
- Added auth-flow event logging for key lifecycle events.

### 8) Secure Authentication
- Hardened Supabase auth client config:
  - PKCE flow enabled
  - explicit secure storage key
  - request metadata headers for telemetry
- Added CAPTCHA and rate-limit checks around sign-in/sign-up.

### 9) Session Management
- Added `security_sessions` table and functions:
  - `security_register_session(...)`
  - `security_revoke_session(...)`
- Added frontend idle-timeout sign-out behavior in auth provider.
- Added session state cleanup on sign-out.

### 10) IP Monitoring
- Added `security_ip_observations` table.
- Added RPC function `security_observe_ip(...)`.
- Stores only SHA-256 hashes of IP values.

### 11) Device Monitoring
- Added `security_device_observations` table.
- Added RPC function `security_observe_device(...)`.
- Captures hashed device fingerprint observations with risk deltas.

### 12) Encryption
- Enabled `pgcrypto` extension.
- Sensitive telemetry fields are persisted as SHA-256 hashes.
- Security token values (captcha/csrf) stored as hashes, not raw values.

### 13) Backup Strategy
- Added `platform_settings.security_backup_policy` seeded config:
  - daily full backup + point-in-time recovery
  - retention policy
  - cross-region replication
  - weekly restore drill requirement
  - encryption requirement

## Migration

- New migration: `supabase/migrations/007_security_hardening.sql`

## Environment Variables

Optional runtime controls:
- `VITE_SECURITY_CAPTCHA_ENABLED`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_AUTH_SESSION_IDLE_TIMEOUT_MINUTES`
- `VITE_AUTH_MAX_SESSION_HOURS`

## Operational Notes

- CAPTCHA token verification must be completed server-side via provider API; this phase provides the storage, logging, and client integration points.
- IP values are privacy-preserving hashes in database storage. If raw IP intake is needed, collect it only in trusted server contexts.
- Security RPC functions are `SECURITY DEFINER`; keep ownership and grants restricted to trusted DB roles.
