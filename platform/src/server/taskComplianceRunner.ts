import { computeAndPersistComplianceRiskScore, runIdentityConsistencyCheck } from '@/services/api/complianceEnforcement';
import { listWithdrawalComplianceReviews } from '@/services/api/taskCompliance';

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

export type TaskComplianceRunnerEvent = {
  httpMethod?: string;
};

export async function handler(event: TaskComplianceRunnerEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const reviews = await listWithdrawalComplianceReviews(80);
    const impactedUsers = Array.from(new Set(reviews.map((review) => review.userId)));

    const riskOutputs: Array<Record<string, unknown>> = [];

    for (const userId of impactedUsers) {
      const risk = await computeAndPersistComplianceRiskScore(userId);
      const identity = await runIdentityConsistencyCheck(userId, {
        profileName: null,
        kycName: null,
        socialHandleName: null,
        historicalName: null,
      });

      riskOutputs.push({
        userId,
        risk,
        identity,
      });
    }

    return json(200, {
      ok: true,
      reviewedUsers: impactedUsers.length,
      outputs: riskOutputs,
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to run task compliance jobs.' });
  }
}
