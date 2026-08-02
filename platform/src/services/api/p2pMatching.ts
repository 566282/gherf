import { supabase } from '@/services/supabase/client';

export type P2PAssignmentDecision = {
  ok: boolean;
  decision: 'assigned' | 'reassigned' | 'no_liquidity' | 'shadow_only' | 'rejected';
  merchantId?: string;
  reason?: string;
  score?: number;
};

export async function assignP2POrder(orderId: string, policyKey = 'default_p2p_matching_v1'): Promise<P2PAssignmentDecision> {
  const { data, error } = await supabase.rpc('assign_p2p_order', {
    p_order_id: orderId,
    p_policy_key: policyKey,
  });

  if (error) throw error;

  const payload = (data as Record<string, unknown> | null) ?? {};

  return {
    ok: Boolean(payload.ok),
    decision: String(payload.decision ?? 'no_liquidity') as P2PAssignmentDecision['decision'],
    merchantId: payload.merchant_id ? String(payload.merchant_id) : undefined,
    reason: payload.reason ? String(payload.reason) : undefined,
    score: payload.score == null ? undefined : Number(payload.score),
  };
}

export async function listMatchingPolicies(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_matching_policies')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load matching policies.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function upsertMatchingPolicy(input: {
  policyKey: string;
  status: 'active' | 'draft' | 'paused' | 'archived';
  version: string;
  criteria: Record<string, unknown>;
  scoringWeights: Record<string, unknown>;
  reassignmentStrategy: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('merchant_matching_policies').upsert(
    {
      policy_key: input.policyKey,
      status: input.status,
      version: input.version,
      criteria: input.criteria,
      scoring_weights: input.scoringWeights,
      reassignment_strategy: input.reassignmentStrategy,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'policy_key' },
  );

  if (error) throw error;
}
