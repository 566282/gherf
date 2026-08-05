import {
  buildWithdrawalMonitoringSummary,
  listWithdrawalOperationsQueue,
  listWithdrawalRuntimeSettings,
  processWithdrawalAssignmentTimeouts,
} from '@/services/api/withdrawalOperations';

export async function runWithdrawalAutomationRunner(limit = 120): Promise<{
  monitoringSummary: ReturnType<typeof buildWithdrawalMonitoringSummary>;
  timeoutResult: Awaited<ReturnType<typeof processWithdrawalAssignmentTimeouts>>;
}> {
  const [runtimeSettings, queue] = await Promise.all([
    listWithdrawalRuntimeSettings(),
    listWithdrawalOperationsQueue({ limit }),
  ]);

  const monitoringSummary = buildWithdrawalMonitoringSummary(queue, runtimeSettings);
  const timeoutResult = await processWithdrawalAssignmentTimeouts(limit);

  return {
    monitoringSummary,
    timeoutResult,
  };
}
