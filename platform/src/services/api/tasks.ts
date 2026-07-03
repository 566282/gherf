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
  task_type: CampaignTask['taskType'];
  media_url: string | null;
  reward_amount: number | string;
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
    .select('id,campaign_id,title,description,task_type,media_url,reward_amount,max_completions,current_completions,status,created_at,updated_at')
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
    .select('id,campaign_id,title,description,task_type,media_url,reward_amount,max_completions,current_completions,status,created_at,updated_at')
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
