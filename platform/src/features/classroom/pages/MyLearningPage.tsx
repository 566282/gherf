import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { listLearningHomeFeed } from '@/services/api/classroom';

export function MyLearningPage(): JSX.Element {
  const { profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['classroom-my-learning', profile?.id],
    queryFn: () => listLearningHomeFeed({ userId: profile?.id, limit: 50 }),
    enabled: Boolean(profile?.id),
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading your learning progress...</p>;
  }

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-danger">Unable to load your learning progress.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">My learning</p>
        <h1 className="text-3xl font-semibold text-foreground">Enrollments and completion status</h1>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data?.continueLearning ?? []).map((enrollment) => (
          <Card key={enrollment.id} className="space-y-3 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{enrollment.status}</p>
            <h2 className="text-lg font-semibold text-foreground">Course {enrollment.courseId.slice(0, 8)}</h2>
            <p className="text-sm text-muted">Progress: {Math.round(enrollment.progressPercent)}%</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, enrollment.progressPercent))}%` }} />
            </div>
            <Link to="/app/classroom/session" className="text-sm font-medium text-accent">
              Continue session
            </Link>
          </Card>
        ))}
      </div>

      {!data?.continueLearning.length ? (
        <Card className="p-4">
          <p className="text-sm text-muted">No active enrollments. Explore the classroom catalog to begin.</p>
          <Link to="/app/classroom" className="mt-2 inline-flex text-sm font-medium text-accent">
            Open classroom home
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
