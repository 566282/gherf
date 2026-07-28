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

### Phase 1: Admin control plane completion

Goal:
- Finish the remaining admin-operational surfaces so the admin area feels like a complete control plane rather than a scaffold.

Still to do:
- Audit trails and change history completion.
- Deeper module-level operational flows for analytics, reporting, wallet management, support, permissions, and CMS.
- Consistent save, reload, and error states across admin modules.
- Review and complete any planned placeholders without deleting them.

Acceptance criteria:
- Admin module changes persist reliably.
- Audit or history views are visible where the admin control plane expects them.
- The admin experience stays structurally consistent across modules.

### Phase 2: UI and UX hardening

Goal:
- Raise the app to a more production-ready accessibility and responsiveness baseline.

Still to do:
- Broader mobile responsiveness checks.
- Keyboard and label coverage for remaining forms and controls.
- Better validation messaging on remaining forms.
- More consistent auth and navigation state handling.
- Reliability hardening and external reporting improvements.

Acceptance criteria:
- Core flows are usable on mobile and desktop.
- Forms expose clear labels, validation, and error states.
- Navigation and auth state feel consistent across shells and routes.

### Phase 3: Advertiser and business dashboard completion

Goal:
- Complete the end-to-end advertiser workflow beyond the current scaffold.

Still to do:
- Campaign launch flow completion.
- Campaign review and approval flow completion.
- Budget control refinement and persistence.
- Reporting and operational summaries for advertisers.
- Any missing business-dashboard edge cases around state transitions.

Acceptance criteria:
- Advertiser flows can move from draft to review to launch cleanly.
- Budget and reporting controls behave predictably and persist.
- Business-facing pages cover the full operational loop.

### Phase 4: Cross-cutting hardening

Goal:
- Close the platform-level production gaps that apply across the whole app.

Still to do:
- Supabase migrations and RLS verification.
- Test coverage expansion.
- Environment and deployment secret hardening.
- Production readiness checks that prove the app is closer to a launched platform than a prototype.

Acceptance criteria:
- Database policies and migrations are verified.
- Test coverage is broader around high-risk flows.
- Environment configuration is documented and stable.

### Phase 5: Enterprise automatic event-tracking campaign engine

Goal:
- Build the missing enterprise event pipeline for campaign/task completion.

Still to do:
- Event ingestion and event store.
- Event-to-task mapping.
- Automatic external verification through SDK or webhook paths.
- Eligibility filtering and suppression for already completed tasks.
- Campaign pacing, budget capping, and frequency enforcement.
- Event-based attribution and analytics.
- A dedicated event history model.

Acceptance criteria:
- Real events can be captured and mapped to task completion.
- Tasks can be auto-fulfilled from tracked events.
- Event-driven analytics and auditing are visible in code and data.

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
