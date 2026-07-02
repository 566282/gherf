import { Card } from '@/components/ui/Card';

export function CampaignManagerPage(): JSX.Element {
  return (
    <Card>
      <h2 className="text-xl font-bold">Campaign Management</h2>
      <p className="mt-2 text-mist/80">
        Create and manage campaign lifecycle, automation windows, and configurable task templates.
      </p>
    </Card>
  );
}
