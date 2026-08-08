# Phase 19: Classroom Learn-to-Earn (Task Engine Vertical)

Date: 2026-08-07

## Purpose

Define a production implementation plan for a Classroom module that is built as a new campaign vertical inside the existing task engine, not as a separate LMS product.

This design reuses the platform foundations already implemented in code:

- universal campaign/task engine
- wallet and reward ledgers
- membership and entitlement controls
- referral and fraud systems
- communication and analytics infrastructure
- enterprise admin control plane patterns

## Architecture Decision

Adopt Classroom as a campaign type and task family, with learning-specific metadata and verification rules.

Target architecture:

```text
Platform
|
+-- Tasks
|   +-- Watch Videos
|   +-- Click Ads
|   +-- Social Tasks
|   +-- Surveys
|   +-- Offers
|   +-- Classroom Learning  (new campaign vertical)
|
+-- Wallet
+-- Rewards
+-- Membership
+-- Referral
+-- Marketplace
+-- Classroom UX surfaces
```

### Why this is the right fit for current code

- Campaign and task contracts are data-driven, and task type values are already extensible.
- Submission payloads are JSON-capable and support flexible verification evidence.
- Reward issuance and withdrawal control already exist and can be reused.
- Fraud and compliance controls are already integrated in both SQL and service layers.
- Admin already operates configurable engines via `platform_settings` and feature-specific pages.

## End-to-End Confirmation From Current Repository State

### Confirmed implemented foundations to reuse

1. Universal task engine and extensible campaign/task model
- `campaign_tasks.task_type` is text and metadata is JSONB (`009_universal_task_engine.sql`).
- Task definitions support requirements, cooldowns, verification methods, fraud checks, and task config payloads.
- Admin task editor supports dynamic task families and free-form type strings (`src/features/admin/pages/TaskEnginePage.tsx`).

2. Campaign event ingestion and deterministic completion mapping
- `campaign_events`, `campaign_event_task_mappings`, and `campaign_event_completions` exist (`030_event_tracking_campaign_engine.sql`).
- This is the correct backbone for learning heartbeats and provider callback events.

3. Reward + wallet + withdrawal foundations
- Reward issuance from submission lifecycle is already in place (`src/services/api/tasks.ts`).
- Wallet and withdrawal systems are mature and production-focused (multiple migration phases through W6-W8 in project state).

4. Fraud/security foundations
- Fraud policy enforcement, risk scoring, and review workflows already exist.
- Security hardening (RLS, rate limiting, audit/session/IP/device monitoring) already exists in dedicated security migrations and docs.

5. Membership, communications, analytics foundations
- Membership engine and admin controls are already present.
- Communication system and analytics/reporting phases are implemented and documented.

### Confirmed current gaps for Classroom

1. No learning domain schema (courses, modules, lessons, enrollments, quiz attempts, certificates) yet.
2. No classroom learner UX (catalog, continue learning, skill tree, career roadmap) yet.
3. No provider management UI for enabling/disabling learning institutions yet.
4. No learning-specific anti-cheat event contract (focus, heartbeat, speed-limit, checkpoints) yet.
5. No dedicated learning reward state model (earning milestones + learning wallet transfer controls) yet.
6. No certificate issuance and verification page model yet.
7. No AI tutor request/response and usage governance model yet.

## Product Positioning

Classroom should launch as a Learn-to-Earn ecosystem:

- Users learn through structured content.
- Learning activity is verified with anti-cheat controls.
- Task engine issues milestone rewards.
- Wallet receives verified earnings based on configured policy.
- Membership unlocks premium paths and higher reward multipliers.

## User Experience Surfaces

## 1) Classroom home (Netflix-style discovery)

Primary sections:

- Search
- Continue Learning
- Recommended
- Professional Certificates
- Universities
- Technology
- Business
- Finance
- Marketing
- Artificial Intelligence
- Programming
- Cybersecurity
- Healthcare
- Languages
- Free Courses
- Paid Courses
- Certificates
- Reward Boost Courses
- New Courses
- Trending
- Recently Added
- Saved
- My Certificates
- Learning Wallet
- Learning Statistics
- Leaderboard

Behavior requirements:

- Personalize ordering by enrollment, completion, and career goal profile.
- Show progress rings and reward milestones on cards.
- Preserve performance using incremental fetch + virtualization for long rows.

## 2) Provider chooser (first-run and settings)

Allow users to select preferred learning providers:

- Coursera, Udemy, edX, Harvard, Google, IBM, Meta, Cisco, Microsoft, AWS, Oracle, HubSpot, Alison, FutureLearn, Khan Academy, Local Universities, Platform Original Courses.

Admin can:

- enable/disable providers globally,
- region-gate providers,
- set reward eligibility mode per provider.

## 3) Learning mode taxonomy

Type A: Platform-original courses
- full telemetry, full verification, full reward automation.

Type B: Embedded providers (YouTube, Vimeo, self-hosted, HLS)
- telemetry tracked through embedded player/session instrumentation.

Type C: Partner institutions
- reward eligibility requires verifiable completion signals (API, signed proof, or approved certificate evidence).
- deep-link only access is non-rewardable unless completion can be verified.

## Classroom as Campaign Engine Model

Each course is a learning campaign with one or more learning tasks.

Example campaign contract:

- Campaign type: `classroom_learning`
- Task family examples:
  - `learning_watch_lesson`
  - `learning_pass_quiz`
  - `learning_submit_assignment`
  - `learning_complete_module`
  - `learning_final_assessment`
  - `learning_certificate_claim`

Reward triggers can include:

- first lesson complete
- module completion
- quiz pass thresholds
- streak goals
- course completion
- certificate issuance

## Learning Metrics Contract

Track measurable progress instead of binary completion only:

- minutes_watched
- active_focus_seconds
- completion_percent
- playback_speed_events
- quiz_score
- assignments_completed
- discussion_participation_count
- notes_count
- downloads_count
- active_study_days
- average_session_minutes
- replay_count
- streak_days
- daily_goal_progress
- monthly_goal_progress
- certificate_earned

Store metrics in event-friendly structures and aggregate views for analytics.

## Anti-Cheat and Integrity Model

Never reward on video start alone.

Minimum anti-cheat checks per rewardable lesson task:

- periodic session heartbeat
- page visibility and tab focus checks
- active-viewing thresholds
- playback speed policy enforcement
- interaction checkpoints (where appropriate)
- random confirmation prompts (sparingly and accessibility-safe)
- device fingerprint and IP risk context
- behavior anomaly scoring
- completion checkpoint validation

Policy outcomes:

- clear -> auto-approve milestone
- review -> hold for manual moderation
- blocked -> no payout and fraud flag event

## Reward Engine Model for Learning

Support granular milestone payouts, for example:

- First lesson: 10 coins
- Module complete: 50 coins
- Quiz pass: 30 coins
- 7-day streak: 150 coins
- Certificate earned: 500 coins
- Daily goal: 20 coins
- Perfect quiz: 75 coins

Reward controls:

- per-course reward budget
- per-user daily/weekly caps
- membership multipliers
- anti-fraud hold states
- manual override queue for flagged rewards

## Membership Integration

Premium tier extensions:

- higher learning reward multipliers
- premium-only learning campaigns
- premium certificates and verification badge
- priority support and mentorship sessions
- richer analytics and AI tutor quotas

Implementation approach:

- membership checks are read at reward decision time
- multiplier policy stored in settings and campaign metadata

## AI Tutor Capability

Attach an AI tutor to each lesson/course context:

- explain concept
- summarize lesson
- generate flashcards
- create practice quizzes
- translation support
- interview prep and career guidance
- coding help and assignment feedback

Governance requirements:

- role and plan-based usage limits
- prompt safety controls and audit logs
- configurable model policy via admin settings

## Skill Tree and Career Roadmaps

### Skill tree

Represent prerequisite progression graphically by domain and level.

Example path:

- Programming
- Python Basics -> Functions -> OOP -> APIs -> Django -> Certificate

### Career roadmaps

Roadmap templates:

- Data Analyst
- Software Engineer
- AI Engineer
- Project Manager
- Digital Marketer
- UI Designer
- Accountant
- Cybersecurity Analyst
- Cloud Engineer

Engine behavior:

- map roadmap milestones to course campaigns,
- recommend next tasks based on completion and assessment outcomes,
- surface expected completion time and reward projection.

## Certificate System

On completion, issue a verifiable certificate with:

- certificate id
- verification id
- QR token link
- optional blockchain hash anchor
- downloadable PDF
- public verification page
- share actions (LinkedIn and profile links)

Trust rules:

- certificate issuance only after verifiable completion requirements.
- revocation/invalid state when fraud or policy violation is confirmed.

## Learning Wallet Model

Introduce an isolated learning rewards ledger domain:

- learning reward accrual
- XP and skill points
- bonus coins
- certificate-linked rewards
- hold/release states before transfer to withdrawable wallet balance

Transfer policy:

- transfer from learning wallet to main wallet only after anti-fraud and completion validation.
- configurable transfer thresholds and cooldown.

## Enterprise Admin Control Plane

Admin surfaces should include:

- institutions
- categories
- courses
- modules and lessons
- video/pdf assets
- quizzes and assignments
- reward plans and XP policies
- certificates and templates
- instructors
- learning campaigns and completion rules
- AI tutor settings
- anti-cheat policies and review queues
- analytics and payout controls

Use the same platform pattern: data-driven settings plus role-gated pages.

## Proposed Data Domains and Schema Track

Migration sequencing recommendation starts after current highest migration (`055_*`).

## Migration 056: Core classroom catalog and enrollment

- `learning_institutions`
  - id, name, slug, logo_url, institution_type, status, provider_config, created_at, updated_at
- `learning_categories`
  - id, name, slug, parent_id, sort_order, status
- `learning_courses`
  - id, institution_id, category_id, title, description, difficulty, language, duration_minutes, pricing_type, reward_plan, status, metadata
- `learning_course_modules`
  - id, course_id, title, sort_order, metadata
- `learning_lessons`
  - id, module_id, lesson_type, title, content_url, duration_seconds, verification_config, sort_order, metadata
- `learning_enrollments`
  - id, user_id, course_id, status, progress_percent, enrolled_at, completed_at, metadata

## Migration 057: Progress, sessions, and anti-cheat telemetry

- `learning_sessions`
  - id, user_id, course_id, lesson_id, started_at, ended_at, active_seconds, focus_seconds, visibility_loss_count, average_playback_speed, risk_score, risk_status, metadata
- `learning_events`
  - id, session_id, user_id, course_id, lesson_id, event_type, event_time, payload, source
- `learning_lesson_progress`
  - id, user_id, lesson_id, watch_seconds, completion_percent, checkpoints, verified_at, status
- `learning_streaks`
  - id, user_id, streak_days, longest_streak_days, last_active_date, metadata

## Migration 058: Assessment and certificate domains

- `learning_quizzes`
- `learning_quiz_attempts`
- `learning_assignments`
- `learning_assignment_submissions`
- `learning_certificates`
  - includes verification_id, qr_token, artifact_url, status, issued_at, revoked_at

## Migration 059: Learning rewards and wallet bridge

- `learning_reward_events`
  - id, user_id, enrollment_id, lesson_id, trigger_type, reward_amount, currency, status, hold_reason, metadata
- `learning_wallet_accounts`
  - id, user_id, balance, pending_balance, xp_balance, skill_points, updated_at
- `learning_wallet_transactions`
  - id, learning_wallet_account_id, transaction_type, amount, reason, reference_type, reference_id, metadata
- `learning_wallet_transfers`
  - id, user_id, learning_amount, wallet_transaction_id, transfer_status, risk_status, created_at

## Migration 060: Admin analytics and provider mapping

- `learning_provider_integrations`
  - id, institution_id, provider_name, integration_mode, credential_ref, status, policy_config
- `learning_course_provider_mappings`
  - id, course_id, provider_course_ref, verification_mode, status
- `learning_analytics_daily`
  - date, dimensions, measures (materialized summary table or view)
- `learning_leaderboard_snapshots`
  - period_key, user_id, score, rank, metadata

All tables require explicit RLS policies, admin manage policies, user own-record policies, and index strategy aligned with expected query paths.

## API and Service Contract

Implement via `src/services/api/*` plus Supabase RPC/Edge Functions.

Core contract groups:

1. Catalog and discovery
- `listLearningHomeFeed(input)`
- `listLearningProviders()`
- `listLearningCourses(filters)`
- `getLearningCourse(courseId)`

2. Enrollment and progression
- `enrollInCourse(courseId)`
- `startLearningSession(input)`
- `appendLearningEvent(input)`
- `completeLessonCheckpoint(input)`
- `getEnrollmentProgress(enrollmentId)`

3. Assessment and completion
- `submitQuizAttempt(input)`
- `submitAssignment(input)`
- `finalizeCourseCompletion(input)`

4. Rewards and wallet transfer
- `evaluateLearningReward(input)` (server-side anti-cheat + policy)
- `claimLearningReward(eventId)`
- `transferLearningBalance(input)`

5. Certificates
- `issueCertificate(input)`
- `getCertificate(certificateId)`
- `verifyCertificate(verificationId)`

6. AI tutor
- `askLearningTutor(input)`
- `listLearningTutorHistory(filters)`

7. Admin operations
- provider/catalog CRUD
- policy updates
- fraud review queue actions
- payout and certificate moderation actions

## Frontend Insertion Points

Recommended initial placement:

- New learner pages under `src/features/classroom/pages`.
- New admin pages under `src/features/admin/pages` for classroom operations.
- Route registration in `src/app/router/index.tsx`.
- Reuse design system components and dashboard telemetry patterns.

Initial user pages:

- ClassroomHomePage
- CourseDetailPage
- LearningSessionPage
- MyLearningPage
- MyCertificatesPage
- LearningWalletPage

Initial admin pages:

- ClassroomOpsPage
- ClassroomCatalogPage
- ClassroomProvidersPage
- ClassroomFraudReviewPage
- ClassroomAnalyticsPage

## Analytics and Reporting Requirements

Admin dashboards must include:

- active learners
- enrollment and completion rates
- average study duration
- learning reward issuance and hold rates
- fraud flags and manual review volumes
- provider/course popularity
- membership conversion after learning activity
- certificate issuance and verification traffic
- daily/weekly/monthly engagement and retention

Export requirements:

- CSV, Excel, and PDF support via existing reporting utility patterns.

## Security and Compliance Requirements

- Enforce RLS on every new table.
- Keep reward decisions server-side only.
- Log all reward evaluation decisions with evidence snapshot references.
- Store tamper-evident audit events for manual moderation actions.

## Implementation Progress Update (2026-08-08)

The classroom learn-to-earn vertical has been implemented as a gated platform feature with a dedicated service layer, learner/admin pages, route registration, and rollout-aware navigation.

### Completed in this pass

- Added classroom-specific campaign/task contract extensions for learning-oriented task families.
- Added a dedicated classroom service for catalog, enrollment, sessions, telemetry, lesson checkpoints, reward evaluation, wallet transfer, certificates, and analytics.
- Added learner-facing classroom pages for home, course details, learning sessions, my learning, certificates, and wallet transfer.
- Added admin classroom pages for rollout and operations, catalog, providers, fraud review, and analytics.
- Wired the feature into app navigation and route gating so it remains feature-flag controlled.
- Added Supabase migration scaffolding for classroom catalog, telemetry, assessments, rewards, wallet bridge, provider mappings, and admin analytics.

### Verification performed

- Verified the platform TypeScript typecheck completed successfully.
- Verified the production build completed successfully with Vite.

### Remaining follow-up

- Apply the new Supabase migrations to the target project database.
- Validate the classroom API wiring against the live Supabase environment and rollout settings.
- Expand the UI copy and data seeding for production-ready catalog content.
- Apply rate limits to high-frequency telemetry endpoints.
- Apply privacy controls for PII in session and event payloads.

## Rollout Plan

## Phase 19.0 - Contract and feature flags

- Lock API/event schemas and lifecycle states.
- Add feature flags for internal, beta, and production cohorts.

## Phase 19.1 - Core schema and RLS

- Deliver migrations 056-060 in staged order.
- Verify RLS and indexes before UI rollout.

## Phase 19.2 - Catalog and provider management

- Build learner catalog and provider chooser.
- Add admin provider enable/disable controls.

## Phase 19.3 - Course player and telemetry

- Build learning session UI and event heartbeat.
- Add focus/visibility/speed integrity checks.

## Phase 19.4 - Assessment engine

- Add quiz and assignment flows.
- Add score and threshold evaluation.

## Phase 19.5 - Reward milestone integration

- Map learning milestones to task/reward engine.
- Add hold/release states based on fraud outcomes.

## Phase 19.6 - Learning wallet bridge

- Introduce learning wallet ledgers and transfer rules.
- Link transfer approval gates to fraud/compliance policy.

## Phase 19.7 - Certificate issuance and verification

- Generate certificates and public verification page.
- Enable revocation workflows.

## Phase 19.8 - Skill tree and career roadmap

- Add progress visualization and role-based learning tracks.
- Add recommendation engine for next milestone.

## Phase 19.9 - AI tutor

- Add tutor interactions with plan-based limits and observability.

## Phase 19.10 - Admin operations and analytics

- Complete classroom admin control plane and exports.

## Phase 19.11 - QA, security, and performance hardening

- Execute test matrix, abuse tests, and mobile accessibility checks.

## Phase 19.12 - Staged release

- Internal staff rollout
- beta cohort rollout
- production rollout with KPI guardrails

## Testing Strategy

Unit tests:

- reward policy evaluators
- anti-cheat scoring
- progress aggregation
- certificate eligibility

Integration tests:

- enroll -> study -> quiz -> reward hold/release
- provider callback/event mapping
- learning wallet transfer gating

E2E tests:

- learner journey from discovery to certificate
- admin moderation and payout workflows
- fraud review and reinstatement flow

Non-functional verification:

- accessibility (keyboard/screen reader)
- performance (large catalogs, long session feeds)
- security (RLS, audit, replay/duplication protection)

## Definition of Done

- Classroom ships as a task engine campaign vertical, not a separate LMS system.
- Learning rewards are issued only from verified progress/assessment evidence.
- Anti-cheat controls are active and auditable.
- Learning wallet transfer controls prevent immediate abuse-driven withdrawals.
- Admin can configure providers, policies, rewards, and review queues without code changes.
- Analytics and exports provide operational visibility across engagement, payout, and fraud outcomes.
- Build/typecheck/tests pass for new classroom modules.

## Immediate Next Execution Steps

1. Add the `classroom_learning` campaign type and learning task templates to the task engine contracts.
2. Create migration 056 with core catalog/enrollment schema and RLS.
3. Build minimal learner surfaces (home, course detail, session) behind a feature flag.
4. Implement telemetry ingestion and anti-cheat baseline before enabling reward payout.
5. Wire first milestone reward rule (lesson completion + quiz threshold) and test end-to-end.