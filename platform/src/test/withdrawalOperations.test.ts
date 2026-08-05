import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWithdrawalMonitoringSummary, listWithdrawalRuntimeSettings, updateWithdrawalRuntimeSettings } from '@/services/api/withdrawalOperations';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));
describe('withdrawal operations runtime settings', () => {
  beforeEach(() => {
    supabaseState.from.mockReset();
    supabaseState.select.mockReset();
    supabaseState.in.mockReset();
    supabaseState.upsert.mockReset();

    const settingsQuery = {
      select: supabaseState.select,
      in: supabaseState.in,
      upsert: supabaseState.upsert,
    };

    supabaseState.from.mockImplementation((table: string) => {
      if (table === 'platform_settings') return settingsQuery;
      return settingsQuery;
    });

    supabaseState.select.mockReturnValue({
      in: supabaseState.in,
    });

    supabaseState.in.mockResolvedValue({ data: [], error: null });
    supabaseState.upsert.mockResolvedValue({ error: null });
  });

  it('loads withdrawal runtime settings with defaults when rows are absent', async () => {
    const settings = await listWithdrawalRuntimeSettings();

    expect(settings.assignmentSlaHours).toBe(12);
    expect(settings.reminderCadenceHours).toEqual([6, 3, 1]);
    expect(settings.maxReassignments).toBe(2);
    expect(settings.enableAutoAssignment).toBe(true);
  });

  it('persists runtime settings through platform settings upserts', async () => {
    await updateWithdrawalRuntimeSettings({
      assignmentSlaHours: 8,
      reminderCadenceHours: [4, 2],
      maxReassignments: 3,
      enableAutoAssignment: false,
      enableDuplicatePrevention: false,
    });

    expect(supabaseState.upsert).toHaveBeenCalled();
  });

  it('computes rollout monitoring counts for overdue and high-risk assignments', () => {
    const summary = buildWithdrawalMonitoringSummary([
      {
        withdrawalRequestId: 'wr-1',
        userId: 'user-1',
        userDisplayName: 'Ada',
        userEmail: 'ada@example.com',
        amount: 100,
        currency: 'USD',
        method: 'bank_transfer',
        destinationLabel: 'Bank',
        destinationValue: '1234',
        scheduledFor: null,
        createdAt: '2026-08-04T10:00:00.000Z',
        workflowStateKey: 'merchant_acknowledged',
        workflowStateLabel: 'Merchant acknowledged',
        legacyStatus: 'processing',
        riskLevel: 'high',
        riskScore: 92,
        complianceState: 'review',
        stateVersion: 3,
        manualAssignmentRequired: true,
        autoAssignmentEnabled: true,
        assignmentId: 'assignment-1',
        assignmentStatus: 'assigned',
        assignmentDueAt: '2026-08-04T06:00:00.000Z',
        assignedMerchantId: 'merchant-1',
        assignedMerchantCode: 'M-1',
        assignedMerchantName: 'Merchant One',
      },
      {
        withdrawalRequestId: 'wr-2',
        userId: 'user-2',
        userDisplayName: 'Ben',
        userEmail: 'ben@example.com',
        amount: 200,
        currency: 'USD',
        method: 'paypal',
        destinationLabel: 'PayPal',
        destinationValue: 'me@example.com',
        scheduledFor: null,
        createdAt: '2026-08-04T09:00:00.000Z',
        workflowStateKey: 'pending_merchant_assignment',
        workflowStateLabel: 'Pending merchant assignment',
        legacyStatus: 'approved',
        riskLevel: 'low',
        riskScore: 18,
        complianceState: null,
        stateVersion: 2,
        manualAssignmentRequired: false,
        autoAssignmentEnabled: true,
        assignmentId: null,
        assignmentStatus: null,
        assignmentDueAt: null,
        assignedMerchantId: null,
        assignedMerchantCode: null,
        assignedMerchantName: null,
      },
    ], {
      assignmentSlaHours: 12,
      reminderCadenceHours: [6, 3, 1],
      maxReassignments: 2,
      enableAutoAssignment: true,
      enableDuplicatePrevention: true,
      disputeAutoEscalationHours: 24,
      reminderNotificationsEnabled: true,
    }, new Date('2026-08-04T10:30:00.000Z'));

    expect(summary.overdueAssignments).toBe(1);
    expect(summary.highRiskItems).toBe(1);
    expect(summary.manualAssignments).toBe(1);
    expect(summary.pendingAssignments).toBe(1);
    expect(summary.reminderDueCount).toBe(1);
  });
});
