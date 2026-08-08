import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { enrollInCourse, getLearningCourse } from '@/services/api/classroom';

export function CourseDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['classroom-course-detail', id],
    queryFn: () => getLearningCourse(id),
    enabled: Boolean(id),
  });

  const totalLessons = useMemo(() => (course?.modules ?? []).reduce((sum, item) => sum + item.lessons.length, 0), [course]);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Authentication required.');
      return enrollInCourse(id, profile.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classroom-home-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['classroom-my-learning'] });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading course...</p>;
  }

  if (error || !course) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Course not found</h1>
        <p className="mt-2 text-sm text-muted">This classroom course is unavailable or outside your cohort.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom course</p>
        <h1 className="text-3xl font-semibold text-foreground">{course.title}</h1>
        <p className="text-sm text-muted">{course.description || 'No course description available.'}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Difficulty</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{course.difficulty}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Language</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{course.language}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Duration</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{course.durationMinutes} min</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Lessons</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{totalLessons}</p>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending || !profile}>
          {enrollMutation.isPending ? 'Enrolling...' : 'Enroll in course'}
        </Button>
        <Link to="/app/classroom/my-learning" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
          View my learning
        </Link>
      </div>

      {enrollMutation.error ? <p className="text-sm text-danger">{(enrollMutation.error as Error).message}</p> : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Modules and lessons</h2>
        <div className="space-y-3">
          {course.modules.map((module) => (
            <Card key={module.id} className="space-y-3 p-4">
              <h3 className="text-lg font-semibold text-foreground">{module.title}</h3>
              <div className="space-y-2">
                {module.lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-elevated p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                      <p className="text-xs text-muted">{lesson.lessonType} • {lesson.durationSeconds}s</p>
                    </div>
                    <Link to={`/app/classroom/session?courseId=${course.id}&lessonId=${lesson.id}`} className="text-sm font-medium text-accent">
                      Start lesson
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
