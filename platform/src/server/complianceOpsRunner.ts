import { listComplianceAppeals } from '@/services/api/appeals';
import {
  getTaskComplianceAlertThresholds,
  getTaskComplianceRolloutConfig,
} from '@/services/api/complianceRollout';
import {
  listNotificationQueue,
  notifySuperAdmins,
  processNotificationQueue,
} from '@/services/api/communications';
import { listWithdrawalComplianceReviews } from '@/services/api/taskCompliance';
import { runTaskComplianceBackfill } from '@/services/api/taskComplianceBackfill';

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

export type ComplianceOpsRunnerEvent = {
  httpMethod?: string;
};

export async function handler(event: ComplianceOpsRunnerEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const [rolloutConfig, alertThresholds] = await Promise.all([
      getTaskComplianceRolloutConfig(),
      getTaskComplianceAlertThresholds(),
    ]);

    const notificationsProcessed = rolloutConfig.processNotificationQueue
      ? await processNotificationQueue(100)
      : 0;

    const backfill = rolloutConfig.runBackfill
      ? await runTaskComplianceBackfill(rolloutConfig.maxBackfillBatch)
      : { withdrawalReviewsCreated: 0, verificationEventsCreated: 0 };

    const [queueRows, reviewRows, appealRows] = await Promise.all([
      listNotificationQueue(300, 0),
      listWithdrawalComplianceReviews(300),
      listComplianceAppeals(300),
    ]);

    const queueFailedCount = queueRows.filter((row) => row.status === 'failed').length;
    const queueRetryCount = queueRows.filter((row) => row.status === 'retry').length;
    const heldReviewBacklogCount = reviewRows.filter((row) => row.state === 'held_compliance' || row.state === 'pending_compliance').length;
    const now = Date.now();
    const dueAppealCount = appealRows.filter((row) => {
      if (!row.slaDueAt) return false;
      const due = new Date(row.slaDueAt).getTime();
      return Number.isFinite(due) && due <= now && (row.state === 'in_review' || row.state === 'fee_pending' || row.state === 'submitted');
    }).length;

    const alerts: string[] = [];

    if (queueFailedCount >= alertThresholds.failedQueueCount) {
      alerts.push(`Failed queue count ${queueFailedCount} reached threshold ${alertThresholds.failedQueueCount}.`);
    }

    if (queueRetryCount >= alertThresholds.retryQueueCount) {
      alerts.push(`Retry queue count ${queueRetryCount} reached threshold ${alertThresholds.retryQueueCount}.`);
    }

    if (heldReviewBacklogCount >= alertThresholds.heldReviewBacklogCount) {
      alerts.push(`Held/pending compliance backlog ${heldReviewBacklogCount} reached threshold ${alertThresholds.heldReviewBacklogCount}.`);
    }

    if (dueAppealCount >= alertThresholds.dueAppealCount) {
      alerts.push(`Due appeals ${dueAppealCount} reached threshold ${alertThresholds.dueAppealCount}.`);
    }

    if (alerts.length) {
      await notifySuperAdmins({
        title: 'Compliance operations threshold alert',
        message: alerts.join(' '),
        type: 'warning',
        category: 'compliance',
        templateKey: 'compliance_ops_alert',
        metadata: {
          rolloutMode: rolloutConfig.mode,
          queueFailedCount,
          queueRetryCount,
          heldReviewBacklogCount,
          dueAppealCount,
          runbookPath: 'platform/docs/TASK_COMPLIANCE_ROLLOUT_RUNBOOK.md',
          alerts,
        },
      });
    }

    return json(200, {
      ok: true,
      rolloutConfig,
      alertThresholds,
      notificationsProcessed,
      backfill,
      metrics: {
        queueFailedCount,
        queueRetryCount,
        heldReviewBacklogCount,
        dueAppealCount,
      },
      alerts,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Unable to run compliance operations tasks.',
    });
  }
}
