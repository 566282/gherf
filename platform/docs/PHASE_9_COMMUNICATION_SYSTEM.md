# Phase 9: Communication System

## Scope Delivered

This phase adds a configurable communication layer for:

- Internal messaging
- Email notifications
- Push notifications
- SMS notifications (optional)
- Live announcements
- Promotional notifications
- Editable templates for all communication surfaces

## Frontend Surfaces

### Admin page

- Route: `/admin/communications`
- File: `src/features/admin/pages/CommunicationSystemPage.tsx`
- Capabilities:
  - Enable/disable email, push, SMS, promotional, and live announcement channels
  - Configure timezone and quiet hours
  - Edit template content and channel coverage
  - Target all users or selected users
  - Send internal messages
  - Publish live announcements
  - Send promotional notifications

### Navigation

- Admin sidebar entry added:
  - `Communications` -> `/admin/communications`

## API Layer

### Communication settings and sending APIs

- File: `src/services/api/communications.ts`
- Stores communication configuration in `platform_settings` under key `communication_config`
- Provides:
  - `listCommunicationConfig`
  - `updateCommunicationConfig`
  - `sendInternalMessage`
  - `publishLiveAnnouncement`
  - `sendPromotionalNotification`

## Database Changes

Migration: `supabase/migrations/006_communication_system.sql`

### Updated table

- `user_notifications`
  - Added `channel`
  - Added `category`
  - Added `template_key`
  - Added `is_promotional`
  - Added `metadata`

### New tables

- `communication_templates`
- `communication_campaigns`

### Security and policies

- Added super admin insert policy for `user_notifications`
- Enabled RLS on communication tables
- Added authenticated read + super admin manage policies

### Seed data

- Template seeds for:
  - internal messages
  - email verification
  - password reset
  - reward updates
  - live announcements
  - promotional blast
- Seeded default `communication_config` in `platform_settings`

## Notification Typing

`src/types/auth.ts` extends notification objects with optional:

- `channel`
- `category`
- `templateKey`
- `isPromotional`
- `metadata`

`src/services/api/auth.ts` now fetches these fields from `user_notifications`.

## Operational Notes

- SMS is optional and disabled by default in global settings.
- Channel/provider dispatch (SMTP, APNs/FCM, SMS gateway) is configuration-ready, but external provider delivery wiring is intentionally left for infra credentials and provider onboarding.

## Phase 9.1: Notification Center Consolidation (Aug 2026)

### Implemented in this phase

- Notification Center now includes direct compose and send controls for:
  - Internal messages
  - Live announcements
  - Promotional notifications
- Admins can target all users or selected users from the same page.
- Promotional sends support per-send channel selection across:
  - in-app
  - email
  - push
  - SMS
  - WhatsApp
  - Telegram
- Existing queue operations remain in the same surface:
  - Process due notifications
  - Retry failed items
  - Cancel selected queue items

### Current backend behavior

- Send actions are backend-linked through Supabase APIs and insert notification records for recipients.
- Queue operations are backend-linked to RPC worker and retry functions.

### Remaining phases

- Phase 9.2: Completed. Template editing and template listing now share `communication_templates` as the primary backend source.
- Phase 9.3: Started. First provider adapter added for email dispatch through Supabase Edge Function `notification-email-dispatch`.
- Phase 9.4: Delivery receipt ingestion and per-channel delivery status dashboard.
- Phase 9.5: Per-channel retry policies, exponential backoff tuning, and dead-letter queue workflows.

## Phase 9.2: Template Source Unification (Completed)

### What changed

- `listCommunicationConfig` now hydrates templates from `communication_templates` and merges into config shape for UI compatibility.
- `updateCommunicationConfig` now persists global toggles to `platform_settings` and upserts template edits into `communication_templates`.
- Template studio edits and live template list now use the same backend template records.

### Files

- `src/services/api/communications.ts`

## Phase 9.3: Email Provider Adapter (Initial)

### What changed

- Added Supabase Edge Function `notification-email-dispatch` for secure server-side provider calls.
- Added best-effort adapter invocation from communication send pipeline when rows include `channel = email`.
- Adapter currently targets Resend API using function environment secrets.

### Required function secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

### Files

- `supabase/functions/notification-email-dispatch/index.ts`
- `src/services/api/communications.ts`

### Still left in Phase 9.3

- Add provider adapters for push, SMS, WhatsApp, and Telegram.
- Add delivery event ingestion back to DB for sent/delivered/bounced analytics.
