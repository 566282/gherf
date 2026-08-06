import { supabase } from '../supabase/client';
import { resolvePaymentGatewayRoute } from './membershipLifecycle';

export type MembershipGatewayProvider = {
  id: string;
  providerKey: string;
  isActive: boolean;
  rankOrder: number;
  supportedCurrencies: string[];
  maxAmount: number;
  config: Record<string, unknown>;
};

export type MembershipGatewayWebhookInput = {
  providerKey: string;
  eventType: string;
  paymentReference: string;
  payload: Record<string, unknown>;
};

function toProvider(row: Record<string, unknown>): MembershipGatewayProvider {
  return {
    id: String(row.id),
    providerKey: String(row.provider_key),
    isActive: Boolean(row.is_active),
    rankOrder: Number(row.rank_order ?? 100),
    supportedCurrencies: Array.isArray(row.supported_currencies)
      ? row.supported_currencies.map((item) => String(item).toUpperCase())
      : ['NGN'],
    maxAmount: Number(row.max_amount ?? 0),
    config: (row.config as Record<string, unknown>) ?? {},
  };
}

export async function listMembershipGatewayProviders(): Promise<MembershipGatewayProvider[]> {
  const { data, error } = await supabase
    .from('membership_gateway_registry')
    .select('id,provider_key,is_active,rank_order,supported_currencies,max_amount,config')
    .eq('is_active', true)
    .order('rank_order', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership gateway providers.');
  }

  return data.map((row) => toProvider(row as Record<string, unknown>));
}

export async function selectMembershipGateway(amount: number, currency: string): Promise<string> {
  const providers = await listMembershipGatewayProviders();
  const decision = resolvePaymentGatewayRoute({
    amount,
    currency: currency.toUpperCase(),
    availableProviders: providers.map((provider) => ({
      id: provider.providerKey,
      currencies: provider.supportedCurrencies,
      maxAmount: provider.maxAmount,
      rank: provider.rankOrder,
    })),
  });

  return decision.provider;
}

export async function ingestMembershipGatewayWebhook(input: MembershipGatewayWebhookInput): Promise<void> {
  const { error: ingestError } = await supabase.rpc('ingest_membership_gateway_event', {
    p_provider_key: input.providerKey,
    p_event_type: input.eventType,
    p_reference: input.paymentReference,
    p_payload: input.payload,
  });

  if (ingestError) throw ingestError;

  const paymentStatus = String(input.payload.status ?? '').toLowerCase();
  const isPaid = paymentStatus === 'paid' || paymentStatus === 'success' || paymentStatus === 'succeeded';

  if (isPaid) {
    const { error: orderError } = await supabase
      .from('membership_multiplier_orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('payment_reference', input.paymentReference)
      .in('status', ['pending', 'processing']);

    if (orderError) throw orderError;
  }
}
