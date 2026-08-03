import { supabase } from '@/services/supabase/client';

export const TASK_COMPLIANCE_POLICY_KEY = 'task_compliance_policy';
export const TASK_COMPLIANCE_POLICY_SCHEMA_VERSION = 'task-compliance-policy.v1';

export const canonicalVerificationStates = ['pending', 'queued', 'running', 'review_required', 'approved', 'rejected', 'expired'] as const;
export const canonicalWithdrawalComplianceStates = ['draft', 'pending_compliance', 'held_compliance', 'approved', 'rejected', 'bypassed'] as const;
export const canonicalEnforcementStates = ['none', 'warning', 'hold', 'suspend', 'ban'] as const;
export const canonicalAppealStates = ['not_eligible', 'eligible', 'submitted', 'fee_pending', 'in_review', 'resolved'] as const;

export type VerificationState = (typeof canonicalVerificationStates)[number];
export type WithdrawalComplianceState = (typeof canonicalWithdrawalComplianceStates)[number];
export type EnforcementState = (typeof canonicalEnforcementStates)[number];
export type AppealState = (typeof canonicalAppealStates)[number];

export type VerificationMethod =
  | 'api_signal'
  | 'oauth_link'
  | 'webhook_event'
  | 'evidence_upload'
  | 'manual_review'
  | 'random_audit';

export interface StateTransitionRule<TState extends string> {
  from: TState;
  to: TState;
  via: string;
}

export interface TaskCompliancePolicy {
  schemaVersion: string;
  metadata: {
    version: number;
    label: string;
    description: string;
    updatedAt: string;
    updatedBy: string | null;
  };
  states: {
    verification: VerificationState[];
    withdrawalCompliance: WithdrawalComplianceState[];
    enforcement: EnforcementState[];
    appeal: AppealState[];
  };
  transitions: {
    verification: StateTransitionRule<VerificationState>[];
    withdrawalCompliance: StateTransitionRule<WithdrawalComplianceState>[];
    enforcement: StateTransitionRule<EnforcementState>[];
    appeal: StateTransitionRule<AppealState>[];
  };
  verificationStrategy: {
    methods: VerificationMethod[];
    platformMethodAllowList: Record<string, VerificationMethod[]>;
    fallbackOrder: VerificationMethod[];
    randomAuditRatePercent: number;
    manualReview: {
      minRiskScore: number;
      minWithdrawalAmount: number;
    };
  };
  withdrawalGate: {
    enabled: boolean;
    bypass: {
      enabled: boolean;
      maxRiskScore: number;
      minAccountAgeDays: number;
    };
    holdState: WithdrawalComplianceState;
  };
  risk: {
    range: {
      min: number;
      max: number;
    };
    weights: {
      taskAnomaly: number;
      identityMismatch: number;
      deviceIpRisk: number;
      violationHistory: number;
      evidenceQuality: number;
    };
  };
  enforcement: {
    rules: Array<{
      threshold: number;
      action: EnforcementState;
      reversible: boolean;
      reasonCode: string;
    }>;
  };
}

export interface CompliancePolicyRecord {
  id: string;
  policyKey: string;
  title: string;
  description: string;
  currentVersion: string | null;
  status: string;
  metadata: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: string;
}

export interface CompliancePolicyVersionRecord {
  id: string;
  policyId: string;
  policyKey: string;
  version: string;
  schemaVersion: string;
  status: string;
  policy: TaskCompliancePolicy;
  isBaseline: boolean;
  publishedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveCompliancePolicySelection {
  policyKey: string;
  version: string;
  schemaVersion: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
}

export const taskCompliancePolicySchema: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://gherf.local/schemas/task-compliance-policy.v1.json',
  title: 'Task Compliance Policy',
  type: 'object',
  required: ['schemaVersion', 'metadata', 'states', 'transitions', 'verificationStrategy', 'withdrawalGate', 'risk', 'enforcement'],
  properties: {
    schemaVersion: { type: 'string', const: TASK_COMPLIANCE_POLICY_SCHEMA_VERSION },
    metadata: { type: 'object' },
    states: { type: 'object' },
    transitions: { type: 'object' },
    verificationStrategy: { type: 'object' },
    withdrawalGate: { type: 'object' },
    risk: { type: 'object' },
    enforcement: { type: 'object' },
  },
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toVerificationMethodList(value: unknown, fallback: VerificationMethod[]): VerificationMethod[] {
  if (!Array.isArray(value)) return fallback;

  const valid: VerificationMethod[] = [];
  for (const item of value) {
    if (
      item === 'api_signal'
      || item === 'oauth_link'
      || item === 'webhook_event'
      || item === 'evidence_upload'
      || item === 'manual_review'
      || item === 'random_audit'
    ) {
      valid.push(item);
    }
  }

  return valid.length ? Array.from(new Set(valid)) : fallback;
}

function toStateList<TState extends string>(value: unknown, allowed: readonly TState[], fallback: TState[]): TState[] {
  if (!Array.isArray(value)) return fallback;

  const allowedSet = new Set(allowed);
  const normalized = value.filter((item): item is TState => typeof item === 'string' && allowedSet.has(item as TState));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function parseTransitions<TState extends string>(
  value: unknown,
  allowed: readonly TState[],
  fallback: Array<StateTransitionRule<TState>>,
): Array<StateTransitionRule<TState>> {
  if (!Array.isArray(value)) return fallback;

  const allowedSet = new Set(allowed);
  const normalized: Array<StateTransitionRule<TState>> = [];

  for (const item of value) {
    if (!isRecord(item)) continue;

    const from = item.from;
    const to = item.to;
    const via = item.via;

    if (typeof from !== 'string' || typeof to !== 'string' || typeof via !== 'string') continue;
    if (!allowedSet.has(from as TState) || !allowedSet.has(to as TState)) continue;

    normalized.push({ from: from as TState, to: to as TState, via });
  }

  return normalized.length ? normalized : fallback;
}

function parsePlatformMethodAllowList(value: unknown, fallback: Record<string, VerificationMethod[]>): Record<string, VerificationMethod[]> {
  if (!isRecord(value)) return fallback;

  const output: Record<string, VerificationMethod[]> = {};
  for (const [platform, methods] of Object.entries(value)) {
    const normalizedMethods = toVerificationMethodList(methods, []);
    if (normalizedMethods.length) {
      output[platform] = normalizedMethods;
    }
  }

  return Object.keys(output).length ? output : fallback;
}

export function createDefaultTaskCompliancePolicy(): TaskCompliancePolicy {
  return {
    schemaVersion: TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
    metadata: {
      version: 1,
      label: 'Baseline task compliance policy',
      description: 'Hybrid verification and withdrawal compliance baseline for rewarded tasks.',
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    },
    states: {
      verification: [...canonicalVerificationStates],
      withdrawalCompliance: [...canonicalWithdrawalComplianceStates],
      enforcement: [...canonicalEnforcementStates],
      appeal: [...canonicalAppealStates],
    },
    transitions: {
      verification: [
        { from: 'pending', to: 'queued', via: 'enqueue' },
        { from: 'queued', to: 'running', via: 'start' },
        { from: 'running', to: 'approved', via: 'auto_pass' },
        { from: 'running', to: 'review_required', via: 'needs_manual_review' },
        { from: 'review_required', to: 'approved', via: 'manual_approve' },
        { from: 'review_required', to: 'rejected', via: 'manual_reject' },
        { from: 'running', to: 'expired', via: 'timeout' },
      ],
      withdrawalCompliance: [
        { from: 'draft', to: 'pending_compliance', via: 'withdrawal_requested' },
        { from: 'pending_compliance', to: 'held_compliance', via: 'policy_hold' },
        { from: 'pending_compliance', to: 'approved', via: 'policy_pass' },
        { from: 'held_compliance', to: 'approved', via: 'manual_release' },
        { from: 'held_compliance', to: 'rejected', via: 'manual_reject' },
        { from: 'pending_compliance', to: 'bypassed', via: 'policy_bypass' },
      ],
      enforcement: [
        { from: 'none', to: 'warning', via: 'low_severity_violation' },
        { from: 'warning', to: 'hold', via: 'repeat_violation' },
        { from: 'hold', to: 'suspend', via: 'high_risk_violation' },
        { from: 'suspend', to: 'ban', via: 'critical_violation' },
      ],
      appeal: [
        { from: 'not_eligible', to: 'eligible', via: 'policy_allows' },
        { from: 'eligible', to: 'submitted', via: 'appeal_created' },
        { from: 'submitted', to: 'fee_pending', via: 'fee_required' },
        { from: 'submitted', to: 'in_review', via: 'no_fee_required' },
        { from: 'fee_pending', to: 'in_review', via: 'fee_settled' },
        { from: 'in_review', to: 'resolved', via: 'decision_recorded' },
      ],
    },
    verificationStrategy: {
      methods: ['api_signal', 'oauth_link', 'webhook_event', 'evidence_upload', 'manual_review', 'random_audit'],
      platformMethodAllowList: {
        youtube: ['api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'],
        facebook: ['api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'],
        instagram: ['api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'],
        x: ['api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'],
        tiktok: ['api_signal', 'oauth_link', 'evidence_upload', 'manual_review', 'random_audit'],
      },
      fallbackOrder: ['api_signal', 'oauth_link', 'webhook_event', 'evidence_upload', 'manual_review', 'random_audit'],
      randomAuditRatePercent: 12,
      manualReview: {
        minRiskScore: 60,
        minWithdrawalAmount: 500,
      },
    },
    withdrawalGate: {
      enabled: true,
      bypass: {
        enabled: true,
        maxRiskScore: 24,
        minAccountAgeDays: 30,
      },
      holdState: 'held_compliance',
    },
    risk: {
      range: {
        min: 0,
        max: 100,
      },
      weights: {
        taskAnomaly: 25,
        identityMismatch: 25,
        deviceIpRisk: 20,
        violationHistory: 20,
        evidenceQuality: 10,
      },
    },
    enforcement: {
      rules: [
        { threshold: 40, action: 'warning', reversible: true, reasonCode: 'risk_warning' },
        { threshold: 60, action: 'hold', reversible: true, reasonCode: 'risk_hold' },
        { threshold: 80, action: 'suspend', reversible: true, reasonCode: 'risk_suspend' },
        { threshold: 95, action: 'ban', reversible: false, reasonCode: 'risk_ban' },
      ],
    },
  };
}

export function mergeTaskCompliancePolicy(value: unknown): TaskCompliancePolicy {
  const defaults = createDefaultTaskCompliancePolicy();
  if (!isRecord(value)) return defaults;

  const statesInput = isRecord(value.states) ? value.states : {};
  const transitionsInput = isRecord(value.transitions) ? value.transitions : {};
  const strategyInput = isRecord(value.verificationStrategy) ? value.verificationStrategy : {};
  const withdrawalGateInput = isRecord(value.withdrawalGate) ? value.withdrawalGate : {};
  const bypassInput = isRecord(withdrawalGateInput.bypass) ? withdrawalGateInput.bypass : {};
  const riskInput = isRecord(value.risk) ? value.risk : {};
  const riskRangeInput = isRecord(riskInput.range) ? riskInput.range : {};
  const riskWeightsInput = isRecord(riskInput.weights) ? riskInput.weights : {};
  const enforcementInput = isRecord(value.enforcement) ? value.enforcement : {};

  const policy: TaskCompliancePolicy = {
    schemaVersion: toStringValue(value.schemaVersion, defaults.schemaVersion),
    metadata: {
      version: Math.max(1, Math.round(toNumber((value.metadata as Record<string, unknown> | undefined)?.version, defaults.metadata.version))),
      label: toStringValue((value.metadata as Record<string, unknown> | undefined)?.label, defaults.metadata.label),
      description: toStringValue((value.metadata as Record<string, unknown> | undefined)?.description, defaults.metadata.description),
      updatedAt: toStringValue((value.metadata as Record<string, unknown> | undefined)?.updatedAt, defaults.metadata.updatedAt),
      updatedBy: typeof (value.metadata as Record<string, unknown> | undefined)?.updatedBy === 'string'
        ? String((value.metadata as Record<string, unknown>).updatedBy)
        : null,
    },
    states: {
      verification: toStateList(statesInput.verification, canonicalVerificationStates, defaults.states.verification),
      withdrawalCompliance: toStateList(statesInput.withdrawalCompliance, canonicalWithdrawalComplianceStates, defaults.states.withdrawalCompliance),
      enforcement: toStateList(statesInput.enforcement, canonicalEnforcementStates, defaults.states.enforcement),
      appeal: toStateList(statesInput.appeal, canonicalAppealStates, defaults.states.appeal),
    },
    transitions: {
      verification: parseTransitions(transitionsInput.verification, canonicalVerificationStates, defaults.transitions.verification),
      withdrawalCompliance: parseTransitions(transitionsInput.withdrawalCompliance, canonicalWithdrawalComplianceStates, defaults.transitions.withdrawalCompliance),
      enforcement: parseTransitions(transitionsInput.enforcement, canonicalEnforcementStates, defaults.transitions.enforcement),
      appeal: parseTransitions(transitionsInput.appeal, canonicalAppealStates, defaults.transitions.appeal),
    },
    verificationStrategy: {
      methods: toVerificationMethodList(strategyInput.methods, defaults.verificationStrategy.methods),
      platformMethodAllowList: parsePlatformMethodAllowList(strategyInput.platformMethodAllowList, defaults.verificationStrategy.platformMethodAllowList),
      fallbackOrder: toVerificationMethodList(strategyInput.fallbackOrder, defaults.verificationStrategy.fallbackOrder),
      randomAuditRatePercent: Math.max(0, Math.min(100, toNumber(strategyInput.randomAuditRatePercent, defaults.verificationStrategy.randomAuditRatePercent))),
      manualReview: {
        minRiskScore: Math.max(0, Math.min(100, toNumber((strategyInput.manualReview as Record<string, unknown> | undefined)?.minRiskScore, defaults.verificationStrategy.manualReview.minRiskScore))),
        minWithdrawalAmount: Math.max(0, toNumber((strategyInput.manualReview as Record<string, unknown> | undefined)?.minWithdrawalAmount, defaults.verificationStrategy.manualReview.minWithdrawalAmount)),
      },
    },
    withdrawalGate: {
      enabled: toBoolean(withdrawalGateInput.enabled, defaults.withdrawalGate.enabled),
      bypass: {
        enabled: toBoolean(bypassInput.enabled, defaults.withdrawalGate.bypass.enabled),
        maxRiskScore: Math.max(0, Math.min(100, toNumber(bypassInput.maxRiskScore, defaults.withdrawalGate.bypass.maxRiskScore))),
        minAccountAgeDays: Math.max(0, Math.round(toNumber(bypassInput.minAccountAgeDays, defaults.withdrawalGate.bypass.minAccountAgeDays))),
      },
      holdState: toStateList([withdrawalGateInput.holdState], canonicalWithdrawalComplianceStates, [defaults.withdrawalGate.holdState])[0],
    },
    risk: {
      range: {
        min: Math.max(0, toNumber(riskRangeInput.min, defaults.risk.range.min)),
        max: Math.min(100, toNumber(riskRangeInput.max, defaults.risk.range.max)),
      },
      weights: {
        taskAnomaly: Math.max(0, toNumber(riskWeightsInput.taskAnomaly, defaults.risk.weights.taskAnomaly)),
        identityMismatch: Math.max(0, toNumber(riskWeightsInput.identityMismatch, defaults.risk.weights.identityMismatch)),
        deviceIpRisk: Math.max(0, toNumber(riskWeightsInput.deviceIpRisk, defaults.risk.weights.deviceIpRisk)),
        violationHistory: Math.max(0, toNumber(riskWeightsInput.violationHistory, defaults.risk.weights.violationHistory)),
        evidenceQuality: Math.max(0, toNumber(riskWeightsInput.evidenceQuality, defaults.risk.weights.evidenceQuality)),
      },
    },
    enforcement: {
      rules: Array.isArray(enforcementInput.rules)
        ? enforcementInput.rules
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => ({
            threshold: Math.max(0, Math.min(100, toNumber(item.threshold, 0))),
            action: toStateList([item.action], canonicalEnforcementStates, ['warning'])[0],
            reversible: toBoolean(item.reversible, true),
            reasonCode: toStringValue(item.reasonCode, 'policy_enforcement'),
          }))
        : defaults.enforcement.rules,
    },
  };

  if (!policy.enforcement.rules.length) {
    policy.enforcement.rules = defaults.enforcement.rules;
  }

  return policy;
}

function validateTransitions<TState extends string>(
  label: string,
  transitions: Array<StateTransitionRule<TState>>,
  states: TState[],
): string[] {
  const errors: string[] = [];
  const statesSet = new Set(states);
  const seen = new Set<string>();

  for (const transition of transitions) {
    if (!statesSet.has(transition.from)) {
      errors.push(`${label}: invalid from state "${transition.from}".`);
    }
    if (!statesSet.has(transition.to)) {
      errors.push(`${label}: invalid to state "${transition.to}".`);
    }
    if (transition.from === transition.to) {
      errors.push(`${label}: transition from ${transition.from} to itself is not allowed.`);
    }

    const key = `${transition.from}:${transition.to}:${transition.via}`;
    if (seen.has(key)) {
      errors.push(`${label}: duplicate transition ${key}.`);
    }
    seen.add(key);
  }

  return errors;
}

export function validateTaskCompliancePolicy(candidate: unknown): PolicyValidationResult {
  const policy = mergeTaskCompliancePolicy(candidate);
  const errors: string[] = [];

  if (policy.schemaVersion !== TASK_COMPLIANCE_POLICY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TASK_COMPLIANCE_POLICY_SCHEMA_VERSION}.`);
  }

  if (!policy.verificationStrategy.methods.length) {
    errors.push('verificationStrategy.methods cannot be empty.');
  }

  if (!policy.verificationStrategy.fallbackOrder.length) {
    errors.push('verificationStrategy.fallbackOrder cannot be empty.');
  }

  const methodSet = new Set(policy.verificationStrategy.methods);
  for (const method of policy.verificationStrategy.fallbackOrder) {
    if (!methodSet.has(method)) {
      errors.push(`verificationStrategy.fallbackOrder includes unsupported method ${method}.`);
    }
  }

  for (const [platform, methods] of Object.entries(policy.verificationStrategy.platformMethodAllowList)) {
    if (!methods.length) {
      errors.push(`verificationStrategy.platformMethodAllowList.${platform} must include at least one method.`);
      continue;
    }

    for (const method of methods) {
      if (!methodSet.has(method)) {
        errors.push(`verificationStrategy.platformMethodAllowList.${platform} includes unsupported method ${method}.`);
      }
    }
  }

  if (policy.verificationStrategy.randomAuditRatePercent < 0 || policy.verificationStrategy.randomAuditRatePercent > 100) {
    errors.push('verificationStrategy.randomAuditRatePercent must be within 0-100.');
  }

  if (!policy.states.withdrawalCompliance.includes(policy.withdrawalGate.holdState)) {
    errors.push(`withdrawalGate.holdState ${policy.withdrawalGate.holdState} is not listed in states.withdrawalCompliance.`);
  }

  if (policy.risk.range.min < 0 || policy.risk.range.max > 100 || policy.risk.range.min >= policy.risk.range.max) {
    errors.push('risk.range must satisfy 0 <= min < max <= 100.');
  }

  const totalWeight = Object.values(policy.risk.weights).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(totalWeight - 100) > 0.001) {
    errors.push(`risk.weights must total 100. Current total is ${totalWeight}.`);
  }

  const transitionErrors = [
    ...validateTransitions('transitions.verification', policy.transitions.verification, policy.states.verification),
    ...validateTransitions('transitions.withdrawalCompliance', policy.transitions.withdrawalCompliance, policy.states.withdrawalCompliance),
    ...validateTransitions('transitions.enforcement', policy.transitions.enforcement, policy.states.enforcement),
    ...validateTransitions('transitions.appeal', policy.transitions.appeal, policy.states.appeal),
  ];
  errors.push(...transitionErrors);

  if (!policy.enforcement.rules.length) {
    errors.push('enforcement.rules cannot be empty.');
  }

  const thresholds = policy.enforcement.rules.map((rule) => rule.threshold);
  for (let index = 1; index < thresholds.length; index += 1) {
    if (thresholds[index] < thresholds[index - 1]) {
      errors.push('enforcement.rules thresholds must be sorted ascending.');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function toCompliancePolicyRecord(row: Record<string, unknown>): CompliancePolicyRecord {
  return {
    id: String(row.id),
    policyKey: String(row.policy_key),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    currentVersion: row.current_version == null ? null : String(row.current_version),
    status: String(row.status ?? 'draft'),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toCompliancePolicyVersionRecord(row: Record<string, unknown>): CompliancePolicyVersionRecord {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    policyKey: String(row.policy_key),
    version: String(row.version),
    schemaVersion: String(row.schema_version ?? TASK_COMPLIANCE_POLICY_SCHEMA_VERSION),
    status: String(row.status ?? 'draft'),
    policy: mergeTaskCompliancePolicy(row.policy),
    isBaseline: Boolean(row.is_baseline),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    effectiveFrom: row.effective_from == null ? null : String(row.effective_from),
    effectiveTo: row.effective_to == null ? null : String(row.effective_to),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function listCompliancePolicies(): Promise<CompliancePolicyRecord[]> {
  const { data, error } = await supabase
    .from('compliance_policies')
    .select('id,policy_key,title,description,current_version,status,metadata,updated_by,updated_at')
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load compliance policies.');
  }

  return data.map((row) => toCompliancePolicyRecord(row as Record<string, unknown>));
}

export async function listCompliancePolicyVersions(policyKey?: string): Promise<CompliancePolicyVersionRecord[]> {
  let query = supabase
    .from('compliance_policy_versions')
    .select('id,policy_id,policy_key,version,schema_version,status,policy,is_baseline,published_at,effective_from,effective_to,updated_by,created_at,updated_at')
    .order('updated_at', { ascending: false });

  if (policyKey) {
    query = query.eq('policy_key', policyKey);
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load compliance policy versions.');
  }

  return data.map((row) => toCompliancePolicyVersionRecord(row as Record<string, unknown>));
}

export async function getActiveCompliancePolicySelection(): Promise<ActiveCompliancePolicySelection> {
  const defaults: ActiveCompliancePolicySelection = {
    policyKey: TASK_COMPLIANCE_POLICY_KEY,
    version: 'v1-baseline',
    schemaVersion: TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
  };

  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'task_compliance_policy_active')
    .maybeSingle();

  if (error || !data || !isRecord((data as Record<string, unknown>).value)) {
    return defaults;
  }

  const value = (data as Record<string, unknown>).value as Record<string, unknown>;
  return {
    policyKey: toStringValue(value.policyKey, defaults.policyKey),
    version: toStringValue(value.version, defaults.version),
    schemaVersion: toStringValue(value.schemaVersion, defaults.schemaVersion),
  };
}

export async function getActiveCompliancePolicy(): Promise<CompliancePolicyVersionRecord | null> {
  const active = await getActiveCompliancePolicySelection();

  const { data, error } = await supabase
    .from('compliance_policy_versions')
    .select('id,policy_id,policy_key,version,schema_version,status,policy,is_baseline,published_at,effective_from,effective_to,updated_by,created_at,updated_at')
    .eq('policy_key', active.policyKey)
    .eq('version', active.version)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toCompliancePolicyVersionRecord(data as Record<string, unknown>);
}

export async function upsertCompliancePolicy(input: {
  policyKey: string;
  title: string;
  description: string;
  status?: 'draft' | 'active' | 'archived';
  metadata?: Record<string, unknown>;
  updatedBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('compliance_policies').upsert(
    {
      policy_key: input.policyKey,
      title: input.title,
      description: input.description,
      status: input.status ?? 'draft',
      metadata: input.metadata ?? {},
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'policy_key' },
  );

  if (error) throw error;
}

export async function upsertCompliancePolicyVersion(input: {
  policyKey: string;
  version: string;
  status?: 'draft' | 'published' | 'archived';
  policy: unknown;
  schemaVersion?: string;
  isBaseline?: boolean;
  updatedBy?: string | null;
}): Promise<void> {
  const validation = validateTaskCompliancePolicy(input.policy);
  if (!validation.valid) {
    throw new Error(`Compliance policy validation failed: ${validation.errors.join(' | ')}`);
  }

  const normalizedPolicy = mergeTaskCompliancePolicy(input.policy);

  const { data: policyRow, error: policyError } = await supabase
    .from('compliance_policies')
    .select('id')
    .eq('policy_key', input.policyKey)
    .maybeSingle();

  if (policyError) throw policyError;

  if (!policyRow || typeof (policyRow as Record<string, unknown>).id !== 'string') {
    throw new Error(`Missing parent policy for key ${input.policyKey}. Create it before adding versions.`);
  }

  const { error } = await supabase.from('compliance_policy_versions').upsert(
    {
      policy_id: String((policyRow as Record<string, unknown>).id),
      policy_key: input.policyKey,
      version: input.version,
      schema_version: input.schemaVersion ?? TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
      status: input.status ?? 'draft',
      policy: normalizedPolicy,
      is_baseline: input.isBaseline ?? false,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'policy_key,version' },
  );

  if (error) throw error;
}

export async function publishCompliancePolicyVersion(policyKey: string, version: string, updatedBy?: string | null): Promise<void> {
  const now = new Date().toISOString();

  const { error: demoteError } = await supabase
    .from('compliance_policy_versions')
    .update({ status: 'archived', updated_at: now, updated_by: updatedBy ?? null })
    .eq('policy_key', policyKey)
    .eq('status', 'published');

  if (demoteError) throw demoteError;

  const { error: publishError } = await supabase
    .from('compliance_policy_versions')
    .update({ status: 'published', published_at: now, effective_from: now, updated_at: now, updated_by: updatedBy ?? null })
    .eq('policy_key', policyKey)
    .eq('version', version);

  if (publishError) throw publishError;

  const { error: policyError } = await supabase
    .from('compliance_policies')
    .update({ current_version: version, status: 'active', updated_by: updatedBy ?? null, updated_at: now })
    .eq('policy_key', policyKey);

  if (policyError) throw policyError;

  await setActiveCompliancePolicySelection({
    policyKey,
    version,
    schemaVersion: TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
  }, updatedBy ?? null);
}

export async function setActiveCompliancePolicySelection(
  selection: ActiveCompliancePolicySelection,
  updatedBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: 'task_compliance_policy_active',
      value: {
        policyKey: selection.policyKey,
        version: selection.version,
        schemaVersion: selection.schemaVersion,
      },
      description: 'Active policy key/version for task compliance orchestration',
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}
