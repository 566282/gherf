import { supabase } from '@/services/supabase/client';
import type { AdminConsoleConfig, AdminFeatureConfig } from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

const ADMIN_CONSOLE_SETTING_KEY = 'admin_console_config';

const DEFAULT_CONFIG: AdminConsoleConfig = {
  features: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFeatureConfig(value: unknown): AdminFeatureConfig | null {
  if (!isRecord(value)) return null;

  const enabled = typeof value.enabled === 'boolean' ? value.enabled : true;
  const mode = typeof value.mode === 'string' ? value.mode : '';
  const policy = typeof value.policy === 'string' ? value.policy : '';
  const scope = typeof value.scope === 'string' ? value.scope : '';
  const note = typeof value.note === 'string' ? value.note : '';

  return { enabled, mode, policy, scope, note };
}

function mergeAdminConsoleConfig(value: unknown): AdminConsoleConfig {
  if (!isRecord(value)) return DEFAULT_CONFIG;

  const features = isRecord(value.features)
    ? Object.entries(value.features).reduce<Record<string, AdminFeatureConfig>>((accumulator, [key, entry]) => {
        const feature = toFeatureConfig(entry);
        if (feature) accumulator[key] = feature;
        return accumulator;
      }, {})
    : {};

  return { features };
}

export async function listAdminConsoleConfig(): Promise<AdminConsoleConfig> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .eq('key', ADMIN_CONSOLE_SETTING_KEY)
    .single();

  if (error || !data) {
    return DEFAULT_CONFIG;
  }

  return mergeAdminConsoleConfig((data as SettingRow).value);
}

export async function updateAdminConsoleConfig(config: AdminConsoleConfig): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: ADMIN_CONSOLE_SETTING_KEY,
      value: config,
      description: 'Admin console feature controls and operational settings',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}