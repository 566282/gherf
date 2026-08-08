import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listAnalyticsReport, type AnalyticsReport } from '@/services/api/analytics';
import { listFraudDetectionConfig, type FraudDetectionConfig } from '@/services/api/fraud';
import { listWithdrawalRuntimeSettings, type WithdrawalRuntimeSettings } from '@/services/api/withdrawalOperations';
import { listActivityLogs } from '@/services/api/auth';
import { getClassroomRolloutSettings, type ClassroomRolloutSettings } from '@/services/api/classroomContracts';

type ReportActivityItem = {
  id: string;
  action: string;
  resourceType: string;
  reason: string;
  createdAt: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function ReportsPage(): JSX.Element {
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [fraudPolicy, setFraudPolicy] = useState<FraudDetectionConfig | null>(null);
  const [withdrawalRuntime, setWithdrawalRuntime] = useState<WithdrawalRuntimeSettings | null>(null);
  const [classroomRollout, setClassroomRollout] = useState<ClassroomRolloutSettings | null>(null);
  const [activity, setActivity] = useState<ReportActivityItem[]>([]);
  const [syncMessage, setSyncMessage] = useState('Loading project-wide reporting controls...');

  useEffect(() => {
    let active = true;

    void Promise.all([
      listAnalyticsReport(30),
      listFraudDetectionConfig(),
      listWithdrawalRuntimeSettings(),
      getClassroomRolloutSettings(),
      listActivityLogs(12),
    ])
      .then(([analyticsReport, fraudConfig, withdrawalSettings, classroomSettings, auditLog]) => {
        if (!active) return;

        setAnalytics(analyticsReport);
        setFraudPolicy(fraudConfig);
        setWithdrawalRuntime(withdrawalSettings);
        setClassroomRollout(classroomSettings);
        setActivity(
          auditLog.map((item) => ({
            id: item.id,
            action: item.action,
            resourceType: item.resourceType,
            reason: item.reason,
            createdAt: item.createdAt,
          })),
        );
        setSyncMessage('Synced live reporting telemetry and project-wide settings.');
      })
      .catch(() => {
        if (!active) return;
        setAnalytics(null);
        setFraudPolicy(null);
        setWithdrawalRuntime(null);
        setClassroomRollout(null);
        setActivity([]);
        setSyncMessage('Unable to load live reporting telemetry right now.');
      });

    return () => {
      active = false;
    };
  }, []);

  const reportKpis = useMemo(() => {
    if (!analytics) return [] as Array<{ label: string; value: string; note: string }>;

    return [
      { label: 'Revenue (30d)', value: formatCurrency(analytics.kpis.totalRevenue), note: 'From analytics rollups' },
      { label: 'Active users', value: String(analytics.kpis.activeUsers), note: 'Users active in the report window' },
      { label: 'Active campaigns', value: String(analytics.kpis.activeCampaigns), note: 'Campaigns currently active' },
      { label: 'Withdrawals volume', value: formatCurrency(analytics.kpis.withdrawalsVolume), note: 'Payout volume tracked by analytics' },
    ];
  }, [analytics]);

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_35%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-accent/70">Project-wide reporting</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Reports control plane</h1>
          <p className="text-base text-muted">Live reporting telemetry and project-wide scope settings, sourced directly from platform APIs.</p>
          <p className="text-sm text-muted">{syncMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportKpis.map((metric) => (
          <Card key={metric.label} className="border border-border bg-surface-elevated">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.note}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Risk and payout policy snapshots</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Live settings state</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Fraud thresholds</p>
              <p className="mt-2 text-sm text-foreground">Review {fraudPolicy?.thresholds.review ?? '--'} · Quarantine {fraudPolicy?.thresholds.quarantine ?? '--'} · Block {fraudPolicy?.thresholds.block ?? '--'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Withdrawal runtime</p>
              <p className="mt-2 text-sm text-foreground">SLA {withdrawalRuntime?.assignmentSlaHours ?? '--'}h · Reassignments {withdrawalRuntime?.maxReassignments ?? '--'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Classroom rollout</p>
              <p className="mt-2 text-sm text-foreground">Enabled: {String(classroomRollout?.enabled ?? false)} · Admin routes: {String(classroomRollout?.allowAdminRoutes ?? false)} · Learner routes: {String(classroomRollout?.allowLearnerRoutes ?? false)} · Cohort: {classroomRollout?.cohort ?? 'internal'}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Operational audit feed</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent reporting-impact activity</h2>
          </div>
          <div className="space-y-2">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-sm font-semibold text-foreground">{item.action.split('_').join(' ')}</p>
                  <p className="text-xs text-muted">{item.resourceType} · {formatDate(item.createdAt)}</p>
                  <p className="mt-1 text-sm text-muted">{item.reason || 'No reason provided.'}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No admin audit entries are currently available.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}