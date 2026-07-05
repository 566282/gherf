import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { describeFraudRiskChecks, fraudRiskChecks } from '@/services/api/fraud';
import { listCampaigns } from '@/services/api/campaigns';
import {
  createTaskDraft,
  getCampaignTaskViews,
  saveCampaignTask,
  taskViewToDraft,
  type TaskEngineFormValues,
  type TaskRequirementDraft,
} from '@/services/api/tasks';

const taskFamilies = [
  'Watch video',
  'Click advertisement',
  'Visit website',
  'Read article',
  'Install app',
  'Download file',
  'Complete survey',
  'Join Telegram',
  'Join WhatsApp',
  'Join Facebook',
  'Join Instagram',
  'Join Twitter/X',
  'Follow TikTok',
  'Subscribe YouTube',
  'Answer quiz',
  'Upload screenshot',
  'Manual approval',
  'Automatic verification',
  'Geo tasks',
  'QR code scan',
  'GPS verification',
  'Custom HTML task',
];

const taskTypeSuggestions = [
  'watch_video',
  'click_advertisement',
  'visit_website',
  'read_article',
  'install_app',
  'download_file',
  'complete_survey',
  'join_telegram',
  'join_whatsapp',
  'join_facebook',
  'join_instagram',
  'join_twitter_x',
  'follow_tiktok',
  'subscribe_youtube',
  'answer_quiz',
  'upload_screenshot',
  'manual_approval',
  'automatic_verification',
  'geo_task',
  'qr_code_scan',
  'gps_verification',
  'custom_html_task',
];

const verificationSuggestions = [
  'automatic_verification',
  'manual_review',
  'screenshot_upload',
  'video_proof',
  'link_validation',
  'api_verification',
  'timer_verification',
  'random_audit',
];

const fraudSuggestions = [...fraudRiskChecks];

const taskContract = [
  { label: 'Reward', description: 'Per-completion payout with budget-aware accounting.' },
  { label: 'Requirements', description: 'Task-specific proof, steps, or eligibility constraints.' },
  { label: 'Cooldown', description: 'Delay before the same user can repeat the task.' },
  { label: 'Maximum attempts', description: 'Per-user or global completion cap.' },
  { label: 'Verification method', description: 'Automatic, manual, proof-based, or API-backed review.' },
  { label: 'Fraud checks', description: 'Duplicate, VPN, proxy, and bot risk controls.' },
  { label: 'Task expiration', description: 'Expiry window for scheduled or time-bound tasks.' },
];

const extensibilityNotes = [
  'Task types are stored as free-form strings, so new task families do not require code changes.',
  'Requirements and engine settings live in JSON-backed metadata, which lets each task define its own shape.',
  'Verification and fraud controls are data-driven and can be combined per task.',
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function stringifyPayload(values: TaskEngineFormValues) {
  const requirements = values.requirements
    .filter((item) => item.key.trim().length || item.label.trim().length || item.value.trim().length)
    .map((item) => ({
      key: item.key.trim() || item.label.trim() || 'requirement',
      label: item.label.trim() || item.key.trim() || 'Requirement',
      value: item.value.trim(),
    }));

  return JSON.stringify(
    {
      campaignId: values.campaignId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      taskType: values.taskType.trim(),
      mediaUrl: values.mediaUrl.trim() || null,
      rewardAmount: values.rewardAmount,
      requirements,
      cooldownSeconds: values.cooldownSeconds,
      maximumAttempts: values.maximumAttempts,
      verificationMethod: values.verificationMethod.trim(),
      fraudChecks: values.fraudChecksText.split(',').map((item) => item.trim()).filter(Boolean),
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      taskConfig: values.taskConfigText ? JSON.parse(values.taskConfigText) : {},
      maxCompletions: values.maxCompletions,
      status: values.status,
    },
    null,
    2,
  );
}

export function TaskEnginePage(): JSX.Element {
  const { data: campaigns = [] } = useQuery({
    queryKey: ['task-engine-campaigns'],
    queryFn: listCampaigns,
  });

  const { data: taskGroups = [], refetch: refetchTasks } = useQuery({
    queryKey: ['task-engine-tasks'],
    queryFn: async () => {
      const views = await Promise.all((await listCampaigns()).map((campaign) => getCampaignTaskViews(campaign.id)));
      return views.flat();
    },
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskEngineFormValues>(createTaskDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('Ready to create a task definition.');

  useEffect(() => {
    if (!campaigns.length || draft.campaignId) return;
    setDraft((current) => ({ ...current, campaignId: campaigns[0].id }));
  }, [campaigns, draft.campaignId]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === draft.campaignId) ?? campaigns[0] ?? null;
  const selectedTask = taskGroups.find((task) => task.id === selectedTaskId) ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => saveCampaignTask(draft, selectedTaskId ?? undefined),
    onSuccess: async (savedTask) => {
      setFormError(null);
      setSavedMessage(`Saved ${savedTask.title} as ${savedTask.taskType}.`);
      setSelectedTaskId(savedTask.id);
      setDraft(taskViewToDraft(savedTask));
      await refetchTasks();
    },
    onError: (error) => {
      setSavedMessage('');
      setFormError(error instanceof Error ? error.message : 'Unable to save task.');
    },
  });

  useEffect(() => {
    if (!selectedTask) return;
    setDraft(taskViewToDraft(selectedTask));
    setFormError(null);
    setSavedMessage(`Editing ${selectedTask.title}.`);
  }, [selectedTask]);

  const payloadPreview = useMemo(() => {
    try {
      return stringifyPayload(draft);
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid JSON task config.';
    }
  }, [draft]);

  const fraudBlockReasons = useMemo(() => describeFraudRiskChecks(draft.fraudChecksText.split(',').map((item) => item.trim()).filter(Boolean)), [draft.fraudChecksText]);

  const requirementCount = draft.requirements.filter((item) => item.key.trim().length || item.label.trim().length || item.value.trim().length).length;

  const updateRequirement = (index: number, key: keyof TaskRequirementDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement, requirementIndex) =>
        requirementIndex === index ? { ...requirement, [key]: value } : requirement,
      ),
    }));
  };

  const addRequirement = () => {
    setDraft((current) => ({
      ...current,
      requirements: [...current.requirements, { key: `requirement-${current.requirements.length + 1}`, label: '', value: '' }],
    }));
  };

  const removeRequirement = (index: number) => {
    setDraft((current) => {
      const nextRequirements = current.requirements.filter((_, requirementIndex) => requirementIndex !== index);
      return { ...current, requirements: nextRequirements.length ? nextRequirements : [{ key: 'requirement-1', label: '', value: '' }] };
    });
  };

  const resetDraft = () => {
    const nextCampaignId = campaigns[0]?.id ?? '';
    setDraft(createTaskDraft(nextCampaignId));
    setSelectedTaskId(null);
    setFormError(null);
    setSavedMessage('Starting a new task definition.');
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="space-y-4 border border-border bg-surface-elevated p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Universal task engine</p>
        <h1 className="text-3xl font-semibold text-foreground">Admin can create any task</h1>
        <p className="max-w-4xl text-sm text-muted">
          The editor is data-driven: define the task type, reward, requirements, verification rules, fraud checks, and expiry,
          then save the row directly to Supabase.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/business/campaigns/new" className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:border-accent/50 hover:text-accent">
            Create a campaign
          </Link>
          <Link to="/admin/verification" className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:border-accent/50 hover:text-accent">
            Review verification flow
          </Link>
          <Button variant="ghost" onClick={resetDraft}>
            New task
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Supported families</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{taskFamilies.length}</p>
          <p className="mt-2 text-sm text-muted">Examples plus custom task definitions.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Existing tasks</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{taskGroups.length}</p>
          <p className="mt-2 text-sm text-muted">Loaded from the current Supabase campaigns.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Requirements</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{requirementCount}</p>
          <p className="mt-2 text-sm text-muted">Repeatable, task-specific constraints.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Extensibility model</p>
          <p className="mt-2 text-3xl font-bold text-foreground">JSON</p>
          <p className="mt-2 text-sm text-muted">The task payload can evolve without code changes.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6 border border-border bg-surface-elevated p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Task editor</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Create or edit a task</h2>
              <p className="mt-2 text-sm text-muted">Select a task to edit it, or start a fresh draft for a new task definition.</p>
            </div>
            <div className="min-w-[240px] space-y-2">
              <label className="block text-xs uppercase tracking-[0.2em] text-muted">Edit existing task</label>
              <select
                className="input-base"
                value={selectedTaskId ?? ''}
                onChange={(event) => {
                  const nextTaskId = event.target.value || null;
                  setSelectedTaskId(nextTaskId);
                  const nextTask = taskGroups.find((task) => task.id === nextTaskId);
                  if (nextTask) setDraft(taskViewToDraft(nextTask));
                }}
              >
                <option value="">Start new task</option>
                {taskGroups.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} · {task.taskType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Campaign</span>
              <select className="input-base" value={draft.campaignId} onChange={(event) => setDraft((current) => ({ ...current, campaignId: event.target.value }))}>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title} · {campaign.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Task type</span>
              <input
                className="input-base"
                value={draft.taskType}
                onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value }))}
                placeholder="qr_code_scan"
              />
              <div className="flex flex-wrap gap-2">
                {taskTypeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, taskType: suggestion }))}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Title</span>
              <input className="input-base" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Join Telegram and verify membership" />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Description</span>
              <textarea className="input-base min-h-24" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Short summary of the task" />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Media URL</span>
              <input className="input-base" value={draft.mediaUrl} onChange={(event) => setDraft((current) => ({ ...current, mediaUrl: event.target.value }))} placeholder="https://..." />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Reward amount</span>
              <input type="number" step="0.01" className="input-base" value={draft.rewardAmount} onChange={(event) => setDraft((current) => ({ ...current, rewardAmount: Number(event.target.value) }))} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Status</span>
              <select className="input-base" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskEngineFormValues['status'] }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Cooldown seconds</span>
              <input type="number" className="input-base" value={draft.cooldownSeconds} onChange={(event) => setDraft((current) => ({ ...current, cooldownSeconds: Number(event.target.value) }))} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Maximum attempts</span>
              <input type="number" className="input-base" value={draft.maximumAttempts ?? ''} onChange={(event) => setDraft((current) => ({ ...current, maximumAttempts: event.target.value === '' ? null : Number(event.target.value) }))} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Verification method</span>
              <input className="input-base" value={draft.verificationMethod} onChange={(event) => setDraft((current) => ({ ...current, verificationMethod: event.target.value }))} placeholder="manual_review" />
              <div className="flex flex-wrap gap-2">
                {verificationSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setDraft((current) => ({ ...current, verificationMethod: suggestion }))} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-accent">
                    {suggestion}
                  </button>
                ))}
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Fraud checks</span>
              <textarea
                className="input-base min-h-24"
                value={draft.fraudChecksText}
                onChange={(event) => setDraft((current) => ({ ...current, fraudChecksText: event.target.value }))}
                placeholder="fraud_detection, duplicate_detection"
              />
              <div className="flex flex-wrap gap-2">
                {fraudSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setDraft((current) => ({ ...current, fraudChecksText: current.fraudChecksText ? `${current.fraudChecksText}, ${suggestion}` : suggestion }))} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-accent">
                    {suggestion}
                  </button>
                ))}
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Maximum completions</span>
              <input type="number" className="input-base" value={draft.maxCompletions ?? ''} onChange={(event) => setDraft((current) => ({ ...current, maxCompletions: event.target.value === '' ? null : Number(event.target.value) }))} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Expires at</span>
              <input type="datetime-local" className="input-base" value={draft.expiresAt} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))} />
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Requirements</p>
                <p className="text-xs text-muted">Add as many requirement rows as the task needs.</p>
              </div>
              <Button variant="ghost" onClick={addRequirement}>
                Add requirement
              </Button>
            </div>
            <div className="space-y-3">
              {draft.requirements.map((requirement, index) => (
                <div key={`${requirement.key}-${index}`} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input className="input-base" value={requirement.key} onChange={(event) => updateRequirement(index, 'key', event.target.value)} placeholder="location" />
                  <input className="input-base" value={requirement.label} onChange={(event) => updateRequirement(index, 'label', event.target.value)} placeholder="Scan only on site" />
                  <input className="input-base" value={requirement.value} onChange={(event) => updateRequirement(index, 'value', event.target.value)} placeholder="optional value" />
                  <button type="button" onClick={() => removeRequirement(index)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted transition hover:border-rose-500/40 hover:text-rose-300">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Task config JSON</span>
              <textarea className="input-base min-h-56 font-mono text-sm" value={draft.taskConfigText} onChange={(event) => setDraft((current) => ({ ...current, taskConfigText: event.target.value }))} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void saveMutation.mutateAsync()}>Save task</Button>
            <Button variant="ghost" onClick={resetDraft}>
              Reset draft
            </Button>
          </div>

          <div className="space-y-2">
            {savedMessage ? <p className="text-sm text-mint">{savedMessage}</p> : null}
            {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 border border-border bg-surface-elevated p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Payload preview</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">What will be saved</h2>
              <p className="mt-2 text-sm text-muted">This preview reflects the live form and shows the shape the runtime will consume.</p>
            </div>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-background p-4 text-xs text-foreground">{payloadPreview}</pre>
            <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted">
              <p><span className="text-foreground">Campaign:</span> {selectedCampaign ? selectedCampaign.title : 'No campaign selected'}</p>
              <p><span className="text-foreground">Task family:</span> {taskFamilies.find((item) => item.toLowerCase().includes(draft.taskType.replace(/_/g, ' '))) ?? draft.taskType}</p>
              <p><span className="text-foreground">Requirements:</span> {requirementCount}</p>
              <p><span className="text-foreground">Expires:</span> {draft.expiresAt ? formatDateTime(draft.expiresAt) : 'No expiration'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">Blocked reasons</p>
              <p className="mt-1 text-xs text-muted">The same reasons will be shown when this task is refused by policy.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fraudBlockReasons.length ? (
                  fraudBlockReasons.map((reason) => (
                    <span key={reason} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
                      {reason}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    No fraud checks selected
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 border border-border bg-surface-elevated p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Task families</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Admin-ready examples</h2>
              <p className="mt-2 text-sm text-muted">These are examples, not a closed list. The engine accepts future task types with matching metadata.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {taskFamilies.map((task) => (
                <div key={task} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                  {task}
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 border border-border bg-surface-elevated p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Existing tasks</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Quick edit queue</h2>
            </div>
            <div className="space-y-3">
              {taskGroups.slice(0, 8).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setDraft(taskViewToDraft(task));
                  }}
                  className="w-full rounded-2xl border border-border bg-background p-4 text-left transition hover:border-accent/50 hover:text-accent"
                >
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{task.taskType}</p>
                  <p className="mt-2 text-sm text-muted">
                    {task.campaignTitle} · {task.status} · Reward ${task.rewardAmount.toFixed(2)}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Engine contract</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Every task carries the same core fields</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {taskContract.map((field) => (
            <div key={field.label} className="rounded-2xl border border-border bg-background p-4">
              <p className="font-medium text-foreground">{field.label}</p>
              <p className="mt-1 text-sm text-muted">{field.description}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 text-sm text-muted">
          {extensibilityNotes.map((note) => (
            <p key={note} className="rounded-2xl border border-border bg-background p-4 text-foreground/85">
              {note}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}