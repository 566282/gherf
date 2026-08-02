# Membership Engine Phase Implentation

Date: 2026-08-02

## Purpose

Plan and sequence the implementation of an enterprise-grade, fully configurable Membership Management System and the configurable Reward, Withdrawal, Auto-Upgrade, and Fee Engine.

This plan is based on confirmed current code, schema, and admin architecture in this repository.

## Codebase Confirmation Summary (Current State)

The current platform already has useful foundations, but membership behavior is still limited and partially hardcoded.

### Confirmed strengths already in code

- Supabase migration workflow and RPC pattern are established under `platform/supabase/migrations`.
- `platform_settings` is already used as a dynamic configuration store in multiple domains (wallet, admin console, referral ops, fraud, CMS, communications).
- Wallet domain exists with:
  - multi-wallet accounts,
  - transfer and reconciliation RPC,
  - withdrawal requests,
  - admin review tooling.
- There is a membership upgrade path (`updateMemberPlan`) and a ledger table for membership payment events (`membership_payments`).
- Admin routing, sidebar navigation, and enterprise module surfaces are in place.
- Referral settings page is already a good reference for live configurable admin-backed rules editing.

### Confirmed constraints and gaps to address first

- Membership tiering is clamped to 3 levels in DB and bootstrap logic (not 100+):
  - `record_member_plan_change` caps `level_tier` to 1..3.
  - signup bootstrap also caps `level_tier` to 1..3.
- Membership labels are hardcoded (`Starter`, `Balanced`, `Premium`) in multiple places.
- User/admin plan selectors are hardcoded to 3 plans.
- Withdrawal hold behavior is partially hardcoded in service logic:
  - static hold threshold function,
  - hardcoded free-member gate (`tier < 2`),
  - hardcoded notification copy.
- Reward Settings page is currently a generic static enterprise module surface, not yet connected to a dedicated reward-rules backend schema.
- No dedicated membership plan catalog tables yet (categories, pricing tiers, durations, benefits, workflow, rule versions).

## Best Insertion Points (Verified)

Use these insertion points to minimize regression risk and align with existing architecture.

### 1) Database and rule runtime insertion points

- Primary location: `platform/supabase/migrations`
- Extend existing models instead of replacing wallet/reward tables.
- Add new migration group for:
  - membership catalog,
  - versioned business rules,
  - reward multiplier,
  - fee engine,
  - workflow engine,
  - rules engine,
  - payment adapter registry,
  - analytics aggregates.

Keep RPC-first domain behavior using `SECURITY DEFINER` functions, consistent with existing wallet and referral style.

### 2) Service layer insertion points

- Create new domain services in `platform/src/services/api`:
  - `membership.ts`
  - `membershipRules.ts`
  - `rewardEngine.ts`
  - `withdrawalEngine.ts`
  - `upgradeEngine.ts`
  - `feeEngine.ts`
  - `workflowEngine.ts`
- Refactor `wallet.ts` to consume business rules from DB-backed config instead of hardcoded thresholds and labels.
- Keep current function signatures stable where possible and route through new engine services behind adapters.

### 3) Admin UI insertion points

- Existing admin shell and nav:
  - `platform/src/components/ui/AdminSidebar.tsx`
  - `platform/src/app/router/index.tsx`
- Add dedicated pages under `platform/src/features/admin/pages`:
  - MembershipPlansPage
  - MembershipBenefitsPage
  - MembershipRulesPage
  - MembershipWorkflowPage
  - RewardMultiplierPage
  - MembershipFeePage
  - MembershipAnalyticsPage
- Follow the live-edit pattern used by `ReferralSettingsPage` instead of the static module placeholder pattern used by current `RewardSettingsPage`.

### 4) User-facing membership insertion points

- Profile and wallet areas are the best first integration surfaces:
  - `platform/src/features/profile/pages/ProfilePage.tsx`
  - wallet/reward pages in `platform/src/features/rewards/pages`
- Add:
  - membership status timeline,
  - reward multiplier toggle card,
  - withdrawal eligibility panel,
  - outstanding membership fee prompts.

### 5) Test insertion points

- Existing tests already cover wallet policy and member-plan release flow.
- Extend in `platform/src/test` with:
  - rule evaluation tests,
  - upgrade/downgrade workflow tests,
  - fee compliance tests,
  - reward multiplier carry-forward tests,
  - 100-tier progression tests.

## Phased Implementation Plan

## Phase 0: Domain Freeze and Rule Contract

Scope:
- Freeze current behavior as baseline contracts.
- Define canonical domain model and naming:
  - Membership Plan,
  - Membership Fee,
  - Reward Multiplier,
  - Reward Cycle,
  - Withdrawal Window,
  - Upgrade Trigger,
  - Rule Version.
- Define strict no-hardcode rule policy for all new membership business logic.

Deliverables:
- ERD draft and data contract spec.
- Rule-expression format (JSON DSL) and validation schema.
- Migration naming map and rollout sequence.

Exit criteria:
- Stakeholder signoff on rule vocabulary and formula schema.

## Phase 1: Membership Catalog Foundation (100+ Tiers)

Scope:
- Create modular tables for:
  - plan categories,
  - plans,
  - plan pricing (multi-currency, country-specific),
  - plan durations,
  - plan status/visibility,
  - plan benefits,
  - plan permissions matrix.
- Seed the 100-level ladder from NGN 5,000 to NGN 13,000,000.
- Introduce stable internal keys/slugs and version-safe soft archival.

Deliverables:
- New migrations with indexes, FK, RLS, optimistic locking fields.
- Seed scripts for baseline 100 tiers.
- Read APIs for catalog and pricing resolution.

Exit criteria:
- No tier clamping to 3 remains in active membership path.

### Canonical Member Plan and Pricing Ladder (Seed Baseline)

Use the following 100-level pricing ladder as the baseline seed data for Phase 1 migrations and admin catalog bootstrapping.

| Level | Membership           |      Price (NGN) |
| ----: | -------------------- | ---------------: |
|     1 | Starter              |            5,000 |
|     2 | Starter Plus         |            7,500 |
|     3 | Bronze               |           10,000 |
|     4 | Bronze Plus          |           15,000 |
|     5 | Bronze Elite         |           20,000 |
|     6 | Silver               |           25,000 |
|     7 | Silver Plus          |           30,000 |
|     8 | Silver Elite         |           35,000 |
|     9 | Gold                 |           40,000 |
|    10 | Gold Plus            |           45,000 |
|    11 | Gold Elite           |           50,000 |
|    12 | Platinum             |           60,000 |
|    13 | Platinum Plus        |           70,000 |
|    14 | Platinum Elite       |           80,000 |
|    15 | Diamond              |           90,000 |
|    16 | Diamond Plus         |          100,000 |
|    17 | Diamond Elite        |          110,000 |
|    18 | Sapphire             |          125,000 |
|    19 | Sapphire Plus        |          140,000 |
|    20 | Sapphire Elite       |          155,000 |
|    21 | Emerald              |          170,000 |
|    22 | Emerald Plus         |          185,000 |
|    23 | Emerald Elite        |          200,000 |
|    24 | Ruby                 |          225,000 |
|    25 | Ruby Plus            |          250,000 |
|    26 | Ruby Elite           |          275,000 |
|    27 | Pearl                |          300,000 |
|    28 | Pearl Plus           |          325,000 |
|    29 | Pearl Elite          |          350,000 |
|    30 | Titanium             |          375,000 |
|    31 | Titanium Plus        |          400,000 |
|    32 | Titanium Elite       |          425,000 |
|    33 | Prestige             |          450,000 |
|    34 | Prestige Plus        |          475,000 |
|    35 | Prestige Elite       |          500,000 |
|    36 | Executive            |          550,000 |
|    37 | Executive Plus       |          600,000 |
|    38 | Executive Elite      |          650,000 |
|    39 | Royal                |          700,000 |
|    40 | Royal Plus           |          750,000 |
|    41 | Royal Elite          |          800,000 |
|    42 | Crown                |          850,000 |
|    43 | Crown Plus           |          900,000 |
|    44 | Crown Elite          |          950,000 |
|    45 | Imperial             |        1,000,000 |
|    46 | Imperial Plus        |        1,100,000 |
|    47 | Imperial Elite       |        1,200,000 |
|    48 | Legacy               |        1,300,000 |
|    49 | Legacy Plus          |        1,400,000 |
|    50 | Legacy Elite         |        1,500,000 |
|    51 | Infinity             |        1,600,000 |
|    52 | Infinity Plus        |        1,700,000 |
|    53 | Infinity Elite       |        1,800,000 |
|    54 | Elite Club           |        1,900,000 |
|    55 | Elite Prime          |        2,000,000 |
|    56 | Elite Signature      |        2,100,000 |
|    57 | Visionary            |        2,200,000 |
|    58 | Visionary Plus       |        2,300,000 |
|    59 | Visionary Elite      |        2,400,000 |
|    60 | Chairman             |        2,500,000 |
|    61 | Chairman Plus        |        2,600,000 |
|    62 | Chairman Elite       |        2,700,000 |
|    63 | Ambassador           |        2,800,000 |
|    64 | Ambassador Plus      |        2,900,000 |
|    65 | Ambassador Elite     |        3,000,000 |
|    66 | President            |        3,200,000 |
|    67 | President Plus       |        3,400,000 |
|    68 | President Elite      |        3,600,000 |
|    69 | Founder              |        3,800,000 |
|    70 | Founder Plus         |        4,000,000 |
|    71 | Founder Elite        |        4,200,000 |
|    72 | Pinnacle             |        4,400,000 |
|    73 | Pinnacle Plus        |        4,600,000 |
|    74 | Pinnacle Elite       |        4,800,000 |
|    75 | Supreme              |        5,000,000 |
|    76 | Supreme Plus         |        5,200,000 |
|    77 | Supreme Elite        |        5,400,000 |
|    78 | Apex                 |        5,600,000 |
|    79 | Apex Plus            |        5,800,000 |
|    80 | Apex Elite           |        6,000,000 |
|    81 | Legend               |        6,200,000 |
|    82 | Legend Plus          |        6,400,000 |
|    83 | Legend Elite         |        6,600,000 |
|    84 | Dynasty              |        6,800,000 |
|    85 | Dynasty Plus         |        7,000,000 |
|    86 | Dynasty Elite        |        7,500,000 |
|    87 | Global               |        8,000,000 |
|    88 | Global Plus          |        8,500,000 |
|    89 | Global Elite         |        9,000,000 |
|    90 | Ultra                |        9,500,000 |
|    91 | Ultra Plus           |       10,000,000 |
|    92 | Ultra Elite          |       10,500,000 |
|    93 | Black                |       11,000,000 |
|    94 | Black Plus           |       11,250,000 |
|    95 | Black Elite          |       11,500,000 |
|    96 | Titanium Black       |       11,750,000 |
|    97 | Titanium Black Elite |       12,000,000 |
|    98 | Diamond Black        |       12,300,000 |
|    99 | Diamond Black Elite  |       12,650,000 |
|   100 | Ultimate Founder     |       13,000,000 |

Notes:
- The progression is intentionally denser at lower prices to encourage frequent upgrades.
- Higher tiers use larger increments to reflect increasing exclusivity and value.

## Phase 2: Membership Assignment and Ledger Refactor

Scope:
- Move user membership state from tier-label assumptions to plan IDs and snapshots.
- Keep existing `membership_payments` and extend to full lifecycle ledger:
  - purchase,
  - renewal,
  - upgrade,
  - downgrade,
  - fee-settlement,
  - multiplier activation.
- Ensure old profile fields remain backward-compatible during migration window.

Deliverables:
- User-membership history tables.
- Upgrade-safe mapping layer for old `level_tier`/`level_label` references.
- Compatibility adapters in auth/wallet services.

Exit criteria:
- Profile derives display labels from plan catalog, not hardcoded tier labels.

## Phase 3: Central Business Rules Engine (Versioned)

Scope:
- Introduce versioned, auditable, draft/publish rule sets with effective dates and rollback.
- Rule domains:
  - reward formulas,
  - withdrawal limits/windows,
  - auto-upgrade triggers,
  - downgrade triggers,
  - membership fee formulas,
  - multiplier pricing formulas,
  - compliance checks.
- Add policy simulator endpoint for test-evaluating rule changes before publish.

Deliverables:
- `membership_rules`, `rule_versions`, `rule_audit_logs` tables.
- Rule evaluation RPC and deterministic logs.
- Admin role-aware publish controls.

Exit criteria:
- Wallet/reward/upgrade decisions are resolved via rule engine lookups.

## Phase 4: Configurable Daily Reward Engine

Scope:
- Implement default reward behavior (10% daily, 31-day cycle) as config, not code.
- Support formula expression, plan eligibility, effective dates, grace periods.
- Settlement target must be configurable (`main_wallet` default).

Deliverables:
- Reward cycle scheduler and posting jobs.
- Reward calculation traces per user-day.
- Admin forms for reward percentage, duration, frequency, and formulas.

Exit criteria:
- Daily reward output changes only by configuration changes, without deployments.

## Phase 5: Withdrawal Management Engine

Scope:
- Replace hardcoded hold threshold and schedule assumptions with config.
- Support fixed dates (e.g., 14th), multi-window schedules, exception windows.
- Implement formula-driven max withdrawal and plan-specific min thresholds.
- Keep and extend hold/release flow that already exists.

Deliverables:
- Withdrawal schedule registry and evaluator.
- Formula-backed min/max resolver by plan and wallet context.
- Admin policy UI and preview tool.

Exit criteria:
- `createWithdrawalRequest` delegates eligibility to rules engine and schedule evaluator.

## Phase 6: Auto-Upgrade and Downgrade Engine

Scope:
- Configurable triggers:
  - every N withdrawals,
  - referral count,
  - purchases,
  - points,
  - time-based,
  - admin approval.
- Configurable insufficient-balance actions:
  - block,
  - partial deduction,
  - pending upgrade,
  - admin review.
- Downgrade flows with grace, warning, recovery.

Deliverables:
- Upgrade workflow executor.
- Downgrade workflow executor.
- Full event logs and notification integration.

Exit criteria:
- Membership progression across 100 tiers is data-driven and test-covered.

## Phase 7: Reward Lock, Carry-Forward, and Multiplier Reset Logic

Scope:
- Implement carried-forward earning tier logic and deduction defaults (20%) as configurable policy.
- On auto-upgrade:
  - membership updates immediately,
  - multiplier resets inactive,
  - reward continues from last activated multiplier tier with configured deduction.

Deliverables:
- Carry-forward policy evaluator.
- Reward suspension/grace rule options.
- Admin controls for deduction, grace, alternate formulas.

Exit criteria:
- Post-upgrade reward behavior is fully policy-defined and reproducible.

## Phase 8: Reward Multiplier Premium Module

Scope:
- Build standalone module linked to all membership tiers.
- Gateway-only payment (cannot pay from internal wallet).
- Formula-driven multiplier pricing (default equals current membership price).
- Activation status, history, expiration, renewal support.
- Conversion-oriented toggle UI with editable marketing copy.

Deliverables:
- Multiplier payment/order tables.
- Multiplier activation workflow and event hooks.
- Admin page for copy, pricing formulas, gateway toggles.

Exit criteria:
- Auto-upgrade disables multiplier automatically and requires reactivation at new tier.

## Phase 9: Bonus Wallet Engine and Fee Compliance Engine

Scope:
- Isolate promotional rewards to Bonus Wallet only.
- Plan-based bonus withdrawal thresholds, caps, waiting/lock periods, fees.
- Membership Fee engine with configurable formula and billing schedules.
- Enforce withdrawal fee-compliance from configurable withdrawal count (default second withdrawal).

Deliverables:
- Bonus wallet policy tables and evaluators.
- Membership fee invoice/settlement tables.
- Hold-release automation after fee settlement.

Exit criteria:
- Outstanding membership fee blocks configured withdrawal paths until paid.

## Phase 10: Membership Workflow Builder + No-Code Rules UI

Scope:
- Visual workflow editor for purchase/verify/approve/activate/reward/notify/invoice flows.
- IF/THEN/ELSE no-code rule authoring with condition groups and dependency checks.
- Draft, publish, rollback, and environment promotion support.

Deliverables:
- Workflow definition and execution tables.
- UI flow designer and execution logs.
- Rule test harness with sample users.

Exit criteria:
- Admins can modify workflow steps and rule behavior without code changes.

## Phase 11: Payment Gateway Orchestration and Financial Controls

Scope:
- Unified gateway abstraction:
  - Stripe,
  - Paystack,
  - Flutterwave,
  - Monnify,
  - PayPal,
  - bank transfer,
  - crypto,
  - USSD,
  - manual/offline.
- Standardized webhook ingestion, idempotency keys, dispute/refund handling.
- Tax, coupons, promo code, installment and recurring billing support.

Deliverables:
- Gateway adapter registry and settlement log.
- Payment event normalization service.
- Financial audit and reconciliation views.

Exit criteria:
- All monetary plan transitions and multiplier/fee payments use normalized gateway events.

## Phase 12: Analytics, Security, and Scale Hardening

Scope:
- Real-time membership analytics:
  - growth,
  - churn,
  - retention,
  - LTV,
  - ARPU,
  - upgrade/downgrade funnels,
  - payment success/failure.
- Exports: CSV/Excel/PDF/API.
- Security hardening for new modules:
  - RBAC matrix expansion,
  - audit logs,
  - rate limits,
  - session/device controls,
  - API keys,
  - policy integrity checks.

Deliverables:
- Analytics marts/materialized views.
- Extended permissions and audit dashboards.
- Production runbooks and SLO alerts.

Exit criteria:
- End-to-end load, security, and regression test suite passes for membership domain.

## Phase 13: Progressive Rollout and Backward-Compatible Cutover

Scope:
- Feature-flag rollout by cohort.
- Data backfill from legacy tier fields to plan instances.
- Double-write period for old/new ledgers.
- Monitoring and rollback checkpoints.

Deliverables:
- Cutover playbook.
- Backfill scripts and verification jobs.
- Rollback and incident response runbook.

Exit criteria:
- Legacy hardcoded paths removed after stable observation window.

## Immediate Build Order (First 3 Sprints)

Sprint 1:
- Phase 0 and Phase 1 migrations.
- Tier cap removal and catalog seeding.

Sprint 2:
- Phase 2 assignment refactor and compatibility adapters.
- Phase 3 rules engine core and versioning.

Sprint 3:
- Phase 4 reward engine and Phase 5 withdrawal engine integration with existing wallet module.

## Risk Controls

- Keep old profile tier fields during transition to prevent frontend breakage.
- Introduce compatibility mapper before replacing existing `updateMemberPlan` and withdrawal checks.
- Use rule-simulator and shadow-mode evaluations before enforcing new rule outputs.
- Add strict idempotency and audit traces for all financial and membership state transitions.

## Definition of Done (Enterprise Membership Engine)

- 100-tier membership supported from configuration.
- Rewards, withdrawals, upgrades, downgrades, multiplier, bonus wallet, and fee logic are fully data-driven.
- Admin can edit formulas, schedules, thresholds, copy, workflows, and gateways without code changes.
- Versioning, draft/publish, rollback, audit logs, and role permissions are enforced.
- System passes security, performance, and regression gates and is production rollout-ready.

## Implementation Progress Log (2026-08-02)

### Phase 0 — Domain Freeze and Rule Contract
- Added a central membership contract layer in [platform/src/services/api/membership.ts](platform/src/services/api/membership.ts) for plan definitions, assignment snapshots, reward policy, and withdrawal policy.
- Added a SQL migration scaffold for plan catalog and rule-version storage in [platform/supabase/migrations/036_membership_engine_catalog_and_rules.sql](platform/supabase/migrations/036_membership_engine_catalog_and_rules.sql).
- Remaining work: wire the policy contract into the Supabase RPC layer and expose a live admin rule-editor UI.

### Phase 1 — Membership Catalog Foundation (100+ Tiers)
- Implemented a data-driven 100-plan catalog with a stable 1..100 ladder and a catalog resolver that no longer clamps membership tiers to three levels.
- Replaced the hardcoded tier label logic in [platform/src/services/api/auth.ts](platform/src/services/api/auth.ts) with catalog-based resolution.
- Remaining work: backfill the full catalog into the production database and expose the catalog in an admin CRUD screen.

### Phase 2 — Membership Assignment and Ledger Refactor
- Added plan-based assignment snapshots and a migration-safe metadata path for membership changes.
- Updated member-plan updates to resolve plan metadata before issuing plan-change flow.
- Remaining work: persist assignment snapshots into a dedicated history table and extend the existing ledger to capture full lifecycle events.

### Phase 3 — Central Business Rules Engine (Versioned)
- Added a central rules evaluation surface for reward policy and withdrawal policy through the membership engine service.
- Added a versioned SQL migration scaffold for rule versions and audit logs.
- Remaining work: publish rules from admin workflows and execute them through the RPC-backed runtime rather than the local service layer only.

### Phase 4 — Configurable Daily Reward Engine
- Implemented a configurable reward policy resolver for daily reward percentage, cycle length, and target wallet.
- Added tests covering reward calculation and reward-policy evaluation.
- Remaining work: connect reward posting to the wallet module and scheduler/cron job infrastructure.

### Phase 5 — Withdrawal Management Engine
- Implemented a withdrawal policy evaluator that resolves threshold, cap, and hold-window behavior from policy data instead of hardcoded assumptions.
- Reused the same policy path in the membership engine and surfaced it in the admin/profile entry points.
- Remaining work: connect the policy evaluator to the actual withdrawal request flow in the wallet service and admin approval controls.

### Sprint 1 Completion Notes
- Implemented and verified the new engine through targeted unit tests and a production build.
- Remaining gaps are now concentrated in database-backed rollout, admin policy UX, and runtime orchestration rather than in the initial core tiering and policy logic.

## Implementation Continuation Log (2026-08-02, Phase 5 to 13)

### Phase 5 — Withdrawal Management Engine (Continuation)
- Completed runtime delegation of plan-eligibility checks from `createWithdrawalRequest` to the central membership policy evaluator in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).
- Replaced hardcoded hold-threshold constant with lifecycle config-backed threshold resolution in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).
- Added deterministic date-safe notification coverage in [platform/src/test/walletNotifications.test.ts](platform/src/test/walletNotifications.test.ts).
- Remaining unfinished:
  - Fee-compliance blocking is not yet wired to invoice settlement data (currently policy-ready but data source not connected).
  - Schedule registry evaluation still uses existing scheduling flow and is not yet backed by dedicated schedule tables.

### Phase 6 — Auto-Upgrade and Downgrade Engine
- Added configurable auto-upgrade trigger evaluator and downgrade policy evaluator in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added test coverage for threshold-triggered upgrades and overdue downgrade decisions in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Added schema scaffolding for lifecycle event persistence in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Remaining unfinished:
  - Upgrade/downgrade evaluators are not yet invoked by a background workflow executor.
  - Notification and admin approval loops for downgrade recovery are not yet integrated.

### Phase 7 — Reward Lock, Carry-Forward, and Multiplier Reset Logic
- Added carry-forward policy evaluator with configurable deduction and multiplier reset behavior in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added tests to validate carry-forward and reset behavior in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - Carry-forward decision is not yet connected to live reward posting jobs.
  - Grace/suspension behavior is not yet persisted per-user in runtime state.

### Phase 8 — Reward Multiplier Premium Module
- Added multiplier pricing evaluator (membership-price linked formula + gateway-only payment enforcement) in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added multiplier order table scaffold in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added pricing assertions in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - No user-facing multiplier activation UI/workflow yet.
  - Payment callback/verification orchestration for multiplier orders is not yet implemented.

### Phase 9 — Bonus Wallet Engine and Fee Compliance Engine
- Added fee-compliance evaluator and policy contract in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added invoice table scaffold in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added fee-compliance policy tests in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - Fee-compliance evaluator is not yet connected to actual `membership_fee_invoices` settlement status.
  - Bonus-wallet specific withdrawal thresholds and lock periods are not yet enforced in wallet runtime.

### Phase 10 — Membership Workflow Builder + No-Code Rules UI
- Added workflow definition/run schema scaffolding in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added workflow transition simulation engine in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added workflow simulation tests in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - No admin visual workflow builder UI yet.
  - No persistent rule test harness UI for sample users yet.

### Phase 11 — Payment Gateway Orchestration and Financial Controls
- Added gateway routing decision engine in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added gateway registry schema scaffolding in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added gateway selection tests in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - Live provider adapters and failover retries are not implemented.
  - Reconciliation loop between provider webhooks and internal ledger is not yet connected.

### Phase 12 — Analytics, Security, and Scale Hardening
- Added membership analytics snapshot builder in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added daily analytics aggregate table scaffold in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added analytics snapshot tests in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - No scheduled population job is wired for daily aggregates yet.
  - Security hardening for new lifecycle tables (RLS + policy set) is not yet applied.

### Phase 13 — Progressive Rollout and Backward-Compatible Cutover
- Added rollout decision evaluator (`shadow` / `progressive` / `enforced`) in [platform/src/services/api/membershipLifecycle.ts](platform/src/services/api/membershipLifecycle.ts).
- Added rollout flags schema scaffold and seed flag in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
- Added rollout behavior tests in [platform/src/test/membershipLifecycle.test.ts](platform/src/test/membershipLifecycle.test.ts).
- Remaining unfinished:
  - No traffic-splitting middleware currently consumes rollout flags at request boundaries.
  - Shadow-mode diff logging and automated rollback triggers are not yet integrated.

### Verification Snapshot
- Tests passed:
  - `membershipEngine.test.ts`
  - `membershipLifecycle.test.ts`
  - `walletNotifications.test.ts`
  - `memberPlanUpgrade.test.ts`
  - `adminCreateUser.test.ts`
- Build checks passed:
  - `npm run typecheck`
  - `npm run build`

## High-Impact Execution Pass (2026-08-02, Priority Ordered)

### Highest Impact Completed First
1. Live withdrawal policy/runtime enforcement wiring:
   - Connected withdrawal eligibility path to centralized policy logic while preserving production min/max wallet constraints in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).
   - Added live-config membership controls sourced from `platform_settings`:
     - `wallet_paid_membership_min_tier`
     - `wallet_withdrawal_hold_threshold`
     - `membership_fee_enforce_from_withdrawal_count`
     - `membership_fee_block_without_settlement`
   - Added optional live fee-blocking against `membership_fee_invoices` when fee enforcement is enabled in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).

2. Security and live-schema hardening for Phase 6-13 tables:
   - Added RLS enablement and admin/user policies for new lifecycle tables in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).
   - Seeded new live settings defaults through migration in [platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql](platform/supabase/migrations/037_membership_lifecycle_phases_6_13.sql).

3. Backward-compatible type and settings propagation:
   - Extended wallet settings contract with optional lifecycle controls in [platform/src/types/index.ts](platform/src/types/index.ts).
   - Updated wallet settings read/write paths to include new live keys in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).

### Verification for This Pass
- Targeted tests passed:
  - `walletNotifications.test.ts`
  - `membershipLifecycle.test.ts`
  - `membershipEngine.test.ts`
  - `memberPlanUpgrade.test.ts`
  - `adminCreateUser.test.ts`
- Build and compile passed:
  - `npm run typecheck`
  - `npm run build`

### Remaining Work (Still Open, Lower-Impact Than Runtime Wiring Above)
- Apply migrations `036` and `037` to the live Supabase project and validate table/policy creation remotely.
- Populate full 100-tier catalog records in live DB (current migration seed is partial baseline).
- Wire fee invoice lifecycle creation/settlement automation (current withdrawal path reads invoice state when enforcement is enabled, but invoice issuance workflow is not yet automated).
- Add admin UX for editing and publishing lifecycle settings/rules without touching DB manually.
- Add production scheduler jobs for reward cycles, workflow runs, and daily membership analytics population.

## Implementation Continuation Log (2026-08-02, Full Leftover Execution Pass)

### Production Database Rollout Verification and Deployment
- Confirmed live Supabase project access and listed applied remote migrations for project `nnslrsosonhbkixegyyq`.
- Confirmed previous migrations `036`, `037`, and `038` are applied remotely.
- Added and applied new migration `039_membership_catalog_full_seed` to populate the full canonical 100-tier ladder in live DB.
- Added and applied new migration `040_membership_automation_and_gateway_orchestration_retry` for:
  - automation job-run tables,
  - gateway webhook event normalization,
  - job RPC runners,
  - pg_cron schedules,
  - RLS policies for new operational tables.

### Full 100-Tier Catalog Seed Completion
- Added local migration file [platform/supabase/migrations/039_membership_catalog_full_seed.sql](platform/supabase/migrations/039_membership_catalog_full_seed.sql).
- Updated in-app catalog pricing to use the exact 100-tier canonical price ladder in [platform/src/services/api/membership.ts](platform/src/services/api/membership.ts).

### Dedicated Admin CRUD Surfaces Added
- Added membership admin data service in [platform/src/services/api/membershipAdmin.ts](platform/src/services/api/membershipAdmin.ts).
- Added membership gateway orchestration service in [platform/src/services/api/membershipGateway.ts](platform/src/services/api/membershipGateway.ts).
- Added dedicated admin pages:
  - [platform/src/features/admin/pages/MembershipPlansPage.tsx](platform/src/features/admin/pages/MembershipPlansPage.tsx)
  - [platform/src/features/admin/pages/MembershipBenefitsPage.tsx](platform/src/features/admin/pages/MembershipBenefitsPage.tsx)
  - [platform/src/features/admin/pages/MembershipRulesPage.tsx](platform/src/features/admin/pages/MembershipRulesPage.tsx)
  - [platform/src/features/admin/pages/MembershipWorkflowPage.tsx](platform/src/features/admin/pages/MembershipWorkflowPage.tsx)
  - [platform/src/features/admin/pages/RewardMultiplierPage.tsx](platform/src/features/admin/pages/RewardMultiplierPage.tsx)
  - [platform/src/features/admin/pages/MembershipFeePage.tsx](platform/src/features/admin/pages/MembershipFeePage.tsx)
  - [platform/src/features/admin/pages/MembershipAnalyticsPage.tsx](platform/src/features/admin/pages/MembershipAnalyticsPage.tsx)
- Wired admin routing in [platform/src/app/router/index.tsx](platform/src/app/router/index.tsx).
- Wired admin sidebar navigation in [platform/src/components/ui/AdminSidebar.tsx](platform/src/components/ui/AdminSidebar.tsx).

### Automation and Gateway Runtime Scaffolding Added
- Added migration [platform/supabase/migrations/040_membership_automation_and_gateway_orchestration.sql](platform/supabase/migrations/040_membership_automation_and_gateway_orchestration.sql) to provide scheduled RPC job runners and gateway event ingestion.
- Added server handlers:
  - [platform/src/server/membershipAutomationRunner.ts](platform/src/server/membershipAutomationRunner.ts)
  - [platform/src/server/membershipGatewayWebhook.ts](platform/src/server/membershipGatewayWebhook.ts)
- Added Supabase function entry points:
  - [platform/supabase/functions/membership-automation-runner.ts](platform/supabase/functions/membership-automation-runner.ts)
  - [platform/supabase/functions/membership-gateway-webhook.ts](platform/supabase/functions/membership-gateway-webhook.ts)

### Legacy Hardcoded Membership Label Removal
- Replaced hardcoded `Starter/Balanced/Premium` fallback logic with catalog-based label resolution in [platform/src/services/api/wallet.ts](platform/src/services/api/wallet.ts).
- Removed 3-tier clamp and hardcoded labels from admin user creation flow in [platform/src/server/adminCreateUser.ts](platform/src/server/adminCreateUser.ts).

### User-Facing Membership UX Enhancements
- Added dynamic tier upgrade actions, membership timeline, withdrawal eligibility panel, and multiplier visibility in [platform/src/features/profile/pages/ProfilePage.tsx](platform/src/features/profile/pages/ProfilePage.tsx).
- Added membership policy and multiplier summary panels in wallet UX at [platform/src/features/rewards/pages/RewardHistoryPage.tsx](platform/src/features/rewards/pages/RewardHistoryPage.tsx).

### Verification Snapshot (This Execution Pass)
- Supabase migrations verified and applied remotely:
  - `039_membership_catalog_full_seed`
  - `040_membership_automation_and_gateway_orchestration_retry`
- Tests passed:
  - `membershipEngine.test.ts`
  - `membershipLifecycle.test.ts`
  - `walletNotifications.test.ts`
  - `memberPlanUpgrade.test.ts`
  - `adminCreateUser.test.ts`
- Build checks passed:
  - `npm run typecheck`
  - `npm run build`

### Remaining Work Requiring Credentials or External Provider Setup
- Live payment-provider adapters (Stripe, Paystack, Flutterwave, Monnify, PayPal, crypto rails) require provider credentials and signing secrets to finalize webhook signature verification and payout/retry logic.
- Deploying and binding production edge/function endpoints to provider callback URLs requires production environment secrets and provider dashboard access.
