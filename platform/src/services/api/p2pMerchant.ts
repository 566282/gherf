import { supabase } from '@/services/supabase/client';

export type FiatPaymentIntent = {
  id: string;
  userId: string;
  moduleKey: string;
  intentType: string;
  sourceReference: string | null;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  currency: string;
  countryCode: string | null;
  providerKey: string;
  fallbackChain: string[];
  status: string;
  etaMinutes: number | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FiatPaymentIntentInput = {
  userId: string;
  moduleKey:
    | 'membership'
    | 'membership_multiplier'
    | 'membership_fee_settlement'
    | 'wallet_funding'
    | 'promotional_purchase'
    | 'premium_features'
    | string;
  intentType: string;
  sourceReference?: string | null;
  amount: number;
  currency: string;
  countryCode?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type FiatProviderPreview = {
  providerKey: string;
  fallbackChain: string[];
};

export type FiatFeeQuote = {
  policyKey: string | null;
  feeModel: string | null;
  feeAmount: number;
  totalAmount: number;
  fixedFee: number;
  percentFee: number;
};

export type MerchantProfile = {
  id: string;
  userId: string;
  merchantCode: string;
  legalName: string | null;
  displayName: string | null;
  status: string;
  regionCode: string | null;
  countryCode: string | null;
  preferredCurrency: string;
  riskScore: number;
  responseSlaSeconds: number;
  completionRate: number;
  ratingScore: number;
  metadata: Record<string, unknown>;
  activatedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantWalletAccount = {
  id: string;
  merchantId: string;
  walletType: 'available' | 'reserved' | 'pending' | 'locked';
  currency: string;
  availableBalance: number;
  reservedBalance: number;
  pendingBalance: number;
  lockedBalance: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MerchantOrderListItem = {
  id: string;
  orderCode: string;
  userId: string;
  merchantId: string | null;
  moduleKey: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  currency: string;
  currentState: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateP2POrderInput = {
  paymentIntentId: string;
  userId: string;
  moduleKey: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  currency: string;
  countryCode?: string | null;
  metadata?: Record<string, unknown>;
};

function mapIntent(row: Record<string, unknown>): FiatPaymentIntent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    moduleKey: String(row.module_key),
    intentType: String(row.intent_type),
    sourceReference: row.source_reference ? String(row.source_reference) : null,
    amount: Number(row.amount ?? 0),
    feeAmount: Number(row.fee_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    countryCode: row.country_code ? String(row.country_code) : null,
    providerKey: String(row.provider_key ?? 'direct_gateway_primary'),
    fallbackChain: Array.isArray(row.fallback_chain) ? row.fallback_chain.map((value) => String(value)) : [],
    status: String(row.status ?? 'created'),
    etaMinutes: row.eta_minutes == null ? null : Number(row.eta_minutes),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapMerchantProfile(row: Record<string, unknown>): MerchantProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    merchantCode: String(row.merchant_code),
    legalName: row.legal_name ? String(row.legal_name) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    status: String(row.status ?? 'pending_qualification'),
    regionCode: row.region_code ? String(row.region_code) : null,
    countryCode: row.country_code ? String(row.country_code) : null,
    preferredCurrency: String(row.preferred_currency ?? 'USD'),
    riskScore: Number(row.risk_score ?? 0),
    responseSlaSeconds: Number(row.response_sla_seconds ?? 900),
    completionRate: Number(row.completion_rate ?? 0),
    ratingScore: Number(row.rating_score ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapMerchantWallet(row: Record<string, unknown>): MerchantWalletAccount {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    walletType: String(row.wallet_type) as MerchantWalletAccount['walletType'],
    currency: String(row.currency ?? 'USD'),
    availableBalance: Number(row.available_balance ?? 0),
    reservedBalance: Number(row.reserved_balance ?? 0),
    pendingBalance: Number(row.pending_balance ?? 0),
    lockedBalance: Number(row.locked_balance ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapMerchantOrder(row: Record<string, unknown>): MerchantOrderListItem {
  return {
    id: String(row.id),
    orderCode: String(row.order_code),
    userId: String(row.user_id),
    merchantId: row.merchant_id ? String(row.merchant_id) : null,
    moduleKey: String(row.module_key),
    amount: Number(row.amount ?? 0),
    feeAmount: Number(row.fee_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    currentState: String(row.current_state ?? 'created'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function createFiatPaymentIntent(input: FiatPaymentIntentInput): Promise<FiatPaymentIntent> {
  const { data, error } = await supabase.rpc('create_fiat_payment_intent', {
    p_user_id: input.userId,
    p_module_key: input.moduleKey,
    p_intent_type: input.intentType,
    p_source_reference: input.sourceReference ?? null,
    p_amount: Number(input.amount || 0),
    p_currency: input.currency.toUpperCase(),
    p_country_code: input.countryCode ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) throw error;

  const intentId = String((data as Record<string, unknown> | null)?.payment_intent_id ?? '');
  if (!intentId) throw new Error('Unable to create fiat payment intent.');

  const { data: intent, error: intentError } = await supabase
    .from('fiat_payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (intentError || !intent) {
    throw intentError ?? new Error('Unable to load created fiat payment intent.');
  }

  return mapIntent(intent as Record<string, unknown>);
}

export async function previewFiatProvider(
  moduleKey: string,
  currency: string,
  countryCode?: string | null,
): Promise<FiatProviderPreview> {
  const { data, error } = await supabase.rpc('resolve_default_fiat_provider', {
    p_module_key: moduleKey,
    p_currency: currency.toUpperCase(),
    p_country_code: countryCode ?? null,
  });

  if (error) throw error;

  const payload = (data as Record<string, unknown> | null) ?? {};
  return {
    providerKey: String(payload.provider_key ?? 'direct_gateway_primary'),
    fallbackChain: Array.isArray(payload.fallback_chain)
      ? payload.fallback_chain.map((item) => String(item))
      : [],
  };
}

export async function quoteFiatFee(input: {
  userId: string;
  moduleKey: string;
  intentType: string;
  amount: number;
  currency: string;
  countryCode?: string | null;
}): Promise<FiatFeeQuote> {
  const { data, error } = await supabase.rpc('quote_fiat_fee', {
    p_user_id: input.userId,
    p_module_key: input.moduleKey,
    p_intent_type: input.intentType,
    p_country_code: input.countryCode ?? null,
    p_currency: input.currency.toUpperCase(),
    p_amount: Number(input.amount || 0),
  });

  if (error) throw error;

  const payload = (data as Record<string, unknown> | null) ?? {};
  return {
    policyKey: payload.policy_key ? String(payload.policy_key) : null,
    feeModel: payload.fee_model ? String(payload.fee_model) : null,
    feeAmount: Number(payload.fee_amount ?? 0),
    totalAmount: Number(payload.total_amount ?? input.amount),
    fixedFee: Number(payload.fixed_fee ?? 0),
    percentFee: Number(payload.percent_fee ?? 0),
  };
}

export async function createP2POrder(input: CreateP2POrderInput): Promise<MerchantOrderListItem> {
  const orderCode = `p2p-${input.userId.slice(0, 8)}-${Date.now()}`;

  const { data, error } = await supabase
    .from('p2p_orders')
    .insert({
      order_code: orderCode,
      payment_intent_id: input.paymentIntentId,
      user_id: input.userId,
      module_key: input.moduleKey,
      amount: Number(input.amount || 0),
      fee_amount: Number(input.feeAmount || 0),
      total_amount: Number(input.totalAmount || 0),
      currency: input.currency.toUpperCase(),
      country_code: input.countryCode ?? null,
      current_state: 'created',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create P2P order.');
  }

  return mapMerchantOrder(data as Record<string, unknown>);
}

export async function listFiatPaymentIntents(userId: string, limit = 50): Promise<FiatPaymentIntent[]> {
  const { data, error } = await supabase
    .from('fiat_payment_intents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load fiat payment intents.');
  }

  return data.map((row) => mapIntent(row as Record<string, unknown>));
}

export async function listMerchantProfiles(limit = 100): Promise<MerchantProfile[]> {
  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant profiles.');
  }

  return data.map((row) => mapMerchantProfile(row as Record<string, unknown>));
}

export async function getMerchantProfileByUserId(userId: string): Promise<MerchantProfile | null> {
  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapMerchantProfile(data as Record<string, unknown>);
}

export async function getMerchantWalletAccounts(merchantId: string): Promise<MerchantWalletAccount[]> {
  const { data, error } = await supabase
    .from('merchant_wallet_accounts')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('wallet_type', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant wallet accounts.');
  }

  return data.map((row) => mapMerchantWallet(row as Record<string, unknown>));
}

export async function listMerchantOrdersForUser(userId: string, limit = 50): Promise<MerchantOrderListItem[]> {
  const { data, error } = await supabase
    .from('p2p_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load P2P orders.');
  }

  return data.map((row) => mapMerchantOrder(row as Record<string, unknown>));
}

export async function listMerchantAssignedOrders(merchantId: string, limit = 50): Promise<MerchantOrderListItem[]> {
  const { data, error } = await supabase
    .from('p2p_orders')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant assigned orders.');
  }

  return data.map((row) => mapMerchantOrder(row as Record<string, unknown>));
}
