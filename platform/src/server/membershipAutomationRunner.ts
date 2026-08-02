import { runMembershipAutomationJobs } from '../services/api/membershipAdmin';

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

export type MembershipAutomationEvent = {
  httpMethod?: string;
};

export async function handler(event: MembershipAutomationEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    await runMembershipAutomationJobs();
    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to run membership automation jobs.' });
  }
}
