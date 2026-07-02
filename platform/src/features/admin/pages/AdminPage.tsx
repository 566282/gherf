import { Card } from '@/components/ui/Card';

export function AdminPage(): JSX.Element {
  return (
    <Card>
      <h2 className="text-xl font-bold">Super Admin Console</h2>
      <p className="mt-2 text-mist/80">
        Manage platform settings, automation rules, role permissions, and global policy toggles.
      </p>
    </Card>
  );
}
