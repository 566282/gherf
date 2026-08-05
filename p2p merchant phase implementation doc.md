# P2P Merchant Phase Implementation Doc

Date: 2026-08-04

## Purpose

Define the phased implementation of an enterprise-grade, fully configurable P2P merchant payment and escrow system that becomes the default fiat payment provider for membership and other fiat purchase flows.

This plan is anchored to verified code that already exists in this repository and has been revalidated as of 2026-08-04.

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

### Confirmed P2P merchant status as of 2026-08-04

- The repository now contains merchant-related wallet, order lifecycle, dispute, and dashboard scaffolding, but those capabilities are still partial rather than fully end-to-end.
- Merchant wallet support is present in database and API layers, but the app-level type model is not yet fully normalized across every consumer path.
- Merchant qualification, matching, order lifecycle, dispute, and admin/merchant dashboard surfaces are present in code, but missing or incomplete pieces remain around full customer-facing journeys, automation, compliance integration, and operational hardening.
- The current repository should be treated as a partially implemented foundation rather than a complete production-ready P2P merchant rollout.

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

Note: The statuses below describe what is present in the repository as of 2026-08-04. They should be read as "scaffolded or partially wired" unless explicitly marked as "fully end-to-end". The current codebase does not yet provide a complete, production-ready P2P merchant payment flow across every user, merchant, admin, and automation surface.

#### Phase 0: Domain Contract and Backward-Compatible Payment Intent

Status: Partially implemented (backend/service scaffolding and compatibility adapters are present; not all fiat entry points are wired end to end).

Completed:
- Added `fiat_payment_intents` table and `create_fiat_payment_intent` RPC.
- Added provider resolution via `resolve_default_fiat_provider` RPC and platform settings keys for default/fallback chain.
- Added compatibility adapter path in `updateMemberPlan` to create intents.

Remaining:
- Expand intent creation usage across every fiat entry point outside membership upgrade (`wallet funding`, `premium feature purchase`, `promotional purchase`) where those flows exist.

#### Phase 1: Default Fiat Fee Engine

Status: Partially implemented (fee policy tables, resolver RPCs, and admin controls exist; user-facing fee quote coverage is still incomplete for every purchase surface).

Completed:
- Added `fiat_platform_fee_policies` table.
- Added `quote_fiat_fee` resolver RPC and integrated fee calculation into payment intent creation.
- Added admin API and admin page controls for fee policies.

Remaining:
- Surface fee ETA/quote cards in all user-facing purchase UIs that initiate intents.

#### Phase 2: Merchant Wallet Foundation

Status: Partially implemented (merchant wallet schema, ledger primitives, and merchant visibility exist; dedicated merchant-wallet admin UX and full operational wiring remain pending).

Completed:
- Added merchant wallet domain tables: `merchant_wallet_accounts`, `merchant_wallet_ledgers`, `merchant_wallet_holds`.
- Added RPC `merchant_wallet_apply_entry` for top-up/withdraw/reserve/release/settlement primitives.
- Added merchant dashboard wallet visibility endpoints and UI.

Remaining:
- Add dedicated admin top-up/withdraw action form for merchant wallets in admin UI (currently available via RPC/service layer).

#### Phase 3: Merchant Qualification and Activation Engine

Status: Partially implemented (qualification rules, KYC data model, and admin controls are present; richer review workflows and full activation enforcement remain incomplete).

Completed:
- Added `merchant_profiles`, `merchant_kyc_requirements`, `merchant_qualification_rules`, `merchant_status_audit`.
- Added rules-driven evaluator RPC `evaluate_merchant_qualification`.
- Added admin API controls to manage qualification rules.

Remaining:
- Add richer admin KYC document review queue UI (data model and endpoints are in place).

#### Phase 4: Matching Engine v1

Status: Partially implemented (assignment RPC and policy controls exist; visual assignment trace debugging and wider operational tuning remain incomplete).

Completed:
- Added `merchant_matching_policies` and `merchant_assignment_events`.
- Added deterministic weighted assignment RPC `assign_p2p_order` with trace capture and shadow-mode behavior.
- Added matching policy admin API upsert/list.

Remaining:
- Add a visual assignment trace explorer in admin UI for debugging candidate scoring.

#### Phase 5: P2P Escrow Order Lifecycle

Status: Partially implemented (order lifecycle tables, state transitions, and merchant-side actions are present; customer-facing order action parity and full end-to-end settlement confirmation remain incomplete).

Completed:
- Added `p2p_orders`, `p2p_order_states`, `p2p_order_state_transitions`, `p2p_payment_submissions`, `p2p_escrow_events`.
- Added state transition validator RPC `transition_p2p_order_state` with idempotency key requirement.
- Added escrow-related reserve/release/settlement hooks tied to transitions.

Remaining:
- Closed in code: customer-side order actions are available in `platform/src/features/dashboard/pages/UserOrdersPage.tsx` (`I have paid`, `Request review`) and are wired to payment-proof + dispute/review transitions.

#### Phase 6: Merchant Notification and SLA Engine

Status: Implemented in code (notification templates/events, queue processor, and channel adapters for email/push/SMS-family dispatch are wired; production provider credentials and scheduler trigger remain deployment configuration).

Completed:
- Added SLA tables `p2p_sla_policies`, `p2p_sla_events`.
- Added notification template/event tables `p2p_notification_templates`, `p2p_notification_events`.
- Added runner endpoint foundation (`p2pEscrowRunner`) to support scheduled automation.
- Added channel dispatch adapters:
  - `platform/supabase/functions/notification-email-dispatch/index.ts`
  - `platform/supabase/functions/notification-push-dispatch/index.ts`
  - `platform/supabase/functions/notification-sms-dispatch/index.ts`
- Added channel routing in communication service:
  - `platform/src/services/api/communications.ts`
- Added withdrawal timeout processing to scheduled escrow runner:
  - `platform/supabase/functions/p2p-escrow-runner/index.ts`

Remaining:
- Configure provider endpoints/secrets in environment and attach a production scheduler to invoke the escrow runner on cadence.

#### Phase 7: Dispute and Evidence Console

Status: Partially implemented (dispute schema and admin dispute APIs exist; evidence-heavy review flows and end-to-end dispute triage UX remain incomplete).

Completed:
- Added `p2p_disputes`, `p2p_dispute_evidence`, `p2p_dispute_actions`.
- Added dispute API service for open/evidence/action/resolve flows.

Remaining:
- Add dedicated admin dispute queue page (actions are available in service layer and schema).

#### Phase 8: Liquidity Controls and Auto-Disable

Status: Partially implemented (health-job and policy settings exist; proactive merchant UI notices and full auto-disable enforcement remain incomplete).

Completed:
- Added RPC `run_p2p_liquidity_health_job`.
- Added platform setting support for minimum balance policy and auto-disable logic.

Remaining:
- Add merchant-facing low-balance proactive notices in dashboard UI.

#### Phase 9: Merchant Dashboard and Analytics

Status: Partially implemented (merchant dashboard and analytics jobs exist; export and deeper self-service analytics workflows remain incomplete).

Completed:
- Added `p2p_merchant_daily_analytics` table and RPC `run_p2p_merchant_analytics_job`.
- Added `MerchantDashboardPage` with liquidity, state, and order views.

Remaining:
- Add CSV/Excel export actions for merchant analytics snapshots.

#### Phase 10: KYC and Compliance Hardening

Status: Implemented in code (KYC/compliance models and runner jobs are present, and AML/sanctions connector supports external provider URL with deterministic mock fallback; production endpoint/credential provisioning remains environment setup).

Completed:
- Added KYC requirement model with status lifecycle fields.
- Added compliance runner RPC `run_p2p_compliance_job` and server/edge handlers.

Remaining:
- Configure production AML provider endpoint/credentials and validate live screening responses against policy thresholds.

#### Phase 11: Security and Fraud Controls

Status: Partially implemented (risk signals, fraud scoring, and audit-friendly state trails exist; admin triage UI and broader challenge/deny automation remain incomplete).

Completed:
- Added `p2p_risk_signals`, `p2p_velocity_windows`, `p2p_fraud_scores`.
- Added strict RLS coverage and audit-friendly state/escrow event trail.

Remaining:
- Add admin risk console UI for score/signal triage and challenge/deny overrides.

#### Phase 12: Admin No-Code Controls and Rollout

Status: Partially implemented (admin control plane and rollout flags exist; cohort simulation preview and broader rollout hardening remain incomplete).

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

1. Production channel provider activation:
  - Email/push/SMS-family adapters are implemented in code.
  - Live delivery still requires deployment-time endpoint/API-key configuration and provider-side health checks.

2. Scheduled automation hardening:
  - Escrow runner now executes liquidity, analytics, and withdrawal-timeout jobs.
  - A reliable production scheduler cadence and alerting around failed runs must still be configured in operations.

3. External AML provider cutover:
  - AML connector supports external provider URL and mock fallback.
  - Final policy cutover still requires real provider credentials and go-live validation against expected sanction/PEP outcomes.

### Validation performed (latest pass)

- TypeScript validation executed again: `npm run typecheck` (success).

---

## 2026-08-03 Withdrawal Processing System Reality Check and New Plan (Added)

This section validates current code against the requested feature:

Feature: P2P Merchant Withdrawal Processing System

It does not replace earlier content. It adds a withdrawal-specific assessment and implementation plan.

### Executive confirmation

- The repository now has substantial P2P, merchant, risk, and orchestration infrastructure.
- However, the current live wiring is primarily built around fiat purchase intents and generic P2P order flows, not a fully automated user-withdrawal-via-merchant lifecycle.
- A dedicated withdrawal admin workflow with mandatory merchant selection, timeout-based reassignment, and user receipt confirmation-driven merchant credit is not yet complete end-to-end.

### Code-verified status against requested withdrawal workflow

1. User withdrawal request UI and validation: Partial
  - Implemented: withdrawal request form and policy checks (amount limits, balance checks, membership tier, fee enforcement/compliance precheck) via `platform/src/features/rewards/pages/RewardHistoryPage.tsx` and `platform/src/services/api/wallet.ts`.
  - Gap: request form and model are generic destination-based payout requests, not a dedicated P2P merchant withdrawal channel with merchant-ready contact/bank payload contract.

2. Admin withdrawal dashboard: Not implemented for live withdrawal operations
  - Current `/admin/withdrawal-approval` route points to a generic enterprise module scaffold (`platform/src/features/admin/pages/PlatformSettingsPage.tsx`) rather than a live withdrawal operations queue backed by `withdrawal_requests` + assignment workflow.

3. Admin approval with mandatory merchant selection: Not implemented
  - `resolveWithdrawalRequest` supports approve/reject only, with no mandatory merchant selection and no assignment contract.

4. Merchant selection engine for withdrawals: Partial (separate domain)
  - Implemented: matching policy + assignment RPC for `p2p_orders` (`assign_p2p_order`, `merchant_matching_policies`, `merchant_assignment_events`).
  - Gap: not wired to `withdrawal_requests` approval path.

5. Merchant notification on assignment: Partial
  - Implemented: notification event tables/dispatcher (`p2p_notification_events`, `processP2PNotificationEvents`).
  - Gap: no confirmed withdrawal-assignment event producer with 12h SLA reminder schedule bound to withdrawal assignments.

6. Merchant dashboard for assigned withdrawals: Partial
  - Implemented merchant dashboard exists (`platform/src/features/dashboard/pages/MerchantDashboardPage.tsx`) for P2P orders.
  - Gap: not clearly modeled as withdrawal payout jobs with user bank/contact-first completion flow.

7. Merchant contact and contact-attempt logs: Not implemented
  - No dedicated merchant-to-user contact attempt table/log contract found.

8. Merchant marks payment sent -> user confirms receipt: Not implemented as specified
  - Current customer action is "I have paid" on user orders page (purchase-side semantics), not "I have received payment" for withdrawal settlement.

9. User confirmation drives settlement: Not implemented as specified
  - Current transition/settlement paths do not implement the requested withdrawal confirmation handshake from recipient user.

10. Merchant wallet credited only after user confirmation: Not implemented as specified
  - Merchant wallet settlement exists, but trigger semantics are tied to generic P2P state transitions, not explicit withdrawal receipt confirmation by user.

11. 12-hour timeout and auto-reassignment loop: Not implemented
  - Existing cron jobs are for liquidity, compliance, and analytics; no verified assignment-expiry and automatic next-merchant reassignment loop.

12. Decline/acceptance windows (15-minute optional acceptance): Not implemented
  - No dedicated acceptance SLA + fallback reassignment workflow found for withdrawal assignments.

13. Withdrawal-specific status set and history trail: Partial
  - Multiple statuses exist across tables, but requested canonical withdrawal lifecycle and history table set are not fully present in the requested structure.

14. Notifications matrix (user/merchant/admin by stage): Partial
  - Foundation exists, but stage-specific withdrawal notification matrix with reminder cadence and reassignment notices is not fully wired.

15. Fraud prevention and audit trail: Partial
  - Strong risk/compliance/audit foundations exist (`p2p_risk_signals`, `p2p_fraud_scores`, `p2p_escrow_events`, compliance ledger domains), but not all withdrawal-specific anti-dispute controls are connected to a live merchant-withdrawal pipeline.

16. Requested table set (`withdrawal_status_history`, `merchant_assignments`, etc.): Partial
  - Equivalent/related domains exist under current P2P naming, but the exact requested withdrawal table topology is not fully implemented as an integrated withdrawal processing subsystem.

### Critical implementation mismatches discovered during verification

- Domain mismatch: current P2P flow is mostly purchase-intent driven, while requested feature is payout/withdrawal driven.
- Workflow mismatch: user-side action is currently payer-oriented ("I have paid"), while requested flow requires recipient confirmation ("I have received payment").
- Admin workflow gap: withdrawal approval page is currently generic module scaffolding, not live assignment operations.
- Automation gap: no verified 12-hour timeout watcher that cancels assignment and reassigns automatically until success.

### New phase implementation plan for the requested withdrawal feature

#### W0 - Stabilization and contract alignment

Scope:
- Freeze and align canonical withdrawal lifecycle states for merchant payout flow.
- Define one source of truth linking `withdrawal_requests` to merchant assignments and payout events.

Deliverables:
- Canonical state dictionary for withdrawal payout lifecycle.
- Transition matrix for admin, merchant, user, and system actors.
- Idempotency and concurrency strategy for all mutable actions.

Exit criteria:
- Every transition needed by UI and automation is explicitly represented and validated.

#### W1 - Withdrawal data model completion

Scope:
- Implement requested withdrawal-specific tables (or strict equivalents with mapping) and relational constraints.

Deliverables:
- `withdrawal_status_history`
- `merchant_assignments`
- `merchant_wallet_transactions` (withdrawal-settlement specific)
- `merchant_notifications`
- `withdrawal_notifications`
- `withdrawal_audit_logs`
- `merchant_performance`
- `merchant_timeout_events`
- `withdrawal_reassignments`
- `withdrawal_disputes`

Exit criteria:
- A single withdrawal request can be replayed and audited from submission to completion/rejection with full chain history.

#### W2 - User withdrawal submission and eligibility hardening

Scope:
- Add explicit withdrawal method: P2P merchant payout.
- Enforce KYC/account verification/active-withdrawal restrictions for this method.

Deliverables:
- Withdrawal request payload contract for bank/account/contact details.
- User status page copy aligned to "Pending Admin Approval" and SLA.

Exit criteria:
- Users can submit P2P withdrawals with deterministic validation outcomes.

#### W3 - Live admin withdrawal operations dashboard

Scope:
- Replace generic `/admin/withdrawal-approval` scaffold with live queue and action controls.

Deliverables:
- Queue columns required in spec (risk, bank, assigned merchant, etc.).
- Approve/reject/fraud review actions.
- Mandatory merchant selection or explicit auto-assignment toggle.

Exit criteria:
- Admin can process any pending withdrawal without direct DB interaction.

#### W4 - Merchant assignment and acceptance engine

Scope:
- Wire assignment to withdrawal approvals.
- Add acceptance/decline window behavior and automatic fallback.

Deliverables:
- Assignment scoring with online/liquidity/load/completion/trust filters.
- Optional acceptance flow (15-minute window) and decline reasons.
- Automatic next-eligible merchant reassignment.

Exit criteria:
- Approved withdrawals always produce either assigned merchant or explicit no-liquidity reason.

#### W5 - Merchant execution and user receipt confirmation

Scope:
- Implement merchant payout execution lifecycle and recipient confirmation path.

Deliverables:
- Merchant actions: payment sent, decline assignment, contact actions.
- User action: "I Have Received Payment" with anti-duplicate confirmation controls.
- Settlement rule: merchant wallet credit only after user confirmation.

Exit criteria:
- Happy path completes with atomic ledger and audit entries.

#### W6 - SLA timers, timeout, reminders, and automatic failover

Scope:
- Implement deterministic timer-driven orchestration.

Deliverables:
- 12-hour assignment timeout watcher.
- Reminder notifications at 6h, 3h, 1h.
- Auto-cancel assignment and reassign with retry-limit policy.

Exit criteria:
- Timeout and reassignment execute automatically without admin intervention.

#### W7 - Fraud prevention, disputes, and forensic audit

Scope:
- Complete withdrawal-specific anti-fraud and dispute pathways.

Deliverables:
- Duplicate withdrawal/payment-confirmation prevention guards.
- Dispute open/review/resolve queue integrated with withdrawal timeline.
- Forensic audit fields (actor, IP/device metadata, reference chains).

Exit criteria:
- Every contested payout has reproducible evidence and decision trail.

#### W8 - Admin no-code controls, monitoring, and rollout

Scope:
- Expose all critical knobs in admin settings and provide live monitoring widgets.

Deliverables:
- Configurable values for SLA windows, acceptance mode, max reassignments, thresholds, limits, and notification cadence.
- Admin monitoring metrics: pending, timeouts, reassignments, completion times, merchant rankings, dispute rates.

Exit criteria:
- Feature can be tuned and rolled out safely without code edits.

### Recommended implementation order (next 3 sprints)

Sprint A:
- W0 + W1 + W3 (state contract, schema completion, live admin queue replacement)

Sprint B:
- W4 + W5 (assignment/acceptance + merchant payout execution + user receipt confirmation)

Sprint C:
- W6 + W7 + W8 (timeout automation, disputes/fraud hardening, settings/monitoring rollout)

### Validation note for this review

- Verified by code inspection across migrations, API services, router/admin/user pages, and runners in the current repository.
- Existing content above remains unchanged; this section is additive and reflects withdrawal-specific end-to-end readiness as of 2026-08-03.

---

## 2026-08-04 Current checkpoint: work done and still pending

This checkpoint summarizes the latest withdrawal-processing work completed in the repository and the remaining follow-up items before the rollout is considered production-ready.

### Work completed in this pass

- Implemented withdrawal monitoring summary logic for queue health, overdue assignments, reminder urgency, escalation urgency, and manual-assignment demand.
- Wired the admin withdrawal operations view to display SLA, risk, assignment context, and timeout-processing controls.
- Added merchant-side assignment actions for accept, decline, and payout-sent transitions, plus user-side receipt confirmation flow.
- Added a user-facing non-receipt escalation action so disputed payouts can be routed into review directly from the wallet/receipt experience.
- Added a server-side automation runner entry point and regression coverage for runtime settings and monitoring behavior.

### Still to do

- Attach the automation runner to a production scheduler with alerting and retry handling.
- Configure live notification and messaging provider credentials so reminder and escalation messages can be delivered outside local validation.
- Expand end-to-end validation across admin, merchant, user, and compliance flows before treating the withdrawal rollout as fully production-ready.

---

## 2026-08-04 Sprint C Execution Update (Added)

This section is additive and does not replace earlier content. It records Sprint C execution progress for the withdrawal rollout plan:

Sprint C target:
- W6 timeout automation, reminder cadence, and reassignment failover
- W7 duplicate-prevention guards, dispute escalation, and evidence tracking
- W8 admin no-code controls and live monitoring widgets

Implemented in the current codebase:
- Admin withdrawal operations page now serves as the live queue view with risk, destination, SLA, and assignment context.
- Automated timeout processing is exposed through the admin dashboard and wired to reassignment flow.
- Runtime controls for assignment SLA, reminder cadence, maximum reassignments, and dispute escalation are persisted through platform settings.
- Admin toggles now support auto-assignment fallback, duplicate-prevention guards, and reminder notifications without code edits.
- Monitoring summary cards highlight queue size, high-risk items, overdue assignments, and manual-assignment demand.

Supporting implementation notes:
- Routing now points the withdrawal admin entry to the live operations page.
- New regression coverage validates the runtime settings load/save flow.
- Related migration assets are tracked under the withdrawal-processing sprint sequence for the broader rollout.

---

## 2026-08-04 Sprint A Execution Update (Added)

This section is additive and does not replace earlier content. It records Sprint A execution progress for the new withdrawal plan:

Sprint A target:
- W0 state contract alignment
- W1 withdrawal schema completion
- W3 live admin withdrawal operations dashboard

### W0 - State contract alignment

Status: Partially implemented (core contract, transition tables, and RPC scaffolding are present; the wider operational rollout still depends on runtime wiring and monitoring).

Completed:
- Added canonical, data-driven withdrawal state dictionary table:
  - `platform/supabase/migrations/045_withdrawal_processing_sprint_a_w0_w1.sql`
  - `withdrawal_state_dictionary`
- Added explicit transition matrix table:
  - `withdrawal_state_transitions`
  - actor/action keyed transitions for admin, merchant, user, and system.
- Added withdrawal request workflow-state source-of-truth fields:
  - `workflow_state_key`, `state_version`, `last_state_transition_at`, assignment mode fields, risk fields.
- Added idempotent and concurrency-safe transition RPC:
  - `transition_withdrawal_state(...)`
  - Includes:
    - state-version conflict checks,
    - idempotency key handling,
    - transition authorization against matrix,
    - status-history write,
    - audit-log write.

Remaining:
- W0 is complete for Sprint A scope. No unresolved W0 items are blocking Sprint B.

### W1 - Withdrawal schema completion

Status: Partially implemented (the withdrawal domain tables, indexes, RPCs, and RLS surfaces are present; historical backfills and broader operational automation remain deferred).

Completed:
- Added the withdrawal-specific schema set requested in the plan (exact names):
  - `withdrawal_status_history`
  - `merchant_assignments`
  - `merchant_wallet_transactions` (withdrawal-settlement specific)
  - `merchant_notifications`
  - `withdrawal_notifications`
  - `withdrawal_audit_logs`
  - `merchant_performance`
  - `merchant_timeout_events`
  - `withdrawal_reassignments`
  - `withdrawal_disputes`
- Added queue/query and orchestration RPCs for admin operations:
  - `list_withdrawal_operations_queue(...)`
  - `assign_withdrawal_merchant(...)`
  - `admin_resolve_withdrawal_action(...)`
- Added indexes and RLS policies for new withdrawal domain tables.

Remaining:
- W1 schema layer is complete for Sprint A scope.
- Data backfills for historical merchant-assignment records are intentionally deferred because they require business-approved replay rules (to avoid inaccurate historical assignment reconstruction).

### W3 - Live admin withdrawal operations dashboard

Status: Partially implemented (the live queue and admin controls are present; the full production workflow still depends on scheduled automation and broader merchant/customer handoff coverage).

Completed:
- Replaced scaffolded `/admin/withdrawal-approval` page wiring with live withdrawal operations dashboard:
  - `platform/src/features/admin/pages/WithdrawalApprovalPage.tsx`
  - `platform/src/features/admin/pages/PlatformSettingsPage.tsx` now renders live dashboard instead of static enterprise scaffold.
- Added new API integration service:
  - `platform/src/services/api/withdrawalOperations.ts`
  - Connects state dictionary, live queue, merchant list, and admin action RPC.
- Delivered queue columns required by plan in live view:
  - risk level + score,
  - destination/bank fields,
  - assigned merchant,
  - assignment SLA,
  - workflow state and version.
- Delivered action controls:
  - approve,
  - reject,
  - fraud review,
  - mandatory merchant selection unless explicit auto-assignment toggle is enabled.

Remaining:
- Auto-assignment worker and retry timer loops are intentionally deferred to Sprint C (W6), as planned.
- Merchant acceptance/decline execution loop remains Sprint B scope (W4/W5).

### Sprint A completion summary

- The core schema and admin-surface scaffolding for Sprint A is now present in code.
- End-to-end coverage is still incomplete for the full merchant/customer/admin workflow, so this should be treated as partial implementation rather than a completed production rollout.
- Next planned execution target remains Sprint B:
  - W4 merchant assignment and acceptance engine,
  - W5 merchant payout execution + user receipt confirmation settlement handshake.

---

## 2026-08-04 Sprint B Execution Update (Added)

This section is additive and records Sprint B execution for point 2:

Sprint B target:
- W4 merchant assignment and acceptance engine
- W5 merchant payout execution and user receipt confirmation settlement handshake

### W4 - Merchant assignment and acceptance engine

Status: Partially implemented (the assignment engine, timeout processor, and merchant action APIs are in place; hands-off production automation and deeper operational monitoring remain incomplete).

Completed:
- Added Sprint B migration:
  - `platform/supabase/migrations/046_withdrawal_processing_sprint_b_w4_w5.sql`
- Added runtime-configurable assignment windows and retry controls in settings:
  - `withdrawal_assignment_acceptance_minutes`
  - `withdrawal_assignment_timeout_hours`
  - `withdrawal_max_reassignments`
- Added automatic next-eligible merchant assignment function:
  - `auto_assign_next_withdrawal_merchant(...)`
  - filters by merchant status + available liquidity + currency match + completion/rating/risk ordering.
- Added merchant acceptance/decline action function:
  - `merchant_respond_withdrawal_assignment(...)`
  - accept path transitions to `merchant_acknowledged`.
  - decline path transitions to `reassigning` and auto-runs reassignment fallback.
- Added deterministic timeout processor function:
  - `process_withdrawal_assignment_timeouts(...)`
  - expires overdue assignments and triggers fallback reassignment or no-liquidity terminal state.
- Added merchant assignment query surface:
  - `list_merchant_withdrawal_assignments(...)`
- Secured `list_withdrawal_operations_queue(...)` visibility so non-admin callers only see records they are allowed to see.
- Added admin UI trigger for timeout reassignment processing:
  - `platform/src/features/admin/pages/WithdrawalApprovalPage.tsx`

Remaining:
- Attach timeout processor to scheduled runner/cron invocation for hands-off production automation cadence.

### W5 - Merchant payout execution and user receipt confirmation

Status: Partially implemented (the payout-sent and receipt-confirmation state transitions are wired; the broader end-to-end confirmation, reconciliation, and automation paths still need hardening).

Completed:
- Added merchant payout-sent action function:
  - `merchant_mark_withdrawal_payout_sent(...)`
  - transitions `merchant_acknowledged -> payout_sent -> user_receipt_pending`
  - writes pending merchant settlement transaction.
- Added user receipt confirmation function:
  - `user_confirm_withdrawal_receipt(...)`
  - transitions `user_receipt_pending -> completed`
  - finalizes merchant settlement and updates assignment completion.
- Added user receipt queue function:
  - `list_user_withdrawal_receipt_queue(...)`
- Added API integration layer for Sprint B actions:
  - `platform/src/services/api/withdrawalOperations.ts`
  - merchant actions + user receipt confirmation + timeout processor endpoints.
- Added merchant withdrawal action UI:
  - `platform/src/features/dashboard/pages/MerchantDashboardPage.tsx`
  - accept, decline, and mark payout sent controls with assignment context.
- Added user "I have received payment" confirmation UI:
  - `platform/src/features/rewards/pages/RewardHistoryPage.tsx`
  - receipt-confirm queue with confirmation note support.

Settlement rule confirmation:
- Merchant settlement credit to available balance is finalized only after user receipt confirmation path executes.

Anti-duplicate confirmation controls:
- Receipt confirmation is state-gated (`user_receipt_pending` only) and idempotency-keyed in transition flow.

Remaining:
- Add explicit user-side "report non-receipt" action control in wallet UI to directly trigger review/dispute from receipt queue row.

### Sprint B completion summary

- The core service and UI scaffolding for Sprint B is now present in code, including assignment actions, payout-sent transitions, and user receipt confirmation hooks.
- These pieces are not yet complete end to end across every user, merchant, and automation path, so they should be treated as partial implementation rather than a finished rollout.
- Next planned sprint remains Sprint C (W6 + W7 + W8):
  - notification reminder cadence automation,
  - full withdrawal dispute/fraud forensic operations,
  - expanded no-code controls and monitoring rollouts.

