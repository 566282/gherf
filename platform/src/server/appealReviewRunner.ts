import { listComplianceAppeals } from '@/services/api/appeals';
import { notifySuperAdmins } from '@/services/api/communications';

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

export type AppealReviewRunnerEvent = {
  httpMethod?: string;
};

export async function handler(event: AppealReviewRunnerEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const appeals = await listComplianceAppeals(120);
    const dueAppeals = appeals.filter((appeal) => {
      if (!appeal.slaDueAt) return false;
      return new Date(appeal.slaDueAt).getTime() <= Date.now() && (appeal.state === 'in_review' || appeal.state === 'fee_pending');
    });

    if (dueAppeals.length) {
      await notifySuperAdmins({
        title: 'Compliance appeals SLA alert',
        message: `${dueAppeals.length} appeal(s) have reached or exceeded SLA and require reviewer action.`,
        type: 'warning',
        category: 'transactional',
        metadata: {
          dueAppealIds: dueAppeals.map((appeal) => appeal.id),
        },
      });
    }

    return json(200, {
      ok: true,
      totalAppeals: appeals.length,
      dueAppeals: dueAppeals.length,
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to run appeal review jobs.' });
  }
}
