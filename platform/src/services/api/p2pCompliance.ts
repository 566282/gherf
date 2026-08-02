import { supabase } from '@/services/supabase/client';
import { sendUserNotification } from '@/services/api/communications';

type ExternalAmlMerchant = {
  id: string;
  user_id: string | null;
  legal_name: string | null;
  display_name: string | null;
  country_code: string | null;
  risk_score: number | string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

export type ExternalAmlScreeningResult = {
  ok: boolean;
  providerName: string;
  providerUrl: string | null;
  screened: number;
  flagged: number;
  mocked: boolean;
  results: Array<Record<string, unknown>>;
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadAmlConnectorSettings(): Promise<{
  enabled: boolean;
  providerName: string;
  providerUrl: string | null;
  mockMode: boolean;
}> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', ['p2p_aml_provider_enabled', 'p2p_aml_provider_name', 'p2p_aml_provider_url', 'p2p_aml_provider_mock_mode']);

  if (error || !Array.isArray(data)) {
    return {
      enabled: true,
      providerName: 'mock-sanctions-grid',
      providerUrl: null,
      mockMode: true,
    };
  }

  const lookup = Object.fromEntries(data.map((row) => [String((row as Record<string, unknown>).key), (row as Record<string, unknown>).value]));
  return {
    enabled: toBoolean(lookup.p2p_aml_provider_enabled, true),
    providerName: typeof lookup.p2p_aml_provider_name === 'string' && lookup.p2p_aml_provider_name.trim()
      ? lookup.p2p_aml_provider_name
      : 'mock-sanctions-grid',
    providerUrl: typeof lookup.p2p_aml_provider_url === 'string' && lookup.p2p_aml_provider_url.trim()
      ? lookup.p2p_aml_provider_url.trim()
      : null,
    mockMode: toBoolean(lookup.p2p_aml_provider_mock_mode, true),
  };
}

function buildMockAmlResult(merchant: ExternalAmlMerchant, providerName: string): Record<string, unknown> {
  const riskScore = toNumber(merchant.risk_score, 0);
  const severity = riskScore >= 80 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
  const sanctionsScore = Number((riskScore / 100).toFixed(4));
  const matchedLists = severity === 'critical'
    ? ['sanctions_watchlist', 'pep_network']
    : severity === 'high'
      ? ['sanctions_watchlist']
      : severity === 'medium'
        ? ['adverse_media']
        : [];

  return {
    merchantId: merchant.id,
    severity,
    score: sanctionsScore,
    verdict: severity === 'critical' ? 'deny' : severity === 'high' ? 'review' : 'allow',
    matchedLists,
    metadata: {
      providerName,
      mode: 'mock',
      merchantStatus: merchant.status,
      countryCode: merchant.country_code,
    },
  };
}

async function persistAmlScreeningResults(results: Array<Record<string, unknown>>): Promise<void> {
  if (!results.length) return;

  const rows = results.map((result) => ({
    merchant_id: String(result.merchantId),
    signal_type: 'external_aml_screening',
    severity: String(result.severity ?? 'low'),
    signal_value: toNumber(result.score, 0),
    metadata: {
      verdict: result.verdict ?? 'allow',
      matchedLists: Array.isArray(result.matchedLists) ? result.matchedLists : [],
      ...(result.metadata as Record<string, unknown> ?? {}),
    },
  }));

  const { error } = await supabase.from('p2p_risk_signals').insert(rows);
  if (error) throw error;
}

export async function runExternalAmlScreening(limit = 25): Promise<ExternalAmlScreeningResult> {
  const settings = await loadAmlConnectorSettings();
  if (!settings.enabled) {
    return {
      ok: true,
      providerName: settings.providerName,
      providerUrl: settings.providerUrl,
      screened: 0,
      flagged: 0,
      mocked: settings.mockMode || !settings.providerUrl,
      results: [],
    };
  }

  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('id,user_id,legal_name,display_name,country_code,risk_score,status,metadata')
    .in('status', ['pending_qualification', 'active', 'under_review'])
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchants for AML screening.');
  }

  const merchants = data as ExternalAmlMerchant[];
  let results: Array<Record<string, unknown>> = [];
  const mocked = settings.mockMode || !settings.providerUrl;

  if (mocked) {
    results = merchants.map((merchant) => buildMockAmlResult(merchant, settings.providerName));
  } else {
    const response = await fetch(settings.providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: settings.providerName,
        merchants: merchants.map((merchant) => ({
          merchantId: merchant.id,
          legalName: merchant.legal_name,
          displayName: merchant.display_name,
          countryCode: merchant.country_code,
          riskScore: toNumber(merchant.risk_score, 0),
          status: merchant.status,
          metadata: merchant.metadata ?? {},
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`External AML provider request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    results = Array.isArray(payload.results) ? payload.results.map((item) => ({ ...(item as Record<string, unknown>) })) : [];
  }

  await persistAmlScreeningResults(results);

  const flagged = results.filter((result) => {
    const severity = String(result.severity ?? 'low');
    return severity === 'high' || severity === 'critical';
  }).length;

  return {
    ok: true,
    providerName: settings.providerName,
    providerUrl: settings.providerUrl,
    screened: results.length,
    flagged,
    mocked,
    results,
  };
}

export async function evaluateMerchantQualification(merchantId: string, triggeredBy?: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('evaluate_merchant_qualification', {
    p_merchant_id: merchantId,
    p_triggered_by: triggeredBy ?? null,
  });

  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PComplianceJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_compliance_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PLiquidityHealthJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_liquidity_health_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PMerchantAnalyticsJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_merchant_analytics_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function listP2PRiskSignals(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_risk_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load risk signals.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PFraudScores(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_fraud_scores')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load fraud scores.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PKycQueue(limit = 200): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_kyc_requirements')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant KYC queue.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PAssignmentEvents(limit = 200): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_assignment_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load assignment events.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function processP2PNotificationEvents(limit = 25): Promise<number> {
  const { data, error } = await supabase
    .from('p2p_notification_events')
    .select('id,user_id,template_key,channel,payload')
    .eq('delivery_status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load queued P2P notification events.');
  }

  let sentCount = 0;

  for (const row of data as Array<Record<string, unknown>>) {
    const eventId = String(row.id);
    const userId = row.user_id ? String(row.user_id) : null;
    const channel = String(row.channel ?? 'in_app');
    const payload = (row.payload as Record<string, unknown>) ?? {};
    const title = typeof payload.title === 'string' ? payload.title : 'P2P update';
    const message = typeof payload.message === 'string' ? payload.message : 'Your P2P order has a new update.';

    try {
      if (userId) {
        await sendUserNotification(userId, {
          title,
          message,
          type: 'info',
          category: 'transactional',
          channel: channel as 'in_app' | 'email' | 'push' | 'sms' | 'whatsapp' | 'telegram',
          templateKey: undefined,
          metadata: payload,
        });
      }

      const { error: markError } = await supabase
        .from('p2p_notification_events')
        .update({
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (markError) throw markError;
      sentCount += 1;
    } catch (sendError) {
      await supabase
        .from('p2p_notification_events')
        .update({
          delivery_status: 'failed',
          payload: {
            ...payload,
            lastError: sendError instanceof Error ? sendError.message : 'Failed to dispatch event',
          },
        })
        .eq('id', eventId);
    }
  }

  return sentCount;
}
