import { supabase } from '@/services/supabase/client';

export type P2PDispute = {
  id: string;
  orderId: string;
  openedBy: string;
  disputeReason: string;
  status: string;
  resolutionOutcome: string | null;
  resolutionNote: string | null;
  assignedAdminId: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function mapDispute(row: Record<string, unknown>): P2PDispute {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    openedBy: String(row.opened_by),
    disputeReason: String(row.dispute_reason ?? ''),
    status: String(row.status ?? 'open'),
    resolutionOutcome: row.resolution_outcome ? String(row.resolution_outcome) : null,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    assignedAdminId: row.assigned_admin_id ? String(row.assigned_admin_id) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function openP2PDispute(input: {
  orderId: string;
  openedBy: string;
  disputeReason: string;
  metadata?: Record<string, unknown>;
}): Promise<P2PDispute> {
  const { data, error } = await supabase
    .from('p2p_disputes')
    .upsert(
      {
        order_id: input.orderId,
        opened_by: input.openedBy,
        dispute_reason: input.disputeReason,
        status: 'open',
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    )
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to open dispute.');
  }

  return mapDispute(data as Record<string, unknown>);
}

export async function addP2PDisputeEvidence(input: {
  disputeId: string;
  uploadedBy: string;
  evidenceType: 'image' | 'document' | 'bank_statement' | 'transaction_log' | 'text_note' | 'other';
  evidenceUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('p2p_dispute_evidence').insert({
    dispute_id: input.disputeId,
    uploaded_by: input.uploadedBy,
    evidence_type: input.evidenceType,
    evidence_url: input.evidenceUrl ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}

export async function addP2PDisputeAction(input: {
  disputeId: string;
  actionType: 'open' | 'request_evidence' | 'review' | 'release' | 'refund' | 'penalize' | 'suspend' | 'close';
  actionBy?: string | null;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('p2p_dispute_actions').insert({
    dispute_id: input.disputeId,
    action_type: input.actionType,
    action_by: input.actionBy ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}

export async function listP2PDisputes(limit = 100): Promise<P2PDispute[]> {
  const { data, error } = await supabase
    .from('p2p_disputes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load disputes.');
  }

  return data.map((row) => mapDispute(row as Record<string, unknown>));
}

export async function resolveP2PDispute(input: {
  disputeId: string;
  status: 'resolved' | 'closed' | 'under_review' | 'awaiting_evidence';
  resolutionOutcome?: 'release' | 'refund' | 'penalize' | 'suspend' | null;
  resolutionNote?: string;
  assignedAdminId?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('p2p_disputes')
    .update({
      status: input.status,
      resolution_outcome: input.resolutionOutcome ?? null,
      resolution_note: input.resolutionNote ?? null,
      assigned_admin_id: input.assignedAdminId ?? null,
      resolved_at: input.status === 'resolved' || input.status === 'closed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.disputeId);

  if (error) throw error;
}
