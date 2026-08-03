import { supabase } from '@/services/supabase/client';
import { createFiatPaymentIntent } from '@/services/api/p2pMerchant';
import { sendUserNotification } from '@/services/api/communications';
import { dispatchComplianceLifecycleEvent } from '@/services/api/complianceNotifications';

export interface CreateAppealInput {
  userId: string;
  violationId?: string | null;
  enforcementActionId?: string | null;
  reason: string;
  paymentRequired: boolean;
  feeAmount: number;
  feeCurrency: string;
}

export interface AppealRecord {
  id: string;
  userId: string;
  violationId: string | null;
  enforcementActionId: string | null;
  state: 'submitted' | 'fee_pending' | 'in_review' | 'approved' | 'rejected' | 'closed';
  reason: string;
  feeAmount: number;
  feeCurrency: string;
  paymentRequired: boolean;
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';
  reviewerId: string | null;
  slaDueAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toAppeal(row: Record<string, unknown>): AppealRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    violationId: row.violation_id == null ? null : String(row.violation_id),
    enforcementActionId: row.enforcement_action_id == null ? null : String(row.enforcement_action_id),
    state: String(row.state) as AppealRecord['state'],
    reason: String(row.reason ?? ''),
    feeAmount: toNumber(row.fee_amount, 0),
    feeCurrency: String(row.fee_currency ?? 'USD'),
    paymentRequired: Boolean(row.payment_required),
    paymentStatus: String(row.payment_status ?? 'not_required') as AppealRecord['paymentStatus'],
    reviewerId: row.reviewer_id == null ? null : String(row.reviewer_id),
    slaDueAt: row.sla_due_at == null ? null : String(row.sla_due_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listComplianceAppeals(limit = 60): Promise<AppealRecord[]> {
  const { data, error } = await supabase
    .from('compliance_appeals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load compliance appeals.');
  }

  return data.map((row) => toAppeal(row as Record<string, unknown>));
}

export async function createComplianceAppeal(input: CreateAppealInput): Promise<AppealRecord> {
  const now = new Date();
  const slaDueAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  const initialState: AppealRecord['state'] = input.paymentRequired ? 'fee_pending' : 'in_review';
  const initialPaymentStatus: AppealRecord['paymentStatus'] = input.paymentRequired ? 'pending' : 'not_required';

  const { data, error } = await supabase
    .from('compliance_appeals')
    .insert({
      user_id: input.userId,
      violation_id: input.violationId ?? null,
      enforcement_action_id: input.enforcementActionId ?? null,
      state: initialState,
      reason: input.reason,
      fee_amount: input.feeAmount,
      fee_currency: input.feeCurrency,
      payment_required: input.paymentRequired,
      payment_status: initialPaymentStatus,
      sla_due_at: slaDueAt,
      metadata: {
        createdVia: 'appeals.createComplianceAppeal',
      },
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create compliance appeal.');
  }

  const appeal = toAppeal(data as Record<string, unknown>);

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: input.userId,
    p_event_type: 'compliance_appeal_submitted',
    p_entity_type: 'compliance_appeals',
    p_entity_id: appeal.id,
    p_payload: {
      state: appeal.state,
      paymentRequired: appeal.paymentRequired,
      feeAmount: appeal.feeAmount,
      feeCurrency: appeal.feeCurrency,
    },
  });

  await sendUserNotification(input.userId, {
    title: 'Appeal submitted',
    message: input.paymentRequired
      ? `Appeal created and pending fee payment of ${input.feeCurrency} ${input.feeAmount.toFixed(2)}.`
      : 'Appeal created and queued for compliance review.',
    type: 'info',
    category: 'transactional',
    metadata: {
      appealId: appeal.id,
      state: appeal.state,
      paymentRequired: appeal.paymentRequired,
    },
  });

  await dispatchComplianceLifecycleEvent({
    userId: input.userId,
    event: 'appeal_submitted',
    title: 'Appeal created',
    message: input.paymentRequired
      ? `Appeal is waiting for fee payment of ${input.feeCurrency} ${input.feeAmount.toFixed(2)}.`
      : 'Appeal is queued for reviewer decision.',
    metadata: {
      appealId: appeal.id,
      paymentRequired: input.paymentRequired,
    },
    notifyAdmins: true,
  });

  return appeal;
}

export async function createAppealPaymentIntent(appealId: string, userId: string): Promise<{ paymentIntentId: string; amount: number; currency: string }> {
  const { data: appealRow, error: appealError } = await supabase
    .from('compliance_appeals')
    .select('id,fee_amount,fee_currency,payment_required,payment_status')
    .eq('id', appealId)
    .eq('user_id', userId)
    .single();

  if (appealError || !appealRow) {
    throw appealError ?? new Error('Appeal not found.');
  }

  const feeAmount = toNumber((appealRow as Record<string, unknown>).fee_amount, 0);
  const feeCurrency = String((appealRow as Record<string, unknown>).fee_currency ?? 'USD');
  const paymentRequired = Boolean((appealRow as Record<string, unknown>).payment_required);

  if (!paymentRequired || feeAmount <= 0) {
    throw new Error('Appeal does not require payment.');
  }

  const intent = await createFiatPaymentIntent({
    userId,
    moduleKey: 'compliance_appeals',
    intentType: 'compliance_appeal_fee',
    sourceReference: appealId,
    amount: feeAmount,
    currency: feeCurrency,
    idempotencyKey: `appeal-fee-${appealId}`,
    metadata: {
      appealId,
    },
  });

  const { error: paymentError } = await supabase.from('compliance_appeal_payments').insert({
    appeal_id: appealId,
    user_id: userId,
    payment_intent_id: intent.id,
    provider_key: intent.providerKey ?? null,
    amount: feeAmount,
    currency: feeCurrency,
    status: 'pending',
    provider_reference: null,
    metadata: {
      source: 'appeals.createAppealPaymentIntent',
    },
  });

  if (paymentError) throw paymentError;

  await supabase
    .from('compliance_appeals')
    .update({
      payment_status: 'pending',
      state: 'fee_pending',
    })
    .eq('id', appealId);

  return {
    paymentIntentId: intent.id,
    amount: feeAmount,
    currency: feeCurrency,
  };
}

export async function markAppealPaymentSettled(input: {
  appealId: string;
  paymentIntentId?: string | null;
  providerReference?: string | null;
}): Promise<void> {
  const { data: appealRow, error: appealError } = await supabase
    .from('compliance_appeals')
    .select('id,user_id,payment_required')
    .eq('id', input.appealId)
    .single();

  if (appealError || !appealRow) {
    throw appealError ?? new Error('Appeal not found.');
  }

  const { error: paymentUpdateError } = await supabase
    .from('compliance_appeal_payments')
    .update({
      status: 'paid',
      provider_reference: input.providerReference ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('appeal_id', input.appealId)
    .eq('status', 'pending');

  if (paymentUpdateError) throw paymentUpdateError;

  const { error: appealUpdateError } = await supabase
    .from('compliance_appeals')
    .update({
      state: 'in_review',
      payment_status: 'paid',
      metadata: {
        paymentSettledAt: new Date().toISOString(),
        paymentIntentId: input.paymentIntentId ?? null,
      },
    })
    .eq('id', input.appealId);

  if (appealUpdateError) throw appealUpdateError;

  const userId = String((appealRow as Record<string, unknown>).user_id);

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: userId,
    p_event_type: 'compliance_appeal_fee_paid',
    p_entity_type: 'compliance_appeals',
    p_entity_id: input.appealId,
    p_payload: {
      paymentIntentId: input.paymentIntentId ?? null,
      providerReference: input.providerReference ?? null,
    },
  });

  await sendUserNotification(userId, {
    title: 'Appeal fee received',
    message: 'Appeal payment confirmed. Your appeal is now in review.',
    type: 'success',
    category: 'transactional',
    metadata: {
      appealId: input.appealId,
    },
  });

  await dispatchComplianceLifecycleEvent({
    userId,
    event: 'appeal_decided',
    title: input.decision === 'approved' ? 'Appeal approved' : input.decision === 'rejected' ? 'Appeal rejected' : 'Appeal requires more information',
    message: `Appeal decision: ${input.decision}. ${input.reason}`,
    metadata: {
      appealId: input.appealId,
      reviewerId: input.reviewerId,
      decision: input.decision,
    },
    notifyAdmins: true,
  });
}

export async function decideComplianceAppeal(input: {
  appealId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'request_more_info';
  reason: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { data: appealRow, error: appealError } = await supabase
    .from('compliance_appeals')
    .select('id,user_id,state')
    .eq('id', input.appealId)
    .single();

  if (appealError || !appealRow) {
    throw appealError ?? new Error('Appeal not found.');
  }

  const { error: decisionError } = await supabase.from('compliance_appeal_decisions').insert({
    appeal_id: input.appealId,
    reviewer_id: input.reviewerId,
    decision: input.decision,
    reason: input.reason,
    payload: input.payload ?? {},
  });

  if (decisionError) throw decisionError;

  const nextState = input.decision === 'approved' ? 'approved' : input.decision === 'rejected' ? 'rejected' : 'in_review';

  const { error: appealUpdateError } = await supabase
    .from('compliance_appeals')
    .update({
      state: nextState,
      reviewer_id: input.reviewerId,
    })
    .eq('id', input.appealId);

  if (appealUpdateError) throw appealUpdateError;

  const userId = String((appealRow as Record<string, unknown>).user_id);

  await supabase.rpc('task_compliance_audit_append', {
    p_user_id: userId,
    p_event_type: 'compliance_appeal_decided',
    p_entity_type: 'compliance_appeals',
    p_entity_id: input.appealId,
    p_payload: {
      decision: input.decision,
      reason: input.reason,
      reviewerId: input.reviewerId,
    },
  });

  await sendUserNotification(userId, {
    title: input.decision === 'approved' ? 'Appeal approved' : input.decision === 'rejected' ? 'Appeal rejected' : 'Appeal review update',
    message:
      input.decision === 'approved'
        ? 'Your appeal was approved and enforcement actions are being reviewed for reversal.'
        : input.decision === 'rejected'
          ? 'Your appeal was rejected. You can contact support for further assistance.'
          : 'Your appeal needs more information and remains under review.',
    type: input.decision === 'approved' ? 'success' : input.decision === 'rejected' ? 'warning' : 'info',
    category: 'transactional',
    metadata: {
      appealId: input.appealId,
      decision: input.decision,
    },
  });
}
