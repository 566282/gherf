# Notification Operations Next Steps

## Status Update (Phase 1 Complete)

- Completed: Notification Center now supports create/send actions for internal messages, live announcements, and promotional notifications from the same admin surface as queue and retry operations.
- Completed: Audience targeting (all users or selected users) is available directly in Notification Center.
- Completed: Existing queue management controls remain active in Notification Center (process due items, retry failed items, cancel queue items).
- Completed: Template source unification. Admin template editing and live template reads now use `communication_templates` as the backend source of truth.
- Completed (initial): Email provider adapter path. Email-channel sends now trigger `notification-email-dispatch` (best-effort) for outbound provider delivery.
- Remaining: Provider adapters still pending for SMS/push/WhatsApp/Telegram.

## Edge Function Deployment (Email Adapter)

- Deploy function: `notification-email-dispatch`
- Ensure function uses JWT verification and super-admin role checks.
- Configure secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- Smoke test by sending a promotional notification with `email` channel selected and verify provider accepts the request.
- Monitor function logs for failures and add alerts for repeated outbound errors.

## Supabase

- Apply `016_notification_delivery_infra.sql`, `017_withdrawal_scheduled_date.sql`, and `018_notification_queue_worker.sql` to the target project in that order.
- Verify the following exist in production after migration:
  - `notification_queue`
  - `notification_retry_history`
  - `withdrawal_requests.scheduled_for`
  - `notify_super_admins`
  - `process_notification_queue`
  - `retry_notification_queue_item`
- Confirm `FORCE ROW LEVEL SECURITY` is enabled on the queue and retry tables.

## RPC and Cron

- Run `process_notification_queue` from a Supabase cron entry or scheduled edge function every few minutes.
- Keep the worker small and idempotent. It should only process rows whose `scheduled_for` is due.
- Use `retry_notification_queue_item` only for items that are still valid after a failure.
- If cron is unavailable, add a thin edge function or server job that calls the RPC on a schedule.

## Withdrawal Behavior

- Withdrawal notifications should be immediate.
- The user message should explain that withdrawals are blocked until the fixed date on the request.
- The admin alert should include the effective withdrawal limit, the requested amount, and the fixed date.

## Release Order

1. Deploy schema changes.
2. Verify the RPCs with a test call in Supabase.
3. Turn on cron or scheduled execution.
4. Deploy the frontend.
5. Smoke-test a withdrawal request and confirm the admin alert and user restriction notice are created immediately.

## Monitoring

- Watch `notification_queue.status`, `retry_count`, and `last_error`.
- Watch `notification_retry_history` for repeated failures.
- Include `withdrawal_request_id` in logs for all withdrawal-related notifications.

## Compliance Ops Rollout and Alerts

- Use staged rollout controls in `task_compliance_rollout_v1` to avoid hard-cutover enforcement.
- Use threshold controls in `task_compliance_alert_thresholds_v1` for queue and backlog alerting.
- `complianceOpsRunner` sends `compliance_ops_alert` when thresholds are exceeded.
- Runbook: `platform/docs/TASK_COMPLIANCE_ROLLOUT_RUNBOOK.md`