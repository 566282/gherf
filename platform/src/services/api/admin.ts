import { supabase } from '@/services/supabase/client';
import { defaultCustomizationConfig, mergeCustomizationConfig } from '@/lib/customization';
import type { EnterpriseModuleActivityItem, EnterpriseModuleRecord } from '@/features/admin/data/enterpriseModules';
import type { AdminConsoleConfig, AdminFeatureConfig, AdminThemeConfig, ThemeFont, ThemeMode, ThemePalette } from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

const ADMIN_CONSOLE_SETTING_KEY = 'admin_console_config';
const ADMIN_MODULE_CATALOG_SETTING_KEY = 'enterprise_admin_module_catalog';

export type AdminModuleCatalogEntry = {
  records: EnterpriseModuleRecord[];
  activity: EnterpriseModuleActivityItem[];
};

export type AdminModuleCatalog = Record<string, AdminModuleCatalogEntry>;
export type ReferralOpsReviewState = {
  commissionStatusFilter: 'all' | 'pending' | 'held' | 'available' | 'paid';
  fraudStatusFilter: 'all' | 'open' | 'investigating' | 'resolved' | 'blocked';
  searchQuery: string;
  selectedPreset: string;
};
export type ReferralOpsReviewPreset = {
  key: string;
  label: string;
  description: string;
  state: Omit<ReferralOpsReviewState, 'selectedPreset'>;
};
const REFERRAL_OPS_REVIEW_STATE_KEY = 'referral_ops_review_state';

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

function isModuleRecord(value: unknown): value is EnterpriseModuleRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.category === 'string' &&
    typeof value.status === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.value === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.risk === 'Low' || value.risk === 'Medium' || value.risk === 'High') &&
    typeof value.notes === 'string'
  );
}

function isModuleActivity(value: unknown): value is EnterpriseModuleActivityItem {
  return isRecord(value) && typeof value.title === 'string' && typeof value.description === 'string' && typeof value.meta === 'string';
}

function mergeAdminModuleCatalog(value: unknown): AdminModuleCatalog {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<AdminModuleCatalog>((catalog, [moduleKey, entry]) => {
    if (!isRecord(entry)) {
      return catalog;
    }

    const records = Array.isArray(entry.records) ? entry.records.filter(isModuleRecord) : [];
    const activity = Array.isArray(entry.activity) ? entry.activity.filter(isModuleActivity) : [];

    catalog[moduleKey] = { records, activity };
    return catalog;
  }, {});
}

export async function listAdminModuleCatalog(): Promise<AdminModuleCatalog> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .eq('key', ADMIN_MODULE_CATALOG_SETTING_KEY)
    .single();

  if (error || !data) {
    return {};
  }

  return mergeAdminModuleCatalog((data as SettingRow).value);
}

export async function updateAdminModuleCatalog(
  moduleKey: string,
  entry: AdminModuleCatalogEntry,
  updatedBy?: string,
): Promise<void> {
  const catalog = await listAdminModuleCatalog();
  const nextCatalog = {
    ...catalog,
    [moduleKey]: entry,
  };

  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: ADMIN_MODULE_CATALOG_SETTING_KEY,
      value: nextCatalog,
      description: 'Enterprise admin module catalog and activity snapshots',
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}

const DEFAULT_REFERRAL_OPS_REVIEW_STATE: ReferralOpsReviewState = {
  commissionStatusFilter: 'all',
  fraudStatusFilter: 'all',
  searchQuery: '',
  selectedPreset: 'custom',
};

export const referralOpsReviewPresets: ReferralOpsReviewPreset[] = [
  {
    key: 'pending-review',
    label: 'Pending review',
    description: 'Focus on commissions that are still waiting for approval.',
    state: {
      commissionStatusFilter: 'pending',
      fraudStatusFilter: 'all',
      searchQuery: '',
    },
  },
  {
    key: 'held-review',
    label: 'Held commissions',
    description: 'Review payouts that have already been paused for manual check.',
    state: {
      commissionStatusFilter: 'held',
      fraudStatusFilter: 'investigating',
      searchQuery: '',
    },
  },
  {
    key: 'blocked-review',
    label: 'Blocked fraud',
    description: 'Inspect fraud flags and commissions that should not move forward.',
    state: {
      commissionStatusFilter: 'all',
      fraudStatusFilter: 'blocked',
      searchQuery: '',
    },
  },
];

function mergeReferralOpsReviewState(value: unknown): ReferralOpsReviewState {
  if (!isRecord(value)) {
    return DEFAULT_REFERRAL_OPS_REVIEW_STATE;
  }

  const commissionStatusFilter = ['all', 'pending', 'held', 'available', 'paid'].includes(String(value.commissionStatusFilter))
    ? (value.commissionStatusFilter as ReferralOpsReviewState['commissionStatusFilter'])
    : DEFAULT_REFERRAL_OPS_REVIEW_STATE.commissionStatusFilter;
  const fraudStatusFilter = ['all', 'open', 'investigating', 'resolved', 'blocked'].includes(String(value.fraudStatusFilter))
    ? (value.fraudStatusFilter as ReferralOpsReviewState['fraudStatusFilter'])
    : DEFAULT_REFERRAL_OPS_REVIEW_STATE.fraudStatusFilter;

  return {
    commissionStatusFilter,
    fraudStatusFilter,
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : DEFAULT_REFERRAL_OPS_REVIEW_STATE.searchQuery,
    selectedPreset: typeof value.selectedPreset === 'string' && value.selectedPreset.trim() ? value.selectedPreset.trim() : DEFAULT_REFERRAL_OPS_REVIEW_STATE.selectedPreset,
  };
}

export async function listReferralOpsReviewState(): Promise<ReferralOpsReviewState> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .eq('key', REFERRAL_OPS_REVIEW_STATE_KEY)
    .single();

  if (error || !data) {
    return DEFAULT_REFERRAL_OPS_REVIEW_STATE;
  }

  return mergeReferralOpsReviewState((data as SettingRow).value);
}

export async function updateReferralOpsReviewState(state: ReferralOpsReviewState, updatedBy?: string): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: REFERRAL_OPS_REVIEW_STATE_KEY,
      value: state,
      description: 'Shared referral ops review filters and search state',
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}