import { supabase } from '@/services/supabase/client';
import { listMerchantProfiles, type MerchantProfile } from '@/services/api/p2pMerchant';

export type WithdrawalStateDictionaryItem = {
  stateKey: string;
  label: string;
  description: string | null;
  actorVisibility: string[];
  legacyStatus: string;
  isTerminal: boolean;
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
};

export type WithdrawalOperationsQueueItem = {
  withdrawalRequestId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string | null;
  amount: number;
  currency: string;
  method: string;
  destinationLabel: string;
  destinationValue: string | null;
  scheduledFor: string | null;
  createdAt: string;
  workflowStateKey: string;
  workflowStateLabel: string;
  legacyStatus: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  complianceState: string | null;
  stateVersion: number;
  manualAssignmentRequired: boolean;
  autoAssignmentEnabled: boolean;
  assignmentId: string | null;
  assignmentStatus: string | null;
  assignmentDueAt: string | null;
  assignedMerchantId: string | null;
  assignedMerchantCode: string | null;
  assignedMerchantName: string | null;
};

export type WithdrawalAdminAction = 'approve' | 'reject' | 'fraud_review';

export type MerchantWithdrawalAssignment = {
  assignmentId: string;
  withdrawalRequestId: string;
  assignmentStatus: string;
  assignmentSequence: number;
  assignedAt: string;
  dueAt: string | null;
  payoutSentAt: string | null;
  payoutReference: string | null;
  amount: number;
  netAmount: number;
  currency: string;
  workflowStateKey: string;
  destinationLabel: string;
  destinationValue: string | null;
  userId: string;
  userDisplayName: string;
  userEmail: string | null;
};

export type WithdrawalRuntimeSettings = {
  assignmentSlaHours: number;
  reminderCadenceHours: number[];
  maxReassignments: number;
  enableAutoAssignment: boolean;
  enableDuplicatePrevention: boolean;
  disputeAutoEscalationHours: number;
  reminderNotificationsEnabled: boolean;
};

export type UserWithdrawalReceiptQueueItem = {
  withdrawalRequestId: string;
  amount: number;
  netAmount: number;
  currency: string;
  workflowStateKey: string;
  scheduledFor: string | null;
  createdAt: string;
  assignmentId: string | null;
  assignmentStatus: string | null;
  payoutSentAt: string | null;
  payoutReference: string | null;
  merchantId: string | null;
  merchantCode: string | null;
  merchantName: string | null;
};

export type WithdrawalMonitoringSummary = {
  queueSize: number;
  highRiskItems: number;
  manualAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  reminderDueCount: number;
  disputeEscalationDueCount: number;
  autoAssignmentEnabled: boolean;
  duplicatePreventionEnabled: boolean;
  assignmentSlaHours: number;
  maxReassignments: number;
  reminderCadenceHours: number[];
};

function toStateDictionaryItem(row: Record<string, unknown>): WithdrawalStateDictionaryItem {
  return {
    stateKey: String(row.state_key ?? ''),
    label: String(row.label ?? ''),
    description: row.description == null ? null : String(row.description),
    actorVisibility: Array.isArray(row.actor_visibility) ? row.actor_visibility.map((value) => String(value)) : [],
    legacyStatus: String(row.legacy_status ?? 'pending'),
    isTerminal: Boolean(row.is_terminal),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function toQueueItem(row: Record<string, unknown>): WithdrawalOperationsQueueItem {
  return {
    withdrawalRequestId: String(row.withdrawal_request_id ?? ''),
    userId: String(row.user_id ?? ''),
    userDisplayName: String(row.user_display_name ?? ''),
    userEmail: row.user_email == null ? null : String(row.user_email),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    method: String(row.method ?? ''),
    destinationLabel: String(row.destination_label ?? ''),
    destinationValue: row.destination_value == null ? null : String(row.destination_value),
    scheduledFor: row.scheduled_for == null ? null : String(row.scheduled_for),
    createdAt: String(row.created_at ?? ''),
    workflowStateKey: String(row.workflow_state_key ?? ''),
    workflowStateLabel: String(row.workflow_state_label ?? ''),
    legacyStatus: String(row.legacy_status ?? ''),
    riskLevel: String(row.risk_level ?? 'low') as WithdrawalOperationsQueueItem['riskLevel'],
    riskScore: Number(row.risk_score ?? 0),
    complianceState: row.compliance_state == null ? null : String(row.compliance_state),
    stateVersion: Number(row.state_version ?? 0),
    manualAssignmentRequired: Boolean(row.manual_assignment_required),
    autoAssignmentEnabled: Boolean(row.auto_assignment_enabled),
    assignmentId: row.assignment_id == null ? null : String(row.assignment_id),
    assignmentStatus: row.assignment_status == null ? null : String(row.assignment_status),
    assignmentDueAt: row.assignment_due_at == null ? null : String(row.assignment_due_at),
    assignedMerchantId: row.assigned_merchant_id == null ? null : String(row.assigned_merchant_id),
    assignedMerchantCode: row.assigned_merchant_code == null ? null : String(row.assigned_merchant_code),
    assignedMerchantName: row.assigned_merchant_name == null ? null : String(row.assigned_merchant_name),
  };
}

function toMerchantAssignment(row: Record<string, unknown>): MerchantWithdrawalAssignment {
  return {
    assignmentId: String(row.assignment_id ?? ''),
    withdrawalRequestId: String(row.withdrawal_request_id ?? ''),
    assignmentStatus: String(row.assignment_status ?? ''),
    assignmentSequence: Number(row.assignment_sequence ?? 1),
    assignedAt: String(row.assigned_at ?? ''),
    dueAt: row.due_at == null ? null : String(row.due_at),
    payoutSentAt: row.payout_sent_at == null ? null : String(row.payout_sent_at),
    payoutReference: row.payout_reference == null ? null : String(row.payout_reference),
    amount: Number(row.amount ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    workflowStateKey: String(row.workflow_state_key ?? ''),
    destinationLabel: String(row.destination_label ?? ''),
    destinationValue: row.destination_value == null ? null : String(row.destination_value),
    userId: String(row.user_id ?? ''),
    userDisplayName: String(row.user_display_name ?? ''),
    userEmail: row.user_email == null ? null : String(row.user_email),
  };
}

function toUserReceiptQueueItem(row: Record<string, unknown>): UserWithdrawalReceiptQueueItem {
  return {
    withdrawalRequestId: String(row.withdrawal_request_id ?? ''),
    amount: Number(row.amount ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    workflowStateKey: String(row.workflow_state_key ?? ''),
    scheduledFor: row.scheduled_for == null ? null : String(row.scheduled_for),
    createdAt: String(row.created_at ?? ''),
    assignmentId: row.assignment_id == null ? null : String(row.assignment_id),
    assignmentStatus: row.assignment_status == null ? null : String(row.assignment_status),
    payoutSentAt: row.payout_sent_at == null ? null : String(row.payout_sent_at),
    payoutReference: row.payout_reference == null ? null : String(row.payout_reference),
    merchantId: row.merchant_id == null ? null : String(row.merchant_id),
    merchantCode: row.merchant_code == null ? null : String(row.merchant_code),
    merchantName: row.merchant_name == null ? null : String(row.merchant_name),
  };
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => toNumber(entry, 0))
        .filter((entry) => entry > 0);
    }

    return [];
  }

  return value
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.round(entry));
}

export const DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS: WithdrawalRuntimeSettings = {
  assignmentSlaHours: 12,
  reminderCadenceHours: [6, 3, 1],
  maxReassignments: 2,
  enableAutoAssignment: true,
  enableDuplicatePrevention: true,
  disputeAutoEscalationHours: 24,
  reminderNotificationsEnabled: true,
};

export function buildWithdrawalMonitoringSummary(
  queue: WithdrawalOperationsQueueItem[],
  settings: Pick<WithdrawalRuntimeSettings, 'assignmentSlaHours' | 'reminderCadenceHours' | 'maxReassignments' | 'enableAutoAssignment' | 'enableDuplicatePrevention' | 'disputeAutoEscalationHours'>,
  now = new Date(),
): WithdrawalMonitoringSummary {
  const referenceTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const reminderCadenceHours = settings.reminderCadenceHours?.length ? settings.reminderCadenceHours : DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.reminderCadenceHours;

  const overdueAssignments = queue.filter((item) => item.assignmentDueAt && new Date(item.assignmentDueAt).getTime() < referenceTime).length;
  const pendingAssignments = queue.filter((item) => item.assignmentStatus === 'assigned' || item.assignmentStatus === 'accepted').length;
  const highRiskItems = queue.filter((item) => item.riskLevel === 'high' || item.riskLevel === 'critical').length;
  const manualAssignments = queue.filter((item) => item.manualAssignmentRequired).length;
  const reminderDueCount = queue.filter((item) => {
    if (!item.assignmentDueAt) return false;
    const hoursRemaining = (new Date(item.assignmentDueAt).getTime() - referenceTime) / 3_600_000;
    const maxReminderCadence = Math.max(...reminderCadenceHours);
    return hoursRemaining <= maxReminderCadence && hoursRemaining >= -Math.max(1, settings.assignmentSlaHours);
  }).length;
  const disputeEscalationDueCount = queue.filter((item) => {
    if (!item.assignmentDueAt) return false;
    const escalationAt = new Date(item.assignmentDueAt).getTime() + settings.disputeAutoEscalationHours * 3_600_000;
    return escalationAt < referenceTime;
  }).length;

  return {
    queueSize: queue.length,
    highRiskItems,
    manualAssignments,
    pendingAssignments,
    overdueAssignments,
    reminderDueCount,
    disputeEscalationDueCount,
    autoAssignmentEnabled: settings.enableAutoAssignment,
    duplicatePreventionEnabled: settings.enableDuplicatePrevention,
    assignmentSlaHours: Math.max(1, Math.round(settings.assignmentSlaHours)),
    maxReassignments: Math.max(0, Math.round(settings.maxReassignments)),
    reminderCadenceHours,
  };
}

export async function listWithdrawalRuntimeSettings(): Promise<WithdrawalRuntimeSettings> {
  const keys = [
    'withdrawal_assignment_sla_hours',
    'withdrawal_reminder_cadence_hours',
    'withdrawal_max_reassignments',
    'withdrawal_enable_auto_assignment',
    'withdrawal_enable_duplicate_prevention',
    'withdrawal_dispute_auto_escalation_hours',
    'withdrawal_reminder_notifications_enabled',
  ];

  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', keys);

  if (error || !Array.isArray(data)) {
    return DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS;
  }

  const lookup = new Map(data.map((row) => [String((row as Record<string, unknown>).key), (row as Record<string, unknown>).value]));

  const reminderCadenceHours = toNumberArray(lookup.get('withdrawal_reminder_cadence_hours'));

  return {
    assignmentSlaHours: Math.max(1, Math.round(toNumber(lookup.get('withdrawal_assignment_sla_hours'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.assignmentSlaHours))),
    reminderCadenceHours: reminderCadenceHours.length ? reminderCadenceHours : DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.reminderCadenceHours,
    maxReassignments: Math.max(0, Math.round(toNumber(lookup.get('withdrawal_max_reassignments'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.maxReassignments))),
    enableAutoAssignment: toBoolean(lookup.get('withdrawal_enable_auto_assignment'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.enableAutoAssignment),
    enableDuplicatePrevention: toBoolean(lookup.get('withdrawal_enable_duplicate_prevention'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.enableDuplicatePrevention),
    disputeAutoEscalationHours: Math.max(1, Math.round(toNumber(lookup.get('withdrawal_dispute_auto_escalation_hours'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.disputeAutoEscalationHours))),
    reminderNotificationsEnabled: toBoolean(lookup.get('withdrawal_reminder_notifications_enabled'), DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS.reminderNotificationsEnabled),
  };
}

export async function updateWithdrawalRuntimeSettings(input: Partial<WithdrawalRuntimeSettings>): Promise<WithdrawalRuntimeSettings> {
  const resolved = {
    ...DEFAULT_WITHDRAWAL_RUNTIME_SETTINGS,
    ...input,
  };

  const rows = [
    { key: 'withdrawal_assignment_sla_hours', value: Math.max(1, Math.round(resolved.assignmentSlaHours)) },
    { key: 'withdrawal_reminder_cadence_hours', value: resolved.reminderCadenceHours },
    { key: 'withdrawal_max_reassignments', value: Math.max(0, Math.round(resolved.maxReassignments)) },
    { key: 'withdrawal_enable_auto_assignment', value: resolved.enableAutoAssignment },
    { key: 'withdrawal_enable_duplicate_prevention', value: resolved.enableDuplicatePrevention },
    { key: 'withdrawal_dispute_auto_escalation_hours', value: Math.max(1, Math.round(resolved.disputeAutoEscalationHours)) },
    { key: 'withdrawal_reminder_notifications_enabled', value: resolved.reminderNotificationsEnabled },
  ];

  const { error } = await supabase.from('platform_settings').upsert(
    rows.map((row) => ({ key: row.key, value: row.value, updated_at: new Date().toISOString() })),
    { onConflict: 'key' },
  );

  if (error) throw error;

  return resolved;
}

export async function listWithdrawalStateDictionary(): Promise<WithdrawalStateDictionaryItem[]> {
  const { data, error } = await supabase
    .from('withdrawal_state_dictionary')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load withdrawal state dictionary.');
  }

  return data.map((row) => toStateDictionaryItem(row as Record<string, unknown>));
}

export async function listWithdrawalOperationsQueue(input?: {
  limit?: number;
  stateKeys?: string[];
  riskLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;
}): Promise<WithdrawalOperationsQueueItem[]> {
  const { data, error } = await supabase.rpc('list_withdrawal_operations_queue', {
    p_limit: Math.max(1, Math.min(500, Math.round(input?.limit ?? 100))),
    p_state_keys: input?.stateKeys ?? null,
    p_risk_levels: input?.riskLevels ?? null,
  });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load withdrawal operations queue.');
  }

  return data.map((row) => toQueueItem(row as Record<string, unknown>));
}

export async function listAssignableMerchants(limit = 100): Promise<MerchantProfile[]> {
  const rows = await listMerchantProfiles(limit);
  return rows.filter((item) => ['active', 'qualified', 'enabled'].includes(item.status));
}

export async function adminResolveWithdrawalAction(input: {
  withdrawalRequestId: string;
  action: WithdrawalAdminAction;
  actorUserId: string;
  note?: string;
  merchantId?: string | null;
  autoAssignmentEnabled?: boolean;
  idempotencyKey?: string;
}): Promise<{ withdrawalStateKey: string; stateVersion: number; assignmentId: string | null }> {
  const { data, error } = await supabase.rpc('admin_resolve_withdrawal_action', {
    p_withdrawal_request_id: input.withdrawalRequestId,
    p_action: input.action,
    p_actor_user_id: input.actorUserId,
    p_note: input.note ?? null,
    p_merchant_id: input.merchantId ?? null,
    p_auto_assignment_enabled: input.autoAssignmentEnabled ?? false,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) {
    throw new Error('No response returned for withdrawal action.');
  }

  return {
    withdrawalStateKey: String(row.withdrawal_state_key ?? ''),
    stateVersion: Number(row.state_version ?? 0),
    assignmentId: row.assignment_id == null ? null : String(row.assignment_id),
  };
}

export async function listMerchantWithdrawalAssignments(limit = 100): Promise<MerchantWithdrawalAssignment[]> {
  const { data, error } = await supabase.rpc('list_merchant_withdrawal_assignments', {
    p_limit: Math.max(1, Math.min(500, Math.round(limit))),
  });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant withdrawal assignments.');
  }

  return data.map((row) => toMerchantAssignment(row as Record<string, unknown>));
}

export async function merchantRespondWithdrawalAssignment(input: {
  assignmentId: string;
  action: 'accept' | 'decline';
  note?: string;
  idempotencyKey?: string;
}): Promise<{ assignmentId: string; withdrawalStateKey: string; stateVersion: number; reassignedAssignmentId: string | null }> {
  const { data, error } = await supabase.rpc('merchant_respond_withdrawal_assignment', {
    p_assignment_id: input.assignmentId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) throw new Error('No response returned for merchant assignment action.');

  return {
    assignmentId: String(row.assignment_id ?? ''),
    withdrawalStateKey: String(row.withdrawal_state_key ?? ''),
    stateVersion: Number(row.state_version ?? 0),
    reassignedAssignmentId: row.reassigned_assignment_id == null ? null : String(row.reassigned_assignment_id),
  };
}

export async function merchantMarkWithdrawalPayoutSent(input: {
  assignmentId: string;
  paymentReference?: string;
  note?: string;
  idempotencyKey?: string;
}): Promise<{ withdrawalRequestId: string; assignmentId: string; withdrawalStateKey: string; stateVersion: number }> {
  const { data, error } = await supabase.rpc('merchant_mark_withdrawal_payout_sent', {
    p_assignment_id: input.assignmentId,
    p_payment_reference: input.paymentReference ?? null,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) throw new Error('No response returned for payout-sent action.');

  return {
    withdrawalRequestId: String(row.withdrawal_request_id ?? ''),
    assignmentId: String(row.assignment_id ?? ''),
    withdrawalStateKey: String(row.withdrawal_state_key ?? ''),
    stateVersion: Number(row.state_version ?? 0),
  };
}

export async function listUserWithdrawalReceiptQueue(limit = 100): Promise<UserWithdrawalReceiptQueueItem[]> {
  const { data, error } = await supabase.rpc('list_user_withdrawal_receipt_queue', {
    p_limit: Math.max(1, Math.min(500, Math.round(limit))),
  });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load user withdrawal receipt queue.');
  }

  return data.map((row) => toUserReceiptQueueItem(row as Record<string, unknown>));
}

export async function userConfirmWithdrawalReceipt(input: {
  withdrawalRequestId: string;
  note?: string;
  idempotencyKey?: string;
}): Promise<{ withdrawalRequestId: string; assignmentId: string; withdrawalStateKey: string; stateVersion: number }> {
  const { data, error } = await supabase.rpc('user_confirm_withdrawal_receipt', {
    p_withdrawal_request_id: input.withdrawalRequestId,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) throw new Error('No response returned for user receipt confirmation.');

  return {
    withdrawalRequestId: String(row.withdrawal_request_id ?? ''),
    assignmentId: String(row.assignment_id ?? ''),
    withdrawalStateKey: String(row.withdrawal_state_key ?? ''),
    stateVersion: Number(row.state_version ?? 0),
  };
}

export async function reportWithdrawalNonReceipt(input: {
  withdrawalRequestId: string;
  actorUserId: string;
  assignmentId?: string | null;
  note?: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<{ withdrawalRequestId: string; withdrawalStateKey: string; stateVersion: number; disputeId: string | null }> {
  const transitionPayload = {
    p_withdrawal_request_id: input.withdrawalRequestId,
    p_actor_type: 'user',
    p_action_key: 'report_non_receipt',
    p_to_state_key: 'disputed',
    p_idempotency_key: input.idempotencyKey ?? null,
    p_actor_user_id: input.actorUserId ?? null,
    p_assignment_id: input.assignmentId ?? null,
    p_note: input.note?.trim() || undefined,
    p_metadata: {
      source: 'user_report_non_receipt',
      reason: input.reason?.trim() || 'non_receipt',
    },
  };

  const { data: transitionData, error: transitionError } = await supabase.rpc('transition_withdrawal_state', transitionPayload);
  if (transitionError) throw transitionError;

  const transitionRow = Array.isArray(transitionData) ? (transitionData[0] as Record<string, unknown> | undefined) : (transitionData as Record<string, unknown> | null);
  if (!transitionRow) throw new Error('No transition response returned for non-receipt report.');

  const disputeInsert = await supabase
    .from('withdrawal_disputes')
    .insert({
      withdrawal_request_id: input.withdrawalRequestId,
      assignment_id: input.assignmentId ?? null,
      user_id: input.actorUserId,
      merchant_id: null,
      state: 'open',
      reason: input.reason?.trim() || 'reported_non_receipt',
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      metadata: {
        source: 'user_report_non_receipt',
        note: input.note?.trim() || null,
        state_key: String(transitionRow.withdrawal_state_key ?? 'disputed'),
      },
    })
    .select('id')
    .single();

  if (disputeInsert.error) throw disputeInsert.error;

  return {
    withdrawalRequestId: input.withdrawalRequestId,
    withdrawalStateKey: String(transitionRow.withdrawal_state_key ?? 'disputed'),
    stateVersion: Number(transitionRow.state_version ?? 0),
    disputeId: disputeInsert.data?.id == null ? null : String(disputeInsert.data.id),
  };
}

export async function processWithdrawalAssignmentTimeouts(limit = 100): Promise<{
  processedCount: number;
  reassignedCount: number;
  failedNoLiquidityCount: number;
}> {
  const { data, error } = await supabase.rpc('process_withdrawal_assignment_timeouts', {
    p_limit: Math.max(1, Math.min(500, Math.round(limit))),
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) {
    return {
      processedCount: 0,
      reassignedCount: 0,
      failedNoLiquidityCount: 0,
    };
  }

  return {
    processedCount: Number(row.processed_count ?? 0),
    reassignedCount: Number(row.reassigned_count ?? 0),
    failedNoLiquidityCount: Number(row.failed_no_liquidity_count ?? 0),
  };
}
