import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { listLearningCourses } from '@/services/api/classroom';

export function ClassroomCatalogPage(): JSX.Element {
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ['classroom-admin-catalog'],
    queryFn: () => listLearningCourses({ status: 'published', limit: 100 }),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom catalog</p>
        <h1 className="text-3xl font-semibold text-foreground">Courses and publication state</h1>
      </header>

      {isLoading ? <p className="text-sm text-muted">Loading classroom catalog...</p> : null}
      {error ? <p className="text-sm text-danger">Unable to load classroom catalog.</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id} className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{course.status}</p>
            <h2 className="text-lg font-semibold text-foreground">{course.title}</h2>
            <p className="text-sm text-muted line-clamp-3">{course.description}</p>
            <p className="text-xs text-muted">{course.durationMinutes} min • {course.pricingType}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
