# Task Compliance Rollout Runbook

## Purpose

Provide a staged activation process for task-compliance enforcement and operational thresholds without hardcoded toggles.

## Settings Keys

Use `platform_settings`:
- `task_compliance_rollout_v1`
- `task_compliance_alert_thresholds_v1`

## Rollout Modes

- `observe`: Run checks and audits, but always bypass enforcement.
- `shadow_enforce`: Compute desired decisions and record telemetry, but bypass user-facing holds.
- `soft_enforce`: Enforce only higher-risk holds based on `softEnforceMinRiskScore`.
- `full_enforce`: Enforce computed decisions for users in rollout scope.

## Progressive Activation Sequence

1. Set mode to `observe` with `rolloutPercent: 100` for telemetry-only burn-in.
2. Set mode to `shadow_enforce` with `rolloutPercent: 20` to compare desired vs effective decisions.
3. Set mode to `soft_enforce` with `rolloutPercent: 40` and tune `softEnforceMinRiskScore`.
4. Raise `rolloutPercent` in steps: 60 -> 80 -> 100 once SLA and queue stability targets hold.
5. Move to `full_enforce` only after alert thresholds remain stable for at least two full review cycles.

## Ops Runner Controls

`task_compliance_rollout_v1` fields:
- `processNotificationQueue`: enable/disable queue processing in compliance ops runner.
- `runBackfill`: enable/disable backfill in compliance ops runner.
- `maxBackfillBatch`: cap each backfill execution batch.

## Alert Thresholds

`task_compliance_alert_thresholds_v1` fields:
- `failedQueueCount`
- `retryQueueCount`
- `heldReviewBacklogCount`
- `dueAppealCount`

When any threshold is exceeded, `complianceOpsRunner` sends a `compliance_ops_alert` notification to super admins with metric details.

## Daily Checks

1. Review `Notification center` compliance delivery observability cards.
2. Verify failed/retry counts are under thresholds.
3. Verify held compliance backlog trend is stable.
4. Verify due appeal count remains below threshold.
5. Confirm no sudden increase in soft-enforce overrides.

## Escalation

- If failed/retry spikes persist for 30+ minutes, pause rollout progression.
- If held backlog exceeds threshold for two consecutive runs, switch to `shadow_enforce` and investigate.
- If due appeals exceed threshold, trigger reviewer capacity response and SLA triage.
