import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '@/server/p2pEscrowRunner';

const complianceState = vi.hoisted(() => ({
  processP2PNotificationEvents: vi.fn(),
  runP2PLiquidityHealthJob: vi.fn(),
  runP2PMerchantAnalyticsJob: vi.fn(),
}));

const orchestratorState = vi.hoisted(() => ({
  runP2PAssignmentOrchestrator: vi.fn(),
}));

vi.mock('@/services/api/p2pCompliance', () => ({
  processP2PNotificationEvents: complianceState.processP2PNotificationEvents,
  runP2PLiquidityHealthJob: complianceState.runP2PLiquidityHealthJob,
  runP2PMerchantAnalyticsJob: complianceState.runP2PMerchantAnalyticsJob,
}));

vi.mock('@/services/api/p2pAssignmentOrchestrator', () => ({
  runP2PAssignmentOrchestrator: orchestratorState.runP2PAssignmentOrchestrator,
}));

describe('p2p escrow runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    complianceState.runP2PLiquidityHealthJob.mockResolvedValue({ ok: true });
    complianceState.runP2PMerchantAnalyticsJob.mockResolvedValue({ ok: true });
    complianceState.processP2PNotificationEvents.mockResolvedValue(3);
    orchestratorState.runP2PAssignmentOrchestrator.mockResolvedValue({ processed: 2, assigned: 1, failed: 0 });
  });

  it('runs orchestrator as part of escrow job execution', async () => {
    const response = await handler({ httpMethod: 'POST' });
    const body = JSON.parse(response.body) as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(orchestratorState.runP2PAssignmentOrchestrator).toHaveBeenCalledWith(40);
    expect(body.assignment).toEqual({ processed: 2, assigned: 1, failed: 0 });
  });
});
