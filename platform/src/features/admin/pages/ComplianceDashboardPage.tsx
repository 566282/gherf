import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listWithdrawalComplianceReviews } from '@/services/api/taskCompliance';
import { listTaskVerificationEvents } from '@/services/api/taskVerification';
import { listComplianceAppeals } from '@/services/api/appeals';
import { listSuspensionNotices } from '@/services/api/complianceEnforcement';
import {
  getDefaultTaskComplianceAlertThresholds,
  getDefaultTaskComplianceRolloutConfig,
  getTaskComplianceAlertThresholds,
  getTaskComplianceRolloutConfig,
  upsertTaskComplianceAlertThresholds,
  upsertTaskComplianceRolloutConfig,
  type TaskComplianceAlertThresholds,
  type TaskComplianceRolloutConfig,
  type TaskComplianceRolloutMode,
} from '@/services/api/complianceRollout';

export function ComplianceDashboardPage(): JSX.Element {
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [verifications, setVerifications] = useState<Array<Record<string, unknown>>>([]);
  const [appeals, setAppeals] = useState<Array<Record<string, unknown>>>([]);
  const [notices, setNotices] = useState<Array<Record<string, unknown>>>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [rolloutConfig, setRolloutConfig] = useState<TaskComplianceRolloutConfig>(getDefaultTaskComplianceRolloutConfig());
  const [alertThresholds, setAlertThresholds] = useState<TaskComplianceAlertThresholds>(getDefaultTaskComplianceAlertThresholds());
  const [isSavingControls, setIsSavingControls] = useState(false);
  const [controlsMessage, setControlsMessage] = useState('');

  const reload = async () => {
    const [nextReviews, nextVerifications, nextAppeals, nextNotices] = await Promise.all([
      listWithdrawalComplianceReviews(80),
      listTaskVerificationEvents(120),
      listComplianceAppeals(80),
      listSuspensionNotices(undefined, 80),
    ]);

    setReviews(nextReviews as unknown as Array<Record<string, unknown>>);
    setVerifications(nextVerifications);
    setAppeals(nextAppeals as unknown as Array<Record<string, unknown>>);
    setNotices(nextNotices);
  };

  const loadControls = async () => {
    const [nextRolloutConfig, nextAlertThresholds] = await Promise.all([
      getTaskComplianceRolloutConfig(),
      getTaskComplianceAlertThresholds(),
    ]);

    setRolloutConfig(nextRolloutConfig);
    setAlertThresholds(nextAlertThresholds);
  };

  const handleSaveControls = async () => {
    setIsSavingControls(true);
    setControlsMessage('');

    try {
      await Promise.all([
        upsertTaskComplianceRolloutConfig(rolloutConfig),
        upsertTaskComplianceAlertThresholds(alertThresholds),
      ]);
      setControlsMessage('Rollout mode and alert thresholds saved.');
    } catch {
      setControlsMessage('Unable to save rollout controls right now.');
    } finally {
      setIsSavingControls(false);
    }
  };

  useEffect(() => {
    void Promise.all([reload(), loadControls()])
      .catch(() => setStatusMessage('Unable to load compliance dashboard metrics.'));
  }, []);

  const metrics = useMemo(() => {
    const heldReviews = reviews.filter((item) => String(item.state) === 'held_compliance').length;
    const pendingReviews = reviews.filter((item) => String(item.state) === 'pending_compliance').length;
    const reviewRequired = verifications.filter((item) => String(item.verification_state) === 'review_required').length;
    const appealInReview = appeals.filter((item) => String(item.state) === 'in_review' || String(item.state) === 'fee_pending').length;
    const activeSuspensions = notices.filter((item) => String(item.notice_state) === 'active').length;

    return {
      totalReviews: reviews.length,
      heldReviews,
      pendingReviews,
      reviewRequired,
      appealInReview,
      activeSuspensions,
    };
  }, [appeals, notices, reviews, verifications]);

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 8</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Compliance command center</h1>
        <p className="mt-2 text-sm text-muted">Unified view of verification queues, withdrawal compliance, appeals, and suspensions.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-muted">Withdrawal reviews</p><p className="mt-2 text-3xl font-semibold text-foreground">{metrics.totalReviews}</p><p className="mt-1 text-xs text-muted">Held: {metrics.heldReviews} | Pending: {metrics.pendingReviews}</p></Card>
        <Card><p className="text-sm text-muted">Verification queue</p><p className="mt-2 text-3xl font-semibold text-foreground">{metrics.reviewRequired}</p><p className="mt-1 text-xs text-muted">Manual-review required events</p></Card>
        <Card><p className="text-sm text-muted">Appeals in flow</p><p className="mt-2 text-3xl font-semibold text-foreground">{metrics.appealInReview}</p><p className="mt-1 text-xs text-muted">Fee pending + in review</p></Card>
      </div>

      <Card>
        <h2 className="text-2xl font-semibold text-foreground">Operational pressure</h2>
        <div className="mt-3 text-sm text-muted">
          <p>Active suspension notices: {metrics.activeSuspensions}</p>
          <p>Risk-prioritized manual actions should start from held reviews, then appeal queue.</p>
        </div>
        <div className="mt-4">
          <Button onClick={() => void reload()}>Refresh dashboard</Button>
          {statusMessage ? <p className="mt-2 text-sm text-muted">{statusMessage}</p> : null}
        </div>
      </Card>

      <Card className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 10 controls</p>
            <h2 className="text-2xl font-semibold text-foreground">Rollout mode and alert thresholds</h2>
            <p className="mt-2 text-sm text-muted">Switch compliance enforcement between observe, shadow, soft, and full enforcement without changing code.</p>
          </div>
          <Button onClick={() => void handleSaveControls()} disabled={isSavingControls}>
            {isSavingControls ? 'Saving...' : 'Save rollout controls'}
          </Button>
        </div>

        {controlsMessage ? <p className="text-sm text-muted">{controlsMessage}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Rollout mode</span>
              <select
                className="input-base"
                value={rolloutConfig.mode}
                onChange={(event) => setRolloutConfig((current) => ({ ...current, mode: event.target.value as TaskComplianceRolloutMode }))}
              >
                <option value="observe">Observe</option>
                <option value="shadow_enforce">Shadow enforce</option>
                <option value="soft_enforce">Soft enforce</option>
                <option value="full_enforce">Full enforce</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Rollout percentage</span>
              <input
                className="input-base"
                type="number"
                min="0"
                max="100"
                value={rolloutConfig.rolloutPercent}
                onChange={(event) => setRolloutConfig((current) => ({ ...current, rolloutPercent: Number(event.target.value) }))}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Soft enforce minimum risk score</span>
              <input
                className="input-base"
                type="number"
                min="0"
                max="100"
                value={rolloutConfig.softEnforceMinRiskScore}
                onChange={(event) => setRolloutConfig((current) => ({ ...current, softEnforceMinRiskScore: Number(event.target.value) }))}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={rolloutConfig.processNotificationQueue}
                  onChange={(event) => setRolloutConfig((current) => ({ ...current, processNotificationQueue: event.target.checked }))}
                />
                Process notification queue
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={rolloutConfig.runBackfill}
                  onChange={(event) => setRolloutConfig((current) => ({ ...current, runBackfill: event.target.checked }))}
                />
                Run backfill jobs
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Backfill batch size</span>
              <input
                className="input-base"
                type="number"
                min="25"
                max="2000"
                value={rolloutConfig.maxBackfillBatch}
                onChange={(event) => setRolloutConfig((current) => ({ ...current, maxBackfillBatch: Number(event.target.value) }))}
              />
            </label>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Failed queue threshold</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={alertThresholds.failedQueueCount}
                onChange={(event) => setAlertThresholds((current) => ({ ...current, failedQueueCount: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Retry queue threshold</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={alertThresholds.retryQueueCount}
                onChange={(event) => setAlertThresholds((current) => ({ ...current, retryQueueCount: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Held review backlog threshold</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={alertThresholds.heldReviewBacklogCount}
                onChange={(event) => setAlertThresholds((current) => ({ ...current, heldReviewBacklogCount: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Due appeals threshold</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={alertThresholds.dueAppealCount}
                onChange={(event) => setAlertThresholds((current) => ({ ...current, dueAppealCount: Number(event.target.value) }))}
              />
            </label>
            <p className="text-sm text-muted">Threshold alerts are sent to super admins through the compliance ops runner and appear in notification center observability.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
