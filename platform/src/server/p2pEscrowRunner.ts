import { processP2PNotificationEvents, runP2PLiquidityHealthJob, runP2PMerchantAnalyticsJob } from '../services/api/p2pCompliance';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export type P2PEscrowRunnerEvent = {
  httpMethod?: string;
};

export async function handler(event: P2PEscrowRunnerEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const [liquidity, analytics, notificationsSent] = await Promise.all([
      runP2PLiquidityHealthJob(),
      runP2PMerchantAnalyticsJob(),
      processP2PNotificationEvents(50),
    ]);
    return json(200, { ok: true, liquidity, analytics, notificationsSent });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to run P2P escrow jobs.' });
  }
}
