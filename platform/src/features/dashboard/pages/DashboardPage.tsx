import { Card } from '@/components/ui/Card';

export function DashboardPage(): JSX.Element {
  return (
    <div className="grid gap-6">
      <Card>
        <h1 className="text-2xl font-bold">Business Marketing Platform</h1>
        <p className="mt-2 text-mist/80">
          Launch configurable campaigns, review task submissions, and manage rewards from a unified control plane.
        </p>
      </Card>
    </div>
  );
}
