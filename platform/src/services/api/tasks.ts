import { supabase } from '@/services/supabase/client';
import type {
  Campaign,
  CampaignEngineConfig,
  CampaignTask,
  TaskSubmission,
  VerificationEvidenceType,
  VerificationRiskCheck,
} from '@/types';

type TaskRow = {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  task_type: string;
  media_url: string | null;
  reward_amount: number | string;
  requirements: JsonValue | null;
  cooldown_seconds: number | string | null;
  maximum_attempts: number | null;
  verification_method: string | null;
  fraud_checks: JsonValue | null;
  expires_at: string | null;
  task_config: JsonValue | null;
  max_completions: number | null;
  current_completions: number | null;
  status: CampaignTask['status'];
  created_at: string;
  updated_at: string;
};

type CampaignRow = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  campaign_type: Campaign['campaignType'];
  instructions: string | null;
  engine_config: CampaignEngineConfig | null;
  status: Campaign['status'];
  start_date: string;
  end_date: string;
  budget: number | string;
  budget_currency: string | null;
  total_rewards_allocated: number | string | null;
  max_participants: number | null;
  current_participants: number | null;
  created_at: string;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  task_id: string;
  user_id: string;
  submission_data: Record<string, unknown> | null;
  status: TaskSubmission['status'];
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type RewardRow = {
  id: string;
  user_id: string;
  campaign_id: string;
  task_id: string | null;
  submission_id: string | null;
  amount: number | string;
  currency: string;
  status: 'pending' | 'approved' | 'claimed' | 'refunded';
  created_at: string;
  updated_at: string;
};

export interface CampaignTaskView {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignStatus: Campaign['status'];
  campaignType: Campaign['campaignType'];
  campaignInstructions: string;
  campaignBudgetCurrency: string;
  title: string;
  description?: string;
  taskType: CampaignTask['taskType'];
  mediaUrl?: string;
  rewardAmount: number;
  requirements: CampaignTask['requirements'];
  cooldownSeconds: number;
  maximumAttempts: number | null;
  verificationMethod: CampaignTask['verificationMethod'];
  fraudChecks: CampaignTask['fraudChecks'];
  expiresAt: string | null;
  taskConfig: CampaignTask['taskConfig'];
  maxCompletions?: number;
  currentCompletions: number;
  status: CampaignTask['status'];
  createdAt: string;
  updatedAt: string;
  userSubmission?: TaskSubmissionView | null;
}

export interface TaskSubmissionView {
  id: string;
  taskId: string;
  userId: string;
  submissionData: Record<string, unknown>;
  status: TaskSubmission['status'];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionReviewItem {
  submission: TaskSubmissionView;
  task: CampaignTaskView;
  campaignBudgetCurrency: string;
}

export interface TaskRequirementDraft {
  key: string;
  label: string;
  value: string;
}

export interface TaskEngineFormValues {
  campaignId: string;
  title: string;
  description: string;
  taskType: string;
  mediaUrl: string;
  rewardAmount: number;
  requirements: TaskRequirementDraft[];
  cooldownSeconds: number;
  maximumAttempts: number | null;
  verificationMethod: string;
  fraudChecksText: string;
  expiresAt: string;
  taskConfigText: string;
  maxCompletions: number | null;
  status: CampaignTask['status'];
}

function createEmptyRequirement(index = 1): TaskRequirementDraft {
  return {
    key: `requirement-${index}`,
    label: '',
    value: '',
  };
}

export function createTaskDraft(campaignId = '', taskType = 'custom_html_task'): TaskEngineFormValues {
  return {
    campaignId,
    title: '',
    description: '',
    taskType,
    mediaUrl: '',
    rewardAmount: 1,
    requirements: [createEmptyRequirement()],
    cooldownSeconds: 0,
    maximumAttempts: 1,
    verificationMethod: 'manual_review',
    fraudChecksText: 'fraud_detection, duplicate_detection',
    expiresAt: '',
    taskConfigText: '{\n  "instructions": ""\n}',
    maxCompletions: 1,
    status: 'draft',
  };
}

export function taskViewToDraft(task: CampaignTaskView): TaskEngineFormValues {
  return {
    campaignId: task.campaignId,
    title: task.title,
    description: task.description ?? '',
    taskType: task.taskType,
    mediaUrl: task.mediaUrl ?? '',
    rewardAmount: task.rewardAmount,
    requirements: task.requirements.length
      ? task.requirements.map((requirement, index) => ({
          key: requirement.key || `requirement-${index + 1}`,
          label: requirement.label,
          value: requirement.value == null ? '' : Array.isArray(requirement.value) ? requirement.value.join(', ') : String(requirement.value),
        }))
      : [createEmptyRequirement()],
    cooldownSeconds: task.cooldownSeconds,
    maximumAttempts: task.maximumAttempts,
    verificationMethod: task.verificationMethod,
    fraudChecksText: task.fraudChecks.join(', '),
    expiresAt: task.expiresAt ? toLocalInputValue(task.expiresAt) : '',
    taskConfigText: JSON.stringify(task.taskConfig, null, 2),
    maxCompletions: task.maxCompletions ?? null,
    status: task.status,
  };
}

function toLocalInputValue(value: string): string {
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseRequirementValue(value: string): string | number | boolean | string[] | null {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed === String(Number(trimmed))) return Number(trimmed);
  if (trimmed.includes(',')) return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  return trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim().length) return {};

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Task configuration must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

function serializeTaskRequirements(requirements: TaskRequirementDraft[]): CampaignTask['requirements'] {
  return requirements
    .filter((requirement) => requirement.key.trim().length || requirement.label.trim().length || requirement.value.trim().length)
    .map((requirement) => ({
      key: requirement.key.trim() || requirement.label.trim() || 'requirement',
      label: requirement.label.trim() || requirement.key.trim() || 'Requirement',
      value: parseRequirementValue(requirement.value),
    }));
}

function serializeFraudChecks(text: string): CampaignTask['fraudChecks'] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTaskPayload(form: TaskEngineFormValues) {
  return {
    campaign_id: form.campaignId,
    title: form.title.trim(),
    description: form.description.trim() || null,
    task_type: form.taskType.trim(),
    media_url: form.mediaUrl.trim() || null,
    reward_amount: form.rewardAmount,
    requirements: serializeTaskRequirements(form.requirements),
    cooldown_seconds: form.cooldownSeconds,
    maximum_attempts: form.maximumAttempts,
    verification_method: form.verificationMethod.trim(),
    fraud_checks: serializeFraudChecks(form.fraudChecksText),
    expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    task_config: parseJsonObject(form.taskConfigText),
    max_completions: form.maxCompletions,
    status: form.status,
  };
}

async function hydrateTaskView(taskId: string): Promise<CampaignTaskView> {
  const bundle = await loadTaskBundle(taskId);
  if (!bundle) throw new Error('Task not found.');

  return mapTaskRow(bundle.task, bundle.campaign);
}

export async function getCampaignTask(taskId: string): Promise<CampaignTaskView | null> {
  try {
    return await hydrateTaskView(taskId);
  } catch {
    return null;
  }
}

export async function saveCampaignTask(form: TaskEngineFormValues, taskId?: string): Promise<CampaignTaskView> {
  const payload = buildTaskPayload(form);
  const query = taskId
    ? supabase.from('campaign_tasks').update(payload).eq('id', taskId)
    : supabase.from('campaign_tasks').insert(payload);

  const { data, error } = await query.select('id').single<{ id: string }>();
  if (error) throw error;

  return hydrateTaskView(data.id);
}

function mapTaskRow(row: TaskRow, campaign: CampaignRow): CampaignTaskView {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: campaign.title,
    campaignStatus: campaign.status,
    campaignType: campaign.campaign_type,
    campaignInstructions: campaign.instructions ?? '',
    campaignBudgetCurrency: campaign.budget_currency ?? 'USD',
    title: row.title,
    description: row.description ?? undefined,
    taskType: row.task_type,
    mediaUrl: row.media_url ?? undefined,
    rewardAmount: Number(row.reward_amount),
    requirements: normalizeRequirements(row.requirements),
    cooldownSeconds: Number(row.cooldown_seconds ?? 0),
    maximumAttempts: row.maximum_attempts ?? row.max_completions ?? null,
    verificationMethod: typeof row.verification_method === 'string' && row.verification_method.trim().length ? row.verification_method : campaign.engine_config?.verificationMethod ?? 'manual_review',
    fraudChecks: normalizeFraudChecks(row.fraud_checks),
    expiresAt: row.expires_at,
    taskConfig: normalizeTaskConfig(row.task_config),
    maxCompletions: row.max_completions ?? undefined,
    currentCompletions: row.current_completions ?? 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmissionRow(row: SubmissionRow): TaskSubmissionView {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    submissionData: row.submission_data ?? {},
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRewardRow(row: RewardRow) {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    taskId: row.task_id ?? undefined,
    submissionId: row.submission_id ?? undefined,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRequirements(value: JsonValue | null): CampaignTask['requirements'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      return [{ key: `requirement-${index + 1}`, label: entry }];
    }

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, JsonValue>;
      const key = typeof record.key === 'string' ? record.key : `requirement-${index + 1}`;
      const label = typeof record.label === 'string' ? record.label : key;
      const value = Object.prototype.hasOwnProperty.call(record, 'value')
        ? (record.value as string | number | boolean | string[] | null)
        : null;

      return [{ key, label, value }];
    }

    return [];
  });
}

function normalizeFraudChecks(value: JsonValue | null): CampaignTask['fraudChecks'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []));
}

function normalizeTaskConfig(value: JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return value as Record<string, unknown>;
}

async function loadCampaignsForTasks(taskRows: TaskRow[]): Promise<CampaignRow[]> {
  const campaignIds = [...new Set(taskRows.map((row) => row.campaign_id))];
  if (campaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from('campaigns')
    .select('id,business_id,title,description,banner_url,campaign_type,instructions,engine_config,status,start_date,end_date,budget,budget_currency,total_rewards_allocated,max_participants,current_participants,created_at,updated_at')
    .in('id', campaignIds);

  if (error) throw error;
  return (data ?? []) as CampaignRow[];
}

async function loadUserSubmissions(taskIds: string[], userId: string): Promise<TaskSubmissionView[]> {
  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from('task_submissions')
    .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at')
    .eq('user_id', userId)
    .in('task_id', taskIds);

  if (error) throw error;
  return (data ?? []).map((row) => mapSubmissionRow(row as SubmissionRow));
}

async function loadSubmissionRewards(submissionIds: string[]): Promise<Map<string, RewardRow>> {
  if (submissionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('rewards')
    .select('id,user_id,campaign_id,task_id,submission_id,amount,currency,status,created_at,updated_at')
    .in('submission_id', submissionIds);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [(row as RewardRow).submission_id as string, row as RewardRow]));
}

export async function listCampaignTasks(campaignId?: string, userId?: string): Promise<CampaignTaskView[]> {
  let taskQuery = supabase
    .from('campaign_tasks')
    .select('id,campaign_id,title,description,task_type,media_url,reward_amount,requirements,cooldown_seconds,maximum_attempts,verification_method,fraud_checks,expires_at,task_config,max_completions,current_completions,status,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (campaignId) taskQuery = taskQuery.eq('campaign_id', campaignId);

  const { data, error } = campaignId ? await taskQuery : await taskQuery.in('campaign_id', await listVisibleCampaignIds());
  if (error) throw error;

  const taskRows = (data ?? []) as TaskRow[];
  const campaigns = await loadCampaignsForTasks(taskRows);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  const userSubmissions = userId ? await loadUserSubmissions(taskRows.map((row) => row.id), userId) : [];
  const submissionByTaskId = new Map(userSubmissions.map((submission) => [submission.taskId, submission]));

  return taskRows
    .map((row) => {
      const campaign = campaignById.get(row.campaign_id);
      if (!campaign) return null;

      const task = mapTaskRow(row, campaign);
      return {
        ...task,
        userSubmission: submissionByTaskId.get(task.id) ?? null,
      };
    })
    .filter((item): item is CampaignTaskView => item !== null);
}

async function listVisibleCampaignIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id')
    .in('status', ['draft', 'scheduled', 'active']);

  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

async function loadTaskBundle(taskId: string): Promise<{ task: TaskRow; campaign: CampaignRow } | null> {
  const { data: taskData, error: taskError } = await supabase
    .from('campaign_tasks')
    .select('id,campaign_id,title,description,task_type,media_url,reward_amount,requirements,cooldown_seconds,maximum_attempts,verification_method,fraud_checks,expires_at,task_config,max_completions,current_completions,status,created_at,updated_at')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!taskData) return null;

  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('id,business_id,title,description,banner_url,campaign_type,instructions,engine_config,status,start_date,end_date,budget,budget_currency,total_rewards_allocated,max_participants,current_participants,created_at,updated_at')
    .eq('id', taskData.campaign_id)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaignData) return null;

  return { task: taskData as TaskRow, campaign: campaignData as CampaignRow };
}

async function loadSubmissionBundle(submissionId: string): Promise<{ submission: SubmissionRow; task: TaskRow; campaign: CampaignRow } | null> {
  const { data: submissionData, error: submissionError } = await supabase
    .from('task_submissions')
    .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at')
    .eq('id', submissionId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  if (!submissionData) return null;

  const bundle = await loadTaskBundle(submissionData.task_id);
  if (!bundle) return null;

  return { submission: submissionData as SubmissionRow, ...bundle };
}

async function hasIssuedReward(submissionId: string): Promise<boolean> {
  const { data, error } = await supabase.from('rewards').select('id').eq('submission_id', submissionId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function issueReward(bundle: { submission: SubmissionRow; task: TaskRow; campaign: CampaignRow }, reviewerId: string, reason: string): Promise<void> {
  const alreadyIssued = await hasIssuedReward(bundle.submission.id);
  if (alreadyIssued) return;

  const rewardAmount = Number(bundle.task.reward_amount);
  const currency = bundle.campaign.budget_currency ?? 'USD';
  const nextRewardBalanceQuery = await supabase.from('profiles').select('reward_balance,reward_history_count').eq('id', bundle.submission.user_id).single<{ reward_balance: number | null; reward_history_count: number | null }>();
  if (nextRewardBalanceQuery.error) throw nextRewardBalanceQuery.error;

  const currentRewardBalance = Number(nextRewardBalanceQuery.data?.reward_balance ?? 0);
  const currentRewardHistory = Number(nextRewardBalanceQuery.data?.reward_history_count ?? 0);

  const { data: rewardData, error: rewardError } = await supabase
    .from('rewards')
    .insert({
      user_id: bundle.submission.user_id,
      campaign_id: bundle.campaign.id,
      task_id: bundle.task.id,
      submission_id: bundle.submission.id,
      amount: rewardAmount,
      currency,
      status: 'approved',
    })
    .select('id,user_id,campaign_id,task_id,submission_id,amount,currency,status,created_at,updated_at')
    .single<RewardRow>();

  if (rewardError || !rewardData) throw rewardError ?? new Error('Unable to issue reward.');

  const { error: ledgerError } = await supabase.from('reward_ledger').insert({
    user_id: bundle.submission.user_id,
    reward_id: rewardData.id,
    amount: rewardAmount,
    reason,
    performed_by: reviewerId,
    status: 'approved',
    action: 'issued',
  });

  if (ledgerError) throw ledgerError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      reward_balance: Number((currentRewardBalance + rewardAmount).toFixed(2)),
      reward_history_count: currentRewardHistory + 1,
    })
    .eq('id', bundle.submission.user_id);

  if (profileError) throw profileError;

  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({
      current_participants: Number(bundle.campaign.current_participants ?? 0) + 1,
      total_rewards_allocated: Number(bundle.campaign.total_rewards_allocated ?? 0) + rewardAmount,
    })
    .eq('id', bundle.campaign.id);

  if (campaignError) throw campaignError;
}

function shouldAutoApprove(engineConfig: CampaignEngineConfig): boolean {
  return engineConfig.autoApproval || engineConfig.verificationMethod === 'automatic_verification' || engineConfig.verificationPolicy.primaryMethod === 'automatic_verification';
}

export async function submitTaskSubmission(
  userId: string,
  taskId: string,
  submissionData: Record<string, unknown>,
): Promise<TaskSubmissionView> {
  const bundle = await loadTaskBundle(taskId);
  if (!bundle) throw new Error('Task not found.');

  if (!['draft', 'scheduled', 'active'].includes(bundle.campaign.status)) {
    throw new Error('This campaign is not accepting submissions.');
  }

  const { data: existingSubmission, error: existingError } = await supabase
    .from('task_submissions')
    .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const payload = {
    task_id: taskId,
    user_id: userId,
    submission_data: submissionData,
    status: 'pending' as const,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
  };

  const { data: submissionResult, error: submissionError } = existingSubmission
    ? await supabase
        .from('task_submissions')
        .update(payload)
        .eq('id', existingSubmission.id)
        .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at')
        .single<SubmissionRow>()
    : await supabase.from('task_submissions').insert(payload).select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at').single<SubmissionRow>();

  if (submissionError || !submissionResult) throw submissionError ?? new Error('Unable to submit task completion.');

  const submission = mapSubmissionRow(submissionResult);

  if (shouldAutoApprove(bundle.campaign.engine_config ?? ({} as CampaignEngineConfig))) {
    const { error: approveError } = await supabase
      .from('task_submissions')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', submission.id);

    if (approveError) throw approveError;

    await issueReward({ submission: submissionResult, task: bundle.task, campaign: bundle.campaign }, userId, 'Auto-approved by campaign engine');

    return {
      ...submission,
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      rejectionReason: null,
    };
  }

  return submission;
}

export async function reviewTaskSubmission(
  submissionId: string,
  reviewerId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string,
): Promise<void> {
  const bundle = await loadSubmissionBundle(submissionId);
  if (!bundle) throw new Error('Submission not found.');

  const { error: updateError } = await supabase
    .from('task_submissions')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? rejectionReason ?? 'Submission rejected by reviewer.' : null,
    })
    .eq('id', submissionId);

  if (updateError) throw updateError;

  if (status === 'approved') {
    await issueReward(bundle, reviewerId, 'Approved after manual review');
  }
}

export async function listPendingTaskReviews(limit = 50): Promise<SubmissionReviewItem[]> {
  const { data, error } = await supabase
    .from('task_submissions')
    .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const submissions = (data ?? []) as SubmissionRow[];
  const bundles = await Promise.all(submissions.map(async (submission) => loadSubmissionBundle(submission.id)));

  return bundles
    .filter((bundle): bundle is NonNullable<typeof bundle> => Boolean(bundle))
    .map((bundle) => ({
      submission: mapSubmissionRow(bundle.submission),
      task: { ...mapTaskRow(bundle.task, bundle.campaign), userSubmission: null },
      campaignBudgetCurrency: bundle.campaign.budget_currency ?? 'USD',
    }));
}

export async function listUserTaskViews(userId: string): Promise<CampaignTaskView[]> {
  return listCampaignTasks(undefined, userId);
}

export async function getCampaignTaskViews(campaignId: string, userId?: string): Promise<CampaignTaskView[]> {
  return listCampaignTasks(campaignId, userId);
}
