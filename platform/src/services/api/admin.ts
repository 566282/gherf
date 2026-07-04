import { supabase } from '@/services/supabase/client';
import { defaultCustomizationConfig, mergeCustomizationConfig } from '@/lib/customization';
import type { AdminConsoleConfig, AdminFeatureConfig, AdminThemeConfig, ThemeFont, ThemeMode, ThemePalette } from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

const ADMIN_CONSOLE_SETTING_KEY = 'admin_console_config';

const DEFAULT_CONFIG: AdminConsoleConfig = {
  features: {},
  theme: {
    mode: 'auto',
    palette: 'deep-blue',
    fontFamily: 'Inter',
  },
  customization: defaultCustomizationConfig,
};

const themeModes: ThemeMode[] = ['light', 'dark', 'auto'];
const themePalettes: ThemePalette[] = ['deep-blue', 'royal-blue', 'emerald', 'indigo'];
const themeFonts: ThemeFont[] = ['Inter', 'Geist', 'Plus Jakarta Sans'];

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

function toThemeConfig(value: unknown): AdminThemeConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.theme;
  }

  const mode = themeModes.includes(value.mode as ThemeMode) ? (value.mode as ThemeMode) : DEFAULT_CONFIG.theme.mode;
  const palette = themePalettes.includes(value.palette as ThemePalette) ? (value.palette as ThemePalette) : DEFAULT_CONFIG.theme.palette;
  const fontFamily = themeFonts.includes(value.fontFamily as ThemeFont) ? (value.fontFamily as ThemeFont) : DEFAULT_CONFIG.theme.fontFamily;

  return { mode, palette, fontFamily };
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

  return {
    features,
    theme: toThemeConfig(value.theme),
    customization: mergeCustomizationConfig(value.customization),
  };
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