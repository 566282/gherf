import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { listLearningHomeFeed, listLearningProviders } from '@/services/api/classroom';

export function ClassroomHomePage(): JSX.Element {
  const { profile } = useAuth();

  const { data: feed, isLoading: loadingFeed, error: feedError } = useQuery({
    queryKey: ['classroom-home-feed', profile?.id],
    queryFn: () => listLearningHomeFeed({ userId: profile?.id }),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['classroom-providers-public'],
    queryFn: listLearningProviders,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom learn-to-earn</p>
        <h1 className="text-3xl font-semibold text-foreground">Discover, learn, and unlock verified rewards</h1>
        <p className="text-sm text-muted">Progress is tracked from validated telemetry and anti-cheat checks before reward release.</p>
      </header>

      {feedError ? (
        <Card className="p-4">
          <p className="text-sm text-danger">Unable to load classroom feed.</p>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Recommended</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{feed?.recommended.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Continue learning</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{feed?.continueLearning.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Providers</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{providers.length}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Continue learning</h2>
        {loadingFeed ? <p className="text-sm text-muted">Loading feed...</p> : null}
        {feed?.continueLearning.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {feed.continueLearning.map((enrollment) => (
              <Card key={enrollment.id} className="space-y-3 p-4">
                <p className="text-sm text-muted">Enrollment {enrollment.id.slice(0, 8)}</p>
                <p className="text-lg font-semibold text-foreground">Progress {Math.round(enrollment.progressPercent)}%</p>
                <Link to={`/app/classroom/my-learning`} className="text-sm font-medium text-accent">
                  Open my learning
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-sm text-muted">No active enrollments yet. Start with a recommended course.</p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Recommended courses</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(feed?.recommended ?? []).map((course) => (
            <Card key={course.id} className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{course.difficulty}</p>
              <h3 className="text-lg font-semibold text-foreground">{course.title}</h3>
              <p className="text-sm text-muted line-clamp-3">{course.description}</p>
              <p className="text-xs text-muted">{course.durationMinutes} minutes</p>
              <Link to={`/app/classroom/courses/${course.id}`} className="text-sm font-medium text-accent">
                View course
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
