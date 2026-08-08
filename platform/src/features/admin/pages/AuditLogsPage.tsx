import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listActivityLogs } from '@/services/api/auth';
import type { ActivityLogItem } from '@/types/auth';

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

export function AuditLogsPage(): JSX.Element {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading live audit trail...');

  useEffect(() => {
    let mounted = true;

    void listActivityLogs(100)
      .then((nextLogs) => {
        if (!mounted) return;
        setLogs(nextLogs);
        setStatusMessage('Synced live admin activity logs from project scope.');
      })
      .catch(() => {
        if (!mounted) return;
        setLogs([]);
        setStatusMessage('Unable to load live admin activity logs right now.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    return {
      total: logs.length,
      admins: new Set(logs.map((item) => item.adminId)).size,
      resources: new Set(logs.map((item) => item.resourceType)).size,
      latest: logs[0]?.createdAt ?? null,
    };
  }, [logs]);

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-2)/0.16),transparent_35%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-accent/70">Project-wide audit trail</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Audit logs</h1>
          <p className="text-base text-muted">Live admin actions sourced from the audit table.</p>
          <p className="text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Total actions</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.total}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Admins active</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.admins}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Resource types</p><p className="mt-2 text-3xl font-semibold text-foreground">{summary.resources}</p></Card>
        <Card className="border border-border bg-surface-elevated"><p className="text-xs uppercase tracking-[0.2em] text-muted">Latest event</p><p className="mt-2 text-sm font-medium text-foreground">{summary.latest ? formatDate(summary.latest) : 'No logs yet'}</p></Card>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live entries</p>
          <h2 className="text-2xl font-semibold text-foreground">Admin activity ledger</h2>
          <p className="text-sm text-muted">Recent project-wide admin actions and reasons.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-muted">
              <tr>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-4 py-4 text-foreground">{log.adminId}</td>
                  <td className="px-4 py-4 text-muted">{pretty(log.action)}</td>
                  <td className="px-4 py-4 text-muted">{pretty(log.resourceType)}{log.resourceId ? ` · ${log.resourceId}` : ''}</td>
                  <td className="px-4 py-4 text-muted">{log.reason ?? 'No reason recorded'}</td>
                  <td className="px-4 py-4 text-muted">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 ? <p className="text-sm text-muted">No live audit events were returned.</p> : null}
      </Card>
    </div>
  );
}
