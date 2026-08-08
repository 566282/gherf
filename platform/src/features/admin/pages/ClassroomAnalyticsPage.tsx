import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { listClassroomAnalyticsDaily, listLearningLeaderboard } from '@/services/api/classroom';

export function ClassroomAnalyticsPage(): JSX.Element {
  const { data: analytics = [], isLoading: loadingAnalytics } = useQuery({
    queryKey: ['classroom-analytics-daily'],
    queryFn: () => listClassroomAnalyticsDaily(30),
  });

  const periodKey = new Date().toISOString().slice(0, 7);
  const { data: leaderboard = [], isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['classroom-leaderboard-admin', periodKey],
    queryFn: () => listLearningLeaderboard(periodKey, 20),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom analytics</p>
        <h1 className="text-3xl font-semibold text-foreground">Engagement, reward, and leaderboard snapshots</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Daily snapshots</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{analytics.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Leaderboard rows</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{leaderboard.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Period key</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{periodKey}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Recent daily aggregates</h2>
        {loadingAnalytics ? <p className="text-sm text-muted">Loading analytics snapshots...</p> : null}
        <div className="space-y-2">
          {analytics.map((row) => (
            <Card key={row.periodDate} className="space-y-2 p-3">
              <p className="text-sm font-medium text-foreground">{row.periodDate}</p>
              <p className="text-xs text-muted">Measures: {JSON.stringify(row.measures)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Leaderboard</h2>
        {loadingLeaderboard ? <p className="text-sm text-muted">Loading leaderboard...</p> : null}
        <div className="space-y-2">
          {leaderboard.map((row) => (
            <Card key={`${row.userId}-${row.rank}`} className="flex items-center justify-between p-3">
              <p className="text-sm text-foreground">{row.userId}</p>
              <p className="text-sm text-muted">#{row.rank} • {row.score}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
