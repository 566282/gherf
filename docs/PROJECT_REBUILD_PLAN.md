# Business Marketing Platform: Gap Analysis and Development Plan

## 1) Executive Assessment

The current repository is a **Flutter PWA prototype** for investment workflows, while the requested product is a **React + TypeScript + Vite + TailwindCSS + Supabase** production system for configurable business marketing campaigns with user rewards.

Conclusion:
- The current codebase does not satisfy the required technical stack.
- A **greenfield rebuild** within this repository is the safest and fastest path.
- Existing code can be used as a **domain reference only** (roles, approvals, dashboard concepts), not as implementation assets.

## 2) Current State vs Required Specification

### 2.1 Stack Compliance

Not compliant:
- Frontend framework: Flutter/Dart (required React + TypeScript)
- Build tool: Flutter tooling (required Vite)
- Styling system: Flutter widgets/themes (required TailwindCSS)
- Backend/Auth/Storage/DB: local SharedPreferences mock data (required Supabase Auth/PostgreSQL/Storage)
- Deployment target: not configured for Netlify

### 2.2 Production Readiness Gaps

Critical gaps:
- No real backend persistence (client-only local storage)
- No environment secret management strategy
- No RLS policies
- No API and schema documentation
- No meaningful test coverage
- Hard-coded credentials and seed data patterns
- Limited modular boundaries for target architecture

### 2.3 Domain Elements Worth Reusing Conceptually

Concepts to carry into the new system:
- Admin/user role separation
- User approval/restriction lifecycle
- Admin operations for approvals and status transitions
- Transaction/investment-style audit ideas (adapted to campaign/reward ledger)

## 3) Target System Blueprint

## 3.1 High-Level Architecture

- Frontend: React + TypeScript + Vite
- UI: TailwindCSS, mobile-first, component-driven
- Backend services: Supabase (Auth, Postgres, Storage, Edge Functions as needed)
- Deployment: Netlify (frontend)
- Configuration model: database-driven admin controls (campaign rules, scheduling, rewards)

## 3.2 Recommended Project Structure (Target)

```text
src/
  app/
    router/
    providers/
    layouts/
  features/
    auth/
    campaigns/
    tasks/
    rewards/
    admin/
    businesses/
    users/
  components/
    ui/
    forms/
    charts/
  services/
    supabase/
    api/
    storage/
  hooks/
  lib/
    validation/
    constants/
    utils/
  types/
  styles/
supabase/
  migrations/
  seed/
  policies/
  functions/
docs/
  api/
  database/
  architecture/
```

## 3.3 Data Model Principles

Core entities (initial):
- profiles (extends auth users)
- businesses
- campaigns
- campaign_rules (dynamic config)
- campaign_tasks
- task_submissions
- rewards
- reward_ledger
- admin_actions_audit
- platform_settings

Design constraints:
- All campaign behavior configurable via DB tables (no hard-coded business logic)
- Soft-delete and status fields for enable/disable workflows
- Full auditing for admin actions and payout-impacting events

## 4) Phase-by-Phase Development Plan

Rule: Do not proceed to the next phase until the current phase passes all exit criteria.

## Phase 0: Foundation and Tooling

Scope:
- Initialize React + TypeScript + Vite app
- Add TailwindCSS with design tokens
- Configure ESLint, Prettier, type checking, path aliases
- Configure Supabase client SDK
- Define environment variable contract (`.env.example`)
- Configure CI checks (lint, typecheck, tests)
- Configure Netlify build settings

Deliverables:
- Working app shell with route scaffolding
- CI pipeline passing
- Base docs for setup and architecture

Exit criteria:
- `npm run lint`, `npm run typecheck`, `npm run test` pass
- Netlify preview deploy succeeds
- No secrets committed; env var docs complete

## Phase 1: Auth, Identity, and Access Control

Scope:
- Supabase Auth (email/password; optional social later)
- Profile bootstrap trigger/workflow
- Role model: `admin`, `business_owner`, `user`
- Guarded routes and session management
- Row-Level Security baseline for profile and role-scoped reads/writes

Deliverables:
- Sign up/login/logout/forgot password flows
- Role-aware navigation
- Initial RLS policies + migration scripts

Exit criteria:
- Unauthorized reads/writes blocked by RLS
- Auth flows tested (unit + integration where relevant)
- Security review checklist complete for auth surfaces

## Phase 2: Core Campaign Domain (Configurable)

Scope:
- Campaign CRUD for businesses
- Campaign statuses: draft, scheduled, active, paused, completed, archived
- DB-driven campaign rule engine (budget caps, task limits, eligibility)
- Campaign media stored in Supabase Storage
- Admin override controls for campaign moderation

Deliverables:
- Business campaign management UI
- Admin campaign moderation UI
- Rule-driven campaign execution fields

Exit criteria:
- No hard-coded campaign logic in frontend
- All key campaign controls editable through admin/business UI
- Storage security policies validated

## Phase 3: Task Completion and Reward Mechanics

Scope:
- Task templates and campaign-bound task generation
- User task completion submission flow
- Validation pipeline (auto + manual review options)
- Reward issuance pipeline to ledger
- Idempotency protections for reward events

Deliverables:
- End-user task center
- Admin/business review queue
- Reward ledger views and event audit trail

Exit criteria:
- Duplicate submissions/rewards prevented
- Reward math rules sourced from DB configuration
- Integration tests for submission-to-reward lifecycle

## Phase 4: Admin Control Plane (Full Configurability)

Scope:
- Platform settings module (feature flags, thresholds, limits)
- Campaign automation controls (auto-activate, auto-pause, schedule windows)
- User/business compliance controls (suspend/restore)
- Operational dashboards with filtering and exports

Deliverables:
- Central admin dashboard with modular settings panels
- Audit trail explorer for admin actions
- Config versioning/change history

Exit criteria:
- Admin can enable/disable major platform behavior without code changes
- Every settings change is traceable and reversible where applicable
- Role/permission boundaries verified via RLS + UI controls

## Phase 5: Hardening, Observability, and Release

Scope:
- End-to-end tests for critical user journeys
- Performance optimization and mobile responsiveness audit
- Error monitoring and logging integration
- Rate limiting and abuse controls (where applicable)
- Final deployment and rollback strategy docs

Deliverables:
- Production release candidate
- Runbooks (incident, rollback, migration)
- Final technical docs (API, schema, policies)

Exit criteria:
- Core journeys pass E2E in CI
- Lighthouse/perf and responsive checks meet agreed thresholds
- Security/RLS regression tests pass

## Phase 15: Deployment and Operations

Scope:
- Netlify production and preview deployments for the frontend
- Supabase production database and authentication environment
- GitHub Actions CI for lint, typecheck, test, and build validation
- Environment variable management for local, preview, and production contexts
- Production monitoring, error logging, analytics, and backup operations

Deliverables:
- CI pipeline that validates every pull request
- Production deployment workflow with explicit release gating
- Deployment runbook for rollback, monitoring, and backup restore steps

Exit criteria:
- Main branch builds deploy successfully through the release pipeline
- Production environment variables are documented and configured
- Monitoring, logging, analytics, and backup ownership are defined

## 5) Testing Strategy by Layer

- Unit tests: pure utilities, validators, rule evaluators
- Integration tests: Supabase interaction boundaries, auth guards, RLS-sensitive queries
- E2E tests: signup/login, campaign creation, task completion, reward issuance, admin moderation
- Policy tests: positive and negative RLS access scenarios for each role

## 6) Documentation Standards (Per Phase)

Required updates each phase:
- `docs/architecture/*` for system design changes
- `docs/database/*` for schema and RLS evolution
- `docs/api/*` for service contracts
- Changelog entry with phase completion tag

## 7) Git and Versioning Workflow

- Branch naming: `feat/phase-x-*`, `fix/*`, `chore/*`
- Commit format: `phase-x: concise change summary`
- Tag each completed phase: `v0.x.0-phase-x-complete`
- PR checklist must include:
  - Tests added/updated
  - Docs updated
  - RLS reviewed
  - No hard-coded config values introduced

## 8) Immediate Next Actions (Implementation Order)

1. Create a new React + TypeScript + Vite app inside this repo (or replace Flutter app) with Tailwind and quality tooling.
2. Add Supabase project config, typed client wrappers, and `.env.example`.
3. Implement Phase 0 CI pipeline and Netlify config.
4. Draft initial SQL migrations for users/profiles/roles with baseline RLS.
5. Build authentication UI and role-gated route shell.

## 9) Migration Note for Existing Flutter Code

Treat current Flutter code as reference only for business flows. Do not migrate Dart code directly. Port only validated domain requirements into typed React services and SQL schema.
