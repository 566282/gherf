# Deployment Checklist

## Before Deploy

- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured for the target environment.
- Confirm `VITE_APP_ENV=production` in Netlify production context.
- Verify migrations are applied to the target Supabase project.
- Confirm RLS policies are enabled for all application tables.
- Run lint, typecheck, tests, and build locally or in CI.

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

## Release

- Deploy schema changes before dependent frontend features.
- Verify login, logout, password reset, and role-based routes after deploy.
- Confirm error logging and analytics endpoints still resolve.
- Smoke-test mobile and desktop layouts on the live URL.

## Rollback

- Keep the last known good Netlify deployment available.
- Maintain a rollback order for DB migrations and feature flags.
- Document restore steps for backups and point-in-time recovery.
