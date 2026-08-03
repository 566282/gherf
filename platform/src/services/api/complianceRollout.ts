import { supabase } from '@/services/supabase/client';

export type TaskComplianceRolloutMode = 'observe' | 'shadow_enforce' | 'soft_enforce' | 'full_enforce';

export interface TaskComplianceRolloutConfig {
  mode: TaskComplianceRolloutMode;
  rolloutPercent: number;
  softEnforceMinRiskScore: number;
  processNotificationQueue: boolean;
  runBackfill: boolean;
  maxBackfillBatch: number;
}

export interface TaskComplianceAlertThresholds {
  failedQueueCount: number;
  retryQueueCount: number;
  heldReviewBacklogCount: number;
  dueAppealCount: number;
}

export interface TaskComplianceRolloutDecision {
  inRollout: boolean;
  mode: TaskComplianceRolloutMode;
  effectiveState: 'held_compliance' | 'approved' | 'bypassed';
  reason: string;
}

const ROLLOUT_SETTINGS_KEY = 'task_compliance_rollout_v1';
const ALERT_THRESHOLDS_KEY = 'task_compliance_alert_thresholds_v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toInteger(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toRolloutMode(value: unknown, fallback: TaskComplianceRolloutMode): TaskComplianceRolloutMode {
  if (value === 'observe' || value === 'shadow_enforce' || value === 'soft_enforce' || value === 'full_enforce') {
    return value;
  }

  return fallback;
}

function hashToPercentBucket(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % 100;
}

const defaultRolloutConfig: TaskComplianceRolloutConfig = {
  mode: 'shadow_enforce',
  rolloutPercent: 20,
  softEnforceMinRiskScore: 75,
  processNotificationQueue: true,
  runBackfill: false,
  maxBackfillBatch: 200,
};

const defaultAlertThresholds: TaskComplianceAlertThresholds = {
  failedQueueCount: 15,
  retryQueueCount: 20,
  heldReviewBacklogCount: 50,
  dueAppealCount: 10,
};

export function getDefaultTaskComplianceRolloutConfig(): TaskComplianceRolloutConfig {
  return defaultRolloutConfig;
}

export function getDefaultTaskComplianceAlertThresholds(): TaskComplianceAlertThresholds {
  return defaultAlertThresholds;
}

export function parseTaskComplianceRolloutConfig(value: unknown): TaskComplianceRolloutConfig {
  if (!isRecord(value)) return defaultRolloutConfig;

  return {
    mode: toRolloutMode(value.mode, defaultRolloutConfig.mode),
    rolloutPercent: toInteger(value.rolloutPercent, defaultRolloutConfig.rolloutPercent, 0, 100),
    softEnforceMinRiskScore: toInteger(value.softEnforceMinRiskScore, defaultRolloutConfig.softEnforceMinRiskScore, 0, 100),
    processNotificationQueue: toBoolean(value.processNotificationQueue, defaultRolloutConfig.processNotificationQueue),
    runBackfill: toBoolean(value.runBackfill, defaultRolloutConfig.runBackfill),
    maxBackfillBatch: toInteger(value.maxBackfillBatch, defaultRolloutConfig.maxBackfillBatch, 25, 2000),
  };
}

export function parseTaskComplianceAlertThresholds(value: unknown): TaskComplianceAlertThresholds {
  if (!isRecord(value)) return defaultAlertThresholds;

  return {
    failedQueueCount: toInteger(value.failedQueueCount, defaultAlertThresholds.failedQueueCount, 1, 100000),
    retryQueueCount: toInteger(value.retryQueueCount, defaultAlertThresholds.retryQueueCount, 1, 100000),
    heldReviewBacklogCount: toInteger(value.heldReviewBacklogCount, defaultAlertThresholds.heldReviewBacklogCount, 1, 100000),
    dueAppealCount: toInteger(value.dueAppealCount, defaultAlertThresholds.dueAppealCount, 1, 100000),
  };
}

export async function getTaskComplianceRolloutConfig(): Promise<TaskComplianceRolloutConfig> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', ROLLOUT_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) {
    return defaultRolloutConfig;
  }

  return parseTaskComplianceRolloutConfig((data as { value: unknown }).value);
}

export async function getTaskComplianceAlertThresholds(): Promise<TaskComplianceAlertThresholds> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', ALERT_THRESHOLDS_KEY)
    .maybeSingle();

  if (error || !data) {
    return defaultAlertThresholds;
  }

  return parseTaskComplianceAlertThresholds((data as { value: unknown }).value);
}

export async function upsertTaskComplianceRolloutConfig(config: Partial<TaskComplianceRolloutConfig>): Promise<void> {
  const current = await getTaskComplianceRolloutConfig();
  const merged = parseTaskComplianceRolloutConfig({
    ...current,
    ...config,
  });

  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: ROLLOUT_SETTINGS_KEY,
      value: merged,
      description: 'Task compliance rollout controls for phase 10 staged activation',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}

export async function upsertTaskComplianceAlertThresholds(thresholds: Partial<TaskComplianceAlertThresholds>): Promise<void> {
  const current = await getTaskComplianceAlertThresholds();
  const merged = parseTaskComplianceAlertThresholds({
    ...current,
    ...thresholds,
  });

  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: ALERT_THRESHOLDS_KEY,
      value: merged,
      description: 'Task compliance operational alert thresholds for queue backlog and SLA risk',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}

export function evaluateTaskComplianceRolloutDecision(input: {
  userId: string;
  riskScore: number;
  desiredState: 'held_compliance' | 'approved' | 'bypassed';
  config: TaskComplianceRolloutConfig;
}): TaskComplianceRolloutDecision {
  const bucket = hashToPercentBucket(input.userId);
  const inRollout = bucket < input.config.rolloutPercent;

  if (input.config.mode === 'observe') {
    return {
      inRollout,
      mode: input.config.mode,
      effectiveState: 'bypassed',
      reason: 'observe_mode_bypass',
    };
  }

  if (!inRollout) {
    return {
      inRollout,
      mode: input.config.mode,
      effectiveState: 'bypassed',
      reason: 'outside_rollout_percent',
    };
  }

  if (input.config.mode === 'shadow_enforce') {
    return {
      inRollout,
      mode: input.config.mode,
      effectiveState: 'bypassed',
      reason: 'shadow_mode_bypass',
    };
  }

  if (input.config.mode === 'soft_enforce') {
    if (input.desiredState === 'held_compliance' && input.riskScore < input.config.softEnforceMinRiskScore) {
      return {
        inRollout,
        mode: input.config.mode,
        effectiveState: 'approved',
        reason: 'soft_enforce_low_risk_override',
      };
    }

    return {
      inRollout,
      mode: input.config.mode,
      effectiveState: input.desiredState,
      reason: 'soft_enforce_applied',
    };
  }

  return {
    inRollout,
    mode: input.config.mode,
    effectiveState: input.desiredState,
    reason: 'full_enforce_applied',
  };
}
