import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { getActiveCompliancePolicy, type CompliancePolicyVersionRecord } from '@/services/api/compliancePolicy';
import { defaultFraudThresholds, describeFraudRiskChecks, explainFraudAssessment, evaluateFraudProfile, type FraudUserProfile } from '@/services/api/fraud';
import { listCampaignTasks, type CampaignTaskView } from '@/services/api/tasks';
import { listTaskVerificationEvents } from '@/services/api/taskVerification';

type LiveVerificationItem = {
  id: string;
  taskTitle: string;
  campaignTitle: string;
  userId: string;
  method: string;
  state: string;
  confidenceScore: number;
  riskScore: number;
  submittedAt: string;
  reasons: string[];
  summary: string;
};

function pretty(value: string): string {
  return value.split('_').join(' ');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusTone(state: string): string {
  if (state === 'approved') return 'bg-emerald-500/15 text-emerald-300';
  if (state === 'rejected') return 'bg-rose-500/15 text-rose-300';
  if (state === 'review_required') return 'bg-amber-500/15 text-amber-300';
  return 'bg-sky-500/15 text-sky-300';
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readContext(event: Record<string, unknown>): Record<string, unknown> {
  const rawResult = event.raw_result;
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) return {};

  const context = (rawResult as Record<string, unknown>).context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {};

  return context as Record<string, unknown>;
}

function buildFraudProfile(event: Record<string, unknown>, task: CampaignTaskView | undefined): FraudUserProfile {
  const context = readContext(event);
  const userId = readString(event.user_id, 'unknown-user');
  const method = readString(event.verification_method, readString(task?.verificationMethod, 'manual_review'));

  return {
    id: readString(event.id, ''),
    name: task?.title ?? readString(event.task_id, 'Unknown task'),
    email: `${userId}@example.com`,
    campaign: task?.campaignTitle ?? readString(event.campaign_id, 'Unknown campaign'),
    country: readString(context.country, 'US'),
    device: method,
    ipGroup: 'verification-review-queue',
    watchTimeMinutes: Math.max(1, Math.round(readNumber(event.confidence_score, 0) / 10)),
    clicksPerMinute: readNumber(context.rapidRetries, 0) > 0 ? 10 : 2,
    refreshesPerMinute: context.suspiciousDevice ? 4 : 0,
    automationConfidence: Math.max(0, Math.min(100, 20 + readNumber(event.risk_score, 0))),
    sharedIpAccounts: readNumber(context.duplicateSignals, 0) > 0 ? 3 : 1,
    deviceReuseCount: readNumber(context.duplicateSignals, 0) > 0 ? 2 : 1,
    linkedAccounts: Math.max(1, readNumber(context.linkedAccounts, 1)),
    referralLoopScore: readNumber(context.referralLoopScore, 12),
    vpn: Boolean(context.vpn),
    proxy: Boolean(context.proxy),
    emulator: Boolean(context.emulator),
    bot: Boolean(context.bot),
    suspiciousReferrals: Boolean(context.suspiciousReferrals),
    lastSeen: readString(event.created_at, new Date().toISOString()),
  };
}

function toLiveItem(event: Record<string, unknown>, task: CampaignTaskView | undefined): LiveVerificationItem {
  const profile = buildFraudProfile(event, task);
  const explanation = explainFraudAssessment(evaluateFraudProfile(profile, defaultFraudThresholds), defaultFraudThresholds);

  return {
    id: readString(event.id, ''),
    taskTitle: task?.title ?? readString(event.task_id, 'Unknown task'),
    campaignTitle: task?.campaignTitle ?? readString(event.campaign_id, 'Unknown campaign'),
    userId: readString(event.user_id, 'unknown-user'),
    method: readString(event.verification_method, readString(task?.verificationMethod, 'manual_review')),
    state: readString(event.verification_state, 'review_required'),
    confidenceScore: readNumber(event.confidence_score, 0),
    riskScore: readNumber(event.risk_score, 0),
    submittedAt: readString(event.created_at, new Date().toISOString()),
    reasons: describeFraudRiskChecks(explanation.signals),
    summary: explanation.summary,
  };
}

export function SubmissionReviewPage(): JSX.Element {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [tasks, setTasks] = useState<CampaignTaskView[]>([]);
  const [activePolicy, setActivePolicy] = useState<CompliancePolicyVersionRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading live verification data...');

  useEffect(() => {
    let mounted = true;

    void Promise.all([listTaskVerificationEvents(120), listCampaignTasks(), getActiveCompliancePolicy()])
      .then(([nextEvents, nextTasks, nextPolicy]) => {
        if (!mounted) return;
        setEvents(nextEvents);
        setTasks(nextTasks);
        setActivePolicy(nextPolicy);
        setStatusMessage('Synced live verification events and compliance policy controls.');
      })
      .catch(() => {
        if (!mounted) return;
        setEvents([]);
        setTasks([]);
        setActivePolicy(null);
        setStatusMessage('Unable to load live verification data right now.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const verificationRows = useMemo(() => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return events.map((event) => toLiveItem(event, taskById.get(readString(event.task_id, ''))));
  }, [events, tasks]);

  const summary = useMemo(() => {
    return {
      pendingReview: verificationRows.filter((row) => row.state === 'review_required').length,
      approved: verificationRows.filter((row) => row.state === 'approved').length,
      rejected: verificationRows.filter((row) => row.state === 'rejected').length,
      highRisk: verificationRows.filter((row) => row.riskScore >= defaultFraudThresholds.quarantine).length,
      taskCoverage: tasks.length,
    };
  }, [tasks.length, verificationRows]);

  const policyMethods = activePolicy?.policy.verificationStrategy.methods ?? [];

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-3)/0.16),transparent_35%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-accent/70">Project-wide verification</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Verification dashboard</h1>
          <p className="max-w-4xl text-base text-muted">Live queue events and active compliance policy controls for submission review.</p>
          <p className="text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Pending review</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.pendingReview}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Approved</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.approved}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Rejected</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.rejected}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">High risk queue</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.highRisk}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Tracked tasks</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.taskCoverage}</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Active policy</p>
            <h2 className="text-2xl font-semibold text-foreground">Verification controls</h2>
            <p className="text-sm text-muted">{activePolicy ? `${activePolicy.policyKey} / ${activePolicy.version}` : 'No active policy is currently selected.'}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {policyMethods.length > 0
              ? policyMethods.map((method) => (
                  <div key={method} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
                    {pretty(method)}
                  </div>
                ))
              : <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">No policy methods available.</div>}
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Routing rationale</p>
            <h2 className="text-2xl font-semibold text-foreground">Recent explanation feed</h2>
            <p className="text-sm text-muted">Reasons are generated from the same live fraud scoring logic used in operations.</p>
          </div>
          <div className="space-y-3">
            {verificationRows.slice(0, 4).map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{row.taskTitle}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(row.state)}`}>{pretty(row.state)}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{row.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  {row.reasons.length > 0
                    ? row.reasons.map((reason) => (
                        <span key={reason} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                          {reason}
                        </span>
                      ))
                    : <span className="rounded-full border border-border px-3 py-1">No risk reasons</span>}
                </div>
              </div>
            ))}
            {verificationRows.length === 0 ? <p className="text-sm text-muted">No live verification events were returned.</p> : null}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live queue</p>
          <h2 className="text-2xl font-semibold text-foreground">Verification event ledger</h2>
          <p className="text-sm text-muted">Directly sourced from task verification events with live task and campaign metadata.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-muted">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Risk score</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {verificationRows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-foreground">{row.taskTitle}</p>
                    <p className="text-xs text-muted">{row.campaignTitle} · {row.userId}</p>
                  </td>
                  <td className="px-4 py-4 text-muted">{pretty(row.method)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(row.state)}`}>{pretty(row.state)}</span></td>
                  <td className="px-4 py-4 text-foreground">{Math.round(row.riskScore)}</td>
                  <td className="px-4 py-4 text-foreground">{Math.round(row.confidenceScore)}</td>
                  <td className="px-4 py-4 text-muted">{formatDate(row.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
