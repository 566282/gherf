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
