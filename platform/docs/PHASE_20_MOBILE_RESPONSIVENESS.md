# Phase 20: Mobile Responsiveness Hardening

## Objective
Improve mobile responsiveness across all dashboard experiences while keeping the desktop layout unchanged.

## Scope
- In scope:
  - Web dashboards in platform src features dashboard and platform src features admin.
  - Flutter dashboards in lib src dashboard and lib src admin.
  - Mobile and small-tablet behavior from 320px through 768px.
- Out of scope:
  - Desktop layout redesign at 1024px and above.
  - Feature changes unrelated to responsiveness.

## Design Constraints
- Desktop layout is the baseline and must remain visually identical at 1024px and above.
- Mobile improvements should only adjust base and small-screen behavior.
- Existing information architecture should be preserved; only presentation and interaction density may change.

## Current Validation Summary
- Global app shell is strong on mobile due to drawer, sticky top header, bottom nav, and safe-area spacing.
- User dashboard is mostly responsive but has oversized heading and dense panel blocks on small screens.
- Merchant dashboard needs stronger mobile treatment for heading scale and section density.
- Business dashboard has the largest gap on mobile due to many large headings and desktop-first data blocks.
- Admin analytics and compliance dashboards need mobile typography and compact card density refinement.
- Flutter user dashboard is mostly mobile-friendly.
- Flutter admin dashboard is desktop-first and needs adaptive shell behavior.

## Mobile Breakpoint Targets
Validate all phase outputs at:
- 320px
- 360px
- 390px
- 430px
- 768px

Desktop non-regression checks at:
- 1024px
- 1280px
- 1440px

## Phase Implementation Plan

### Phase 0: Baseline and Guardrails
Purpose:
Create enforcement rules that guarantee mobile progress without desktop regressions.

Tasks:
- Establish viewport validation matrix for all dashboard routes.
- Capture before screenshots and behavior notes for mobile and desktop targets.
- Define non-regression rule: no desktop class behavior changes at md lg xl breakpoints.
- Add a simple route-by-route audit checklist for heading wraps, overflow, and CTA visibility.

Exit Criteria:
- Baseline audit artifact completed for each dashboard route.
- Desktop baseline snapshots stored for quick visual comparison.

### Phase 1: Mobile Typography Normalization
Purpose:
Fix oversized headings and large metric text on phones.

Tasks:
- Normalize hero heading scale for mobile-first sizing, then progressively enhance upward.
- Normalize section heading scale where text currently dominates viewport height.
- Reduce oversized metric text on mobile while preserving current desktop sizes.
- Ensure heading line-height and spacing prevent awkward 3 to 4 line wraps.

Primary Targets:
- platform src features dashboard pages DashboardPage.tsx
- platform src features dashboard pages MerchantDashboardPage.tsx
- platform src features admin pages BusinessDashboardPage.tsx
- platform src features admin pages DashboardAnalyticsPage.tsx
- platform src features admin pages ComplianceDashboardPage.tsx

Exit Criteria:
- No major heading occupies disproportionate vertical space at 320px to 390px.
- Desktop heading sizes remain unchanged.

### Phase 2: Mobile Panel Density and Grid Refinement
Purpose:
Replace long vertical section stacking with compact mobile-friendly layout density.

Tasks:
- Recompose card and panel groups into compact grids on mobile where readable.
- Keep existing md lg xl grid behavior unchanged.
- Reduce excessive vertical gaps that force long scrolling for first actions.
- Prioritize operational panels and quick actions near top of viewport.

Primary Targets:
- User dashboard summary and insight sections.
- Merchant dashboard metric strips and quick controls.
- Business dashboard selected campaign and side feed compositions.

Exit Criteria:
- Above-the-fold mobile view shows actionable density without clutter.
- No desktop grid structure changes.

### Phase 3: Mobile Data Surface Strategy for Tables
Purpose:
Improve usability of table-heavy sections on phones.

Tasks:
- Keep desktop tables intact.
- For mobile only, implement one of:
  - Card-list representation for row data, or
  - Priority-column table with expandable details.
- Preserve all critical actions from current table rows.
- Ensure primary row actions remain one tap away.

Primary Targets:
- Merchant assignments, orders, and analytics tables.
- Business campaign portfolio table.

Exit Criteria:
- Critical workflows are usable at 360px without painful horizontal panning.
- Desktop table presentations remain unchanged.

### Phase 4: Mobile Interaction and Spacing Polish
Purpose:
Improve touch ergonomics, wrapping behavior, and section controls.

Tasks:
- Tighten mobile paddings and margins where section bloat exists.
- Ensure action groups wrap cleanly and maintain hierarchy.
- Improve chips, section jump links, and collapse toggles for narrow screens.
- Verify floating controls and bottom navigation do not obstruct key content.

Exit Criteria:
- No clipped CTA, overlap, or inaccessible controls on mobile breakpoints.
- Interaction rhythm feels consistent across dashboards.

### Phase 5: Flutter Admin Dashboard Adaptivity
Purpose:
Bring Flutter admin shell to mobile parity.

Tasks:
- Replace fixed desktop row-and-sidebar behavior on small widths.
- Add adaptive navigation shell:
  - Desktop retains existing sidebar layout.
  - Mobile uses drawer or compact nav controls.
- Convert fixed-width and dense row structures to responsive composition.

Primary Targets:
- lib src admin admin_dashboard.dart

Exit Criteria:
- Flutter admin dashboard has no horizontal overflow on 360px widths.
- Desktop Flutter admin layout remains unchanged.

## Route Coverage Checklist
Web:
- app dashboard
- app merchant dashboard
- business dashboard
- admin analytics dashboard
- admin compliance dashboard

Flutter:
- user dashboard
- admin dashboard

## Quality Gates Per Phase
- No horizontal page overflow at target mobile widths.
- Minimum touch target size remains accessible.
- Primary CTA visible without accidental obstruction.
- No desktop visual regression at 1024px and above.
- Build and typecheck remain green after each phase.

## Execution Order
1. Phase 1: Mobile typography normalization
2. Phase 3: Mobile table strategy for heavy data sections
3. Phase 2: Panel density and grid refinement
4. Phase 4: Interaction and spacing polish
5. Phase 5: Flutter admin adaptivity

## Risks and Mitigations
- Risk: Mobile compaction may reduce readability.
  - Mitigation: Validate text scale and spacing at 320px and 360px before merge.
- Risk: Desktop regressions from shared utility classes.
  - Mitigation: Limit edits to base classes and keep md lg xl classes intact.
- Risk: Table conversions may hide critical actions.
  - Mitigation: Define mandatory actions per row before conversion and test each flow.

## Done Definition
Phase 20 is complete when:
- All targeted dashboard pages pass mobile breakpoint validation.
- Desktop layout is unchanged across validated pages.
- Table-heavy workflows are usable on mobile without friction.
- Flutter admin dashboard is operable on mobile form factors.
