import { Card } from '@/components/ui/Card';

export function AuditLogsPage() {
  return (
    <div className="p-6">
      <Card>
        <h1 className="text-3xl font-bold text-ember mb-4">Audit Logs</h1>
        <p className="text-mist">View system and admin action audit trail.</p>
      </Card>
    </div>
  );
}
