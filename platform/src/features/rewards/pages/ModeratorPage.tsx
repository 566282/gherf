import { Card } from '@/components/ui/Card';

export function ModeratorPage(): JSX.Element {
  return (
    <Card>
      <h2 className="text-xl font-bold">Moderation Queue</h2>
      <p className="mt-2 text-mist/80">
        Review flagged submissions, approve or reject evidence, and enforce policy actions.
      </p>
    </Card>
  );
}
