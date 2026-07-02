import { Card } from '@/components/ui/Card';

export function AdminPanelPage() {
  return (
    <div className="p-6">
      <Card>
        <h1 className="text-3xl font-bold text-ember mb-4">Admin Panel</h1>
        <p className="text-mist">Manage platform, users, and settings.</p>
      </Card>
    </div>
  );
}
