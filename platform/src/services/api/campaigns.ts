import { supabase } from '@/services/supabase/client';
import { defaultFraudThresholds, fraudRiskChecks } from '@/services/api/fraud';
import type {
  CampaignCategory,
  Campaign,
  CampaignBrowserRestriction,
  CampaignDeviceRestriction,
  CampaignDurationUnit,
  CampaignEngineConfig,
  CampaignRecurringConfig,
  CampaignTargetAudience,
  CampaignTypeDefinition,
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
  campaign_image_url: string | null;
  video_url: string | null;
  landing_url: string | null;
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
  age_restriction_min: number | null;
  age_restriction_max: number | null;
  campaign_categories: string[] | null;
  recurring_config: JsonValue | null;
  current_participants: number | null;
  created_at: string;
  updated_at: string;
};

type CampaignTypeRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  default_instructions: string | null;
  default_verification_method: CampaignVerificationMethod | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CampaignCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export interface CampaignEditorFormValues {
  businessId: string;
  title: string;
  description: string;
  bannerUrl: string;
  campaignImageUrl: string;
  videoUrl: string;
  landingUrl: string;
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
  ageRestrictionMin: number | null;
  ageRestrictionMax: number | null;
  verificationMethod: CampaignVerificationMethod;
  autoApproval: boolean;
  manualApproval: boolean;
  budget: number;
  budgetCurrency: string;
  totalParticipants: number;
  campaignCategories: string;
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
  recurringEnabled: boolean;
  recurringFrequency: CampaignRecurringConfig['frequency'];
  recurringInterval: number;
  recurringDaysOfWeek: string;
  recurringEndsAt: string;
  recurringTimezone: string;
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

const defaultRecurringConfig = (): CampaignRecurringConfig => ({
  enabled: false,
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [],
  timezone: 'UTC',
  endsAt: null,
});

const defaultEngineConfig = (campaignType: CampaignType): CampaignEngineConfig => ({
  campaignType,
  instructions: '',
  campaignImageUrl: '',
  videoUrl: '',
  landingUrl: '',
  rewardAmount: 1,
  durationValue: 1,
  durationUnit: 'days',
  completionLimit: 100,
  dailyLimit: 10,
  countryRestrictions: [],
  deviceRestrictions: ['any'],
  browserRestrictions: ['any'],
  ageRestrictionMin: null,
  ageRestrictionMax: null,
  verificationMethod: 'manual_review',
  autoApproval: false,
  manualApproval: true,
  budget: 100,
  totalParticipants: 100,
  campaignCategories: [],
  targetAudience: defaultTargetAudience,
  activeFrom: new Date().toISOString(),
  activeTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  priority: 0,
  requiredScreenshots: 0,
  requiredProof: '',
  verificationPolicy: {
    primaryMethod: 'manual_review',
    requiredEvidence: ['screenshot_upload'],
    riskChecks: [...fraudRiskChecks],
    randomAuditRate: 0,
    fraudThreshold: defaultFraudThresholds.block,
    appealWindowHours: 72,
  },
  recurringConfig: defaultRecurringConfig(),
  timeDelayBeforeReward: 0,
  cooldownPeriod: 0,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campaign-type';
}

function mapCampaignTypeRow(row: CampaignTypeRow): CampaignTypeDefinition {
  return {
    value: row.slug,
    label: row.label,
    description: row.description ?? '',
    defaultInstructions: row.default_instructions ?? '',
    defaultVerificationMethod: normalizeVerificationMethod(row.default_verification_method, 'manual_review'),
    isSystem: row.is_system,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapCampaignCategoryRow(row: CampaignCategoryRow): CampaignCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    isActive: row.is_active,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

function normalizeRecurringConfig(value: unknown, fallback: CampaignRecurringConfig): CampaignRecurringConfig {
  const raw = (value ?? {}) as Record<string, unknown>;

  return {
    enabled: Boolean(raw.enabled ?? fallback.enabled),
    frequency: (raw.frequency as CampaignRecurringConfig['frequency'] | undefined) ?? fallback.frequency,
    interval: Number(raw.interval ?? fallback.interval),
    daysOfWeek: Array.isArray(raw.daysOfWeek) ? (raw.daysOfWeek as string[]) : fallback.daysOfWeek,
    timezone: typeof raw.timezone === 'string' && raw.timezone.trim().length ? raw.timezone : fallback.timezone,
    endsAt: typeof raw.endsAt === 'string' ? raw.endsAt : null,
  };
}

export const campaignTypeOptions: CampaignTypeDefinition[] = [
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

export async function listCampaignTypes(): Promise<CampaignTypeDefinition[]> {
  try {
    const { data, error } = await supabase
      .from('campaign_type_definitions')
      .select('id,slug,label,description,default_instructions,default_verification_method,is_active,is_system,sort_order,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;

    const records = (data ?? []).map((row) => mapCampaignTypeRow(row as CampaignTypeRow)).filter((item) => item.isActive !== false);
    return records.length ? records : campaignTypeOptions;
  } catch {
    return campaignTypeOptions;
  }
}

export async function createCampaignType(input: {
  slug?: string;
  label: string;
  description?: string;
  defaultInstructions?: string;
  defaultVerificationMethod?: CampaignVerificationMethod;
  sortOrder?: number;
}): Promise<CampaignTypeDefinition> {
  const payload = {
    slug: input.slug?.trim() || slugify(input.label),
    label: input.label.trim(),
    description: input.description?.trim() || null,
    default_instructions: input.defaultInstructions?.trim() || '',
    default_verification_method: input.defaultVerificationMethod ?? 'manual_review',
    sort_order: input.sortOrder ?? 0,
    is_active: true,
    is_system: false,
  };

  const { data, error } = await supabase.from('campaign_type_definitions').insert(payload).select().single();
  if (error) throw error;

  return mapCampaignTypeRow(data as CampaignTypeRow);
}

export async function listCampaignCategories(): Promise<CampaignCategory[]> {
  try {
    const { data, error } = await supabase
      .from('campaign_categories')
      .select('id,slug,name,description,is_active,is_system,sort_order,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    const records = (data ?? []).map((row) => mapCampaignCategoryRow(row as CampaignCategoryRow)).filter((item) => item.isActive !== false);
    return records;
  } catch {
    return [];
  }
}

export async function createCampaignCategory(input: {
  slug?: string;
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<CampaignCategory> {
  const payload = {
    slug: input.slug?.trim() || slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    is_active: true,
    is_system: false,
  };

  const { data, error } = await supabase.from('campaign_categories').insert(payload).select().single();
  if (error) throw error;

  return mapCampaignCategoryRow(data as CampaignCategoryRow);
}

function normalizeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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
    campaignImageUrl: (raw.campaignImageUrl as string | undefined) ?? (raw.campaign_image_url as string | undefined) ?? fallback.campaignImageUrl,
    videoUrl: (raw.videoUrl as string | undefined) ?? (raw.video_url as string | undefined) ?? fallback.videoUrl,
    landingUrl: (raw.landingUrl as string | undefined) ?? (raw.landing_url as string | undefined) ?? fallback.landingUrl,
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
    ageRestrictionMin: typeof raw.ageRestrictionMin === 'number' ? raw.ageRestrictionMin : typeof raw.age_restriction_min === 'number' ? raw.age_restriction_min : fallback.ageRestrictionMin,
    ageRestrictionMax: typeof raw.ageRestrictionMax === 'number' ? raw.ageRestrictionMax : typeof raw.age_restriction_max === 'number' ? raw.age_restriction_max : fallback.ageRestrictionMax,
    verificationMethod: normalizeVerificationMethod(raw.verificationMethod, fallback.verificationMethod),
    autoApproval: Boolean(raw.autoApproval ?? fallback.autoApproval),
    manualApproval: Boolean(raw.manualApproval ?? fallback.manualApproval),
    budget: Number(raw.budget ?? fallback.budget),
    totalParticipants: Number(raw.totalParticipants ?? fallback.totalParticipants),
    campaignCategories: Array.isArray(raw.campaignCategories)
      ? (raw.campaignCategories as string[])
      : Array.isArray(raw.campaign_categories)
        ? (raw.campaign_categories as string[])
        : fallback.campaignCategories,
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
    recurringConfig: normalizeRecurringConfig(raw.recurringConfig ?? raw.recurring_config, fallback.recurringConfig),
    timeDelayBeforeReward: Number(raw.timeDelayBeforeReward ?? fallback.timeDelayBeforeReward),
    cooldownPeriod: Number(raw.cooldownPeriod ?? fallback.cooldownPeriod),
  };
}

export function createDefaultCampaignForm(campaignTypeOrPreset: CampaignTypeDefinition | CampaignType = 'custom_tasks'): CampaignEditorFormValues {
  const preset = typeof campaignTypeOrPreset === 'string'
    ? campaignTypeOptions.find((option) => option.value === campaignTypeOrPreset) ?? campaignTypeOptions.at(-1)!
    : campaignTypeOrPreset;
  const campaignType = typeof campaignTypeOrPreset === 'string' ? campaignTypeOrPreset : campaignTypeOrPreset.value;
  const engine = defaultEngineConfig(campaignType);

  engine.instructions = preset.defaultInstructions;
  engine.verificationMethod = preset.defaultVerificationMethod;
  engine.verificationPolicy.primaryMethod = preset.defaultVerificationMethod;

  return {
    businessId: '',
    title: preset.label,
    description: preset.description,
    bannerUrl: '',
    campaignImageUrl: '',
    videoUrl: '',
    landingUrl: '',
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
    ageRestrictionMin: null,
    ageRestrictionMax: null,
    verificationMethod: engine.verificationMethod,
    autoApproval: engine.autoApproval,
    manualApproval: engine.manualApproval,
    budget: engine.budget,
    budgetCurrency: 'USD',
    totalParticipants: engine.totalParticipants,
    campaignCategories: '',
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
    recurringEnabled: engine.recurringConfig.enabled,
    recurringFrequency: engine.recurringConfig.frequency,
    recurringInterval: engine.recurringConfig.interval,
    recurringDaysOfWeek: engine.recurringConfig.daysOfWeek.join(', '),
    recurringEndsAt: engine.recurringConfig.endsAt ? formatDateTimeLocal(engine.recurringConfig.endsAt) : '',
    recurringTimezone: engine.recurringConfig.timezone,
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
    campaignImageUrl: campaign.campaignImageUrl ?? engine.campaignImageUrl ?? '',
    videoUrl: campaign.videoUrl ?? engine.videoUrl ?? '',
    landingUrl: campaign.landingUrl ?? engine.landingUrl ?? '',
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
    ageRestrictionMin: campaign.ageRestrictionMin ?? engine.ageRestrictionMin,
    ageRestrictionMax: campaign.ageRestrictionMax ?? engine.ageRestrictionMax,
    verificationMethod: engine.verificationMethod,
    autoApproval: engine.autoApproval,
    manualApproval: engine.manualApproval,
    budget: campaign.budget,
    budgetCurrency: campaign.budgetCurrency,
    totalParticipants: campaign.maxParticipants ?? engine.totalParticipants,
    campaignCategories: (campaign.campaignCategories ?? engine.campaignCategories).join(', '),
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
    recurringEnabled: engine.recurringConfig.enabled,
    recurringFrequency: engine.recurringConfig.frequency,
    recurringInterval: engine.recurringConfig.interval,
    recurringDaysOfWeek: engine.recurringConfig.daysOfWeek.join(', '),
    recurringEndsAt: engine.recurringConfig.endsAt ? formatDateTimeLocal(engine.recurringConfig.endsAt) : '',
    recurringTimezone: engine.recurringConfig.timezone,
    timeDelayBeforeReward: engine.timeDelayBeforeReward,
    cooldownPeriod: engine.cooldownPeriod,
  };
}

export function buildCampaignEngineConfig(form: CampaignEditorFormValues): CampaignEngineConfig {
  const recurringEndsAt = form.recurringEnabled && form.recurringEndsAt ? toISOStringFromLocal(form.recurringEndsAt) : null;

  return {
    campaignType: form.campaignType,
    instructions: form.instructions,
    campaignImageUrl: form.campaignImageUrl,
    videoUrl: form.videoUrl,
    landingUrl: form.landingUrl,
    rewardAmount: Number(form.rewardAmount),
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit,
    completionLimit: Number(form.completionLimit),
    dailyLimit: Number(form.dailyLimit),
    countryRestrictions: normalizeList(form.countryRestrictions),
    deviceRestrictions: normalizeList(form.deviceRestrictions) as CampaignDeviceRestriction[],
    browserRestrictions: normalizeList(form.browserRestrictions) as CampaignBrowserRestriction[],
    ageRestrictionMin: toNullableNumber(form.ageRestrictionMin),
    ageRestrictionMax: toNullableNumber(form.ageRestrictionMax),
    verificationMethod: form.verificationMethod,
    autoApproval: Boolean(form.autoApproval),
    manualApproval: Boolean(form.manualApproval),
    budget: Number(form.budget),
    totalParticipants: Number(form.totalParticipants),
    campaignCategories: normalizeList(form.campaignCategories),
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
      riskChecks: [...fraudRiskChecks],
      randomAuditRate: form.verificationMethod === 'random_audit' ? 100 : 0,
      fraudThreshold: defaultFraudThresholds.block,
      appealWindowHours: 72,
    },
    recurringConfig: {
      enabled: Boolean(form.recurringEnabled),
      frequency: form.recurringFrequency,
      interval: Number(form.recurringInterval),
      daysOfWeek: normalizeList(form.recurringDaysOfWeek),
      timezone: form.recurringTimezone || 'UTC',
      endsAt: recurringEndsAt,
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
    campaign_image_url: form.campaignImageUrl || null,
    video_url: form.videoUrl || null,
    landing_url: form.landingUrl || null,
    campaign_type: form.campaignType,
    instructions: form.instructions,
    status: form.status,
    start_date: engineConfig.activeFrom,
    end_date: engineConfig.activeTo,
    budget: Number(form.budget),
    budget_currency: form.budgetCurrency,
    total_rewards_allocated: Number(form.budget),
    max_participants: Number(form.totalParticipants) || null,
    age_restriction_min: engineConfig.ageRestrictionMin,
    age_restriction_max: engineConfig.ageRestrictionMax,
    campaign_categories: engineConfig.campaignCategories,
    recurring_config: engineConfig.recurringConfig,
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
    campaignImageUrl: row.campaign_image_url ?? engineConfig.campaignImageUrl,
    videoUrl: row.video_url ?? engineConfig.videoUrl,
    landingUrl: row.landing_url ?? engineConfig.landingUrl,
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
    ageRestrictionMin: row.age_restriction_min ?? engineConfig.ageRestrictionMin,
    ageRestrictionMax: row.age_restriction_max ?? engineConfig.ageRestrictionMax,
    campaignCategories: row.campaign_categories ?? engineConfig.campaignCategories,
    recurringConfig: normalizeRecurringConfig(row.recurring_config, engineConfig.recurringConfig),
    currentParticipants: row.current_participants ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const campaignSelect =
  'id,business_id,title,description,banner_url,campaign_image_url,video_url,landing_url,campaign_type,instructions,engine_config,status,start_date,end_date,budget,budget_currency,total_rewards_allocated,max_participants,age_restriction_min,age_restriction_max,campaign_categories,recurring_config,current_participants,created_at,updated_at';

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
