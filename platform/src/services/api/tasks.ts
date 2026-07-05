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

export type TaskTemplateId =
  | 'telegram_membership'
  | 'website_visit'
  | 'screenshot_proof'
  | 'video_proof'
  | 'api_verification'
  | 'survey_completion'
  | 'app_install'
  | 'social_follow';

export interface TaskTemplateDefinition {
  id: TaskTemplateId;
  label: string;
  description: string;
  taskType: string;
  rewardAmount: number;
  requirements: TaskRequirementDraft[];
  cooldownSeconds: number;
  maximumAttempts: number | null;
  verificationMethod: string;
  fraudChecksText: string;
  taskConfig: Record<string, unknown>;
  maxCompletions: number | null;
  status: CampaignTask['status'];
}

export interface TaskValidationIssue {
  field: keyof TaskEngineFormValues | 'requirements' | 'taskConfigText' | 'template';
  message: string;
  severity: 'error' | 'warning';
}

export interface TaskEngineAnalyticsRow {
  taskType: string;
  taskCount: number;
  submissionCount: number;
  approvalRate: number;
  fraudRate: number;
  averageReward: number;
  rewardCost: number;
}

export interface TaskEngineCampaignAnalyticsRow {
  campaignId: string;
  campaignTitle: string;
  campaignStatus: Campaign['status'];
  taskCount: number;
  submissionCount: number;
  completionRate: number;
  fraudRate: number;
  averageReviewHours: number;
  averageReward: number;
  rewardCost: number;
}

export interface TaskEngineTrendAnalyticsRow {
  period: string;
  submissionCount: number;
  fraudFlags: number;
  averageReviewHours: number;
}

export interface TaskEngineAnalytics {
  totalTasks: number;
  draftTasks: number;
  activeTasks: number;
  pausedTasks: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  pendingSubmissions: number;
  approvalRate: number;
  fraudRate: number;
  averageReviewHours: number;
  averageRewardAmount: number;
  averageCompletions: number;
  rewardCost: number;
  byTaskType: TaskEngineAnalyticsRow[];
  byCampaign: TaskEngineCampaignAnalyticsRow[];
  fraudFlagsByMonth: TaskEngineTrendAnalyticsRow[];
}

const TASK_TEMPLATE_LIBRARY: TaskTemplateDefinition[] = [
  {
    id: 'telegram_membership',
    label: 'Telegram membership',
    description: 'Join the community channel and verify membership before payout.',
    taskType: 'join_telegram',
    rewardAmount: 2,
    requirements: [
      { key: 'join', label: 'Join the Telegram channel', value: 'required' },
      { key: 'screenshot', label: 'Upload proof if needed', value: 'optional' },
    ],
    cooldownSeconds: 3600,
    maximumAttempts: 1,
    verificationMethod: 'manual_review',
    fraudChecksText: 'fraud_detection, duplicate_detection, vpn_detection',
    taskConfig: {
      instructions: 'Join the Telegram community and keep membership active.',
      proofType: 'telegram_membership',
    },
    maxCompletions: 1,
    status: 'draft',
  },
  {
    id: 'website_visit',
    label: 'Website visit',
    description: 'Send users to a landing page with minimum dwell time.',
    taskType: 'visit_website',
    rewardAmount: 1.5,
    requirements: [
      { key: 'url', label: 'Visit URL', value: 'required' },
      { key: 'dwell_time', label: 'Minimum time on page', value: '30 seconds' },
    ],
    cooldownSeconds: 600,
    maximumAttempts: 3,
    verificationMethod: 'timer_verification',
    fraudChecksText: 'fraud_detection, duplicate_detection, bot_detection',
    taskConfig: {
      instructions: 'Open the page and remain on-screen for the minimum timer.',
      proofType: 'visit_tracker',
      minimumDwellSeconds: 30,
    },
    maxCompletions: 1000,
    status: 'draft',
  },
  {
    id: 'screenshot_proof',
    label: 'Screenshot proof',
    description: 'Collect visual proof of completion for manual moderation.',
    taskType: 'upload_screenshot',
    rewardAmount: 3,
    requirements: [
      { key: 'evidence', label: 'Upload screenshot evidence', value: 'required' },
      { key: 'quality', label: 'Image must be legible', value: 'required' },
    ],
    cooldownSeconds: 1800,
    maximumAttempts: 2,
    verificationMethod: 'screenshot_upload',
    fraudChecksText: 'fraud_detection, duplicate_detection, proxy_detection',
    taskConfig: {
      instructions: 'Upload a clear screenshot showing the completed action.',
      proofType: 'image',
      minImages: 1,
    },
    maxCompletions: 500,
    status: 'draft',
  },
  {
    id: 'video_proof',
    label: 'Video proof',
    description: 'Capture a longer proof flow that benefits from manual review.',
    taskType: 'video_proof',
    rewardAmount: 5,
    requirements: [
      { key: 'upload', label: 'Upload a short video clip', value: 'required' },
      { key: 'clarity', label: 'Show the full flow', value: 'required' },
    ],
    cooldownSeconds: 3600,
    maximumAttempts: 1,
    verificationMethod: 'video_proof',
    fraudChecksText: 'fraud_detection, duplicate_detection, bot_detection, proxy_detection',
    taskConfig: {
      instructions: 'Record the full flow and upload a short clip for review.',
      proofType: 'video',
      minDurationSeconds: 15,
    },
    maxCompletions: 250,
    status: 'draft',
  },
  {
    id: 'api_verification',
    label: 'API verification',
    description: 'Send webhooks or integration-based tasks through a direct verification flow.',
    taskType: 'api_verification',
    rewardAmount: 4,
    requirements: [
      { key: 'callback', label: 'Trigger callback endpoint', value: 'required' },
      { key: 'auth', label: 'Signed request required', value: 'required' },
    ],
    cooldownSeconds: 900,
    maximumAttempts: 5,
    verificationMethod: 'api_verification',
    fraudChecksText: 'fraud_detection, duplicate_detection, bot_detection',
    taskConfig: {
      instructions: 'Ping the partner API and verify the callback signature.',
      proofType: 'api',
      requiresSignature: true,
    },
    maxCompletions: 10000,
    status: 'draft',
  },
  {
    id: 'survey_completion',
    label: 'Survey completion',
    description: 'Collect structured answers for research or lead-generation campaigns.',
    taskType: 'complete_survey',
    rewardAmount: 2.5,
    requirements: [
      { key: 'survey', label: 'Answer every required question', value: 'required' },
      { key: 'quality', label: 'Submit complete responses', value: 'required' },
    ],
    cooldownSeconds: 7200,
    maximumAttempts: 2,
    verificationMethod: 'manual_review',
    fraudChecksText: 'fraud_detection, duplicate_detection, bot_detection, speed_check',
    taskConfig: {
      instructions: 'Complete the survey without skipping required questions.',
      proofType: 'form_submission',
      minimumResponses: 5,
    },
    maxCompletions: 2000,
    status: 'draft',
  },
  {
    id: 'app_install',
    label: 'App install',
    description: 'Track mobile app installs with launch or install confirmation.',
    taskType: 'install_app',
    rewardAmount: 6,
    requirements: [
      { key: 'install', label: 'Install the mobile app', value: 'required' },
      { key: 'launch', label: 'Open the app after install', value: 'required' },
    ],
    cooldownSeconds: 86400,
    maximumAttempts: 1,
    verificationMethod: 'api_verification',
    fraudChecksText: 'fraud_detection, duplicate_detection, device_fingerprint, emulator_detection',
    taskConfig: {
      instructions: 'Install the app and confirm the first launch event.',
      proofType: 'mobile_install',
      requiresDeepLink: true,
    },
    maxCompletions: 500,
    status: 'draft',
  },
  {
    id: 'social_follow',
    label: 'Social follow',
    description: 'Grow social channels with a verified follow or subscribe action.',
    taskType: 'follow_social',
    rewardAmount: 1.25,
    requirements: [
      { key: 'follow', label: 'Follow the target account', value: 'required' },
      { key: 'proof', label: 'Capture proof if review is manual', value: 'optional' },
    ],
    cooldownSeconds: 1800,
    maximumAttempts: 3,
    verificationMethod: 'manual_review',
    fraudChecksText: 'fraud_detection, duplicate_detection, proxy_detection',
    taskConfig: {
      instructions: 'Follow the social account and keep proof available if asked.',
      proofType: 'social_follow',
      platform: 'social',
    },
    maxCompletions: 5000,
    status: 'draft',
  },
];

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

export function listTaskTemplates(): TaskTemplateDefinition[] {
  return TASK_TEMPLATE_LIBRARY;
}

export function createTaskDraftFromTemplate(templateId: TaskTemplateId, campaignId = ''): TaskEngineFormValues {
  const template = TASK_TEMPLATE_LIBRARY.find((item) => item.id === templateId);
  if (!template) {
    return createTaskDraft(campaignId);
  }

  return {
    ...createTaskDraft(campaignId, template.taskType),
    title: template.label,
    description: template.description,
    rewardAmount: template.rewardAmount,
    requirements: template.requirements.map((requirement, index) => ({
      key: requirement.key || `requirement-${index + 1}`,
      label: requirement.label,
      value: typeof requirement.value === 'string' ? requirement.value : String(requirement.value ?? ''),
    })),
    cooldownSeconds: template.cooldownSeconds,
    maximumAttempts: template.maximumAttempts,
    verificationMethod: template.verificationMethod,
    fraudChecksText: template.fraudChecksText,
    taskConfigText: JSON.stringify(template.taskConfig, null, 2),
    maxCompletions: template.maxCompletions,
    status: template.status,
  };
}

export function validateTaskDraft(form: TaskEngineFormValues): TaskValidationIssue[] {
  const issues: TaskValidationIssue[] = [];

  if (!form.campaignId.trim()) {
    issues.push({ field: 'campaignId', message: 'Select a campaign for this task.', severity: 'error' });
  }

  if (!form.title.trim()) {
    issues.push({ field: 'title', message: 'Task title is required.', severity: 'error' });
  }

  if (!form.taskType.trim()) {
    issues.push({ field: 'taskType', message: 'Task type cannot be empty.', severity: 'error' });
  }

  if (!form.verificationMethod.trim()) {
    issues.push({ field: 'verificationMethod', message: 'Choose a verification method.', severity: 'error' });
  }

  if (form.rewardAmount <= 0) {
    issues.push({ field: 'rewardAmount', message: 'Reward amount must be greater than zero.', severity: 'error' });
  }

  if (form.cooldownSeconds < 0) {
    issues.push({ field: 'cooldownSeconds', message: 'Cooldown cannot be negative.', severity: 'error' });
  }

  if (form.maximumAttempts !== null && form.maximumAttempts < 1) {
    issues.push({ field: 'maximumAttempts', message: 'Maximum attempts must be at least 1.', severity: 'error' });
  }

  if (form.maxCompletions !== null && form.maxCompletions < 1) {
    issues.push({ field: 'maxCompletions', message: 'Maximum completions must be at least 1.', severity: 'error' });
  }

  if (!form.description.trim()) {
    issues.push({ field: 'description', message: 'Add a short description so users know what to do.', severity: 'warning' });
  }

  if (!form.fraudChecksText.trim()) {
    issues.push({ field: 'requirements', message: 'Add at least one fraud check for safer review.', severity: 'warning' });
  }

  if (form.expiresAt.trim()) {
    const expiresAt = new Date(form.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      issues.push({ field: 'expiresAt', message: 'Expiration date must be valid.', severity: 'error' });
    }
  }

  try {
    parseJsonObject(form.taskConfigText);
  } catch (error) {
    issues.push({ field: 'taskConfigText', message: error instanceof Error ? error.message : 'Task configuration must be valid JSON.', severity: 'error' });
  }

  if (!form.requirements.some((requirement) => requirement.key.trim().length || requirement.label.trim().length || requirement.value.trim().length)) {
    issues.push({ field: 'requirements', message: 'Add at least one requirement row.', severity: 'warning' });
  }

  return issues;
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

export async function saveCampaignTask(form: TaskEngineFormValues, taskId?: string, actorId?: string): Promise<CampaignTaskView> {
  const previousTask = taskId ? await getCampaignTask(taskId) : null;
  const payload = buildTaskPayload(form);
  const query = taskId
    ? supabase.from('campaign_tasks').update(payload).eq('id', taskId)
    : supabase.from('campaign_tasks').insert(payload);

  const { data, error } = await query.select('id').single<{ id: string }>();
  if (error) throw error;

  const savedTask = await hydrateTaskView(data.id);

  await recordTaskAudit({
    actorId,
    action: taskId ? 'task_updated' : 'task_created',
    resourceType: 'campaign_task',
    resourceId: savedTask.id,
    oldValues: previousTask ?? null,
    newValues: savedTask,
    reason: taskId ? 'Task updated from the task engine' : 'Task created from the task engine',
  });

  return savedTask;
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

  if (reviewerId !== bundle.submission.user_id) {
    const { error: auditError } = await supabase.from('admin_action_audit').insert({
      admin_id: reviewerId,
      action: 'task_reward_issued',
      resource_type: 'reward',
      resource_id: rewardData.id,
      old_values: {
        reward_balance: currentRewardBalance,
        reward_history_count: currentRewardHistory,
      },
      new_values: {
        reward_balance: Number((currentRewardBalance + rewardAmount).toFixed(2)),
        reward_history_count: currentRewardHistory + 1,
        reward_amount: rewardAmount,
        task_id: bundle.task.id,
        submission_id: bundle.submission.id,
      },
      reason,
    });

    if (auditError) throw auditError;
  }
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

async function recordTaskAudit(input: {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
}): Promise<void> {
  if (!input.actorId) return;

  const { error } = await supabase.from('admin_action_audit').insert({
    admin_id: input.actorId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    reason: input.reason ?? null,
  });

  if (error) throw error;
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

  await recordTaskAudit({
    actorId: reviewerId,
    action: `task_submission_${status}`,
    resourceType: 'task_submission',
    resourceId: submissionId,
    oldValues: {
      status: bundle.submission.status,
      reviewedBy: bundle.submission.reviewedBy ?? null,
      reviewedAt: bundle.submission.reviewedAt ?? null,
    },
    newValues: {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason ?? 'Submission rejected by reviewer.' : null,
    },
    reason: rejectionReason ?? null,
  });
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

export interface TaskEngineAnalyticsInput {
  tasks: Array<Pick<TaskRow, 'id' | 'campaign_id' | 'task_type' | 'reward_amount' | 'current_completions' | 'status'>>;
  submissions: Array<Pick<SubmissionRow, 'task_id' | 'status' | 'created_at' | 'reviewed_at'>>;
  rewards: Array<Pick<RewardRow, 'task_id' | 'amount' | 'status'>>;
  campaigns: Array<Pick<CampaignRow, 'id' | 'title' | 'status'>>;
}

function getReviewLatencyHours(createdAt: string, reviewedAt: string): number {
  return (new Date(reviewedAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
}

function getMonthPeriod(value: string): string {
  return value.slice(0, 7);
}

export function buildTaskEngineAnalytics(input: TaskEngineAnalyticsInput): TaskEngineAnalytics {
  const campaignMap = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]));
  const submissionsByTaskId = new Map<string, Array<Pick<SubmissionRow, 'task_id' | 'status' | 'created_at' | 'reviewed_at'>>>();
  const rewardsByTaskId = new Map<string, Array<Pick<RewardRow, 'task_id' | 'amount' | 'status'>>>();

  for (const submission of input.submissions) {
    const bucket = submissionsByTaskId.get(submission.task_id) ?? [];
    bucket.push(submission);
    submissionsByTaskId.set(submission.task_id, bucket);
  }

  for (const reward of input.rewards) {
    if (!reward.task_id) continue;
    const bucket = rewardsByTaskId.get(reward.task_id) ?? [];
    bucket.push(reward);
    rewardsByTaskId.set(reward.task_id, bucket);
  }

  const byTaskTypeMap = new Map<string, TaskEngineAnalyticsRow>();
  const byCampaignMap = new Map<string, {
    campaignId: string;
    campaignTitle: string;
    campaignStatus: Campaign['status'];
    taskCount: number;
    submissionCount: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    reviewedSubmissions: number;
    reviewLatencyHoursTotal: number;
    averageRewardTotal: number;
    rewardCost: number;
  }>();
  const fraudTrendMap = new Map<string, {
    period: string;
    submissionCount: number;
    fraudFlags: number;
    reviewedSubmissions: number;
    reviewLatencyHoursTotal: number;
  }>();

  for (const task of input.tasks) {
    const campaign = campaignMap.get(task.campaign_id);
    const taskSubmissions = submissionsByTaskId.get(task.id) ?? [];
    const taskRewards = rewardsByTaskId.get(task.id) ?? [];
    const approvedCount = taskSubmissions.filter((submission) => submission.status === 'approved').length;
    const rejectedCount = taskSubmissions.filter((submission) => submission.status === 'rejected').length;
    const reviewedSubmissions = taskSubmissions.filter((submission) => submission.reviewed_at);
    const rewardCostForTask = taskRewards
      .filter((reward) => reward.status === 'approved' || reward.status === 'claimed')
      .reduce((sum, reward) => sum + Number(reward.amount), 0);

    const taskTypeBucket = byTaskTypeMap.get(task.task_type) ?? {
      taskType: task.task_type,
      taskCount: 0,
      submissionCount: 0,
      approvalRate: 0,
      fraudRate: 0,
      averageReward: 0,
      rewardCost: 0,
    };

    taskTypeBucket.taskCount += 1;
    taskTypeBucket.submissionCount += taskSubmissions.length;
    taskTypeBucket.approvalRate += taskSubmissions.length ? (approvedCount / taskSubmissions.length) * 100 : 0;
    taskTypeBucket.fraudRate += taskSubmissions.length ? (rejectedCount / taskSubmissions.length) * 100 : 0;
    taskTypeBucket.averageReward += Number(task.reward_amount ?? 0);
    taskTypeBucket.rewardCost += rewardCostForTask;
    byTaskTypeMap.set(task.task_type, taskTypeBucket);

    const campaignBucket = byCampaignMap.get(task.campaign_id) ?? {
      campaignId: task.campaign_id,
      campaignTitle: campaign?.title ?? 'Unknown campaign',
      campaignStatus: campaign?.status ?? 'draft',
      taskCount: 0,
      submissionCount: 0,
      approvedSubmissions: 0,
      rejectedSubmissions: 0,
      reviewedSubmissions: 0,
      reviewLatencyHoursTotal: 0,
      averageRewardTotal: 0,
      rewardCost: 0,
    };

    campaignBucket.taskCount += 1;
    campaignBucket.submissionCount += taskSubmissions.length;
    campaignBucket.approvedSubmissions += approvedCount;
    campaignBucket.rejectedSubmissions += rejectedCount;
    campaignBucket.reviewedSubmissions += reviewedSubmissions.length;
    campaignBucket.reviewLatencyHoursTotal += reviewedSubmissions.reduce((sum, submission) => sum + getReviewLatencyHours(submission.created_at, submission.reviewed_at as string), 0);
    campaignBucket.averageRewardTotal += Number(task.reward_amount ?? 0);
    campaignBucket.rewardCost += rewardCostForTask;
    byCampaignMap.set(task.campaign_id, campaignBucket);

    for (const submission of taskSubmissions) {
      const period = getMonthPeriod((submission.reviewed_at ?? submission.created_at));
      const trendBucket = fraudTrendMap.get(period) ?? {
        period,
        submissionCount: 0,
        fraudFlags: 0,
        reviewedSubmissions: 0,
        reviewLatencyHoursTotal: 0,
      };

      trendBucket.submissionCount += 1;
      if (submission.status === 'rejected') {
        trendBucket.fraudFlags += 1;
      }
      if (submission.reviewed_at) {
        trendBucket.reviewedSubmissions += 1;
        trendBucket.reviewLatencyHoursTotal += getReviewLatencyHours(submission.created_at, submission.reviewed_at);
      }

      fraudTrendMap.set(period, trendBucket);
    }
  }

  const groupedTaskTypes = [...byTaskTypeMap.values()]
    .map((entry) => ({
      ...entry,
      averageReward: entry.taskCount ? Number((entry.averageReward / entry.taskCount).toFixed(2)) : 0,
      approvalRate: entry.taskCount ? Number((entry.approvalRate / entry.taskCount).toFixed(2)) : 0,
      fraudRate: entry.taskCount ? Number((entry.fraudRate / entry.taskCount).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.rewardCost - left.rewardCost);

  const groupedCampaigns = [...byCampaignMap.values()]
    .map((entry) => ({
      campaignId: entry.campaignId,
      campaignTitle: entry.campaignTitle,
      campaignStatus: entry.campaignStatus,
      taskCount: entry.taskCount,
      submissionCount: entry.submissionCount,
      completionRate: entry.submissionCount ? Number(((entry.approvedSubmissions / entry.submissionCount) * 100).toFixed(2)) : 0,
      fraudRate: entry.submissionCount ? Number(((entry.rejectedSubmissions / entry.submissionCount) * 100).toFixed(2)) : 0,
      averageReviewHours: entry.reviewedSubmissions ? Number((entry.reviewLatencyHoursTotal / entry.reviewedSubmissions).toFixed(2)) : 0,
      averageReward: entry.taskCount ? Number((entry.averageRewardTotal / entry.taskCount).toFixed(2)) : 0,
      rewardCost: Number(entry.rewardCost.toFixed(2)),
    }))
    .sort((left, right) => right.submissionCount - left.submissionCount || right.rewardCost - left.rewardCost);

  const fraudFlagsByMonth = [...fraudTrendMap.values()]
    .map((entry) => ({
      period: entry.period,
      submissionCount: entry.submissionCount,
      fraudFlags: entry.fraudFlags,
      averageReviewHours: entry.reviewedSubmissions ? Number((entry.reviewLatencyHoursTotal / entry.reviewedSubmissions).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.period.localeCompare(left.period));

  const reviewedSubmissions = input.submissions.filter((submission) => submission.reviewed_at);
  const averageReviewHours = reviewedSubmissions.length
    ? Number((reviewedSubmissions.reduce((sum, submission) => sum + getReviewLatencyHours(submission.created_at, submission.reviewed_at as string), 0) / reviewedSubmissions.length).toFixed(2))
    : 0;

  const totalTasks = input.tasks.length;
  const totalSubmissions = input.submissions.length;
  const approvedSubmissions = input.submissions.filter((submission) => submission.status === 'approved').length;
  const rejectedSubmissions = input.submissions.filter((submission) => submission.status === 'rejected').length;
  const pendingSubmissions = input.submissions.filter((submission) => submission.status === 'pending').length;
  const averageRewardAmount = totalTasks
    ? Number((input.tasks.reduce((sum, task) => sum + Number(task.reward_amount ?? 0), 0) / totalTasks).toFixed(2))
    : 0;
  const averageCompletions = totalTasks
    ? Number((input.tasks.reduce((sum, task) => sum + Number(task.current_completions ?? 0), 0) / totalTasks).toFixed(2))
    : 0;
  const rewardCost = input.rewards
    .filter((reward) => reward.status === 'approved' || reward.status === 'claimed')
    .reduce((sum, reward) => sum + Number(reward.amount), 0);

  return {
    totalTasks,
    draftTasks: input.tasks.filter((task) => task.status === 'draft').length,
    activeTasks: input.tasks.filter((task) => task.status === 'active').length,
    pausedTasks: input.tasks.filter((task) => task.status === 'paused').length,
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    pendingSubmissions,
    approvalRate: totalSubmissions ? Number(((approvedSubmissions / totalSubmissions) * 100).toFixed(2)) : 0,
    fraudRate: totalSubmissions ? Number(((rejectedSubmissions / totalSubmissions) * 100).toFixed(2)) : 0,
    averageReviewHours,
    averageRewardAmount,
    averageCompletions,
    rewardCost: Number(rewardCost.toFixed(2)),
    byTaskType: groupedTaskTypes,
    byCampaign: groupedCampaigns,
    fraudFlagsByMonth,
  };
}

export async function listTaskEngineAnalytics(): Promise<TaskEngineAnalytics> {
  const [taskResult, submissionResult, rewardResult, campaignResult] = await Promise.all([
    supabase
      .from('campaign_tasks')
      .select('id,campaign_id,task_type,reward_amount,current_completions,max_completions,status,created_at,updated_at'),
    supabase
      .from('task_submissions')
      .select('id,task_id,user_id,submission_data,status,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at'),
    supabase
      .from('rewards')
      .select('id,user_id,campaign_id,task_id,submission_id,amount,currency,status,created_at,updated_at'),
    supabase
      .from('campaigns')
      .select('id,title,status'),
  ]);

  const [tasks, submissions, rewards, campaigns] = [taskResult, submissionResult, rewardResult, campaignResult].map((result) => {
    if (result.error || !result.data) {
      return [] as Array<Record<string, unknown>>;
    }

    return result.data as Array<Record<string, unknown>>;
  });

  return buildTaskEngineAnalytics({
    tasks: tasks as TaskEngineAnalyticsInput['tasks'],
    submissions: submissions as TaskEngineAnalyticsInput['submissions'],
    rewards: rewards as TaskEngineAnalyticsInput['rewards'],
    campaigns: campaigns as TaskEngineAnalyticsInput['campaigns'],
  });
}

export async function listUserTaskViews(userId: string): Promise<CampaignTaskView[]> {
  return listCampaignTasks(undefined, userId);
}

export async function getCampaignTaskViews(campaignId: string, userId?: string): Promise<CampaignTaskView[]> {
  return listCampaignTasks(campaignId, userId);
}
