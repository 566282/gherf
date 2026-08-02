import { supabase } from '@/services/supabase/client';

export type P2POrderTransitionResult = {
  ok: boolean;
  orderId: string;
  previousState: string;
  nextState: string;
  transitionKey: string;
};

export type P2PPaymentSubmissionInput = {
  orderId: string;
  submittedBy: string;
  proofType: 'bank_transfer_receipt' | 'transaction_id' | 'manual_note' | 'other';
  amount: number;
  currency: string;
  paymentReference?: string;
  bankReference?: string;
  metadata?: Record<string, unknown>;
};

export async function submitP2PPaymentProof(input: P2PPaymentSubmissionInput): Promise<void> {
  const { error } = await supabase.from('p2p_payment_submissions').insert({
    order_id: input.orderId,
    submitted_by: input.submittedBy,
    proof_type: input.proofType,
    amount: Number(input.amount || 0),
    currency: input.currency.toUpperCase(),
    payment_reference: input.paymentReference ?? null,
    bank_reference: input.bankReference ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}

export async function transitionP2POrderState(input: {
  orderId: string;
  nextState: string;
  actorId: string;
  actorRole: 'user' | 'merchant' | 'admin' | 'system';
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<P2POrderTransitionResult> {
  const { data, error } = await supabase.rpc('transition_p2p_order_state', {
    p_order_id: input.orderId,
    p_next_state: input.nextState,
    p_actor_id: input.actorId,
    p_actor_role: input.actorRole,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: input.metadata ?? {},
  });

  if (error) throw error;

  const payload = (data as Record<string, unknown> | null) ?? {};

  return {
    ok: Boolean(payload.ok),
    orderId: String(payload.order_id ?? input.orderId),
    previousState: String(payload.previous_state ?? ''),
    nextState: String(payload.next_state ?? input.nextState),
    transitionKey: String(payload.transition_key ?? ''),
  };
}

export async function listP2POrderStates(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_order_states')
    .select('*')
    .order('state_key', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load P2P order states.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PTransitions(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_order_state_transitions')
    .select('*')
    .order('from_state', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load P2P state transitions.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}
