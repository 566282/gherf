import { describe, expect, it } from 'vitest';
import {
  evaluateTaskComplianceRolloutDecision,
  getDefaultTaskComplianceRolloutConfig,
  parseTaskComplianceAlertThresholds,
  parseTaskComplianceRolloutConfig,
} from '@/services/api/complianceRollout';

describe('task compliance rollout controls', () => {
  it('parses rollout config with clamped numeric ranges', () => {
    const parsed = parseTaskComplianceRolloutConfig({
      mode: 'soft_enforce',
      rolloutPercent: 170,
      softEnforceMinRiskScore: -10,
      processNotificationQueue: 'true',
      runBackfill: true,
      maxBackfillBatch: 10,
    });

    expect(parsed).toMatchObject({
      mode: 'soft_enforce',
      rolloutPercent: 100,
      softEnforceMinRiskScore: 0,
      processNotificationQueue: true,
      runBackfill: true,
      maxBackfillBatch: 25,
    });
  });

  it('returns observe-mode bypass regardless of desired state', () => {
    const decision = evaluateTaskComplianceRolloutDecision({
      userId: 'user-observe',
      riskScore: 98,
      desiredState: 'held_compliance',
      config: {
        ...getDefaultTaskComplianceRolloutConfig(),
        mode: 'observe',
        rolloutPercent: 100,
      },
    });

    expect(decision).toMatchObject({
      mode: 'observe',
      effectiveState: 'bypassed',
      reason: 'observe_mode_bypass',
    });
  });

  it('applies soft-enforce low-risk override', () => {
    const decision = evaluateTaskComplianceRolloutDecision({
      userId: 'user-soft',
      riskScore: 50,
      desiredState: 'held_compliance',
      config: {
        ...getDefaultTaskComplianceRolloutConfig(),
        mode: 'soft_enforce',
        rolloutPercent: 100,
        softEnforceMinRiskScore: 75,
      },
    });

    expect(decision).toMatchObject({
      mode: 'soft_enforce',
      effectiveState: 'approved',
      reason: 'soft_enforce_low_risk_override',
    });
  });

  it('parses alert thresholds with defaults and clamps', () => {
    const thresholds = parseTaskComplianceAlertThresholds({
      failedQueueCount: 0,
      retryQueueCount: '4',
      heldReviewBacklogCount: 12,
      dueAppealCount: null,
    });

    expect(thresholds.failedQueueCount).toBe(1);
    expect(thresholds.retryQueueCount).toBe(4);
    expect(thresholds.heldReviewBacklogCount).toBe(12);
    expect(thresholds.dueAppealCount).toBeGreaterThan(0);
  });
});
