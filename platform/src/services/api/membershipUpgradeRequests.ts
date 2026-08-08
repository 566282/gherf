import { supabase } from '@/services/supabase/client';
import { resolveMembershipLabel, resolveMembershipPlan } from '@/services/api/membership';
import { startFiatPurchase } from '@/services/api/p2pMerchant';
import { releaseWithdrawalHolds } from '@/services/api/wallet';

type UpgradeRequestRow = {
  id: string;
  request_id: string;
  user_id: string;
  current_tier: number;
  target_tier: number;
  payment_intent_id: string | null;
  payment_reference: string | null;
  status: 'pending' | 'settled' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  settled_at: string | null;
  created_at?: string;
  failed_at?: string | null;
  cancelled_at?: string | null;
  metadata: Record<string, unknown> | null;
};

type ProfileLevelRow = {
  level_tier: number;
};

export async function createMembershipUpgradeRequest(input: {
  userId: string;
  targetTier: number;
  paymentAmount: number;
  paymentCurrency: string;
}): Promise<UpgradeRequestRow> {
  const targetPlan = resolveMembershipPlan(input.targetTier);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('level_tier')
    .eq('id', input.userId)
    .single<ProfileLevelRow>();

  if (profileError || !profile) {
    throw profileError ?? new Error('Unable to load current membership tier.');
  }

  const currentTier = Math.max(0, Math.round(profile.level_tier ?? 0));
  const amount = Number(input.paymentAmount || targetPlan.price);
  const currency = input.paymentCurrency || targetPlan.currency;
  const requestId = `mem-upg-${input.userId.slice(0, 8)}-${targetPlan.level}-${Date.now()}`;

  const paymentFlow = await startFiatPurchase({
    userId: input.userId,
    moduleKey: 'membership',
    intentType: 'membership_plan_upgrade',
    sourceReference: requestId,
    amount,
    currency,
    createOrder: true,
    idempotencyKey: `${requestId}-intent`,
    metadata: {
      requestId,
      currentTier,
      targetTier: targetPlan.level,
    },
  });

  const { data, error } = await supabase
    .from('membership_upgrade_requests')
    .insert({
      request_id: requestId,
      user_id: input.userId,
      current_tier: currentTier,
      target_tier: targetPlan.level,
      payment_intent_id: paymentFlow.intent.id,
      payment_reference: paymentFlow.intent.id,
      status: 'pending',
      amount,
      currency,
      metadata: {
        source: 'membership_upgrade_request',
        provider: paymentFlow.intent.providerKey,
        p2pOrderId: paymentFlow.order?.id ?? null,
        p2pOrderCode: paymentFlow.order?.orderCode ?? null,
      },
    })
    .select('id,request_id,user_id,current_tier,target_tier,payment_intent_id,payment_reference,status,amount,currency,settled_at,metadata')
    .single<UpgradeRequestRow>();

  if (error || !data) {
    throw error ?? new Error('Unable to create membership upgrade request.');
  }

  return data;
}

export async function listMembershipUpgradeRequestsForUser(userId: string, limit = 6): Promise<UpgradeRequestRow[]> {
  const { data, error } = await supabase
    .from('membership_upgrade_requests')
    .select('id,request_id,user_id,current_tier,target_tier,payment_intent_id,payment_reference,status,amount,currency,settled_at,failed_at,cancelled_at,metadata,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership upgrade requests.');
  }

  return data as UpgradeRequestRow[];
}

export async function markMembershipUpgradeFailed(paymentReference: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('membership_upgrade_requests')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      metadata: {
        failureReason: reason,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('payment_reference', paymentReference)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function settleMembershipUpgradeRequest(paymentReference: string, payload: Record<string, unknown>): Promise<boolean> {
  const { data: request, error: requestError } = await supabase
    .from('membership_upgrade_requests')
    .select('id,request_id,user_id,current_tier,target_tier,payment_intent_id,payment_reference,status,amount,currency,settled_at,metadata')
    .eq('payment_reference', paymentReference)
    .maybeSingle<UpgradeRequestRow>();

  if (requestError) throw requestError;
  if (!request) return false;
  if (request.status === 'settled') return true;
  if (request.status !== 'pending') return false;

  const settledAt = new Date().toISOString();
  const targetTier = resolveMembershipPlan(request.target_tier).level;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      level_tier: targetTier,
      level_label: resolveMembershipLabel(targetTier),
      updated_at: settledAt,
    })
    .eq('id', request.user_id);

  if (profileError) throw profileError;

  const { data: transitionedRows, error: settleError } = await supabase
    .from('membership_upgrade_requests')
    .update({
      status: 'settled',
      settled_at: settledAt,
      metadata: {
        ...(request.metadata ?? {}),
        settlementPayload: payload,
      },
      updated_at: settledAt,
    })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id');

  if (settleError) throw settleError;

  // If no row transitioned from pending->settled, another worker already finalized it.
  if (!Array.isArray(transitionedRows) || transitionedRows.length === 0) return false;

  await releaseWithdrawalHolds(request.user_id, targetTier);
  return true;
}
