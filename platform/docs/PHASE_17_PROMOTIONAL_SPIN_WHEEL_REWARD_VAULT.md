# Phase 17 - Promotional Spin Wheel and Reward Vault

Date: 2026-08-04

## Purpose

Define a production implementation plan for a guest-triggered promotional Spin Wheel and Reward Vault experience, based on confirmed current code and schema in this repository.

This phase is designed to be additive and low-risk by reusing existing campaign configuration, referral/fraud engines, wallet ledgers, membership verification infrastructure, and admin settings patterns.

## Requirement Normalization (Security and Consistency)

The requirement update is accepted and preserved as:

- Guaranteed non-losing outcomes for first-time eligible guests are supported only as an admin-configurable campaign rule.
- Prize determination remains server-side.
- Weighted probabilities, fraud controls, and auditability remain active.

This avoids insecure client-side outcome control while allowing campaigns that intentionally guarantee a non-losing first spin.

## End-to-End Confirmation of Existing Work

### Confirmed implemented foundations

1. Campaign engine and configurable campaign metadata
- Service layer exists in src/services/api/campaigns.ts.
- Dynamic engine configuration exists and supports JSON-backed rules.
- Campaign editor exists in src/features/admin/pages/CampaignEditorPage.tsx.

2. Wallet and reward ledger foundation
- Wallet APIs and controls exist in src/services/api/wallet.ts.
- User wallet/reward operations page exists in src/features/rewards/pages/RewardHistoryPage.tsx.
- Multi-wallet and reconciliation migrations already exist (012, 013, and later withdrawal migrations).

3. Referral and fraud foundations
- Referral backend/service exists in src/services/api/referrals.ts.
- Referral admin operations exist in src/features/admin/pages/ReferralSettingsPage.tsx and src/features/admin/pages/ReferralOpsPage.tsx.
- Fraud policy and scoring services exist in src/services/api/fraud.ts.
- Fraud admin page exists in src/features/admin/pages/FraudDetectionPage.tsx.

4. Membership/payment foundations
- Membership gateway orchestration exists in src/services/api/membershipGateway.ts.
- Membership catalog/admin lifecycle services exist in src/services/api/membershipAdmin.ts and related admin pages.
- User payment/order interaction exists in src/features/dashboard/pages/UserOrdersPage.tsx.

5. Gamification foundation (includes lucky wheel concept)
- Gamification config/state service exists in src/services/api/gamification.ts.
- Gamification UI exists in src/features/rewards/pages/GamificationPage.tsx.
- DB already includes wheel-related state in migration 005 and user state in migration 021.

6. Modal/drawer foundation for UX
- Reusable modal exists in src/components/ui/DesignSystem.tsx.
- Mobile navigation drawer pattern exists in src/app/layouts/AppLayout.tsx.

### Confirmed gaps (not yet implemented)

1. No guest-triggered promotional popup system for homepage, signup, and membership-plan discovery surfaces.
2. No dedicated production Spin Wheel component with 12-segment visual wheel, pointer physics, and server-resolved outcomes.
3. No campaign-specific spin outcome API contract (spin, claim reserve, status, history) for onboarding rewards.
4. No Reward Vault UX in dashboard (collapsed card + expandable details + drawer/bottom-sheet behavior).
5. No explicit end-to-end unlock tracker for requirements: registration, verification, referrals, membership purchase, countdown expiry.
6. No dedicated promotional reward status model tying reserved reward -> pending unlock -> released/expired/revoked across all requirement checks.

## Best Insertion Points

## 1) Guest trigger and popup surfaces

- Homepage: src/features/home/pages/HomePage.tsx
- Signup page: src/features/auth/pages/SignupPage.tsx
- Public route composition: src/app/router/index.tsx
- Shared modal primitives: src/components/ui/DesignSystem.tsx

Notes:
- Add route-aware trigger checks at layout/public-shell level.
- Membership Plans trigger target should be implemented as a public membership route (or mapped CMS public route) before enabling trigger scope.

## 2) Spin wheel UX and state handling

- Gamification user-facing shell: src/features/rewards/pages/GamificationPage.tsx
- Dashboard insertion for vault card entry point: src/features/dashboard/pages/DashboardPage.tsx
- Shared component folder for new wheel/drawer/bottom-sheet components: src/components/ui

## 3) Server outcome, fraud checks, and campaign rules

- Campaign rule parsing and policy utilities: src/services/api/campaigns.ts
- Fraud thresholds and risk checks: src/services/api/fraud.ts
- Referral qualification and fraud statuses: src/services/api/referrals.ts
- Membership payment verification hooks: src/services/api/membershipGateway.ts and src/services/api/membershipAdmin.ts

## 4) Wallet and reward reservation/release

- Existing wallet operations and transfers: src/services/api/wallet.ts
- Reward/wallet user visibility surface: src/features/rewards/pages/RewardHistoryPage.tsx
- Order/payment confirmation surface: src/features/dashboard/pages/UserOrdersPage.tsx

## 5) Admin operations and observability

- Campaign configuration UI: src/features/admin/pages/CampaignEditorPage.tsx
- Reward settings surface (currently generic module page): src/features/admin/pages/RewardSettingsPage.tsx
- Referral/Fraud operations: src/features/admin/pages/ReferralOpsPage.tsx and src/features/admin/pages/FraudDetectionPage.tsx
- Audit and reporting route surfaces: admin pages and migrations already present

## Phase Plan

## Phase 17.0 - Contract Lock and Feature Flags

Scope:
- Freeze API and state contracts for spin lifecycle and reward vault lifecycle.
- Add feature flags for staged rollout (internal, beta, production).

Deliverables:
- Contract document for:
  - spin eligibility input,
  - server outcome payload,
  - reward reservation payload,
  - unlock requirement status payload,
  - expiration and revocation payload.

Exit criteria:
- Signoff on lifecycle states and failure/retry semantics.

## Phase 17.1 - Guest Trigger System and Premium Popup Shell

Scope:
- Build guest-only trigger orchestration for allowed pages.
- Enforce configurable cooldown and one-show policy.
- Add close behavior and optional floating reopen action.

Primary insertion points:
- src/features/home/pages/HomePage.tsx
- src/features/auth/pages/SignupPage.tsx
- src/app/router/index.tsx
- src/components/ui/DesignSystem.tsx

Exit criteria:
- Popup appears only for eligible guests and honors cooldown/reopen configuration.

## Phase 17.2 - Spin Wheel UI Component (Client)

Scope:
- Implement 12-segment premium wheel UI with pointer, motion, and accessibility.
- Implement disabled/active spin states, animation timing, and responsive behavior.
- Keep result rendering driven by server response.

Primary insertion points:
- src/components/ui (new SpinWheel and related motion components)
- src/features/rewards/pages/GamificationPage.tsx (for first integration path)

Exit criteria:
- Wheel interactions are WCAG-safe, responsive, and production quality on desktop/mobile.

## Phase 17.3 - Server-Side Outcome and Campaign Policy Enforcement

Scope:
- Add backend flow for spin attempt creation, eligibility checks, and outcome generation.
- Enforce weighted probabilities and guaranteed non-losing rules when configured.
- Log fraud/audit context per spin action.

Primary insertion points:
- src/services/api/campaigns.ts
- src/services/api/fraud.ts
- Supabase migration set for spin attempts/outcomes and policy tables/functions

Exit criteria:
- Client cannot determine outcomes locally; all outcomes are server-issued and auditable.

## Phase 17.4 - Reserved Reward Lifecycle and Post-Signup Binding

Scope:
- Reserve reward for guest after spin.
- Bind reward reservation to user after registration/auth completion.
- Set initial status to Pending unlock (not withdrawable).

Primary insertion points:
- src/services/api/wallet.ts
- src/services/api/auth.ts
- src/features/auth/pages/SignupPage.tsx
- Supabase migration set for reservation/binding tables

Exit criteria:
- Reserved reward persists across guest-to-user conversion and is visible in user context.

## Phase 17.5 - Unlock Requirement Engine and Countdown Expiration

Scope:
- Track all required gates:
  - registration complete,
  - verification complete,
  - verified qualifying referrals,
  - qualifying membership purchase,
  - not expired.
- Add countdown expiration transitions and admin reinstatement override path.

Primary insertion points:
- src/services/api/referrals.ts
- src/services/api/membershipGateway.ts
- src/services/api/membershipAdmin.ts
- Supabase migration set for unlock requirements and status transitions

Exit criteria:
- Reward cannot be released before all gates pass; expiry transitions are deterministic and auditable.

## Phase 17.6 - Reward Vault Dashboard Widget (Recommended UX)

Scope:
- Implement Reward Vault as:
  - collapsed dashboard card,
  - expandable inline details,
  - desktop drawer,
  - mobile bottom sheet.
- Show exact blocking step, live referral verification status, pending bonus amount, and countdown.

Primary insertion points:
- src/features/dashboard/pages/DashboardPage.tsx
- src/app/layouts/AppLayout.tsx
- src/components/ui (new RewardVault widget/drawer/bottom-sheet components)

Exit criteria:
- Users can always see why reward is still pending and what exact step remains.

## Phase 17.7 - Admin Control Plane Extensions

Scope:
- Extend campaign/reward admin controls for:
  - trigger pages,
  - cooldown rules,
  - daily spin limits,
  - prize inventory/weights,
  - guaranteed non-losing onboarding rule,
  - eligibility filters,
  - expiration durations,
  - manual approve/revoke/reinstate actions.

Primary insertion points:
- src/features/admin/pages/CampaignEditorPage.tsx
- src/features/admin/pages/RewardSettingsPage.tsx
- src/features/admin/pages/ReferralOpsPage.tsx
- src/features/admin/pages/FraudDetectionPage.tsx

Exit criteria:
- Operations team can run and tune campaigns without code changes.

## Phase 17.8 - Notifications, Analytics, and Support Deflection

Scope:
- Add milestone and urgency notifications (new update, one step remaining, expiring soon, unlocked).
- Add analytics funnels from popup -> spin -> signup -> unlock completion.
- Add Reward Vault event timeline/history to reduce support tickets.

Primary insertion points:
- existing communications, analytics, and dashboard service/page modules

Exit criteria:
- Measurable conversion funnel and reduced reward-support friction.

## Phase 17.9 - Testing, Security Verification, and Rollout

Scope:
- Unit tests for policy and eligibility logic.
- Integration tests for spin -> reserve -> register -> unlock -> release.
- Regression tests for fraud guardrails and cooldown bypass attempts.
- Rollout via feature flags and staged enablement.

Primary insertion points:
- src/test
- docs/TESTING_STRATEGY.md
- docs/RLS_VERIFICATION.md
- docs/OBSERVABILITY.md

Exit criteria:
- Build/typecheck/tests pass and rollout checklist is signed.

## Recommended New Data Domains (Migration Track)

1. Promotional campaign runtime
- spin_campaigns
- spin_prize_inventory
- spin_campaign_rules

2. Spin execution audit
- spin_attempts
- spin_outcomes
- spin_abuse_signals

3. Reward reservation and unlock
- promotional_reward_reservations
- promotional_reward_requirements
- promotional_reward_events
- promotional_reward_expirations

4. Reward Vault view model
- reward_vault_state (or equivalent materialized query layer)
- reward_vault_history

## API Surface to Implement

- POST /spin/start
- GET /spin/status
- POST /spin/claim-reserve
- GET /reward-vault/status
- GET /reward-vault/history
- POST /reward-vault/release
- POST /reward-vault/reinstate (admin)

Implementation note:
- Keep APIs backed by Supabase RPC/functions and RLS-safe table access patterns already used in this codebase.

## UX Decision (Adopted)

Do not create a separate Reward Vault page first.

Implement the recommended pattern:
- Dashboard card (collapsed)
- Expandable details in place
- Drawer on desktop
- Bottom sheet on mobile

This aligns with current dashboard architecture and minimizes navigation friction while increasing conversion transparency.

## Done-vs-Next Summary

Done now:
- Campaign, wallet, referral, fraud, membership, gamification, and admin foundations exist.

Next to build in Phase 17:
- Guest trigger popup, production spin wheel UX, server outcome contract, reservation/unlock lifecycle, Reward Vault widget system, and dedicated analytics/support-deflection flows.

## Implementation Progress Update (2026-08-04)

This section tracks what has been implemented in code for this phase pass and what remains.

### Completed in this implementation pass

Phase 17.0 - Contract lock and feature flags
- Added a dedicated promotional settings contract in `platform_settings` via `promotional_spin_settings` service support.
- Added typed API contracts in `src/services/api/promotionalRewards.ts` for:
  - spin start,
  - reserve claim,
  - guest-to-user bind,
  - vault status,
  - release,
  - reinstate,
  - event history.

Phase 17.1 - Guest trigger system and popup shell
- Added route-aware popup orchestration at public layout level:
  - `src/app/layouts/PublicLayout.tsx`
  - surface mapping for home, signup, membership-plans routes.
- Added reusable popup UI with cooldown/one-show/reopen behavior:
  - `src/components/ui/PromotionalSpinPopup.tsx`.

Phase 17.2 - Spin wheel UI component
- Added 12-segment wheel component with pointer and animation:
  - `src/components/ui/PromotionalSpinWheel.tsx`.
- Integrated server-driven promotional wheel action path into gamification page:
  - `src/features/rewards/pages/GamificationPage.tsx`.

Phase 17.3 - Server-side outcome and campaign policy enforcement
- Added migration `047_phase_17_promotional_spin_reward_vault.sql` with:
  - `spin_campaigns`,
  - `spin_prize_inventory`,
  - `spin_attempts`,
  - `spin_outcomes`,
  - `spin_abuse_signals`.
- Added server-side RPC:
  - `promotional_spin_start` (weighted selection and first-spin non-losing campaign rule),
  - `promotional_spin_claim_reserve`.

Phase 17.4 - Reserved reward lifecycle and post-signup binding
- Added reservation table domain and binding RPC:
  - `promotional_reward_reservations`,
  - `promotional_spin_bind_guest_reservation`.
- Wired signup flow to bind stored guest reservation to user after successful signup:
  - `src/services/api/auth.ts`.

Phase 17.5 - Unlock requirements and expiration
- Added requirements/event domains:
  - `promotional_reward_requirements`,
  - `promotional_reward_events`.
- Added lifecycle RPC:
  - `promotional_reward_refresh_requirements`,
  - `promotional_reward_vault_status`,
  - `promotional_reward_release`,
  - `promotional_reward_reinstate`.

Phase 17.6 - Reward Vault dashboard widget
- Added dashboard vault card + expandable panel UX:
  - `src/components/ui/RewardVaultWidget.tsx`.
- Integrated into user dashboard:
  - `src/features/dashboard/pages/DashboardPage.tsx`.

Phase 17.7 - Admin control plane extensions
- Extended reward settings admin with promotional rollout controls and manual reinstatement action:
  - `src/features/admin/pages/RewardSettingsPage.tsx`.
- Added promotional campaign type support:
  - `src/services/api/campaigns.ts`,
  - `src/types/index.ts`.
- Added promotional records in enterprise module seed:
  - `src/features/admin/data/enterpriseModules.ts`.

Phase 17.8 - Notifications, analytics, support deflection
- Added explicit promotional event timeline persistence through `promotional_reward_events` and timeline display in vault panel.
- Added public membership plan route target for trigger surface alignment:
  - `src/app/router/index.tsx` (`/membership-plans`).

Phase 17.9 - Testing, verification, rollout
- Added unit tests for popup policy/guest token behavior:
  - `src/test/promotionalRewards.test.ts`.
- Validation executed:
  - `npm run typecheck` passed,
  - `npm run test -- promotionalRewards.test.ts gamification.test.ts` passed,
  - `npm run build` passed.

### Remaining work

1. Apply migration `047_phase_17_promotional_spin_reward_vault.sql` to the target Supabase environment(s) and confirm RPC grants/policies in deployed infra.
2. Add additional integration tests for end-to-end flow (guest spin -> reserve -> signup bind -> requirement completion -> release) with Supabase test fixtures.
3. Add dedicated admin UI for spin prize inventory CRUD (weights, stock, labels) and campaign-level guaranteed-first-spin toggle editing.
4. Wire channel notifications (email/push/SMS templates) for vault milestones into communication templates and dispatch paths.
5. Add observability dashboards/alerts on spin abuse signals, reserve expiry rates, and unlock funnel conversion.

## Proposed Phase 17.2 Premium Spin Wheel UX Implementation Plan (Non-Breaking)

Date: 2026-08-04

Objective:
- Upgrade the promotional wheel to a premium casino-quality experience without breaking currently wired server outcomes, reward reservation flow, popup triggers, or vault lifecycle logic.

### Design acceptance alignment

Accepted for implementation:
- Transparent component background with glow fading into transparency.
- Premium metallic wheel aesthetics (gold rim, LED ring, alternating red/gold segments, center hub, top pointer).
- SVG-first rendering for crisp gradients and responsive scaling.
- Enhanced motion and winning effects with reduced-motion fallback.

Adjusted for contract safety:
- Keep the runtime segment model at 12 segments in this rollout.
- Do not switch to 10 slices in this pass because current mapping, labels, and tests are anchored to 12-segment behavior.

### Safe insertion point and wiring boundary

Primary insertion point:
- `src/components/ui/PromotionalSpinWheel.tsx`

Reason:
- This component is the shared visual surface consumed by both:
  - `src/components/ui/PromotionalSpinPopup.tsx`
  - `src/features/rewards/pages/GamificationPage.tsx`
- Current business logic (spin start, reserve claim, eligibility, guest token, vault progression) is outside the wheel renderer and should remain unchanged.

Protected wiring contracts to preserve:
- Props contract: `segments`, `spinning`, `selectedSegmentId`, `onSpinEnd`.
- Server-driven selection flow using `resolvePromotionalWheelSegmentId(...)`.
- Existing popup policy and guest token behavior.
- Existing reservation and bind flow behavior.

### Implementation phases

#### Phase 17.2A - Visual engine swap (safe)

Scope:
- Replace current div/skew wheel rendering with SVG wheel rendering while preserving identical component API.
- Implement premium visual system:
  - transparent background,
  - metallic outer ring,
  - LED ring,
  - 12 alternating red/gold slices,
  - center hub,
  - top pointer,
  - soft multi-layer glow and wheel shadow.

Constraints:
- No RPC/API/schema changes.
- No changes to promotionalRewards service mapping logic.
- No changes to popup eligibility/cooldown behavior.

Exit criteria:
- Visual upgrade appears in popup and gamification contexts with no behavioral regressions.

#### Phase 17.2B - Motion and stopping precision

Scope:
- Implement premium spin timing profile:
  - realistic acceleration,
  - long deceleration,
  - deterministic final stop aligned to `selectedSegmentId`.
- Keep stop callback aligned to actual animation completion event.

Risk control:
- Remove reliance on hardcoded timeout duration assumptions where timing may drift from animation duration.

Exit criteria:
- Wheel always stops on server-resolved segment and end-state messaging remains correct.

#### Phase 17.2C - Winner and interaction polish

Scope:
- Add winner pulse/highlight, center hub flash, and faster LED pulse on win.
- Add desktop hover enhancement and pointer cursor.
- Keep effects lightweight and GPU-accelerated.

Accessibility:
- Keyboard-trigger compatible.
- ARIA labels retained/improved.
- Respect `prefers-reduced-motion` with reduced or no spin effects.
- Maintain readable text contrast on red/gold slices.

Exit criteria:
- Premium feel is achieved while maintaining accessible interaction.

#### Phase 17.2D - Responsive and performance hardening

Scope:
- Enforce circle sizing targets:
  - desktop 450px,
  - tablet 380px,
  - mobile 300px.
- Validate minimum touch target sizing for controls.
- Verify smooth behavior under mobile constraints.

Exit criteria:
- Stable rendering and smooth animation across desktop/tablet/mobile.

### Test and verification additions

Required validation:
- `npm run typecheck`
- `npm run test -- promotionalRewards.test.ts`
- Targeted UI regression checks for:
  - popup spin flow,
  - gamification embedded spin flow,
  - reserve button gating before/after spin,
  - correct post-spin messaging.

Recommended additions:
- Add unit tests that assert selected segment index resolution remains unchanged.
- Add component-level tests for reduced-motion branch and animation completion callback behavior.

### Rollout and guardrails

Rollout approach:
- Ship under existing promotional rollout controls (internal -> beta -> production).
- Start with internal rollout and monitor:
  - spin completion success rate,
  - reserve conversion rate,
  - animation-related UI errors.

Operational guardrails:
- If premium animation causes client instability on low-end devices, auto-fallback to reduced-motion style.
- Keep a quick rollback path by isolating premium renderer behind a component-level feature flag.

### Deferred design change (separate contract migration)

Not in this pass:
- Switching from 12 slices to 10 slices.

Why deferred:
- Current label generation, reward-to-segment mapping behavior, and tests depend on a 12-segment model.

Future migration prerequisites for 10-slice support:
1. Update server/client mapping contract and prize indexing semantics.
2. Update admin wheel label constraints and defaults.
3. Update and expand tests for new segment cardinality.
4. Re-verify stop-angle precision and payout label correctness.

### Definition of done for premium UX pass

- Premium transparent SVG wheel replaces current basic renderer.
- Existing promotional APIs and vault flows behave unchanged.
- Segment mapping remains deterministic and server-driven.
- Accessibility and reduced-motion requirements are satisfied.
- Typecheck, tests, and build all pass.
