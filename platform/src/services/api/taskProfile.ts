import { supabase } from '@/services/supabase/client';

export interface SocialPlatformDefinition {
  id: string;
  platformKey: string;
  displayName: string;
  status: 'active' | 'paused' | 'archived';
  fieldSchema: Record<string, unknown>;
  verificationCapabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComplianceProfile {
  id: string;
  userId: string;
  preferredTaskTypes: string[];
  socialProfiles: Record<string, unknown>;
  onboardingProgress: Record<string, unknown>;
  onboardingCompleted: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toPlatform(row: Record<string, unknown>): SocialPlatformDefinition {
  return {
    id: String(row.id),
    platformKey: String(row.platform_key),
    displayName: String(row.display_name),
    status: String(row.status) as SocialPlatformDefinition['status'],
    fieldSchema: (row.field_schema as Record<string, unknown>) ?? {},
    verificationCapabilities: Array.isArray(row.verification_capabilities)
      ? row.verification_capabilities.map((item) => String(item))
      : [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toProfile(row: Record<string, unknown>): TaskComplianceProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    preferredTaskTypes: Array.isArray(row.preferred_task_types)
      ? row.preferred_task_types.map((item) => String(item))
      : [],
    socialProfiles: (row.social_profiles as Record<string, unknown>) ?? {},
    onboardingProgress: (row.onboarding_progress as Record<string, unknown>) ?? {},
    onboardingCompleted: Boolean(row.onboarding_completed),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listSocialPlatformDefinitions(): Promise<SocialPlatformDefinition[]> {
  const { data, error } = await supabase
    .from('social_platform_definitions')
    .select('*')
    .order('display_name', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load social platform definitions.');
  }

  return data.map((row) => toPlatform(row as Record<string, unknown>));
}

export async function upsertSocialPlatformDefinition(input: {
  platformKey: string;
  displayName: string;
  status: 'active' | 'paused' | 'archived';
  fieldSchema: Record<string, unknown>;
  verificationCapabilities: string[];
  metadata?: Record<string, unknown>;
  updatedBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('social_platform_definitions').upsert(
    {
      platform_key: input.platformKey,
      display_name: input.displayName,
      status: input.status,
      field_schema: input.fieldSchema,
      verification_capabilities: input.verificationCapabilities,
      metadata: input.metadata ?? {},
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'platform_key' },
  );

  if (error) throw error;
}

export async function getTaskComplianceProfile(userId: string): Promise<TaskComplianceProfile | null> {
  const { data, error } = await supabase
    .from('task_compliance_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toProfile(data as Record<string, unknown>);
}

export async function upsertTaskComplianceProfile(input: {
  userId: string;
  preferredTaskTypes: string[];
  socialProfiles: Record<string, unknown>;
  onboardingProgress: Record<string, unknown>;
  onboardingCompleted: boolean;
  metadata?: Record<string, unknown>;
}): Promise<TaskComplianceProfile> {
  const { data, error } = await supabase
    .from('task_compliance_profiles')
    .upsert(
      {
        user_id: input.userId,
        preferred_task_types: input.preferredTaskTypes,
        social_profiles: input.socialProfiles,
        onboarding_progress: input.onboardingProgress,
        onboarding_completed: input.onboardingCompleted,
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to save task compliance profile.');
  }

  return toProfile(data as Record<string, unknown>);
}
