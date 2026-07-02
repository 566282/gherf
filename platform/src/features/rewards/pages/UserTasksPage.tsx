import { Card } from '@/components/ui/Card';

export function UserTasksPage() {
  return (
    <div className="p-6">
      <Card>
        <h1 className="text-3xl font-bold text-ember mb-4">My Tasks</h1>
        <p className="text-mist">Complete tasks to earn rewards.</p>
      </Card>
    </div>
  );
}
