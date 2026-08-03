import { describe, expect, it } from 'vitest';
import {
  createDefaultTaskCompliancePolicy,
  mergeTaskCompliancePolicy,
  validateTaskCompliancePolicy,
} from '@/services/api/compliancePolicy';

describe('task compliance policy contract', () => {
  it('validates the default policy baseline', () => {
    const policy = createDefaultTaskCompliancePolicy();
    const validation = validateTaskCompliancePolicy(policy);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('rejects fallback methods that are not declared', () => {
    const policy = createDefaultTaskCompliancePolicy();
    policy.verificationStrategy.fallbackOrder = ['api_signal', 'webhook_event'];
    policy.verificationStrategy.methods = ['api_signal'];

    const validation = validateTaskCompliancePolicy(policy);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('fallbackOrder includes unsupported method webhook_event');
  });

  it('rejects risk weights that do not sum to 100', () => {
    const policy = createDefaultTaskCompliancePolicy();
    policy.risk.weights.evidenceQuality = 9;

    const validation = validateTaskCompliancePolicy(policy);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('risk.weights must total 100');
  });

  it('normalizes malformed policies and keeps them valid', () => {
    const merged = mergeTaskCompliancePolicy({
      schemaVersion: 'task-compliance-policy.v1',
      verificationStrategy: {
        methods: ['api_signal', 'not-real-method'],
        fallbackOrder: ['not-real-method'],
        randomAuditRatePercent: 101,
      },
      risk: {
        weights: {
          taskAnomaly: 25,
          identityMismatch: 25,
          deviceIpRisk: 20,
          violationHistory: 20,
          evidenceQuality: 10,
        },
      },
    });

    const validation = validateTaskCompliancePolicy(merged);

    expect(merged.verificationStrategy.randomAuditRatePercent).toBe(100);
    expect(merged.verificationStrategy.methods).toContain('api_signal');
    expect(validation.valid).toBe(true);
  });
});
