import { Card } from '@/components/ui/Card';

export function UserTasksPage() {
  return (
    <div className="p-6">
      <Card className="border border-white/10 bg-white/5">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Tasks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">My tasks</h1>
        <p className="mt-2 text-mist/80">Complete tasks to earn rewards.</p>
      </Card>
    </div>
  );
}
