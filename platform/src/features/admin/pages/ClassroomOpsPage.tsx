import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getClassroomRolloutSettings,
  updateClassroomRolloutSettings,
  type ClassroomRolloutCohort,
} from '@/services/api/classroomContracts';

export function ClassroomOpsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['classroom-rollout-settings-admin'],
    queryFn: getClassroomRolloutSettings,
  });

  const [cohort, setCohort] = useState<ClassroomRolloutCohort>('internal');

  const updateMutation = useMutation({
    mutationFn: updateClassroomRolloutSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classroom-rollout-settings-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['classroom-rollout-settings'] });
    },
  });

  if (isLoading || !settings) {
    return <p className="text-sm text-muted">Loading classroom rollout controls...</p>;
  }

  const save = (patch: Partial<typeof settings>) => {
    updateMutation.mutate({ ...patch, cohort });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom operations</p>
        <h1 className="text-3xl font-semibold text-foreground">Rollout flags and schema controls</h1>
      </header>

      <Card className="space-y-4 p-4">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Rollout cohort</span>
          <select
            className="input-base w-full"
            value={cohort}
            onChange={(event) => setCohort(event.target.value as ClassroomRolloutCohort)}
          >
            <option value="internal">Internal</option>
            <option value="beta">Beta</option>
            <option value="production">Production</option>
          </select>
        </label>

        <div className="grid gap-2 md:grid-cols-2">
          <Button onClick={() => save({ enabled: !settings.enabled })}>{settings.enabled ? 'Disable classroom' : 'Enable classroom'}</Button>
          <Button onClick={() => save({ allowLearnerRoutes: !settings.allowLearnerRoutes })}>
            {settings.allowLearnerRoutes ? 'Disable learner routes' : 'Enable learner routes'}
          </Button>
          <Button onClick={() => save({ allowAdminRoutes: !settings.allowAdminRoutes })}>
            {settings.allowAdminRoutes ? 'Disable admin routes' : 'Enable admin routes'}
          </Button>
          <Button onClick={() => save({ allowRewardPayouts: !settings.allowRewardPayouts })}>
            {settings.allowRewardPayouts ? 'Disable reward payouts' : 'Enable reward payouts'}
          </Button>
          <Button onClick={() => save({ allowWalletTransfers: !settings.allowWalletTransfers })}>
            {settings.allowWalletTransfers ? 'Disable wallet transfers' : 'Enable wallet transfers'}
          </Button>
          <Button onClick={() => save({ allowTutor: !settings.allowTutor })}>{settings.allowTutor ? 'Disable tutor' : 'Enable tutor'}</Button>
        </div>

        {updateMutation.error ? <p className="text-sm text-danger">{(updateMutation.error as Error).message}</p> : null}
        {updateMutation.isSuccess ? <p className="text-sm text-success">Classroom rollout settings updated.</p> : null}
      </Card>
    </div>
  );
}
