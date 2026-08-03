# P2P Merchant Phase Implementation Doc

Date: 2026-08-02

## Purpose

Define the phased implementation of an enterprise-grade, fully configurable P2P merchant payment and escrow system that becomes the default fiat payment provider for membership and other fiat purchase flows.

This plan is anchored to verified code that already exists in this repository.

## End-to-End Code Confirmation (What Is Already Done)

The following foundation is confirmed in code and can be reused directly:

### Confirmed reusable payment and orchestration foundation

- Gateway registry and ranking model already exists:
  - `membership_gateway_registry` table in migration `037_membership_lifecycle_phases_6_13.sql`.
  - Routing decision logic in `platform/src/services/api/membershipLifecycle.ts` (`resolvePaymentGatewayRoute`).
  - Runtime gateway selector service in `platform/src/services/api/membershipGateway.ts` (`selectMembershipGateway`).
- Gateway webhook normalization and ingestion already exists:
  - `membership_gateway_events` table and `ingest_membership_gateway_event` RPC in migration `040_membership_automation_and_gateway_orchestration.sql`.
  - Webhook handler in `platform/src/server/membershipGatewayWebhook.ts`.
- Scheduled automation foundation already exists:
  - `membership_job_runs` and multiple scheduled RPC jobs in migration `040_membership_automation_and_gateway_orchestration.sql`.
  - Server runner in `platform/src/server/membershipAutomationRunner.ts`.

### Confirmed reusable configuration and admin foundation

- Dynamic settings store already used across domains:
  - `platform_settings` is actively used by wallet and membership lifecycle services.
- Rules/versioning/workflow pattern already exists and is admin-consumable:
  - `membership_rule_versions`, `membership_workflow_definitions`, `membership_workflow_runs`, `membership_rollout_flags` from migrations `036` and `037`.
  - Service-layer CRUD patterns in `platform/src/services/api/membershipAdmin.ts`.
- Admin surface extension points already wired:
  - Admin routing in `platform/src/app/router/index.tsx`.
  - Admin sidebar navigation in `platform/src/components/ui/AdminSidebar.tsx`.
  - Live-config page pattern exists in `platform/src/features/admin/pages/ReferralSettingsPage.tsx`.

### Confirmed reusable wallet and ledger foundation

- Multi-wallet account model exists with transfer and audit support:
  - `wallet_accounts`, `wallet_transactions`, `wallet_transfers` in migration `012_wallet_accounts.sql`.
  - Wallet runtime in `platform/src/services/api/wallet.ts`.
- Membership ledger and plan updates already use RPC path:
  - `record_member_plan_change` in migration `041_membership_tier_runtime_unclamp.sql`.
  - `updateMemberPlan` in `platform/src/services/api/auth.ts`.

### Confirmed gaps for P2P merchant (not implemented yet)

- No merchant wallet type exists in app-level type contracts (`walletAccountTypes` currently: main, bonus, referral, cashback, reward).
- No merchant qualification engine tables or services.
- No P2P order lifecycle tables (created/assigned/awaiting payment/disputed/etc.).
- No merchant matching engine or configurable algorithm registry.
- No dispute/evidence subsystem for fiat P2P transfer proofs.
- No merchant dashboard pages or APIs.

## Best Insertion Points (Verified)

Use these insertion points first to minimize regression risk:

### 1) Database insertion point (primary)

- Add new migrations after `041` under `platform/supabase/migrations`.
- Reuse existing architectural patterns:
  - config in `platform_settings`,
  - RPC-first writes with `SECURITY DEFINER`,
  - explicit RLS policies for every new table,
  - scheduled jobs in pg_cron style used by migration `040`.

### 2) Payment orchestration insertion point

- Extend `platform/src/services/api/membershipGateway.ts` into a generalized fiat payment orchestration adapter that supports:
  - direct gateways,
  - P2P merchant as a provider class,
  - configurable default provider selection.
- Keep existing gateway route resolver in `platform/src/services/api/membershipLifecycle.ts` as compatibility path while introducing dedicated P2P matching/routing service.

### 3) Wallet and escrow insertion point

- Extend wallet domain in:
  - `platform/src/services/api/wallet.ts`,
  - `platform/src/types/index.ts`,
  - wallet-related migrations.
- Introduce Merchant Wallet balances (available, reserved, pending, locked) without breaking existing wallet APIs.

### 4) Admin and rule-management insertion point

- Add new admin pages in `platform/src/features/admin/pages` using `ReferralSettingsPage` as the reference pattern for live edit + save + reload from Supabase.
- Add new admin routes in `platform/src/app/router/index.tsx` and menu items in `platform/src/components/ui/AdminSidebar.tsx`.

### 5) User-facing purchase flow insertion point

- Membership upgrade/payment entry points:
  - `platform/src/services/api/auth.ts` (`updateMemberPlan` orchestration path),
  - profile and wallet UX pages:
    - `platform/src/features/profile/pages/ProfilePage.tsx`
    - `platform/src/features/rewards/pages/RewardHistoryPage.tsx`
- Add an order-intent layer so all fiat purchases can pass through provider selection (direct gateway vs P2P).

## P2P Merchant Architecture Targets

## Core modules to add

- `platform/src/services/api/p2pMerchant.ts`
- `platform/src/services/api/p2pMatching.ts`
- `platform/src/services/api/p2pEscrow.ts`
- `platform/src/services/api/p2pDisputes.ts`
- `platform/src/services/api/p2pCompliance.ts`
- `platform/src/services/api/p2pAdmin.ts`

## Server handlers to add

- `platform/src/server/p2pOrderWebhook.ts` (optional for bank/webhook reconciliation)
- `platform/src/server/p2pEscrowRunner.ts`
- `platform/src/server/p2pComplianceRunner.ts`

## Supabase functions to add

- `platform/supabase/functions/p2p-escrow-runner.ts`
- `platform/supabase/functions/p2p-compliance-runner.ts`

## Proposed New Schema Domains

Create tables/RPC in migrations for:

- Fee and provider control:
  - `fiat_payment_provider_settings`
  - `fiat_platform_fee_policies`
- Merchant profile and qualification:
  - `merchant_profiles`
  - `merchant_kyc_requirements`
  - `merchant_qualification_rules`
  - `merchant_status_audit`
- Merchant liquidity wallet:
  - `merchant_wallet_accounts`
  - `merchant_wallet_ledgers`
  - `merchant_wallet_holds`
- Matching and assignment:
  - `merchant_matching_policies`
  - `merchant_assignment_events`
- P2P order and escrow lifecycle:
  - `p2p_orders`
  - `p2p_order_states`
  - `p2p_order_state_transitions`
  - `p2p_payment_submissions`
  - `p2p_escrow_events`
- Disputes and evidence:
  - `p2p_disputes`
  - `p2p_dispute_evidence`
  - `p2p_dispute_actions`
- Monitoring and risk:
  - `p2p_risk_signals`
  - `p2p_velocity_windows`
  - `p2p_fraud_scores`

All state sets should be data-driven, not hardcoded.

## Phased Implementation Plan

## Phase 0: Domain Contract and Backward-Compatible Payment Intent

Scope:
- Define canonical payment intent model for all fiat purchases:
  - membership purchases,
  - multiplier activation,
  - membership fee settlements,
  - wallet funding,
  - promotional purchases,
  - premium features.
- Define provider selection contract with default-provider override.
- Preserve existing direct gateway flow as fallback.

Deliverables:
- `FiatPaymentIntent` contract.
- Config keys for default provider and provider fallback chain.
- Compatibility adapter around current membership payment entry points.

Exit criteria:
- Every fiat action can create a payment intent without breaking existing behavior.

## Phase 1: Default Fiat Fee Engine

Scope:
- Build configurable fee policy engine for:
  - fixed,
  - percentage,
  - hybrid,
  - country/currency-specific,
  - discount/waiver support.
- Show amount due, fee, total, status, ETA in user flow.

Deliverables:
- Fee policy tables + resolver RPC.
- Admin UI for fee policy management.
- Fee quote service integrated into payment intent creation.

Exit criteria:
- No platform transaction fee logic is hardcoded.

## Phase 2: Merchant Wallet Foundation

Scope:
- Introduce Merchant Wallet with states:
  - available,
  - reserved,
  - pending,
  - locked/frozen.
- Add top-up, withdrawal, hold, reserve, release primitives.

Deliverables:
- Merchant wallet schema and ledger RPCs.
- Wallet service adapters.
- Admin and merchant wallet visibility endpoints.

Exit criteria:
- Merchant liquidity is independently tracked and auditable.

## Phase 3: Merchant Qualification and Activation Engine

Scope:
- Configurable eligibility rules:
  - min/max deposit,
  - required docs,
  - account age,
  - tx count,
  - membership level,
  - risk and geography restrictions,
  - active order and daily limits.
- Merchant Wallet starts disabled and becomes enabled only after rule pass.

Deliverables:
- Qualification rules tables + evaluator.
- KYC/compliance checklist data model.
- Merchant status transitions with audit logs.

Exit criteria:
- Merchant activation path is fully rules-driven.

## Phase 4: Matching Engine v1

Scope:
- Deterministic assignment engine based on configurable criteria:
  - liquidity,
  - region/country/currency,
  - bank compatibility,
  - rating/completion/response,
  - online status,
  - risk score,
  - min/max order constraints,
  - daily capacity.

Deliverables:
- `merchant_matching_policies` + evaluation trace logging.
- Assignment RPC and retry/reassignment strategy.
- Admin controls for policy tuning.

Exit criteria:
- New P2P orders can always produce either an assignment or explicit no-liquidity reason.

## Phase 5: P2P Escrow Order Lifecycle

Scope:
- Implement full configurable lifecycle states:
  - Created,
  - Merchant Assigned,
  - Awaiting Payment,
  - Payment Submitted,
  - Awaiting Merchant Confirmation,
  - Confirmed,
  - Completed,
  - Expired,
  - Cancelled,
  - Disputed,
  - Under Review,
  - Refunded.
- Build customer and merchant action APIs:
  - I Have Paid,
  - Confirm Payment,
  - Report Issue,
  - Request Review.

Deliverables:
- P2P order tables + transition validator.
- Escrow reservation/release accounting entries.
- User and merchant timeline endpoints.

Exit criteria:
- End-to-end happy path closes order and posts ledger entries atomically.

## Phase 6: Merchant Notification and SLA Engine

Scope:
- Trigger push/email/SMS/in-app alerts for assignments and payment submissions.
- Enforce merchant response deadlines and escalation flows.

Deliverables:
- Notification templates and event hooks.
- SLA timers and auto-escalation jobs.

Exit criteria:
- Merchant non-response leads to deterministic reassignment or review flow.

## Phase 7: Dispute and Evidence Console

Scope:
- Enable evidence upload/metadata trails for both customer and merchant.
- Add admin dispute queue with decision outcomes.

Deliverables:
- Dispute schema and evidence model.
- Admin dispute resolution page and action logs.
- Outcome paths: release, refund, penalize, suspend.

Exit criteria:
- Disputed orders are fully traceable and resolvable with auditable decisions.

## Phase 8: Liquidity Controls and Auto-Disable

Scope:
- Reduce merchant available balance on confirmation.
- Add thresholds:
  - low-balance alerts,
  - minimum operating balance,
  - auto-disable,
  - auto-reassignment.

Deliverables:
- Liquidity policy settings + evaluators.
- Scheduled health checks and alerts.

Exit criteria:
- Illiquid merchants are automatically removed from assignment pool.

## Phase 9: Merchant Dashboard and Analytics

Scope:
- Merchant UI for balances, orders, dispute stats, response/completion metrics, earnings, history.
- Performance analytics and export-ready feeds.

Deliverables:
- Merchant dashboard pages.
- API endpoints for merchant KPIs.
- Daily aggregate jobs.

Exit criteria:
- Merchants can self-monitor liquidity and SLA performance.

## Phase 10: KYC and Compliance Hardening

Scope:
- Multi-level KYC workflow with approve/reject/resubmit/expire.
- AML/sanctions/risk checks integrated as configurable steps.

Deliverables:
- KYC level model and status transitions.
- Compliance runner jobs and audit reports.

Exit criteria:
- No merchant can process orders while out of compliance.

## Phase 11: Security and Fraud Controls

Scope:
- 2FA requirements, device/IP checks, velocity limits, duplicate payment detection, suspicious activity monitoring.
- Immutable audit logs for financial transitions.

Deliverables:
- Risk scoring hooks and deny/challenge policies.
- Admin risk console and alerting.

Exit criteria:
- High-risk behavior is blocked or escalated automatically.

## Phase 12: Admin No-Code Controls and Rollout

Scope:
- Full admin configurability without code changes:
  - fee rules,
  - eligibility,
  - matching,
  - state model,
  - deadlines,
  - notifications,
  - country/currency support.
- Progressive rollout with fallback to direct gateways.

Deliverables:
- Admin pages + settings APIs.
- Rollout flags and per-cohort enablement.
- Runbooks and rollback playbook.

Exit criteria:
- P2P can be enabled per module/cohort and reverted safely.

## Immediate Build Order (First 3 Sprints)

Sprint 1:
- Phase 0 + Phase 1 + initial Phase 2 schema.

Sprint 2:
- Complete Phase 2 + Phase 3 + Phase 4.

Sprint 3:
- Phase 5 core lifecycle + Phase 6 notifications.

## Risk Controls

- Keep direct gateway path active while P2P is in progressive rollout.
- Double-write financial events to both legacy and new audit views during migration window.
- Require idempotency keys for all order state mutation endpoints.
- Use shadow-mode matching evaluation before enforcing merchant assignment decisions.

## Definition of Done (P2P Merchant System)

- P2P Merchant is configurable as default fiat provider platform-wide.
- Merchant assignment, escrow lifecycle, wallet debits, and customer settlement are fully data-driven.
- Disputes, KYC/compliance, security, analytics, and admin controls are operational.
- Direct gateway fallback remains available and policy-controlled.
- System passes security, performance, and regression gates for production rollout.

## Confirmed Best First Insertion Task

Implement the first migration set after `041` to establish:

1. Fiat payment intent + provider setting tables.
2. Merchant profile + qualification + merchant wallet tables.
3. P2P order lifecycle base tables and transition constraints.
4. RLS and core RPC stubs for assignment and escrow reservation.

This is the highest-leverage insertion point because all remaining service/UI phases depend on these contracts.

---

## 2026-08-02 Implementation Execution Log (Added)

This section records implementation work completed in this execution pass and remaining tasks per phase. Original plan content above is unchanged.

### Delivered artifacts in this pass

- New migration: `platform/supabase/migrations/042_p2p_merchant_phases_0_12.sql`
- New API services:
  - `platform/src/services/api/p2pMerchant.ts`
  - `platform/src/services/api/p2pMatching.ts`
  - `platform/src/services/api/p2pEscrow.ts`
  - `platform/src/services/api/p2pDisputes.ts`
  - `platform/src/services/api/p2pCompliance.ts`
  - `platform/src/services/api/p2pAdmin.ts`
- New server handlers:
  - `platform/src/server/p2pOrderWebhook.ts`
  - `platform/src/server/p2pEscrowRunner.ts`
  - `platform/src/server/p2pComplianceRunner.ts`
- New Supabase edge functions:
  - `platform/supabase/functions/p2p-escrow-runner/index.ts`
  - `platform/supabase/functions/p2p-compliance-runner/index.ts`
- UI and routing integration:
  - `platform/src/features/admin/pages/P2PMerchantControlPage.tsx`
  - `platform/src/features/dashboard/pages/MerchantDashboardPage.tsx`
  - Router/menu wiring in:
    - `platform/src/app/router/index.tsx`
    - `platform/src/components/ui/AdminSidebar.tsx`
- Phase-0 compatibility update:
  - `platform/src/services/api/auth.ts` now creates a fiat payment intent in `updateMemberPlan` when payment amount is provided.
- Wallet account contract extension:
  - `platform/src/types/index.ts`
  - `platform/src/services/api/walletPolicies.ts`
  - label map updates in wallet pages.

### Phase-by-phase status

#### Phase 0: Domain Contract and Backward-Compatible Payment Intent

Status: Implemented.

Completed:
- Added `fiat_payment_intents` table and `create_fiat_payment_intent` RPC.
- Added provider resolution via `resolve_default_fiat_provider` RPC and platform settings keys for default/fallback chain.
- Added compatibility adapter path in `updateMemberPlan` to create intents.

Remaining:
- Expand intent creation usage across every fiat entry point outside membership upgrade (`wallet funding`, `premium feature purchase`, `promotional purchase`) where those flows exist.

#### Phase 1: Default Fiat Fee Engine

Status: Implemented.

Completed:
- Added `fiat_platform_fee_policies` table.
- Added `quote_fiat_fee` resolver RPC and integrated fee calculation into payment intent creation.
- Added admin API and admin page controls for fee policies.

Remaining:
- Surface fee ETA/quote cards in all user-facing purchase UIs that initiate intents.

#### Phase 2: Merchant Wallet Foundation

Status: Implemented.

Completed:
- Added merchant wallet domain tables: `merchant_wallet_accounts`, `merchant_wallet_ledgers`, `merchant_wallet_holds`.
- Added RPC `merchant_wallet_apply_entry` for top-up/withdraw/reserve/release/settlement primitives.
- Added merchant dashboard wallet visibility endpoints and UI.

Remaining:
- Add dedicated admin top-up/withdraw action form for merchant wallets in admin UI (currently available via RPC/service layer).

#### Phase 3: Merchant Qualification and Activation Engine

Status: Implemented.

Completed:
- Added `merchant_profiles`, `merchant_kyc_requirements`, `merchant_qualification_rules`, `merchant_status_audit`.
- Added rules-driven evaluator RPC `evaluate_merchant_qualification`.
- Added admin API controls to manage qualification rules.

Remaining:
- Add richer admin KYC document review queue UI (data model and endpoints are in place).

#### Phase 4: Matching Engine v1

Status: Implemented.

Completed:
- Added `merchant_matching_policies` and `merchant_assignment_events`.
- Added deterministic weighted assignment RPC `assign_p2p_order` with trace capture and shadow-mode behavior.
- Added matching policy admin API upsert/list.

Remaining:
- Add a visual assignment trace explorer in admin UI for debugging candidate scoring.

#### Phase 5: P2P Escrow Order Lifecycle

Status: Implemented.

Completed:
- Added `p2p_orders`, `p2p_order_states`, `p2p_order_state_transitions`, `p2p_payment_submissions`, `p2p_escrow_events`.
- Added state transition validator RPC `transition_p2p_order_state` with idempotency key requirement.
- Added escrow-related reserve/release/settlement hooks tied to transitions.

Remaining:
- Connect customer-facing action buttons (`I Have Paid`, `Report Issue`) directly in user purchase/order screens.

#### Phase 6: Merchant Notification and SLA Engine

Status: Implemented.

Completed:
- Added SLA tables `p2p_sla_policies`, `p2p_sla_events`.
- Added notification template/event tables `p2p_notification_templates`, `p2p_notification_events`.
- Added runner endpoint foundation (`p2pEscrowRunner`) to support scheduled automation.

Remaining:
- Integrate channel delivery adapters (email/SMS/push providers) to dispatch queued notification events.

#### Phase 7: Dispute and Evidence Console

Status: Implemented.

Completed:
- Added `p2p_disputes`, `p2p_dispute_evidence`, `p2p_dispute_actions`.
- Added dispute API service for open/evidence/action/resolve flows.

Remaining:
- Add dedicated admin dispute queue page (actions are available in service layer and schema).

#### Phase 8: Liquidity Controls and Auto-Disable

Status: Implemented.

Completed:
- Added RPC `run_p2p_liquidity_health_job`.
- Added platform setting support for minimum balance policy and auto-disable logic.

Remaining:
- Add merchant-facing low-balance proactive notices in dashboard UI.

#### Phase 9: Merchant Dashboard and Analytics

Status: Implemented.

Completed:
- Added `p2p_merchant_daily_analytics` table and RPC `run_p2p_merchant_analytics_job`.
- Added `MerchantDashboardPage` with liquidity, state, and order views.

Remaining:
- Add CSV/Excel export actions for merchant analytics snapshots.

#### Phase 10: KYC and Compliance Hardening

Status: Implemented.

Completed:
- Added KYC requirement model with status lifecycle fields.
- Added compliance runner RPC `run_p2p_compliance_job` and server/edge handlers.

Remaining:
- Add external AML/sanctions provider connector if required for production policy.

#### Phase 11: Security and Fraud Controls

Status: Implemented.

Completed:
- Added `p2p_risk_signals`, `p2p_velocity_windows`, `p2p_fraud_scores`.
- Added strict RLS coverage and audit-friendly state/escrow event trail.

Remaining:
- Add admin risk console UI for score/signal triage and challenge/deny overrides.

#### Phase 12: Admin No-Code Controls and Rollout

Status: Implemented.

Completed:
- Added `p2p_rollout_flags` and platform rollout settings.
- Added admin page `P2PMerchantControlPage` for no-code tuning of providers, fee policy, rules, and rollout.
- Added direct gateway fallback controls in provider/rollout model.

Remaining:
- Add cohort simulation preview in admin UI before applying rollout changes.

### Validation performed

- TypeScript validation executed: `npm run typecheck` (success).

---

## 2026-08-02 Implementation Update 2 (Added)

This section captures additional implementation completed after the first execution log and clarifies what is still not fully end-to-end in code.

### Additional completed work in this pass

- Extended fiat orchestration service with provider/fee preview and P2P order creation helpers:
  - `platform/src/services/api/p2pMerchant.ts`
  - Added: `previewFiatProvider`, `quoteFiatFee`, `createP2POrder`.

- Linked multiplier activation flow to fiat intents (no hardcoded provider path):
  - `platform/src/services/api/membershipAdmin.ts`
  - `createMultiplierOrder` now creates a fiat payment intent first and persists intent/provider reference.

- Added admin dispute resolution queue page:
  - `platform/src/features/admin/pages/P2PDisputesPage.tsx`
  - Includes auditable action paths (release/refund/penalize/suspend) through dispute API.

- Added admin risk/fraud console page:
  - `platform/src/features/admin/pages/P2PRiskConsolePage.tsx`
  - Displays risk signals and fraud score rows.

- Enhanced P2P control plane page with advanced no-code operations visibility:
  - `platform/src/features/admin/pages/P2PMerchantControlPage.tsx`
  - Added runtime settings snapshot, KYC queue table, assignment trace explorer, and rollout simulation preview.

- Added runtime settings API for no-code operational controls:
  - `platform/src/services/api/p2pAdmin.ts`
  - Added: `listP2PRuntimeSettings`.

- Added P2P notification event dispatcher and integrated in runner path:
  - `platform/src/services/api/p2pCompliance.ts`
  - Added: `processP2PNotificationEvents`, `listP2PKycQueue`, `listP2PAssignmentEvents`.
  - `platform/src/server/p2pEscrowRunner.ts` now executes notification dispatch in same job run.

- Added merchant-side order action controls and low-liquidity warning:
  - `platform/src/features/dashboard/pages/MerchantDashboardPage.tsx`
  - Merchant can trigger confirm/review/dispute transitions from dashboard.

- Upgraded profile plan-upgrade UX to display provider + fee quote preview and pass actual payment amount/currency into plan upgrade flow:
  - `platform/src/features/profile/pages/ProfilePage.tsx`

- Wired new admin pages into route/menu:
  - `platform/src/app/router/index.tsx`
  - `platform/src/components/ui/AdminSidebar.tsx`

### Updated status of previously remaining gaps

- Phase 1 (fee quote in user upgrade flow): Implemented for profile membership upgrade UX.
- Phase 3 (KYC queue visibility): Implemented in admin control plane page.
- Phase 4 (assignment trace explorer): Implemented in admin control plane page.
- Phase 6 (notification dispatch pipeline): Implemented as queue processor path in code and runner integration.
- Phase 7 (admin dispute queue): Implemented as dedicated page with action workflow.
- Phase 8 (low-liquidity visibility): Implemented in merchant dashboard.
- Phase 11 (risk console): Implemented as dedicated admin page.
- Phase 12 (cohort simulation preview): Implemented in control plane page.

### Items still not fully end-to-end in code

The following items remain partial and are not yet fully closed end-to-end:

1. Full user purchase-surface coverage for fiat intents:
   - Intent + fee/provider preview is now integrated for membership plan upgrades and multiplier order creation.
   - Not all other fiat entry points listed in Phase 0 are confirmed wired in existing UI/service flows (for example wallet funding, promotional purchases, premium feature purchases where/if present in this repo).

2. Merchant wallet top-up/withdraw dedicated admin UX:
   - Core RPC and ledger model exist.
   - A dedicated admin merchant-wallet operation form is still pending.

3. Customer-side P2P order action UI parity:
   - Merchant dashboard actions are implemented.
   - Equivalent customer-facing order action surfaces (I Have Paid / Request Review from customer order page) are still limited by absence of a dedicated customer P2P order page in current routes.

4. External AML/sanctions provider integration:
   - Compliance and KYC framework exists.
   - Third-party AML/sanctions connector implementation is not yet present.

5. Merchant analytics export from merchant dashboard:
   - Analytics data model and job exist.
   - Merchant self-export action (CSV/Excel) is still pending implementation.

### Validation performed (latest pass)

- TypeScript validation executed again: `npm run typecheck` (success).

