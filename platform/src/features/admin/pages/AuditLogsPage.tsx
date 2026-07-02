import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listActivityLogs } from '@/services/api/auth';
import type { ActivityLogItem } from '@/types/auth';

export function AuditLogsPage(): JSX.Element {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  useEffect(() => {
    void listActivityLogs().then(setLogs).catch(() => setLogs([]));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <h1 className="text-3xl font-bold text-ember">Activity logs</h1>
        <p className="mt-2 text-mist/80">View the most recent administrative and system actions.</p>
      </Card>
      <Card>
        <div className="space-y-3 text-sm text-mist/80">
          {logs.length ? logs.map((log) => <div key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="font-medium text-white">{log.action}</p><p>{log.resourceType} · {log.resourceId}</p><p>{log.reason ?? 'No reason recorded'}</p></div>) : <p>No logs available.</p>}
        </div>
      </Card>
    </div>
  );
}
