import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipAnalytics, listMembershipJobRuns, runMembershipAutomationJobs, type MembershipAnalyticsRecord, type MembershipJobRunRecord } from '@/services/api/membershipAdmin';

export function MembershipAnalyticsPage(): JSX.Element {
  const [analytics, setAnalytics] = useState<MembershipAnalyticsRecord[]>([]);
  const [jobRuns, setJobRuns] = useState<MembershipJobRunRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isRunningJobs, setIsRunningJobs] = useState(false);

  const reload = async () => {
    const [nextAnalytics, nextJobRuns] = await Promise.all([
      listMembershipAnalytics(90),
      listMembershipJobRuns(60),
    ]);

    setAnalytics(nextAnalytics);
    setJobRuns(nextJobRuns);
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load membership analytics.'));
  }, []);

  const runJobs = async () => {
    setIsRunningJobs(true);
    setStatusMessage('');
    try {
      await runMembershipAutomationJobs();
      await reload();
      setStatusMessage('Membership automation jobs executed successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to run membership automation jobs.');
    } finally {
      setIsRunningJobs(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Analytics and automation</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership analytics</h1>
        <p className="mt-2 text-sm text-muted">Review daily aggregates and job runner executions. Trigger all jobs on demand for controlled rollout validation.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void runJobs()} disabled={isRunningJobs}>{isRunningJobs ? 'Running jobs...' : 'Run membership jobs now'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isRunningJobs}>Reload data</Button>
        </div>
        {statusMessage ? <p className="mt-3 text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Daily analytics snapshots</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Paid</th><th className="py-2 pr-4">Pending upgrades</th><th className="py-2 pr-4">Active multipliers</th><th className="py-2 pr-4">Fee delinquent</th><th className="py-2 pr-4">Top plan</th></tr>
            </thead>
            <tbody>
              {analytics.map((row) => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{row.reportDate}</td>
                  <td className="py-2 pr-4">{row.totalMembers}</td>
                  <td className="py-2 pr-4">{row.paidMembers}</td>
                  <td className="py-2 pr-4">{row.pendingUpgrades}</td>
                  <td className="py-2 pr-4">{row.activeMultipliers}</td>
                  <td className="py-2 pr-4">{row.feeDelinquentMembers}</td>
                  <td className="py-2 pr-4">Tier {row.topPlanLevel} - {row.topPlanLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Automation job runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Started</th><th className="py-2 pr-4">Job</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Run date</th><th className="py-2 pr-4">Details</th></tr>
            </thead>
            <tbody>
              {jobRuns.map((run) => (
                <tr key={run.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{run.jobKey}</td>
                  <td className="py-2 pr-4">{run.status}</td>
                  <td className="py-2 pr-4">{run.runDate}</td>
                  <td className="py-2 pr-4"><pre className="max-w-[28rem] whitespace-pre-wrap text-xs text-muted">{JSON.stringify(run.details, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
