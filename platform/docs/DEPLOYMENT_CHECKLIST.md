# Deployment Checklist

## Before Deploy

- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured for the target environment.
- Confirm `VITE_APP_ENV=production` in Netlify production context.
- Verify migrations are applied to the target Supabase project.
- Confirm RLS policies are enabled for all application tables.
- Run lint, typecheck, tests, and build locally or in CI.
- Apply notification-related migrations in order: `016_notification_delivery_infra.sql`, `017_withdrawal_scheduled_date.sql`, then `018_notification_queue_worker.sql`.
- Verify the `notify_super_admins`, `process_notification_queue`, and `retry_notification_queue_item` RPCs exist in the target Supabase project before release.

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 20
- Keep the SPA redirect to `index.html`.
- Keep the long-lived immutable asset cache headers.

## Supabase

- Use a dedicated production project or production branch.
- Review auth settings, redirect URLs, and session lifetimes.
- Verify service-role keys are not exposed to frontend code.
- Validate storage and table policies after each schema release.
- Confirm the notification queue tables are accessible only through RLS and that `FORCE ROW LEVEL SECURITY` is enabled.
- Set up a scheduled job or Supabase cron to invoke `process_notification_queue` at a regular interval, and make sure failure alerts are visible in logs.
- If you use Supabase scheduled functions instead of database cron, document the invocation interval and owner credentials in the project notes.

## Release

- Deploy schema changes before dependent frontend features.
- Verify login, logout, password reset, and role-based routes after deploy.
- Confirm error logging and analytics endpoints still resolve.
- Smoke-test mobile and desktop layouts on the live URL.
- Validate that a withdrawal request immediately creates a user notice and a super-admin alert, and that the user message states withdrawals remain blocked until the fixed date.

## Rollback

- Keep the last known good Netlify deployment available.
- Maintain a rollback order for DB migrations and feature flags.
- Document restore steps for backups and point-in-time recovery.
- If the queue worker causes issues, disable the cron or scheduled job first, then revert the delivery migration after confirming no in-flight queue items are pending.
