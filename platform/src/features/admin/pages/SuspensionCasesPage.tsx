import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listSuspensionNotices } from '@/services/api/complianceEnforcement';

export function SuspensionCasesPage(): JSX.Element {
  const [notices, setNotices] = useState<Array<Record<string, unknown>>>([]);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    void listSuspensionNotices(undefined, 120)
      .then(setNotices)
      .catch(() => setStatusMessage('Unable to load suspension cases.'));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 5</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Suspension cases</h1>
        <p className="mt-2 text-sm text-muted">Track user-facing suspension notices and appeal eligibility state.</p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Appeal eligible</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => (
                <tr key={String(notice.id)} className="border-b border-border/60">
                  <td className="py-2 pr-4">{String(notice.user_id)}</td>
                  <td className="py-2 pr-4">{String(notice.notice_state)}</td>
                  <td className="py-2 pr-4">{String(notice.title)}</td>
                  <td className="py-2 pr-4">{String(Boolean(notice.appeal_eligible))}</td>
                  <td className="py-2 pr-4">{new Date(String(notice.created_at)).toLocaleString()}</td>
                </tr>
              ))}
              {!notices.length ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={5}>No suspension notices found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {statusMessage ? <p className="mt-4 text-sm text-muted">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
