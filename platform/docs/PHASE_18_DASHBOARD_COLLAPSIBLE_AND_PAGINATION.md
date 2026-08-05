# Phase 18: Dashboard UX Upgrade (Collapsible Layout + Pagination Minimization)

## Objective
Improve user experience across user and business dashboards by reducing cognitive overload, minimizing unnecessary pagination, and introducing progressive disclosure via collapsible sections.

## Date
August 5, 2026

## Why this phase
Current dashboards are functionally rich, but users must process too much information at once in long scroll flows. In some sections, pagination is present despite very short datasets, creating extra clicks without real value.

This phase focuses on:
- Better information hierarchy
- Faster access to primary actions
- Fewer page navigation interactions
- Accessible, keyboard-friendly collapsible behavior

## In-scope surfaces
- User dashboard page
- Business dashboard page
- Merchant dashboard page (operational business workflow)

## Current-state review summary

### User dashboard
- Activity history uses page controls with a small page size, but the source list itself is heavily capped.
- Result: users can see multi-page controls for tiny datasets.
- Secondary blocks (notifications, leaderboard, referral, achievement) are always expanded, especially dense on mobile.

### Business dashboard
- Primary issue is not strict pagination, but content density and long continuous scroll.
- Many analytical sections are always open, including heavy visual modules and tables.
- Spending history appears in more than one location, causing repetition and extra cognitive load.

### Merchant dashboard
- Several high-row operational tables are shown at once.
- This is effective for power users, but default fully-expanded behavior can overwhelm users and slow first-scan comprehension.

## UX principles for implementation
- Keep critical actions visible; collapse secondary analysis first.
- Replace hard pagination with progressive reveal where possible.
- Prioritize mobile readability and shorter scanning paths.
- Preserve analyst depth with opt-in expansion.
- Maintain full accessibility support for all collapsible controls.

## Phase rollout plan

## Phase 1: User Dashboard Quick Wins (Low Risk, High Impact)
### Goal
Remove unnecessary page friction and improve first-glance scanning.

### Changes
- Replace activity Prev/Next pagination with progressive reveal:
  - Initial visible count (example: 5)
  - Show more button increments (example: +5)
  - Optional Show less reset
- Increase upstream activity fetch depth so reveal behavior is meaningful.
- Reset reveal count when activity search or filter changes.
- Introduce a collapsed-by-default "More insights" group on smaller screens for non-primary cards.

### Expected outcome
- Fewer clicks to see relevant history
- Better mobile dashboard readability
- Lower interaction cost for routine users

## Phase 2: Business Dashboard Information Architecture
### Goal
Restructure long-scroll content into clear, collapsible workflow sections.

### Changes
- Introduce section-level collapsible groups:
  - Portfolio performance (default expanded)
  - Campaign operations (default expanded)
  - Deep analytics (default collapsed)
  - Activity and diagnostics (default collapsed)
- Remove duplicated spending-history presentation and keep one canonical component.
- Add a top "jump to section" utility row for fast navigation.

### Expected outcome
- Faster orientation and task completion
- Reduced visual overload
- Better separation between action areas and analysis areas

## Phase 3: Replace Hard Pagination Patterns with Progressive Disclosure
### Goal
Reduce rigid paging patterns in favor of context-preserving expansion.

### Changes
- Campaign tables:
  - Render top N rows first
  - Add Show more rows action
- Activity feeds:
  - Use chronological stream expansion (newer/older loading)
- Merchant operations:
  - Default to urgent subset (assigned, near SLA, blocked)
  - Expand to full list on demand
- Persist filter and disclosure state in URL params where appropriate.

### Expected outcome
- Continuity while exploring data
- Less page-state friction
- Better deep-work flow for operators

## Phase 4: Accessibility and Performance Hardening
### Goal
Ensure upgrades are inclusive, resilient, and scalable.

### Changes
- Use semantic details/summary or equivalent ARIA-compliant button-region patterns.
- Enforce keyboard support:
  - Tab order
  - Enter/Space toggle
  - Visible focus states
- Add reduced-motion support for expand/collapse transitions.
- Introduce virtualization only where row volumes justify it.

### Expected outcome
- WCAG-aligned behavior for expand/collapse interactions
- Smooth performance across low and high data volume states

## Phase 5: Instrumentation and Iteration
### Goal
Measure whether UX changes reduce friction and improve task success.

### Metrics to track
- Section expansion rate per dashboard area
- Show-more usage frequency
- Time to first key action:
  - user: resume task / claim reward
  - business: pause-resume campaign / save budget
  - merchant: accept assignment / mark payout sent
- Exit/bounce behavior from dashboard routes

### Success criteria
- Reduced interaction count before key task completion
- Reduced abandonment from dashboard entry
- Stable or improved operational task throughput
- No regression in test coverage

## Delivery sequence recommendation
1. Implement Phase 1 first (highest ROI with lowest risk)
2. Implement Business Dashboard collapsible architecture (Phase 2)
3. Apply progressive-disclosure patterns to heavy tables and feeds (Phase 3)
4. Complete accessibility/performance hardening (Phase 4)
5. Enable event instrumentation and assess impact (Phase 5)

## Testing strategy
- Unit tests for disclosure-state logic and show-more behavior
- Integration tests for filter-reset and persisted state behavior
- Accessibility checks:
  - keyboard toggling
  - screen-reader labels
  - focus management
- Responsive checks for mobile and desktop
- Regression checks for existing dashboard metrics and action controls

## Risks and mitigations
- Risk: hiding critical actions behind collapsed sections
  - Mitigation: keep task-critical controls in default-expanded areas.
- Risk: users miss content due to new collapsed defaults
  - Mitigation: use section summaries and item counts in headers.
- Risk: performance regressions from additional state handling
  - Mitigation: memoized selectors and virtualization only where needed.

## Out of scope for this phase
- Rewriting dashboard visual language/theme
- Backend schema redesign
- Cross-product navigation redesign

## Implementation notes
- Prefer reusable collapsible wrappers for consistency.
- Keep defaults role-aware (user vs advertiser vs merchant priorities).
- Preserve existing route structure and avoid breaking deep links.

## Definition of done
- Dashboard sections are collapsible where appropriate.
- Unnecessary pagination is replaced with progressive disclosure.
- Critical workflows remain prominent and reachable in one or two interactions.
- Accessibility requirements are verified.
- Metrics instrumentation is available for post-release validation.

---

## Implementation status update (Aug 5, 2026)

### Completed
- Phase 1 implemented on user dashboard:
  - Replaced activity page navigation with progressive reveal (show more/show less).
  - Increased recent activity depth by combining and sorting wallet and reward activity.
  - Added collapsible "More insights" section with accessible toggle controls.
- Phase 2 implemented on business dashboard:
  - Added section architecture controls with jump links and collapsible sections.
  - Introduced explicit section visibility controls for portfolio, campaign operations, and diagnostics.
  - Removed duplicate spending-history block from funding card.
- Phase 3 implemented on business and merchant dashboards:
  - Business campaign portfolio table now progressively reveals rows.
  - Business conversion feed and activity feed now support progressive reveal.
  - Merchant assignments, orders, and analytics tables now support progressive reveal.
  - Merchant assignment list prioritizes urgent queue subset by default when available.
- Phase 4 implemented on business and merchant dashboards:
  - Added aria-expanded and aria-controls semantics for all section toggle controls.
  - Added transition classes with reduced-motion support hooks via motion-reduce utilities.
  - Reduced repeated per-row max computations in spending-history rendering.
- Phase 5 implemented across dashboards:
  - Added shared telemetry emitter utility at src/lib/telemetry.ts.
  - Wired user/business/merchant interaction events for section toggles and progressive reveal actions.
  - Telemetry emits browser CustomEvent and supports optional dataLayer if present.

### Verified
- Typecheck: pass (`npm run typecheck`).
- Production build: pass (`npm run build`).

### Left to do
- Add/expand automated tests for:
  - Business dashboard section toggles and progressive reveal controls.
  - Merchant dashboard urgent-first assignment visibility and reveal controls.
  - Telemetry event payload assertions (user/business/merchant interactions).
- Add analytics consumer wiring for telemetry stream if external observability sink is required.
- Run manual QA checklist on mobile and desktop for collapsed-default behavior and keyboard navigation.

### Notes
- Original document content is preserved; this status update is appended only.

## Follow-up update (Aug 5, 2026)

### Requested execution order status
- Step 1 (dedicated tests): completed.
  - Added dedicated dashboard phase test coverage for business and merchant behavior:
    - File: src/test/dashboardPhase18.test.tsx
    - Coverage includes:
      - Business section collapse/expand controls
      - Merchant progressive reveal for assignments
      - Merchant analytics section collapse/expand behavior
- Step 2 (telemetry verification surface): completed.
  - Added a development-only telemetry debug panel:
    - File: src/components/ui/TelemetryDebugPanel.tsx
  - Mounted panel on dashboard surfaces for live interaction verification:
    - src/features/dashboard/pages/DashboardPage.tsx
    - src/features/admin/pages/BusinessDashboardPage.tsx
    - src/features/dashboard/pages/MerchantDashboardPage.tsx

### Verification for follow-up work
- New dedicated tests pass:
  - vitest run src/test/dashboardPhase18.test.tsx --run
- Existing user dashboard tests still pass:
  - vitest run src/test/dashboard.test.tsx --run
