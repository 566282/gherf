# Notification Operations Next Steps

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