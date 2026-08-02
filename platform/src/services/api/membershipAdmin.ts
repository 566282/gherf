import { supabase } from '@/services/supabase/client';
import { resolveMembershipPlan } from '@/services/api/membership';
import { evaluateMultiplierPricing, type MembershipLifecycleConfig } from '@/services/api/membershipLifecycle';

export type MembershipPlanRecord = {
  id: string;
  level: number;
  slug: string;
  label: string;
  price: number;
  currency: string;
  durationDays: number;
  category: string;
  benefits: string[];
  isActive: boolean;
  archivedAt: string | null;
  updatedAt: string;
};

export type MembershipRuleVersionRecord = {
  id: string;
  ruleKey: string;
  version: string;
  payload: Record<string, unknown>;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string;
};

export type MembershipWorkflowRecord = {
  id: string;
  workflowKey: string;
  version: string;
  status: string;
  definition: Record<string, unknown>;
  updatedAt: string;
};

export type MembershipMultiplierOrderRecord = {
  id: string;
  userId: string;
  planLevel: number;
  amount: number;
  currency: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

export type MembershipFeeInvoiceRecord = {
  id: string;
  userId: string;
  feeCycleKey: string;
  amount: number;
  currency: string;
  status: string;
  dueAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type MembershipAnalyticsRecord = {
  id: string;
  reportDate: string;
  totalMembers: number;
  paidMembers: number;
  pendingUpgrades: number;
  activeMultipliers: number;
  feeDelinquentMembers: number;
  topPlanLevel: number;
  topPlanLabel: string;
};

export type MembershipJobRunRecord = {
  id: string;
  jobKey: string;
  status: string;
  runDate: string;
  startedAt: string;
  finishedAt: string | null;
  details: Record<string, unknown>;
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toPlanRecord(row: Record<string, unknown>): MembershipPlanRecord {
  return {
    id: String(row.id),
    level: Number(row.level),
    slug: String(row.slug),
    label: String(row.label),
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? 'NGN'),
    durationDays: Number(row.duration_days ?? 30),
    category: String(row.category ?? 'starter'),
    benefits: Array.isArray(row.benefits) ? row.benefits.map((item) => String(item)) : [],
    isActive: Boolean(row.is_active),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toRuleRecord(row: Record<string, unknown>): MembershipRuleVersionRecord {
  return {
    id: String(row.id),
    ruleKey: String(row.rule_key),
    version: String(row.version),
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: String(row.status ?? 'draft'),
    effectiveFrom: row.effective_from ? String(row.effective_from) : null,
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toWorkflowRecord(row: Record<string, unknown>): MembershipWorkflowRecord {
  return {
    id: String(row.id),
    workflowKey: String(row.workflow_key),
    version: String(row.version),
    status: String(row.status ?? 'draft'),
    definition: (row.definition as Record<string, unknown>) ?? {},
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toMultiplierOrderRecord(row: Record<string, unknown>): MembershipMultiplierOrderRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    planLevel: Number(row.plan_level ?? 1),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'NGN'),
    paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    status: String(row.status ?? 'pending'),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function toFeeInvoiceRecord(row: Record<string, unknown>): MembershipFeeInvoiceRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    feeCycleKey: String(row.fee_cycle_key),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'NGN'),
    status: String(row.status ?? 'unpaid'),
    dueAt: row.due_at ? String(row.due_at) : null,
    settledAt: row.settled_at ? String(row.settled_at) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function toAnalyticsRecord(row: Record<string, unknown>): MembershipAnalyticsRecord {
  return {
    id: String(row.id),
    reportDate: String(row.report_date),
    totalMembers: Number(row.total_members ?? 0),
    paidMembers: Number(row.paid_members ?? 0),
    pendingUpgrades: Number(row.pending_upgrades ?? 0),
    activeMultipliers: Number(row.active_multipliers ?? 0),
    feeDelinquentMembers: Number(row.fee_delinquent_members ?? 0),
    topPlanLevel: Number(row.top_plan_level ?? 1),
    topPlanLabel: String(row.top_plan_label ?? 'Starter'),
  };
}

function toJobRunRecord(row: Record<string, unknown>): MembershipJobRunRecord {
  return {
    id: String(row.id),
    jobKey: String(row.job_key),
    status: String(row.status ?? 'pending'),
    runDate: String(row.run_date ?? ''),
    startedAt: String(row.started_at ?? ''),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    details: (row.details as Record<string, unknown>) ?? {},
  };
}

export async function listMembershipPlans(): Promise<MembershipPlanRecord[]> {
  const { data, error } = await supabase
    .from('membership_plan_catalog')
    .select('id,level,slug,label,price,currency,duration_days,category,benefits,is_active,archived_at,updated_at')
    .order('level', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership plans.');
  }

  return data.map((row) => toPlanRecord(row as Record<string, unknown>));
}

export async function upsertMembershipPlan(input: {
  level: number;
  label: string;
  price: number;
  category: string;
  durationDays?: number;
  benefits?: string[];
  isActive?: boolean;
}): Promise<void> {
  const level = Math.max(1, Math.min(100, Math.round(Number(input.level) || 1)));
  const label = input.label.trim() || resolveMembershipPlan(level).label;

  const { error } = await supabase.from('membership_plan_catalog').upsert({
    level,
    slug: slugify(label),
    label,
    price: Number(input.price || 0),
    currency: 'NGN',
    duration_days: Math.max(1, Math.round(Number(input.durationDays ?? 30))),
    category: input.category || (level >= 50 ? 'enterprise' : level >= 20 ? 'growth' : 'starter'),
    benefits: (input.benefits ?? []).map((value) => value.trim()).filter(Boolean),
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'level' });

  if (error) throw error;
}

export async function archiveMembershipPlan(level: number): Promise<void> {
  const { error } = await supabase
    .from('membership_plan_catalog')
    .update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('level', level);

  if (error) throw error;
}

export async function listMembershipRuleVersions(): Promise<MembershipRuleVersionRecord[]> {
  const { data, error } = await supabase
    .from('membership_rule_versions')
    .select('id,rule_key,version,payload,status,effective_from,effective_to,updated_at')
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership rules.');
  }

  return data.map((row) => toRuleRecord(row as Record<string, unknown>));
}

export async function upsertMembershipRuleVersion(input: {
  ruleKey: string;
  version: string;
  payload: Record<string, unknown>;
  status?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('membership_rule_versions').upsert({
    rule_key: input.ruleKey,
    version: input.version,
    payload: input.payload,
    status: input.status ?? 'draft',
    effective_from: input.effectiveFrom ?? null,
    effective_to: input.effectiveTo ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'rule_key,version' });

  if (error) throw error;
}

export async function publishMembershipRuleVersion(ruleKey: string, version: string): Promise<void> {
  const { error: demoteError } = await supabase
    .from('membership_rule_versions')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('rule_key', ruleKey)
    .eq('status', 'published');

  if (demoteError) throw demoteError;

  const { error } = await supabase
    .from('membership_rule_versions')
    .update({ status: 'published', effective_from: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('rule_key', ruleKey)
    .eq('version', version);

  if (error) throw error;
}

export async function listMembershipWorkflows(): Promise<MembershipWorkflowRecord[]> {
  const { data, error } = await supabase
    .from('membership_workflow_definitions')
    .select('id,workflow_key,version,status,definition,updated_at')
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership workflow definitions.');
  }

  return data.map((row) => toWorkflowRecord(row as Record<string, unknown>));
}

export async function upsertMembershipWorkflow(input: {
  workflowKey: string;
  version: string;
  status?: string;
  definition: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('membership_workflow_definitions').upsert({
    workflow_key: input.workflowKey,
    version: input.version,
    status: input.status ?? 'draft',
    definition: input.definition,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workflow_key,version' });

  if (error) throw error;
}

export async function listMultiplierOrders(limit = 50): Promise<MembershipMultiplierOrderRecord[]> {
  const { data, error } = await supabase
    .from('membership_multiplier_orders')
    .select('id,user_id,plan_level,amount,currency,payment_provider,payment_reference,status,expires_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load multiplier orders.');
  }

  return data.map((row) => toMultiplierOrderRecord(row as Record<string, unknown>));
}

export async function createMultiplierOrder(input: {
  userId: string;
  planLevel: number;
  overrideAmount?: number;
  provider?: string;
  config?: MembershipLifecycleConfig;
}): Promise<void> {
  const pricing = evaluateMultiplierPricing(input.planLevel, input.config);
  const reference = `mult-${input.userId.slice(0, 8)}-${Date.now()}`;

  const { error } = await supabase.from('membership_multiplier_orders').insert({
    user_id: input.userId,
    plan_level: input.planLevel,
    amount: Number(input.overrideAmount ?? pricing.amount),
    currency: pricing.currency,
    payment_provider: input.provider ?? null,
    payment_reference: reference,
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) throw error;
}

export async function listMembershipFeeInvoices(limit = 100): Promise<MembershipFeeInvoiceRecord[]> {
  const { data, error } = await supabase
    .from('membership_fee_invoices')
    .select('id,user_id,fee_cycle_key,amount,currency,status,due_at,settled_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership fee invoices.');
  }

  return data.map((row) => toFeeInvoiceRecord(row as Record<string, unknown>));
}

export async function updateMembershipFeeInvoiceStatus(invoiceId: string, status: 'unpaid' | 'paid' | 'waived'): Promise<void> {
  const { error } = await supabase
    .from('membership_fee_invoices')
    .update({
      status,
      settled_at: status === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  if (error) throw error;
}

export async function listMembershipAnalytics(limit = 90): Promise<MembershipAnalyticsRecord[]> {
  const { data, error } = await supabase
    .from('membership_daily_analytics')
    .select('id,report_date,total_members,paid_members,pending_upgrades,active_multipliers,fee_delinquent_members,top_plan_level,top_plan_label')
    .order('report_date', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership analytics.');
  }

  return data.map((row) => toAnalyticsRecord(row as Record<string, unknown>));
}

export async function listMembershipJobRuns(limit = 50): Promise<MembershipJobRunRecord[]> {
  const { data, error } = await supabase
    .from('membership_job_runs')
    .select('id,job_key,status,run_date,started_at,finished_at,details')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load membership job runs.');
  }

  return data.map((row) => toJobRunRecord(row as Record<string, unknown>));
}

export async function runMembershipAutomationJobs(): Promise<void> {
  const jobs = [
    'run_membership_reward_cycle_job',
    'run_membership_workflow_job',
    'run_membership_fee_invoice_job',
    'run_membership_daily_analytics_job',
  ];

  for (const job of jobs) {
    const { error } = await supabase.rpc(job);
    if (error) {
      throw error;
    }
  }
}
