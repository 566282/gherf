import type { PropsWithChildren } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { getClassroomRolloutSettings } from '@/services/api/classroomContracts';

interface ClassroomRouteGateProps extends PropsWithChildren {
  scope: 'learner' | 'admin';
}

export function ClassroomRouteGate({ scope, children }: ClassroomRouteGateProps): JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['classroom-rollout-settings'],
    queryFn: getClassroomRolloutSettings,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">Loading classroom rollout settings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Classroom unavailable</h1>
        <p className="mt-2 text-sm text-muted">Unable to load rollout settings for classroom routes.</p>
      </Card>
    );
  }

  const settings = data;
  const enabledForScope = Boolean(settings?.enabled && (scope === 'admin' ? settings.allowAdminRoutes : settings.allowLearnerRoutes));

  if (!enabledForScope) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Classroom is not enabled for this environment</h1>
        <p className="mt-2 text-sm text-muted">
          Rollout cohort: <span className="font-medium text-foreground">{settings?.cohort ?? 'internal'}</span>
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
