import { supabase } from '@/services/supabase/client';

export async function listFiatProviderSettings(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('fiat_payment_provider_settings')
    .select('*')
    .order('rank_order', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load fiat provider settings.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function upsertFiatProviderSetting(input: {
  providerKey: string;
  providerClass: 'direct_gateway' | 'p2p_merchant' | 'hybrid';
  status: 'active' | 'paused' | 'disabled';
  rankOrder: number;
  supportedModules: string[];
  supportedCountries: string[];
  supportedCurrencies: string[];
  fallbackChain: string[];
  config?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('fiat_payment_provider_settings').upsert(
    {
      provider_key: input.providerKey,
      provider_class: input.providerClass,
      status: input.status,
      rank_order: input.rankOrder,
      supported_modules: input.supportedModules,
      supported_countries: input.supportedCountries,
      supported_currencies: input.supportedCurrencies,
      fallback_chain: input.fallbackChain,
      config: input.config ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'provider_key' },
  );

  if (error) throw error;
}

export async function listFiatFeePolicies(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('fiat_platform_fee_policies')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load fiat fee policies.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function upsertFiatFeePolicy(input: {
  policyKey: string;
  status: 'active' | 'draft' | 'paused' | 'archived';
  feeModel: 'fixed' | 'percentage' | 'hybrid';
  appliesToModules: string[];
  appliesToIntentTypes: string[];
  countries: string[];
  currencies: string[];
  minAmount: number;
  maxAmount?: number | null;
  fixedFee: number;
  percentFee: number;
  waiverRules?: unknown[];
  discountRules?: unknown[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('fiat_platform_fee_policies').upsert(
    {
      policy_key: input.policyKey,
      status: input.status,
      fee_model: input.feeModel,
      applies_to_modules: input.appliesToModules,
      applies_to_intent_types: input.appliesToIntentTypes,
      countries: input.countries,
      currencies: input.currencies,
      min_amount: input.minAmount,
      max_amount: input.maxAmount ?? null,
      fixed_fee: input.fixedFee,
      percent_fee: input.percentFee,
      waiver_rules: input.waiverRules ?? [],
      discount_rules: input.discountRules ?? [],
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'policy_key' },
  );

  if (error) throw error;
}

export async function listQualificationRules(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_qualification_rules')
    .select('*')
    .order('priority', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant qualification rules.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function upsertQualificationRule(input: {
  ruleKey: string;
  status: 'active' | 'draft' | 'paused' | 'archived';
  priority: number;
  criteria: Record<string, unknown>;
  outcomeOnFail: 'disable' | 'suspend' | 'review';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('merchant_qualification_rules').upsert(
    {
      rule_key: input.ruleKey,
      status: input.status,
      priority: input.priority,
      criteria: input.criteria,
      outcome_on_fail: input.outcomeOnFail,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'rule_key' },
  );

  if (error) throw error;
}

export async function listP2PRolloutFlags(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_rollout_flags')
    .select('*')
    .order('flag_key', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load P2P rollout flags.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function upsertP2PRolloutFlag(input: {
  flagKey: string;
  status: 'active' | 'draft' | 'paused' | 'archived';
  mode: 'shadow' | 'progressive' | 'enforced';
  rolloutPercent: number;
  cohortRule?: Record<string, unknown>;
  fallbackProviderKey?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('p2p_rollout_flags').upsert(
    {
      flag_key: input.flagKey,
      status: input.status,
      mode: input.mode,
      rollout_percent: Math.max(0, Math.min(100, Math.round(input.rolloutPercent))),
      cohort_rule: input.cohortRule ?? {},
      fallback_provider_key: input.fallbackProviderKey ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'flag_key' },
  );

  if (error) throw error;
}

export async function listP2PRuntimeSettings(): Promise<Record<string, unknown>> {
  const keys = [
    'fiat_default_provider_key',
    'fiat_provider_fallback_chain',
    'p2p_rollout_mode',
    'p2p_rollout_percent',
    'p2p_shadow_mode',
    'p2p_dispute_auto_escalation_hours',
    'p2p_min_operating_balance',
    'p2p_aml_provider_enabled',
    'p2p_aml_provider_name',
    'p2p_aml_provider_url',
    'p2p_aml_provider_mock_mode',
  ];

  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', keys);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load P2P runtime settings.');
  }

  return Object.fromEntries(
    data.map((row) => [String((row as Record<string, unknown>).key), (row as Record<string, unknown>).value]),
  );
}

export async function applyMerchantWalletOperation(input: {
  merchantId: string;
  entryType: 'top_up' | 'withdrawal';
  amount: number;
  currency: string;
  note?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('merchant_wallet_apply_entry', {
    p_merchant_id: input.merchantId,
    p_entry_type: input.entryType,
    p_amount: Number(input.amount || 0),
    p_currency: input.currency.toUpperCase(),
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_note: input.note ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}
