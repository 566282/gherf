import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAdminConsoleConfig, type AdminConsoleConfig } from '@/services/api/admin';
import { listCommunicationConfig, type CommunicationConfig } from '@/services/api/communications';
import { listCmsConfig, type CmsConfig } from '@/services/api/cms';
import { listFraudDetectionConfig, type FraudDetectionConfig } from '@/services/api/fraud';
import { getClassroomRolloutSettings, updateClassroomRolloutSettings, type ClassroomRolloutSettings } from '@/services/api/classroomContracts';
import { listWithdrawalRuntimeSettings, type WithdrawalRuntimeSettings } from '@/services/api/withdrawalOperations';

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatYesNo(value: boolean): string {
  return value ? 'Enabled' : 'Disabled';
}

export function SystemSettingsPage(): JSX.Element {
  const { profile } = useAuth();
  const [adminConfig, setAdminConfig] = useState<AdminConsoleConfig | null>(null);
  const [communicationConfig, setCommunicationConfig] = useState<CommunicationConfig | null>(null);
  const [cmsConfig, setCmsConfig] = useState<CmsConfig | null>(null);
  const [fraudConfig, setFraudConfig] = useState<FraudDetectionConfig | null>(null);
  const [withdrawalSettings, setWithdrawalSettings] = useState<WithdrawalRuntimeSettings | null>(null);
  const [classroomSettings, setClassroomSettings] = useState<ClassroomRolloutSettings | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading project-wide system settings...');
  const [savingClassroom, setSavingClassroom] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listAdminConsoleConfig(),
      listCommunicationConfig(),
      listCmsConfig(),
      listFraudDetectionConfig(),
      listWithdrawalRuntimeSettings(),
      getClassroomRolloutSettings(),
    ])
      .then(([nextAdminConfig, nextCommunicationConfig, nextCmsConfig, nextFraudConfig, nextWithdrawalSettings, nextClassroomSettings]) => {
        if (!active) return;

        setAdminConfig(nextAdminConfig);
        setCommunicationConfig(nextCommunicationConfig);
        setCmsConfig(nextCmsConfig);
        setFraudConfig(nextFraudConfig);
        setWithdrawalSettings(nextWithdrawalSettings);
        setClassroomSettings(nextClassroomSettings);
        setStatusMessage('Synced live project-wide system settings.');
      })
      .catch(() => {
        if (!active) return;
        setStatusMessage('Unable to load live system settings right now.');
      });

    return () => {
      active = false;
    };
  }, []);

  const classroomSummary = useMemo(
    () => (classroomSettings ? `${formatYesNo(classroomSettings.enabled)} · Admin routes ${formatYesNo(classroomSettings.allowAdminRoutes)} · Learner routes ${formatYesNo(classroomSettings.allowLearnerRoutes)} · Cohort ${classroomSettings.cohort}` : 'Loading...'),
    [classroomSettings],
  );

  const enableClassroom = async (): Promise<void> => {
    if (!classroomSettings) {
      return;
    }

    setSavingClassroom(true);
    try {
      const nextSettings = await updateClassroomRolloutSettings({
        ...classroomSettings,
        enabled: true,
        allowAdminRoutes: true,
      }, profile?.id);
      setClassroomSettings(nextSettings);
      setStatusMessage('Classroom rollout enabled from system settings.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to enable classroom rollout.');
    } finally {
      setSavingClassroom(false);
    }
  };

  const toggleClassroom = async (patch: Partial<ClassroomRolloutSettings>): Promise<void> => {
    if (!classroomSettings) {
      return;
    }

    setSavingClassroom(true);
    try {
      const nextSettings = await updateClassroomRolloutSettings({ ...classroomSettings, ...patch }, profile?.id);
      setClassroomSettings(nextSettings);
      setStatusMessage('Classroom rollout settings updated.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update classroom rollout settings.');
    } finally {
      setSavingClassroom(false);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-accent/70">Project-wide system settings</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">System settings control plane</h1>
          <p className="text-base text-muted">Live settings from the platform configuration tables, including the classroom rollout toggle.</p>
          <p className="text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin console theme</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{adminConfig?.theme.palette ?? 'Loading...'}</p>
          <p className="mt-1 text-sm text-muted">Mode: {adminConfig?.theme.mode ?? 'Loading...'} · Font: {adminConfig?.theme.fontFamily ?? 'Loading...'}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">CMS scope</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{cmsConfig?.siteName ?? 'Loading...'}</p>
          <p className="mt-1 text-sm text-muted">{cmsConfig ? `${Object.keys(cmsConfig.pages).length} pages · ${cmsConfig.customPages.length} custom pages` : 'Loading live CMS configuration'}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Communication system</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{communicationConfig?.timezone ?? 'Loading...'}</p>
          <p className="mt-1 text-sm text-muted">Email {formatYesNo(Boolean(communicationConfig?.emailEnabled))} · Push {formatYesNo(Boolean(communicationConfig?.pushEnabled))} · SMS {formatYesNo(Boolean(communicationConfig?.smsEnabled))}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Withdrawal runtime</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">SLA {withdrawalSettings?.assignmentSlaHours ?? 'Loading...'}h</p>
          <p className="mt-1 text-sm text-muted">Reassignments {withdrawalSettings?.maxReassignments ?? 'Loading...'} · Auto assignment {formatYesNo(Boolean(withdrawalSettings?.enableAutoAssignment))}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Fraud thresholds</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">Review {fraudConfig?.thresholds.review ?? 'Loading...'}</p>
          <p className="mt-1 text-sm text-muted">Quarantine {fraudConfig?.thresholds.quarantine ?? 'Loading...'} · Block {fraudConfig?.thresholds.block ?? 'Loading...'}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom rollout</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{classroomSettings ? formatYesNo(classroomSettings.enabled) : 'Loading...'}</p>
          <p className="mt-1 text-sm text-muted">{classroomSummary}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Classroom admin control</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Enable the classroom feature</h2>
            <p className="text-sm text-muted">This control is available here even when the classroom routes are currently disabled in the environment.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Cohort</span>
              <select
                className="input-base"
                value={classroomSettings?.cohort ?? 'internal'}
                onChange={(event) => void toggleClassroom({ cohort: event.target.value as ClassroomRolloutSettings['cohort'] })}
                disabled={!classroomSettings || savingClassroom}
              >
                <option value="internal">Internal</option>
                <option value="beta">Beta</option>
                <option value="production">Production</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="button" onClick={() => void enableClassroom()} disabled={!classroomSettings || savingClassroom}>
                {classroomSettings?.enabled ? 'Classroom enabled' : 'Enable classroom'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" variant="ghost" onClick={() => void toggleClassroom({ allowAdminRoutes: !(classroomSettings?.allowAdminRoutes ?? false) })} disabled={!classroomSettings || savingClassroom}>
              {classroomSettings?.allowAdminRoutes ? 'Disable admin routes' : 'Enable admin routes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void toggleClassroom({ allowLearnerRoutes: !(classroomSettings?.allowLearnerRoutes ?? false) })} disabled={!classroomSettings || savingClassroom}>
              {classroomSettings?.allowLearnerRoutes ? 'Disable learner routes' : 'Enable learner routes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void toggleClassroom({ allowRewardPayouts: !(classroomSettings?.allowRewardPayouts ?? false) })} disabled={!classroomSettings || savingClassroom}>
              {classroomSettings?.allowRewardPayouts ? 'Disable reward payouts' : 'Enable reward payouts'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void toggleClassroom({ allowWalletTransfers: !(classroomSettings?.allowWalletTransfers ?? false) })} disabled={!classroomSettings || savingClassroom}>
              {classroomSettings?.allowWalletTransfers ? 'Disable wallet transfers' : 'Enable wallet transfers'}
            </Button>
          </div>

          <p className="text-xs text-muted">Schema versions: {classroomSettings?.eventSchemaVersion ?? 'Loading...'} · {classroomSettings?.apiSchemaVersion ?? 'Loading...'}</p>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Current status</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Live settings snapshot</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Admin console</p>
              <p className="mt-2 text-sm text-foreground">Theme {adminConfig?.theme.palette ?? 'Loading...'} · Customization loaded: {formatYesNo(Boolean(adminConfig?.customization))}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Communication</p>
              <p className="mt-2 text-sm text-foreground">Quiet hours {communicationConfig?.quietHoursStart ?? '--'} to {communicationConfig?.quietHoursEnd ?? '--'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Fraud policy</p>
              <p className="mt-2 text-sm text-foreground">Saved at {formatDateTime(fraudConfig?.savedAt)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">CMS publish</p>
              <p className="mt-2 text-sm text-foreground">Live pages: {cmsConfig ? Object.keys(cmsConfig.pages).length : 'Loading...'}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}