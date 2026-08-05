import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import {
  adminResolveWithdrawalAction,
  buildWithdrawalMonitoringSummary,
  DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS,
  listAssignableMerchants,
  listWithdrawalOperationsQueue,
  listWithdrawalRuntimeSettings,
  listWithdrawalStateDictionary,
  processWithdrawalAssignmentTimeouts,
  updateWithdrawalRuntimeSettings,
  type WithdrawalAdminAction,
  type WithdrawalRuntimeSettings,
} from '@/services/api/withdrawalOperations';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function riskTone(level: string): string {
  if (level === 'critical' || level === 'high') return 'text-rose-300 border-rose-500/20 bg-rose-500/10';
  if (level === 'medium') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
}

export function WithdrawalApprovalPage(): JSX.Element {
  const { user } = useAuth();
  const [selectedStateFilter, setSelectedStateFilter] = useState<'all' | string>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
  const [action, setAction] = useState<WithdrawalAdminAction>('approve');
  const [merchantId, setMerchantId] = useState('');
  const [autoAssignmentEnabled, setAutoAssignmentEnabled] = useState(false);
  const [note, setNote] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<WithdrawalRuntimeSettings>(DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingTimeouts, setIsProcessingTimeouts] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['withdrawal-operations-dashboard'],
    queryFn: async () => {
      const [states, queue, merchants, runtimeSettings] = await Promise.all([
        listWithdrawalStateDictionary(),
        listWithdrawalOperationsQueue({
          limit: 120,
          stateKeys: selectedStateFilter === 'all' ? undefined : [selectedStateFilter],
          riskLevels: selectedRiskFilter === 'all' ? undefined : [selectedRiskFilter],
        }),
        listAssignableMerchants(120),
        listWithdrawalRuntimeSettings(),
      ]);

      return { states, queue, merchants, runtimeSettings };
    },
    staleTime: 30_000,
    retry: false,
  });

  const queue = data?.queue ?? [];
  const states = data?.states ?? [];
  const merchants = data?.merchants ?? [];
  const runtimeSettings = data?.runtimeSettings ?? DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS;

  useEffect(() => {
    setSettingsDraft(runtimeSettings);
  }, [runtimeSettings]);

  const selectedItem = useMemo(
    () => queue.find((item) => item.withdrawalRequestId === selectedWithdrawalId) ?? null,
    [queue, selectedWithdrawalId],
  );

  const canSubmit = Boolean(selectedItem) && Boolean(user?.id) && !isSubmitting;

  const monitoringSummary = useMemo(
    () => buildWithdrawalMonitoringSummary(queue, runtimeSettings),
    [queue, runtimeSettings],
  );

  const handleRunAction = async (): Promise<void> => {
    if (!selectedItem) {
      setStatusMessage('Select a withdrawal request first.');
      return;
    }

    if (!user?.id) {
      setStatusMessage('Admin identity is not available for this action.');
      return;
    }

    if (action === 'approve' && !autoAssignmentEnabled && !merchantId.trim()) {
      setStatusMessage('Approving requires merchant selection unless auto-assignment is explicitly enabled.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const idempotencyKey = [
        action,
        selectedItem.withdrawalRequestId,
        selectedItem.stateVersion,
        Date.now(),
      ].join(':');

      const result = await adminResolveWithdrawalAction({
        withdrawalRequestId: selectedItem.withdrawalRequestId,
        action,
        actorUserId: user.id,
        note: note.trim() || undefined,
        merchantId: action === 'approve' && !autoAssignmentEnabled ? merchantId : null,
        autoAssignmentEnabled: action === 'approve' ? autoAssignmentEnabled : false,
        idempotencyKey,
      });

      setStatusMessage(
        action === 'approve'
          ? `Withdrawal approved. State: ${result.withdrawalStateKey}${result.assignmentId ? ' with merchant assignment.' : ' with auto-assignment queue enabled.'}`
          : action === 'reject'
            ? `Withdrawal rejected. State: ${result.withdrawalStateKey}.`
            : `Withdrawal moved to fraud review. State: ${result.withdrawalStateKey}.`,
      );

      setNote('');
      await refetch();
    } catch (runError) {
      setStatusMessage(runError instanceof Error ? runError.message : 'Unable to run withdrawal action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessTimeouts = async (): Promise<void> => {
    setIsProcessingTimeouts(true);
    setStatusMessage(null);

    try {
      const result = await processWithdrawalAssignmentTimeouts(120);
      setStatusMessage(
        `Timeout processor complete. processed=${result.processedCount} reassigned=${result.reassignedCount} failedNoLiquidity=${result.failedNoLiquidityCount}.`,
      );
      await refetch();
    } catch (runError) {
      setStatusMessage(runError instanceof Error ? runError.message : 'Unable to process assignment timeouts.');
    } finally {
      setIsProcessingTimeouts(false);
    }
  };

  const handleSaveSettings = async (): Promise<void> => {
    setIsSavingSettings(true);
    setStatusMessage(null);

    try {
      await updateWithdrawalRuntimeSettings(settingsDraft);
      setStatusMessage('Withdrawal rollout controls updated.');
      await refetch();
    } catch (runError) {
      setStatusMessage(runError instanceof Error ? runError.message : 'Unable to update withdrawal rollout controls.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (error) {
    return (
      <Card className="border border-border bg-surface-elevated p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Withdrawal operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Unable to load withdrawal queue</h1>
        <p className="mt-2 text-sm text-muted">The withdrawal operations dashboard could not load from Supabase.</p>
        <Button className="mt-4" onClick={() => void refetch()}>Retry</Button>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-44" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Withdrawal operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Live admin withdrawal operations dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Process withdrawal requests with state-aware actions, risk context, and merchant assignment controls.
        </p>
        {statusMessage ? <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-sm text-muted">Queue size</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{monitoringSummary.queueSize}</p>
          </div>
          <div>
            <p className="text-sm text-muted">High risk items</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{monitoringSummary.highRiskItems}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Needs manual merchant assignment</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{monitoringSummary.manualAssignments}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Timed out / overdue</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{monitoringSummary.overdueAssignments}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Reminder due</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{monitoringSummary.reminderDueCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            <p className="font-semibold text-foreground">Pending assignment work</p>
            <p className="mt-2">Assigned/accepted items: {monitoringSummary.pendingAssignments}</p>
            <p className="mt-1">Dispute escalation due: {monitoringSummary.disputeEscalationDueCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            <p className="font-semibold text-foreground">Rollout toggles</p>
            <p className="mt-2">Auto-assignment: {monitoringSummary.autoAssignmentEnabled ? 'enabled' : 'disabled'}</p>
            <p className="mt-1">Duplicate prevention: {monitoringSummary.duplicatePreventionEnabled ? 'enabled' : 'disabled'}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-surface px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">W6-W8 rollout controls</p>
              <p className="text-sm text-muted">Tune SLA windows, reminder cadence, reassignment limits, and fraud guard toggles without code changes.</p>
            </div>
            <Button onClick={() => void handleSaveSettings()} disabled={isSavingSettings}>
              {isSavingSettings ? 'Saving...' : 'Save controls'}
            </Button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Assignment SLA (hours)</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={settingsDraft.assignmentSlaHours}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, assignmentSlaHours: Number(event.target.value) || 1 }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Reminder cadence (hours, comma separated)</span>
              <input
                className="input-base"
                value={settingsDraft.reminderCadenceHours.join(',')}
                onChange={(event) => setSettingsDraft((current) => ({
                  ...current,
                  reminderCadenceHours: event.target.value.split(',').map((entry) => Number(entry.trim()) || 0).filter((entry) => entry > 0),
                }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Max reassignments</span>
              <input
                className="input-base"
                type="number"
                min="0"
                value={settingsDraft.maxReassignments}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, maxReassignments: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Dispute escalation (hours)</span>
              <input
                className="input-base"
                type="number"
                min="1"
                value={settingsDraft.disputeAutoEscalationHours}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, disputeAutoEscalationHours: Number(event.target.value) || 1 }))}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settingsDraft.enableAutoAssignment}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, enableAutoAssignment: event.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
              />
              <span>Enable auto-assignment fallback</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settingsDraft.enableDuplicatePrevention}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, enableDuplicatePrevention: event.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
              />
              <span>Enable duplicate prevention and evidence guards</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settingsDraft.reminderNotificationsEnabled}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, reminderNotificationsEnabled: event.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
              />
              <span>Send reminder notifications</span>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-muted">State filter</span>
            <select
              className="input-base"
              value={selectedStateFilter}
              onChange={(event) => setSelectedStateFilter(event.target.value)}
            >
              <option value="all">All states</option>
              {states.map((state) => (
                <option key={state.stateKey} value={state.stateKey}>{state.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Risk filter</span>
            <select
              className="input-base"
              value={selectedRiskFilter}
              onChange={(event) => setSelectedRiskFilter(event.target.value as 'all' | 'low' | 'medium' | 'high' | 'critical')}
            >
              <option value="all">All risk levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void refetch()}>Refresh queue</Button>
            <Button variant="ghost" disabled={isProcessingTimeouts} onClick={() => void handleProcessTimeouts()}>
              {isProcessingTimeouts ? 'Processing timeouts...' : 'Run timeout reassignment now'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated p-6">
        <h2 className="text-2xl font-semibold text-foreground">Pending queue</h2>
        <p className="mt-2 text-sm text-muted">Columns include risk, destination/bank details, assignment state, and merchant ownership.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted">
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Destination / Bank</th>
                <th className="px-3 py-2">Workflow state</th>
                <th className="px-3 py-2">Assigned merchant</th>
                <th className="px-3 py-2">Assignment SLA</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.length ? queue.map((item) => {
                const selected = selectedWithdrawalId === item.withdrawalRequestId;
                return (
                  <tr key={item.withdrawalRequestId} className={`border-b border-border/70 ${selected ? 'bg-accent/10' : ''}`}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{item.userDisplayName}</p>
                      <p className="text-xs text-muted">{item.userEmail ?? item.userId}</p>
                      <p className="text-xs text-muted">{formatDate(item.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{formatCurrency(item.amount, item.currency)}</p>
                      <p className="text-xs text-muted">Method: {item.method}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${riskTone(item.riskLevel)}`}>
                        {item.riskLevel.toUpperCase()} ({item.riskScore.toFixed(2)})
                      </span>
                      <p className="mt-2 text-xs text-muted">Compliance: {item.complianceState ?? 'n/a'}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{item.destinationLabel}</p>
                      <p className="text-xs text-muted break-all">{item.destinationValue || '-'}</p>
                      <p className="text-xs text-muted">Scheduled: {formatDate(item.scheduledFor)}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{item.workflowStateLabel}</p>
                      <p className="text-xs text-muted">Legacy: {item.legacyStatus}</p>
                      <p className="text-xs text-muted">Version: {item.stateVersion}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{item.assignedMerchantName ?? 'Unassigned'}</p>
                      <p className="text-xs text-muted">{item.assignedMerchantCode ?? '-'}</p>
                      <p className="text-xs text-muted">{item.assignmentStatus ?? 'n/a'}</p>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted">
                      {formatDate(item.assignmentDueAt)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedWithdrawalId(item.withdrawalRequestId);
                          if (item.assignedMerchantId) {
                            setMerchantId(item.assignedMerchantId);
                          }
                        }}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-3 py-4 text-sm text-muted" colSpan={8}>No withdrawal queue items match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated p-6">
        <h2 className="text-2xl font-semibold text-foreground">Selected withdrawal actions</h2>
        <p className="mt-2 text-sm text-muted">
          Approve/reject/fraud-review with mandatory merchant selection or explicit auto-assignment toggle.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Selected request</p>
            {selectedItem ? (
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p><span className="text-muted">User:</span> {selectedItem.userDisplayName}</p>
                <p><span className="text-muted">Amount:</span> {formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                <p><span className="text-muted">State:</span> {selectedItem.workflowStateLabel}</p>
                <p><span className="text-muted">Destination:</span> {selectedItem.destinationLabel}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Select a queue row to run an action.</p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Action</span>
              <select className="input-base" value={action} onChange={(event) => setAction(event.target.value as WithdrawalAdminAction)}>
                <option value="approve">Approve withdrawal</option>
                <option value="reject">Reject withdrawal</option>
                <option value="fraud_review">Move to fraud review</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={autoAssignmentEnabled}
                disabled={action !== 'approve'}
                onChange={(event) => setAutoAssignmentEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
              />
              <span>Enable auto-assignment instead of manual merchant selection</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Merchant selection (required if auto-assignment is off)</span>
              <select
                className="input-base"
                disabled={action !== 'approve' || autoAssignmentEnabled}
                value={merchantId}
                onChange={(event) => setMerchantId(event.target.value)}
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.displayName || merchant.legalName || merchant.merchantCode} ({merchant.merchantCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Admin note</span>
              <textarea
                className="input-base min-h-24"
                placeholder="Enter review notes or rejection/fraud context."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>

            <div className="flex gap-3">
              <Button disabled={!canSubmit} onClick={() => void handleRunAction()}>
                {isSubmitting ? 'Processing...' : 'Apply action'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setAction('approve');
                  setAutoAssignmentEnabled(false);
                  setMerchantId('');
                  setNote('');
                }}
                variant="ghost"
              >
                Reset form
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
