import { runP2PComplianceJob } from '../services/api/p2pCompliance';

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

export type P2PComplianceRunnerEvent = {
  httpMethod?: string;
};

export async function handler(event: P2PComplianceRunnerEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const compliance = await runP2PComplianceJob();
    return json(200, { ok: true, compliance });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to run P2P compliance jobs.' });
  }
}
