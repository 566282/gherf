import { supabase } from '@/services/supabase/client';

export const CLASSROOM_ROLLOUT_SETTINGS_KEY = 'classroom_rollout_settings';

export type ClassroomRolloutCohort = 'internal' | 'beta' | 'production';

export type ClassroomLifecycleState =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'held'
  | 'review_required'
  | 'blocked'
  | 'archived';

export type ClassroomSessionRiskStatus = 'clear' | 'review' | 'blocked';

export type ClassroomLearningEventType =
  | 'session_started'
  | 'session_heartbeat'
  | 'session_focus_changed'
  | 'session_visibility_changed'
  | 'lesson_checkpoint'
  | 'playback_speed_changed'
  | 'quiz_started'
  | 'quiz_submitted'
  | 'assignment_submitted'
  | 'module_completed'
  | 'course_completed'
  | 'certificate_claimed';

export interface ClassroomRolloutSettings {
  enabled: boolean;
  cohort: ClassroomRolloutCohort;
  allowLearnerRoutes: boolean;
  allowAdminRoutes: boolean;
  allowRewardPayouts: boolean;
  allowWalletTransfers: boolean;
  allowTutor: boolean;
  eventSchemaVersion: string;
  apiSchemaVersion: string;
}

export interface ClassroomLearningEventEnvelope {
  schemaVersion: string;
  eventType: ClassroomLearningEventType;
  eventTime: string;
  source: string;
  payload: Record<string, unknown>;
}

const DEFAULT_ROLLOUT_SETTINGS: ClassroomRolloutSettings = {
  enabled: false,
  cohort: 'internal',
  allowLearnerRoutes: false,
  allowAdminRoutes: false,
  allowRewardPayouts: false,
  allowWalletTransfers: false,
  allowTutor: false,
  eventSchemaVersion: 'classroom_learning_event_v1',
  apiSchemaVersion: 'classroom_learning_api_v1',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function toCohort(value: unknown, fallback: ClassroomRolloutCohort): ClassroomRolloutCohort {
  if (value === 'internal' || value === 'beta' || value === 'production') {
    return value;
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length ? value : fallback;
}

function normalizeRolloutSettings(value: unknown): ClassroomRolloutSettings {
  if (!isRecord(value)) {
    return DEFAULT_ROLLOUT_SETTINGS;
  }

  return {
    enabled: toBoolean(value.enabled, DEFAULT_ROLLOUT_SETTINGS.enabled),
    cohort: toCohort(value.cohort, DEFAULT_ROLLOUT_SETTINGS.cohort),
    allowLearnerRoutes: toBoolean(value.allowLearnerRoutes, DEFAULT_ROLLOUT_SETTINGS.allowLearnerRoutes),
    allowAdminRoutes: toBoolean(value.allowAdminRoutes, DEFAULT_ROLLOUT_SETTINGS.allowAdminRoutes),
    allowRewardPayouts: toBoolean(value.allowRewardPayouts, DEFAULT_ROLLOUT_SETTINGS.allowRewardPayouts),
    allowWalletTransfers: toBoolean(value.allowWalletTransfers, DEFAULT_ROLLOUT_SETTINGS.allowWalletTransfers),
    allowTutor: toBoolean(value.allowTutor, DEFAULT_ROLLOUT_SETTINGS.allowTutor),
    eventSchemaVersion: toString(value.eventSchemaVersion, DEFAULT_ROLLOUT_SETTINGS.eventSchemaVersion),
    apiSchemaVersion: toString(value.apiSchemaVersion, DEFAULT_ROLLOUT_SETTINGS.apiSchemaVersion),
  };
}

export function getDefaultClassroomRolloutSettings(): ClassroomRolloutSettings {
  return DEFAULT_ROLLOUT_SETTINGS;
}

export async function getClassroomRolloutSettings(): Promise<ClassroomRolloutSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', CLASSROOM_ROLLOUT_SETTINGS_KEY)
    .maybeSingle<{ value: unknown }>();

  if (error) {
    throw error;
  }

  return normalizeRolloutSettings(data?.value);
}

export async function updateClassroomRolloutSettings(
  settings: Partial<ClassroomRolloutSettings>,
): Promise<ClassroomRolloutSettings> {
  const current = await getClassroomRolloutSettings();
  const merged = normalizeRolloutSettings({ ...current, ...settings });

  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: CLASSROOM_ROLLOUT_SETTINGS_KEY,
      value: merged,
      description: 'Classroom rollout, cohorting, and schema contract controls.',
    },
    { onConflict: 'key' },
  );

  if (error) {
    throw error;
  }

  return merged;
}

export function isClassroomRouteEnabled(settings: ClassroomRolloutSettings, scope: 'learner' | 'admin'): boolean {
  if (!settings.enabled) return false;
  return scope === 'admin' ? settings.allowAdminRoutes : settings.allowLearnerRoutes;
}

export function validateLearningEventEnvelope(event: ClassroomLearningEventEnvelope): void {
  if (!event.schemaVersion.trim()) {
    throw new Error('Learning event schemaVersion is required.');
  }
  if (!event.eventType.trim()) {
    throw new Error('Learning eventType is required.');
  }
  if (!event.source.trim()) {
    throw new Error('Learning event source is required.');
  }
  if (!event.eventTime || Number.isNaN(new Date(event.eventTime).getTime())) {
    throw new Error('Learning event eventTime must be a valid ISO timestamp.');
  }
  if (!isRecord(event.payload)) {
    throw new Error('Learning event payload must be a JSON object.');
  }
}
