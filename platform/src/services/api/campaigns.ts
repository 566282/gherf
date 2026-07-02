import { supabase } from '@/services/supabase/client';
import type {
  Campaign,
  CampaignBrowserRestriction,
  CampaignDeviceRestriction,
  CampaignDurationUnit,
  CampaignEngineConfig,
  CampaignTargetAudience,
  CampaignType,
  CampaignVerificationMethod,
  VerificationEvidenceType,
  VerificationRiskCheck,
} from '@/types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type CampaignRow = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  campaign_type: CampaignType | null;
  instructions: string | null;
  engine_config: JsonValue | null;
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

export interface CampaignEditorFormValues {
  businessId: string;
  title: string;
  description: string;
  bannerUrl: string;
  campaignType: CampaignType;
  instructions: string;
  rewardAmount: number;
  durationValue: number;
  durationUnit: CampaignDurationUnit;
  completionLimit: number;
  dailyLimit: number;
  countryRestrictions: string;
  deviceRestrictions: string;
  browserRestrictions: string;
  verificationMethod: CampaignVerificationMethod;
  autoApproval: boolean;
  manualApproval: boolean;
  budget: number;
  budgetCurrency: string;
  totalParticipants: number;
  targetAgeRange: string;
  targetInterests: string;
  targetRegions: string;
  targetLanguages: string;
  targetTags: string;
  targetNotes: string;
  activeFrom: string;
  activeTo: string;
  status: Campaign['status'];
  priority: number;
  requiredScreenshots: number;
  requiredProof: string;
  timeDelayBeforeReward: number;
  cooldownPeriod: number;
}

const defaultTargetAudience: CampaignTargetAudience = {
  ageRange: '18-45',
  interests: [],
  regions: [],
  languages: [],
  tags: [],
  notes: '',
};

const defaultEngineConfig = (campaignType: CampaignType): CampaignEngineConfig => ({
  campaignType,
  instructions: '',
  rewardAmount: 1,
  durationValue: 1,
  durationUnit: 'days',
  completionLimit: 100,
  dailyLimit: 10,
  countryRestrictions: [],
  deviceRestrictions: ['any'],
  browserRestrictions: ['any'],
  verificationMethod: 'manual_review',
  autoApproval: false,
  manualApproval: true,
  budget: 100,
  totalParticipants: 100,
  targetAudience: defaultTargetAudience,
  activeFrom: new Date().toISOString(),
  activeTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  priority: 0,
  requiredScreenshots: 0,
  requiredProof: '',
  verificationPolicy: {
    primaryMethod: 'manual_review',
    requiredEvidence: ['screenshot_upload'],
    riskChecks: ['fraud_detection', 'duplicate_detection', 'vpn_detection', 'proxy_detection', 'bot_detection'],
    randomAuditRate: 0,
    fraudThreshold: 70,
    appealWindowHours: 72,
  },
  timeDelayBeforeReward: 0,
  cooldownPeriod: 0,
});

function normalizeVerificationMethod(value: unknown, fallback: CampaignVerificationMethod): CampaignVerificationMethod {
  switch (value) {
    case 'automatic':
    case 'automatic_verification':
      return 'automatic_verification';
    case 'manual_review':
      return 'manual_review';
    case 'screenshot_proof':
    case 'screenshot_upload':
      return 'screenshot_upload';
    case 'video_proof':
      return 'video_proof';
    case 'link_proof':
    case 'link_validation':
      return 'link_validation';
    case 'api_webhook':
    case 'api_verification':
      return 'api_verification';
    case 'human_validation':
    case 'timer_verification':
      return 'timer_verification';
    case 'random_audit':
      return 'random_audit';
    default:
      return fallback;
  }
}

function normalizeEvidenceList(value: unknown, fallback: VerificationEvidenceType[]): VerificationEvidenceType[] {
  if (!Array.isArray(value)) return fallback;

  return value.flatMap((entry) => {
    switch (entry) {
      case 'screenshot_proof':
      case 'screenshot_upload':
        return ['screenshot_upload'];
      case 'video_proof':
        return ['video_proof'];
      case 'link_proof':
      case 'link_validation':
        return ['link_validation'];
      case 'api_webhook':
      case 'api_verification':
        return ['api_verification'];
      case 'human_validation':
      case 'timer_verification':
        return ['timer_verification'];
      default:
        return [];
    }
  });
}

function normalizeRiskChecks(value: unknown, fallback: VerificationRiskCheck[]): VerificationRiskCheck[] {
  if (!Array.isArray(value)) return fallback;

  return value.flatMap((entry) => {
    switch (entry) {
      case 'fraud_detection':
      case 'duplicate_detection':
      case 'vpn_detection':
      case 'proxy_detection':
      case 'bot_detection':
        return [entry];
      default:
        return [];
    }
  });
}

export const campaignTypeOptions = [
  {
    value: 'watch_videos',
    label: 'Watch videos',
    description: 'Reward completed video views with configurable verification and cooldowns.',
    defaultInstructions: 'Watch the full video until the completion threshold is met.',
    defaultVerificationMethod: 'video_proof' as const,
  },
  {
    value: 'click_advertisements',
    label: 'Click advertisements',
    description: 'Run click-through campaigns with device and browser restrictions.',
    defaultInstructions: 'Open the advertisement and keep it visible for the required delay.',
    defaultVerificationMethod: 'link_validation' as const,
  },
  {
    value: 'visit_websites',
    label: 'Visit websites',
    description: 'Track traffic, dwell time, and proof of page visits.',
    defaultInstructions: 'Visit the target page and stay on it for the instructed delay.',
    defaultVerificationMethod: 'timer_verification' as const,
  },
  {
    value: 'read_articles',
    label: 'Read articles',
    description: 'Measure article engagement and reading completion.',
    defaultInstructions: 'Read the article completely before submitting proof.',
    defaultVerificationMethod: 'timer_verification' as const,
  },
  {
    value: 'install_mobile_apps',
    label: 'Install mobile apps',
    description: 'Require app installs, launches, and optional screenshot proof.',
    defaultInstructions: 'Install the app, launch it once, and attach proof if requested.',
    defaultVerificationMethod: 'screenshot_upload' as const,
  },
  {
    value: 'register_accounts',
    label: 'Register accounts',
    description: 'Support sign-up campaigns with manual or automated verification.',
    defaultInstructions: 'Register an account using the provided partner flow.',
    defaultVerificationMethod: 'automatic_verification' as const,
  },
  {
    value: 'complete_surveys',
    label: 'Complete surveys',
    description: 'Collect survey responses with completion and quality thresholds.',
    defaultInstructions: 'Answer all survey questions honestly and submit the final page.',
    defaultVerificationMethod: 'manual_review' as const,
  },
  {
    value: 'social_media_follows',
    label: 'Social media follows',
    description: 'Reward follows across social networks with proof requirements.',
    defaultInstructions: 'Follow the requested social profile and provide proof of completion.',
    defaultVerificationMethod: 'screenshot_upload' as const,
  },
  {
    value: 'social_media_likes',
    label: 'Social media likes',
    description: 'Track likes on posts and social updates.',
    defaultInstructions: 'Like the target post and submit the resulting proof.',
    defaultVerificationMethod: 'screenshot_upload' as const,
  },
  {
    value: 'comments',
    label: 'Comments',
    description: 'Collect written comments and validate message quality.',
    defaultInstructions: 'Leave a relevant comment that matches the campaign rules.',
    defaultVerificationMethod: 'manual_review' as const,
  },
  {
    value: 'shares',
    label: 'Shares',
    description: 'Reward content shares and reposts.',
    defaultInstructions: 'Share the provided content through the allowed network.',
    defaultVerificationMethod: 'screenshot_upload' as const,
  },
  {
    value: 'join_telegram',
    label: 'Join Telegram',
    description: 'Validate Telegram community joins with invite-based workflows.',
    defaultInstructions: 'Join the Telegram community and keep membership active.',
    defaultVerificationMethod: 'random_audit' as const,
  },
  {
    value: 'join_discord',
    label: 'Join Discord',
    description: 'Handle Discord membership, role checks, and proof uploads.',
    defaultInstructions: 'Join the Discord server and complete any role or verification steps.',
    defaultVerificationMethod: 'manual_review' as const,
  },
  {
    value: 'subscribe_to_youtube',
    label: 'Subscribe to YouTube',
    description: 'Track channel subscriptions and optional watch-time follow-up.',
    defaultInstructions: 'Subscribe to the requested channel and keep the subscription active.',
    defaultVerificationMethod: 'screenshot_upload' as const,
  },
  {
    value: 'download_files',
    label: 'Download files',
    description: 'Control file downloads with proof and cooldown windows.',
    defaultInstructions: 'Download the file from the approved source and confirm completion.',
    defaultVerificationMethod: 'link_validation' as const,
  },
  {
    value: 'daily_tasks',
    label: 'Daily tasks',
    description: 'Repeatable tasks with daily caps and cooldown control.',
    defaultInstructions: 'Complete the task once per day within the allowed window.',
    defaultVerificationMethod: 'timer_verification' as const,
  },
  {
    value: 'weekly_challenges',
    label: 'Weekly challenges',
    description: 'Recurring weekly missions with flexible proof and reward pacing.',
    defaultInstructions: 'Finish the weekly challenge before the deadline expires.',
    defaultVerificationMethod: 'random_audit' as const,
  },
  {
    value: 'seasonal_campaigns',
    label: 'Seasonal campaigns',
    description: 'Campaigns tied to limited seasonal windows and special rewards.',
    defaultInstructions: 'Complete the seasonal task before the active window ends.',
    defaultVerificationMethod: 'random_audit' as const,
  },
  {
    value: 'referral_campaigns',
    label: 'Referral campaigns',
    description: 'Reward successful referrals and downstream conversions.',
    defaultInstructions: 'Invite eligible users and confirm the referral criteria.',
    defaultVerificationMethod: 'api_verification' as const,
  },
  {
    value: 'custom_tasks',
    label: 'Custom tasks',
    description: 'Free-form campaigns for any workflow not covered by a preset.',
    defaultInstructions: 'Follow the custom instructions exactly as written by the admin.',
    defaultVerificationMethod: 'manual_review' as const,
  },
] as const;

export const campaignDurationUnitOptions: { value: CampaignDurationUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

export const campaignVerificationOptions: { value: CampaignVerificationMethod; label: string }[] = [
  { value: 'automatic_verification', label: 'Automatic verification' },
  { value: 'manual_review', label: 'Manual review' },
  { value: 'screenshot_upload', label: 'Screenshot upload' },
  { value: 'video_proof', label: 'Video proof' },
  { value: 'link_validation', label: 'Link validation' },
  { value: 'api_verification', label: 'API verification' },
  { value: 'timer_verification', label: 'Timer verification' },
  { value: 'random_audit', label: 'Random audit' },
];

export const campaignDeviceOptions: { value: CampaignDeviceRestriction; label: string }[] = [
  { value: 'any', label: 'Any device' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
];

export const campaignBrowserOptions: { value: CampaignBrowserRestriction; label: string }[] = [
  { value: 'any', label: 'Any browser' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'safari', label: 'Safari' },
  { value: 'edge', label: 'Edge' },
  { value: 'opera', label: 'Opera' },
];

function normalizeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toISOStringFromLocal(value: string): string {
  if (!value) return new Date().toISOString();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();

  return date.toISOString();
}

function cloneTargetAudience(value?: Partial<CampaignTargetAudience> | null): CampaignTargetAudience {
  return {
    ageRange: value?.ageRange ?? defaultTargetAudience.ageRange,
    interests: value?.interests ?? [],
    regions: value?.regions ?? [],
    languages: value?.languages ?? [],
    tags: value?.tags ?? [],
    notes: value?.notes ?? '',
  };
}

function normalizeEngineConfig(rawValue: JsonValue | null, campaignType: CampaignType): CampaignEngineConfig {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  const fallback = defaultEngineConfig(campaignType);
  const targetAudience = (raw.targetAudience ?? {}) as Partial<CampaignTargetAudience>;
  const policy = (raw.verificationPolicy ?? {}) as Record<string, unknown>;

  return {
    campaignType: (raw.campaignType as CampaignType | undefined) ?? (raw.campaign_type as CampaignType | undefined) ?? campaignType,
    instructions: (raw.instructions as string | undefined) ?? fallback.instructions,
    rewardAmount: Number(raw.rewardAmount ?? fallback.rewardAmount),
    durationValue: Number(raw.durationValue ?? fallback.durationValue),
    durationUnit: (raw.durationUnit as CampaignDurationUnit | undefined) ?? fallback.durationUnit,
    completionLimit: Number(raw.completionLimit ?? fallback.completionLimit),
    dailyLimit: Number(raw.dailyLimit ?? fallback.dailyLimit),
    countryRestrictions: Array.isArray(raw.countryRestrictions) ? (raw.countryRestrictions as string[]) : fallback.countryRestrictions,
    deviceRestrictions: Array.isArray(raw.deviceRestrictions)
      ? (raw.deviceRestrictions as CampaignDeviceRestriction[])
      : fallback.deviceRestrictions,
    browserRestrictions: Array.isArray(raw.browserRestrictions)
      ? (raw.browserRestrictions as CampaignBrowserRestriction[])
      : fallback.browserRestrictions,
    verificationMethod: normalizeVerificationMethod(raw.verificationMethod, fallback.verificationMethod),
    autoApproval: Boolean(raw.autoApproval ?? fallback.autoApproval),
    manualApproval: Boolean(raw.manualApproval ?? fallback.manualApproval),
    budget: Number(raw.budget ?? fallback.budget),
    totalParticipants: Number(raw.totalParticipants ?? fallback.totalParticipants),
    targetAudience: cloneTargetAudience(targetAudience),
    activeFrom: typeof raw.activeFrom === 'string' ? raw.activeFrom : fallback.activeFrom,
    activeTo: typeof raw.activeTo === 'string' ? raw.activeTo : fallback.activeTo,
    priority: Number(raw.priority ?? fallback.priority),
    requiredScreenshots: Number(raw.requiredScreenshots ?? fallback.requiredScreenshots),
    requiredProof: typeof raw.requiredProof === 'string' ? raw.requiredProof : fallback.requiredProof,
    verificationPolicy: {
      primaryMethod: normalizeVerificationMethod(policy.primaryMethod, fallback.verificationPolicy.primaryMethod),
      requiredEvidence: normalizeEvidenceList(policy.requiredEvidence, fallback.verificationPolicy.requiredEvidence),
      riskChecks: normalizeRiskChecks(policy.riskChecks, fallback.verificationPolicy.riskChecks),
      randomAuditRate: Number(policy.randomAuditRate ?? fallback.verificationPolicy.randomAuditRate),
      fraudThreshold: Number(policy.fraudThreshold ?? fallback.verificationPolicy.fraudThreshold),
      appealWindowHours: Number(policy.appealWindowHours ?? fallback.verificationPolicy.appealWindowHours),
    },
    timeDelayBeforeReward: Number(raw.timeDelayBeforeReward ?? fallback.timeDelayBeforeReward),
    cooldownPeriod: Number(raw.cooldownPeriod ?? fallback.cooldownPeriod),
  };
}

export function createDefaultCampaignForm(campaignType: CampaignType = 'custom_tasks'): CampaignEditorFormValues {
  const preset = campaignTypeOptions.find((option) => option.value === campaignType) ?? campaignTypeOptions.at(-1)!;
  const engine = defaultEngineConfig(campaignType);

  engine.instructions = preset.defaultInstructions;
  engine.verificationMethod = preset.defaultVerificationMethod;
  engine.verificationPolicy.primaryMethod = preset.defaultVerificationMethod;

  return {
    businessId: '',
    title: preset.label,
    description: preset.description,
    bannerUrl: '',
    campaignType,
    instructions: engine.instructions,
    rewardAmount: engine.rewardAmount,
    durationValue: engine.durationValue,
    durationUnit: engine.durationUnit,
    completionLimit: engine.completionLimit,
    dailyLimit: engine.dailyLimit,
    countryRestrictions: '',
    deviceRestrictions: engine.deviceRestrictions.join(', '),
    browserRestrictions: engine.browserRestrictions.join(', '),
    verificationMethod: engine.verificationMethod,
    autoApproval: engine.autoApproval,
    manualApproval: engine.manualApproval,
    budget: engine.budget,
    budgetCurrency: 'USD',
    totalParticipants: engine.totalParticipants,
    targetAgeRange: engine.targetAudience.ageRange,
    targetInterests: '',
    targetRegions: '',
    targetLanguages: '',
    targetTags: '',
    targetNotes: '',
    activeFrom: formatDateTimeLocal(engine.activeFrom),
    activeTo: formatDateTimeLocal(engine.activeTo),
    status: 'draft',
    priority: engine.priority,
    requiredScreenshots: engine.requiredScreenshots,
    requiredProof: engine.requiredProof,
    timeDelayBeforeReward: engine.timeDelayBeforeReward,
    cooldownPeriod: engine.cooldownPeriod,
  };
}

export function campaignToFormValues(campaign: Campaign): CampaignEditorFormValues {
  const engine = campaign.engineConfig ?? defaultEngineConfig(campaign.campaignType);

  return {
    businessId: campaign.businessId,
    title: campaign.title,
    description: campaign.description ?? '',
    bannerUrl: campaign.bannerUrl ?? '',
    campaignType: campaign.campaignType,
    instructions: campaign.instructions ?? engine.instructions,
    rewardAmount: engine.rewardAmount,
    durationValue: engine.durationValue,
    durationUnit: engine.durationUnit,
    completionLimit: engine.completionLimit,
    dailyLimit: engine.dailyLimit,
    countryRestrictions: engine.countryRestrictions.join(', '),
    deviceRestrictions: engine.deviceRestrictions.join(', '),
    browserRestrictions: engine.browserRestrictions.join(', '),
    verificationMethod: engine.verificationMethod,
    autoApproval: engine.autoApproval,
    manualApproval: engine.manualApproval,
    budget: campaign.budget,
    budgetCurrency: campaign.budgetCurrency,
    totalParticipants: campaign.maxParticipants ?? engine.totalParticipants,
    targetAgeRange: engine.targetAudience.ageRange,
    targetInterests: engine.targetAudience.interests.join(', '),
    targetRegions: engine.targetAudience.regions.join(', '),
    targetLanguages: engine.targetAudience.languages.join(', '),
    targetTags: engine.targetAudience.tags.join(', '),
    targetNotes: engine.targetAudience.notes,
    activeFrom: formatDateTimeLocal(campaign.startDate),
    activeTo: formatDateTimeLocal(campaign.endDate),
    status: campaign.status,
    priority: engine.priority,
    requiredScreenshots: engine.requiredScreenshots,
    requiredProof: engine.requiredProof,
    timeDelayBeforeReward: engine.timeDelayBeforeReward,
    cooldownPeriod: engine.cooldownPeriod,
  };
}

export function buildCampaignEngineConfig(form: CampaignEditorFormValues): CampaignEngineConfig {
  return {
    campaignType: form.campaignType,
    instructions: form.instructions,
    rewardAmount: Number(form.rewardAmount),
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit,
    completionLimit: Number(form.completionLimit),
    dailyLimit: Number(form.dailyLimit),
    countryRestrictions: normalizeList(form.countryRestrictions),
    deviceRestrictions: normalizeList(form.deviceRestrictions) as CampaignDeviceRestriction[],
    browserRestrictions: normalizeList(form.browserRestrictions) as CampaignBrowserRestriction[],
    verificationMethod: form.verificationMethod,
    autoApproval: Boolean(form.autoApproval),
    manualApproval: Boolean(form.manualApproval),
    budget: Number(form.budget),
    totalParticipants: Number(form.totalParticipants),
    targetAudience: {
      ageRange: form.targetAgeRange,
      interests: normalizeList(form.targetInterests),
      regions: normalizeList(form.targetRegions),
      languages: normalizeList(form.targetLanguages),
      tags: normalizeList(form.targetTags),
      notes: form.targetNotes,
    },
    activeFrom: toISOStringFromLocal(form.activeFrom),
    activeTo: toISOStringFromLocal(form.activeTo),
    priority: Number(form.priority),
    requiredScreenshots: Number(form.requiredScreenshots),
    requiredProof: form.requiredProof,
    verificationPolicy: {
      primaryMethod: form.verificationMethod,
      requiredEvidence: form.requiredScreenshots > 0 ? ['screenshot_upload'] : [],
      riskChecks: ['fraud_detection', 'duplicate_detection', 'vpn_detection', 'proxy_detection', 'bot_detection'],
      randomAuditRate: form.verificationMethod === 'random_audit' ? 100 : 0,
      fraudThreshold: 70,
      appealWindowHours: 72,
    },
    timeDelayBeforeReward: Number(form.timeDelayBeforeReward),
    cooldownPeriod: Number(form.cooldownPeriod),
  };
}

function buildCampaignPayload(form: CampaignEditorFormValues) {
  const engineConfig = buildCampaignEngineConfig(form);

  return {
    business_id: form.businessId,
    title: form.title,
    description: form.description || null,
    banner_url: form.bannerUrl || null,
    campaign_type: form.campaignType,
    instructions: form.instructions,
    status: form.status,
    start_date: engineConfig.activeFrom,
    end_date: engineConfig.activeTo,
    budget: Number(form.budget),
    budget_currency: form.budgetCurrency,
    total_rewards_allocated: Number(form.budget),
    max_participants: Number(form.totalParticipants) || null,
    engine_config: engineConfig,
  };
}

function mapCampaignRow(row: CampaignRow): Campaign {
  const engineConfig = normalizeEngineConfig(row.engine_config, row.campaign_type ?? 'custom_tasks');

  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    description: row.description ?? undefined,
    bannerUrl: row.banner_url ?? undefined,
    campaignType: row.campaign_type ?? engineConfig.campaignType,
    instructions: row.instructions ?? engineConfig.instructions,
    engineConfig,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: Number(row.budget),
    budgetCurrency: row.budget_currency ?? 'USD',
    totalRewardsAllocated: Number(row.total_rewards_allocated ?? row.budget),
    maxParticipants: row.max_participants ?? undefined,
    currentParticipants: row.current_participants ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const campaignSelect =
  'id,business_id,title,description,banner_url,campaign_type,instructions,engine_config,status,start_date,end_date,budget,budget_currency,total_rewards_allocated,max_participants,current_participants,created_at,updated_at';

export async function listCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select(campaignSelect).order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapCampaignRow(row as CampaignRow));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from('campaigns').select(campaignSelect).eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? mapCampaignRow(data as CampaignRow) : null;
}

export async function saveCampaign(form: CampaignEditorFormValues, campaignId?: string): Promise<Campaign> {
  const payload = buildCampaignPayload(form);
  const query = campaignId
    ? supabase.from('campaigns').update(payload).eq('id', campaignId)
    : supabase.from('campaigns').insert(payload);

  const { data, error } = await query.select(campaignSelect).single();
  if (error) throw error;

  return mapCampaignRow(data as CampaignRow);
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

export function getCampaignPreset(campaignType: CampaignType) {
  return campaignTypeOptions.find((option) => option.value === campaignType) ?? campaignTypeOptions.at(-1)!;
}
