import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { appendLearningEvent, completeLessonCheckpoint, evaluateLearningReward, startLearningSession } from '@/services/api/classroom';

export function LearningSessionPage(): JSX.Element {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchSeconds, setWatchSeconds] = useState(600);
  const [completionPercent, setCompletionPercent] = useState(100);

  const courseId = params.get('courseId') ?? '';
  const lessonId = params.get('lessonId') ?? '';

  const canStart = Boolean(profile?.id && courseId && lessonId);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Authentication required.');
      const session = await startLearningSession({
        userId: profile.id,
        courseId,
        lessonId,
        source: 'web_classroom_session_page',
      });

      await appendLearningEvent({
        userId: profile.id,
        sessionId: session.id,
        courseId,
        lessonId,
        event: {
          schemaVersion: 'classroom_learning_event_v1',
          eventType: 'session_started',
          eventTime: new Date().toISOString(),
          source: 'web',
          payload: {
            route: 'learning_session_page',
          },
        },
      });

      return session.id;
    },
    onSuccess: (id) => {
      setSessionId(id);
    },
  });

  const checkpointMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Authentication required.');
      if (!lessonId) throw new Error('Lesson is required.');

      if (sessionId) {
        await appendLearningEvent({
          userId: profile.id,
          sessionId,
          courseId,
          lessonId,
          event: {
            schemaVersion: 'classroom_learning_event_v1',
            eventType: 'lesson_checkpoint',
            eventTime: new Date().toISOString(),
            source: 'web',
            payload: {
              watchSeconds,
              completionPercent,
            },
          },
        });
      }

      const checkpoint = await completeLessonCheckpoint({
        userId: profile.id,
        lessonId,
        watchSeconds,
        completionPercent,
        checkpoint: {
          sessionId,
          recordedAt: new Date().toISOString(),
        },
      });

      if (checkpoint.completion_percent >= 100) {
        await evaluateLearningReward({
          userId: profile.id,
          lessonId,
          triggerType: 'lesson_completed',
          rewardAmount: 10,
          evidence: {
            sessionId: sessionId ?? undefined,
            completionPercent,
            activeSeconds: watchSeconds,
            focusRatio: 0.9,
            playbackSpeed: 1,
          },
        });
      }

      return checkpoint;
    },
  });

  const completionLabel = useMemo(() => `${Math.max(0, Math.min(100, completionPercent))}%`, [completionPercent]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom learning session</p>
        <h1 className="text-3xl font-semibold text-foreground">Telemetry and checkpoint verification</h1>
        <p className="text-sm text-muted">Start session, emit lesson checkpoint, and persist validated progress.</p>
      </header>

      <Card className="space-y-4 p-4">
        <div>
          <p className="text-sm text-muted">Course id</p>
          <p className="font-mono text-xs text-foreground">{courseId || 'missing'}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Lesson id</p>
          <p className="font-mono text-xs text-foreground">{lessonId || 'missing'}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => startSessionMutation.mutate()} disabled={!canStart || startSessionMutation.isPending}>
            {startSessionMutation.isPending ? 'Starting...' : 'Start learning session'}
          </Button>
          <p className="text-sm text-muted">Session: {sessionId ?? 'not started'}</p>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-lg font-semibold text-foreground">Submit lesson checkpoint</h2>

        <label className="block space-y-2">
          <span className="text-sm text-muted">Active watch seconds</span>
          <input
            type="number"
            min={0}
            value={watchSeconds}
            onChange={(event) => setWatchSeconds(Number(event.target.value))}
            className="input-base w-full"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-muted">Completion percent</span>
          <input
            type="number"
            min={0}
            max={100}
            value={completionPercent}
            onChange={(event) => setCompletionPercent(Number(event.target.value))}
            className="input-base w-full"
          />
          <span className="text-xs text-muted">{completionLabel}</span>
        </label>

        <Button onClick={() => checkpointMutation.mutate()} disabled={!canStart || checkpointMutation.isPending}>
          {checkpointMutation.isPending ? 'Saving checkpoint...' : 'Save checkpoint'}
        </Button>

        {checkpointMutation.error ? <p className="text-sm text-danger">{(checkpointMutation.error as Error).message}</p> : null}
        {checkpointMutation.isSuccess ? <p className="text-sm text-success">Lesson progress saved.</p> : null}
      </Card>
    </div>
  );
}
