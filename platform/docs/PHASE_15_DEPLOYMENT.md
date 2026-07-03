# Phase 15: Deployment and Operations

## Scope Delivered

This phase formalizes the production deployment and operations model across Netlify, Supabase, GitHub Actions, environment management, monitoring, error logging, analytics, and backups.

## Deployment Topology

### Netlify hosting

- Frontend builds are published from `dist`.
- `netlify.toml` provides build settings, SPA redirects, and security headers.
- Production and preview environments should use separate Netlify contexts and secrets.

### Supabase production backend

- Production should run on a dedicated Supabase project or production branch.
- Apply migrations before each release promotion.
- Keep frontend access limited to the public anon key; reserve privileged access for trusted server-side code.

## GitHub Actions Pipeline

### Continuous validation

- Pull requests validate the release surface with:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

### Production deployment

- Main branch pushes can publish to Netlify after a successful validation run.
- Required deployment secrets:
  - `NETLIFY_AUTH_TOKEN`
  - `NETLIFY_SITE_ID`
- Required build variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_APP_ENV=production`

## Environment Variables

- Local development uses `.env.example` as the template.
- Production and preview values must be configured in Netlify and GitHub Actions secrets/variables.
- Do not commit `.env.local` or any production credential file.

## Monitoring and Error Logging

- Capture deployment failures from GitHub Actions.
- Use application error logging for runtime exceptions and unhandled request failures.
- Track release health through analytics and user-facing error signals after deployment.

## Analytics

- Confirm analytics instrumentation remains active in production after each release.
- Validate dashboard data after deploys that affect campaign, reward, or performance reporting.
- Treat analytics regressions as release blockers when they affect operational decision-making.

## Backup and Recovery

- Keep backup policy settings in Supabase-backed platform configuration.
- Require point-in-time recovery and restore drills for production data.
- Document rollback and data-restore procedures in the release runbook.

## Operational Notes

- Deploy schema changes before enabling dependent UI or API features.
- Verify RLS and storage policy behavior in production before marketing traffic is routed.
- Use the release pipeline as the authoritative gate for production promotion.