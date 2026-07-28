# G4W Phase TODO

Source basis:

- `docs/g4w debug`
- `platform/docs/PRODUCTION_READINESS_AUDIT.md`
- `platform/docs/RLS_VERIFICATION.md`
- `platform/docs/OBSERVABILITY.md`
- live code and test inventory under `platform/src/`

This checklist separates functionality already implemented in the repository from work that still requires implementation, live-environment validation, or release configuration. A migration or runbook is not treated as live verification until it has been executed against the target Supabase project.

Status: Phases 1–5 are code-complete for their documented scope. Phase 6 is in progress and is the current release gate.

## Completed in code

- Admin users and membership gating are wired through the admin Users page and wallet withdrawal path.
- Admin console save flows and business dashboard campaign actions have pending-state and failure handling.
- Responsive shells, tables, wizard grids, and dashboard controls include mobile-safe wrapping or overflow behavior.
- Auth and campaign forms include labels, hints, validation, and ARIA status/error semantics in the implemented surfaces.
- Shared logout, loading, error-boundary, and navigation-state handling are wired across the app shells.
- Campaign editing persists campaigns and attached tasks with autosave and review/launch state handling.
- Campaign lifecycle validation rejects invalid transitions and missing launch data.
- Business budget updates, reward/budget guardrails, dashboard reporting, and export controls are implemented.
- Participant campaign detail pages expose instructions, targeting, schedule, rewards, and live tasks.
- Event tracking has an idempotent ingestion path, provider/external-event uniqueness, event-to-task mappings, automatic fulfillment records, duplicate suppression, and event history queries.
- Event-engine migrations include indexes, constraints, and RLS policies in `platform/supabase/migrations/030_event_tracking_campaign_engine.sql`.
- Deterministic Supabase test configuration, CI validation, app-level error recovery, centralized logging, and deployment documentation are present.
- Automated coverage already includes dashboard, protected-route, admin, wallet, campaign/task, and event-engine tests.

## Phase 6: Production validation and release hardening — IN PROGRESS

Goal:

- Prove the implemented auth, authorization, database, and deployment controls in the live environment before calling the G4W build production-ready.

### 6.1 Supabase migrations and RLS — NOT COMPLETE

Implementation plan:

1. Confirm the target Supabase project, branch, migration baseline, and backup/PITR state.
2. Apply all pending migrations in order, including `030_event_tracking_campaign_engine.sql` and the latest CMS/operational migrations.
3. Record the migration result and schema version in the release evidence.
4. Execute the manual and SQL checks in `platform/docs/RLS_VERIFICATION.md` using at least a regular user, business/advertiser, and super-admin session.
5. Verify direct cross-user reads/writes fail, role-scoped operations succeed, storage policies hold, and important indexes exist.
6. Re-run the checks after deployment and attach the results to the release record.

Completed:

- Migration files and policy definitions exist in the repository.
- The RLS verification runbook and deployment checklist exist.
- Event-engine policies and constraints have been reviewed in code.

Yet to do:

- Apply the migrations to the live Supabase project.
- Verify every relevant policy and index with live credentials.
- Capture evidence of both allowed and denied operations.

Exit criteria:

- No pending production migrations.
- All role and ownership checks pass in the live project.
- No client workflow depends on an unrestricted table or RPC.

### 6.2 Auth, role access, and post-verification activation — NOT COMPLETE

Implementation plan:

1. Reproduce sign-up for user and business/advertiser roles with email confirmation enabled.
2. Confirm the profile role is preserved from sign-up metadata through profile bootstrap and session refresh.
3. After email verification, transition `pending_verification` accounts to `active` through a server-trusted trigger/RPC or an equivalent idempotent flow.
4. Confirm active users reach the correct dashboard and inactive, suspended, banned, or wrong-role users remain blocked.
5. Validate logout, refresh, expired-session, password-reset, resend-verification, and unauthorized-route behavior.
6. Add regression coverage for the complete flow before live smoke testing.

Completed:

- Email/password auth, resend verification, password reset, role metadata, protected routes, middleware, and role gates are implemented.
- The restricted-route failure has been narrowed to verified profiles remaining in `pending_verification` after email confirmation.

Yet to do:

- Fix and verify the post-email-verification profile status transition.
- Run end-to-end role and activation checks against live Supabase Auth.
- Confirm session/profile state converges after verification and token refresh.

Exit criteria:

- Verified user and advertiser accounts can sign in and reach their permitted dashboards.
- Unverified or inactive accounts cannot access protected workflows.
- Cross-role route access is denied in both UI navigation and direct URL access.

### 6.3 Automated auth, protected-route, and dashboard coverage — NOT COMPLETE

Implementation plan:

1. Add unit tests for profile-status transitions, role resolution, middleware decisions, and session refresh behavior.
2. Add integration tests for sign-up, verification callback, resend verification, login, logout, password reset, and activation failure states.
3. Add protected-route tests for anonymous, pending, active, suspended, banned, wrong-role, and expired-session users.
4. Expand dashboard workflow tests for campaign draft/review/launch, budget guards, task completion, wallet actions, and admin mutations.
5. Add live or isolated Supabase integration coverage for representative RLS allow/deny cases.
6. Run the expanded suite in CI and retain coverage output as a release artifact.

Completed:

- Vitest setup is deterministic and targeted suites exist for dashboards, protected routes, campaigns/tasks, wallets, admin modules, and event tracking.

Yet to do:

- Add the missing email-verification-to-activation regression tests.
- Broaden route and dashboard workflow coverage to failure, refresh, and permission-denied states.
- Add an integration/E2E layer that exercises real Supabase behavior or a controlled Supabase test project.

Exit criteria:

- Critical auth and role workflows have deterministic regression coverage.
- Protected-route and dashboard tests cover both success and denial paths.
- CI passes the expanded suite without relying on production credentials.

### 6.4 Deployment secrets, observability, and external error reporting — NOT COMPLETE

Implementation plan:

1. Configure separate preview and production values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_ENV` in Netlify/GitHub Actions.
2. Configure Netlify deployment credentials and confirm secrets are not exposed in logs or committed files.
3. Select an external error-reporting provider and add its DSN/endpoint as a deployment secret, not a source-controlled value.
4. Connect `platform/src/lib/logger.ts` and the global error boundary to the provider with secret/token redaction and environment tagging.
5. Configure Web Vitals and release-health reporting, plus alerts for repeated client errors and failed notification workers/RPCs.
6. Perform a preview deployment, trigger a controlled test error, verify the external event, then promote to production.
7. Document rollback, alert ownership, secret rotation, and post-deploy smoke checks.

Completed:

- `.env.example`, CI/deploy workflow, Netlify configuration, centralized logger, global error boundary, and observability guidance exist.
- CI is wired to consume Supabase variables and Netlify deployment credentials.

Yet to do:

- Populate and verify the live preview/production secrets.
- Select and integrate an external error-reporting sink.
- Verify Web Vitals, runtime alerts, deployment notifications, and rollback procedures in production.

Exit criteria:

- Preview and production builds use the intended environment configuration.
- A controlled client error is visible in the external monitoring system with secrets redacted.
- On-call ownership and rollback steps are documented and tested.

## Phase completion summary

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Admin control plane | Code complete |
| 2 | UI and UX hardening | Code complete |
| 3 | Advertiser/business dashboard | Code complete |
| 4 | Cross-cutting database, CI, and test hardening | Code complete; live verification pending |
| 5 | Automatic event-tracking campaign engine | Code complete; live migration/RLS verification pending |
| 6 | Production validation and release hardening | In progress |

## Recommended execution order

1. Fix the verified-account activation transition.
2. Add auth and protected-route regression coverage for that transition.
3. Apply migrations and execute the live RLS verification runbook.
4. Configure deployment secrets and external observability.
5. Run preview and production smoke tests, then close Phase 6 only when all exit criteria pass.

## Release evidence to retain

- Migration output and live schema/policy verification results.
- Auth and role-flow smoke-test results for each account state.
- CI test, typecheck, build, and coverage artifacts.
- Preview/production deployment URLs and environment checklist.
- Controlled error-reporting event and alert/rollback test results.
