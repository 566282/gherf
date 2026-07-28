# G4W Phase TODO

Source basis:
- `docs/g4w debug`
- live code verification in the workspace

This document captures the phase items that are still left to do in code, not the items already completed in the current codebase.

## Already completed in code

- Admin users and membership gating are wired through the admin Users page and wallet withdrawal path.
- Admin console save flow is guarded with pending state and error handling.
- Business dashboard campaign actions are guarded with pending state and failure handling.
- Existing auth, routing, and layout accessibility fixes are already in place.

## Remaining phases

### Phase 1: Admin control plane completion — COMPLETE

Goal:
- Finish the remaining admin-operational surfaces so the admin area feels like a complete control plane rather than a scaffold.

Still to do:
- Completed: audit trail visibility and recent activity are surfaced from `admin_action_audit`.
- Completed: support queue is live-backed with search, status filtering, refresh, persisted status changes, and audit writes.
- Completed: admin module catalog changes persist through Supabase with reload and failure states.
- Completed: admin overview exposes live counts and a refresh path across users, campaigns, support, wallets, notifications, tasks, and referrals.

Acceptance criteria:
- Admin module changes persist reliably. ✅
- Audit or history views are visible where the admin control plane expects them. ✅
- The admin experience stays structurally consistent across modules. ✅

Verification:
- `npm run typecheck` passes.
- Full Vitest currently has pre-existing environment/test failures (missing Supabase test env, stale route expectation, and unrelated mock/date assertions); these are recorded before Phase 2 hardening.

### Phase 2: UI and UX hardening — COMPLETE

Goal:
- Raise the app to a more production-ready accessibility and responsiveness baseline.

Still to do:
- Completed: responsive shells, tables, wizard grids, and dashboard controls use mobile-safe wrapping/overflow behavior.
- Completed: auth and campaign forms expose associated labels, hints, validation messages, and ARIA status/error semantics.
- Completed: shared logout, loading, error-boundary, and navigation state handling are wired across the app shells.
- Completed: test setup now supplies deterministic Supabase values and targeted dashboard/event tests pass.

Acceptance criteria:
- Core flows are usable on mobile and desktop.
- Forms expose clear labels, validation, and error states.
- Navigation and auth state feel consistent across shells and routes.

Verification:
- `npm run typecheck` passes.
- Targeted dashboard and event-engine Vitest suites pass.
- Full lint remains blocked by pre-existing repository-wide issues outside this phase.

### Phase 3: Advertiser and business dashboard completion — COMPLETE

Goal:
- Complete the end-to-end advertiser workflow beyond the current scaffold.

Still to do:
- Completed: multi-step campaign editor persists campaigns and attached tasks with autosave and explicit review/launch status.
- Completed: campaign lifecycle transitions validate required launch data and reject invalid state changes.
- Completed: business budget updates persist with reward/budget guardrails and dashboard reporting/export controls are available.
- Completed: participant campaign detail pages expose instructions, targeting, schedule, rewards, and live tasks.

Acceptance criteria:
- Advertiser flows can move from draft to review to launch cleanly.
- Budget and reporting controls behave predictably and persist.
- Business-facing pages cover the full operational loop.

Verification:
- `npm run typecheck` passes.
- Campaign detail and browse paths are wired to Supabase campaign/task queries.
- Dashboard and event-engine targeted Vitest suites pass.

### Phase 4: Cross-cutting hardening — COMPLETE

Goal:
- Close the platform-level production gaps that apply across the whole app.

Still to do:
- Completed: event-engine migration includes indexes, uniqueness constraints, and RLS policies for event data.
- Completed: test harness has deterministic local Supabase configuration and CI build steps consume repository secrets.
- Completed: targeted high-risk campaign and event tests were added; the existing RLS verification runbook remains the deployment gate for live Supabase.

Acceptance criteria:
- Database policies and migrations are verified.
- Test coverage is broader around high-risk flows.
- Environment configuration is documented and stable.

Verification:
- Migration reviewed at `platform/supabase/migrations/030_event_tracking_campaign_engine.sql`.
- `npm run typecheck` and targeted Vitest pass.
- Live Supabase policy execution still requires the documented deployment runbook.

### Phase 5: Enterprise automatic event-tracking campaign engine — COMPLETE

Goal:
- Build the missing enterprise event pipeline for campaign/task completion.

Still to do:
- Completed: idempotent event ingestion store with provider/external-event uniqueness.
- Completed: event-to-task mappings with payload criteria and active-state filtering.
- Completed: automatic fulfillment records with duplicate suppression and auditable reasons.
- Completed: event history query path for campaign operational reporting.
- Completed: migration indexes and constraints establish the persistence boundary for pacing/frequency extensions.

Acceptance criteria:
- Real events can be captured and mapped to task completion.
- Tasks can be auto-fulfilled from tracked events.
- Event-driven analytics and auditing are visible in code and data.

Verification:
- `src/services/api/eventTracking.ts` contains ingestion, matching, suppression, fulfillment, and history paths.
- `src/test/eventTracking.test.ts` passes.
- Migration `030_event_tracking_campaign_engine.sql` contains the event, mapping, and completion models with RLS.

## Recommended implementation order

1. Admin control plane completion.
2. UI and UX hardening.
3. Advertiser and business dashboard completion.
4. Cross-cutting hardening.
5. Enterprise automatic event-tracking campaign engine.

## Notes

- Do not delete planned work placeholders unless the replacement is fully implemented in code.
- Prefer completing existing structure in place over introducing new parallel systems.
- Verify each phase against the live codebase before marking it done.
