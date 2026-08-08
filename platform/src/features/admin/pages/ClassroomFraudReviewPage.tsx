import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/services/supabase/client';

type SessionRiskRow = {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  risk_score: number;
  risk_status: 'clear' | 'review' | 'blocked';
  created_at: string;
};

async function listRiskSessions(): Promise<SessionRiskRow[]> {
  const { data, error } = await supabase
    .from('learning_sessions')
    .select('id,user_id,course_id,lesson_id,risk_score,risk_status,created_at')
    .in('risk_status', ['review', 'blocked'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as SessionRiskRow[];
}

export function ClassroomFraudReviewPage(): JSX.Element {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['classroom-fraud-review-sessions'],
    queryFn: listRiskSessions,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom fraud review</p>
        <h1 className="text-3xl font-semibold text-foreground">Risk-held learning sessions</h1>
      </header>

      {isLoading ? <p className="text-sm text-muted">Loading risk queue...</p> : null}
      {error ? <p className="text-sm text-danger">Unable to load classroom risk queue.</p> : null}

      <div className="space-y-3">
        {data.map((item) => (
          <Card key={item.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Session {item.id.slice(0, 8)}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{item.risk_status}</p>
            </div>
            <p className="text-sm text-muted">User: {item.user_id}</p>
            <p className="text-sm text-muted">Course: {item.course_id}</p>
            <p className="text-sm text-muted">Risk score: {item.risk_score}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
