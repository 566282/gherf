import { supabase } from '@/services/supabase/client';

export type FraudThresholds = {
  review: number;
  quarantine: number;
  block: number;
  watchTimeMinutes: number;
  rapidClicksPerMinute: number;
  autoRefreshesPerMinute: number;
  sharedIpLimit: number;
  deviceReuseLimit: number;
  linkedAccountLimit: number;
  automationConfidence: number;
  referralLoopScore: number;
};

export type FraudDetectionConfig = {
  thresholds: FraudThresholds;
  savedAt: string;
  updatedBy: string | null;
  version: number;
};

export type FraudPolicyAuditEntry = {
  id: string;
  adminId: string | null;
  action: string;
  resourceId: string;
  reason: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string | null;
};

export type FraudDecision = 'Monitor' | 'Review' | 'Quarantine' | 'Block';

export type FraudSignalKey =
  | 'vpn'
  | 'proxy'
  | 'emulator'
  | 'bot'
  | 'multiple_accounts'
  | 'duplicate_ip'
  | 'device_fingerprint'
  | 'rapid_clicking'
  | 'fake_watch_time'
  | 'auto_refresh'
  | 'automation'
  | 'suspicious_referrals';

export type FraudSignalDefinition = {
  key: FraudSignalKey;
  label: string;
  category: string;
  description: string;
  weight: number;
};

export type FraudUserProfile = {
  id: string;
  name: string;
  email: string;
  campaign: string;
  country: string;
  device: string;
  ipGroup: string;
  watchTimeMinutes: number;
  clicksPerMinute: number;
  refreshesPerMinute: number;
  automationConfidence: number;
  sharedIpAccounts: number;
  deviceReuseCount: number;
  linkedAccounts: number;
  referralLoopScore: number;
  vpn: boolean;
  proxy: boolean;
  emulator: boolean;
  bot: boolean;
  suspiciousReferrals: boolean;
  lastSeen: string;
};

export type FraudAssessment = FraudUserProfile & {
  score: number;
  decision: FraudDecision;
  activeSignals: string[];
};

export type FraudDecisionExplanation = {
  decision: FraudDecision;
  score: number;
  summary: string;
  reasons: string[];
  signals: string[];
};

export const fraudRiskChecks = ['fraud_detection', 'duplicate_detection', 'vpn_detection', 'proxy_detection', 'bot_detection'] as const;

export type FraudRiskCheck = (typeof fraudRiskChecks)[number];

const fraudRiskCheckReasons: Record<FraudRiskCheck, string> = {
  fraud_detection: 'Fraud detection is enabled for this flow.',
  duplicate_detection: 'Duplicate submissions or identities will be blocked.',
  vpn_detection: 'VPN-based activity is blocked by policy.',
  proxy_detection: 'Proxy-based activity is blocked by policy.',
  bot_detection: 'Bot and automation signals are blocked by policy.',
};

export const fraudSignalLabels: Record<FraudSignalKey, string> = {
  vpn: 'VPN',
  proxy: 'Proxy',
  emulator: 'Emulator',
  bot: 'Bot',
  multiple_accounts: 'Multiple accounts',
  duplicate_ip: 'Duplicate IP',
  device_fingerprint: 'Device fingerprint',
  rapid_clicking: 'Rapid clicking',
  fake_watch_time: 'Fake watch time',
  auto_refresh: 'Auto refresh',
  automation: 'Automation',
  suspicious_referrals: 'Suspicious referrals',
};

export const fraudSignalDefinitions: FraudSignalDefinition[] = [
  { key: 'vpn', label: 'VPN', category: 'Network', description: 'Flags traffic that routes through anonymized or privacy-grade tunnels.', weight: 18 },
  { key: 'proxy', label: 'Proxy', category: 'Network', description: 'Detects proxy hops, residential relays, and masked IP paths.', weight: 16 },
  { key: 'emulator', label: 'Emulator', category: 'Device', description: 'Flags virtualized device fingerprints and simulator environments.', weight: 22 },
  { key: 'bot', label: 'Bot', category: 'Behavior', description: 'Identifies scripted or non-human automation behavior.', weight: 24 },
  { key: 'multiple_accounts', label: 'Multiple accounts', category: 'Identity', description: 'Detects shared identity clusters with repeated registration patterns.', weight: 20 },
  { key: 'duplicate_ip', label: 'Duplicate IP', category: 'Identity', description: 'Surfaces repeated source IPs across linked or suspicious accounts.', weight: 15 },
  { key: 'device_fingerprint', label: 'Device fingerprint', category: 'Device', description: 'Detects repeated device signatures across multiple accounts.', weight: 22 },
  { key: 'rapid_clicking', label: 'Rapid clicking', category: 'Behavior', description: 'Flags click bursts that exceed normal human interaction rates.', weight: 14 },
  { key: 'fake_watch_time', label: 'Fake watch time', category: 'Engagement', description: 'Identifies video views that end far too early to be credible.', weight: 26 },
  { key: 'auto_refresh', label: 'Auto refresh', category: 'Behavior', description: 'Detects repeated refresh loops used to simulate activity.', weight: 15 },
  { key: 'automation', label: 'Automation', category: 'Behavior', description: 'Captures high-confidence automation signatures and scripted flows.', weight: 20 },
  { key: 'suspicious_referrals', label: 'Suspicious referrals', category: 'Growth', description: 'Checks self-referrals, invite loops, and referral ring behavior.', weight: 19 },
];

const fraudSignalReasonByLabel = new Map(fraudSignalDefinitions.map((signal) => [signal.label, signal.description]));

export function formatFraudRiskCheckReason(check: string): string {
  if (check in fraudRiskCheckReasons) {
    return fraudRiskCheckReasons[check as FraudRiskCheck];
  }

  return `${check.split('_').join(' ')} is blocked by policy.`;
}

export function describeFraudRiskChecks(checks: readonly string[]): string[] {
  return checks.map((check) => formatFraudRiskCheckReason(check));
}

export function explainFraudAssessment(assessment: FraudAssessment, thresholds: FraudThresholds): FraudDecisionExplanation {
  const reasons = assessment.activeSignals.length
    ? assessment.activeSignals.map((signal) => fraudSignalReasonByLabel.get(signal) ?? `${signal} is contributing to the fraud score.`)
    : ['No active fraud signals were detected.'];

  const summary =
    assessment.decision === 'Block'
      ? `Score ${assessment.score} crosses the block threshold of ${thresholds.block}.`
      : assessment.decision === 'Quarantine'
        ? `Score ${assessment.score} sits between the quarantine threshold of ${thresholds.quarantine} and the block threshold of ${thresholds.block}.`
        : assessment.decision === 'Review'
          ? `Score ${assessment.score} sits between the review threshold of ${thresholds.review} and the quarantine threshold of ${thresholds.quarantine}.`
          : `Score ${assessment.score} stays below the review threshold of ${thresholds.review}.`;

  return {
    decision: assessment.decision,
    score: assessment.score,
    summary,
    reasons,
    signals: assessment.activeSignals,
  };
}

const fraudSignalByKey = new Map(fraudSignalDefinitions.map((signal) => [signal.key, signal]));

type SettingRow = {
  key: string;
  value: unknown;
};

const FRAUD_SETTING_KEY = 'fraud_detection_policy';

export const defaultFraudThresholds: FraudThresholds = {
  review: 45,
  quarantine: 65,
  block: 85,
  watchTimeMinutes: 2,
  rapidClicksPerMinute: 8,
  autoRefreshesPerMinute: 3,
  sharedIpLimit: 1,
  deviceReuseLimit: 1,
  linkedAccountLimit: 1,
  automationConfidence: 70,
  referralLoopScore: 65,
};

const defaultFraudDetectionConfig: FraudDetectionConfig = {
  thresholds: defaultFraudThresholds,
  savedAt: '',
  updatedBy: null,
  version: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mergeFraudThresholds(value: unknown): FraudThresholds {
  if (!isRecord(value)) {
    return defaultFraudThresholds;
  }

  return {
    review: toPositiveNumber(value.review, defaultFraudThresholds.review),
    quarantine: toPositiveNumber(value.quarantine, defaultFraudThresholds.quarantine),
    block: toPositiveNumber(value.block, defaultFraudThresholds.block),
    watchTimeMinutes: toPositiveNumber(value.watchTimeMinutes, defaultFraudThresholds.watchTimeMinutes),
    rapidClicksPerMinute: toPositiveNumber(value.rapidClicksPerMinute, defaultFraudThresholds.rapidClicksPerMinute),
    autoRefreshesPerMinute: toPositiveNumber(value.autoRefreshesPerMinute, defaultFraudThresholds.autoRefreshesPerMinute),
    sharedIpLimit: toPositiveNumber(value.sharedIpLimit, defaultFraudThresholds.sharedIpLimit),
    deviceReuseLimit: toPositiveNumber(value.deviceReuseLimit, defaultFraudThresholds.deviceReuseLimit),
    linkedAccountLimit: toPositiveNumber(value.linkedAccountLimit, defaultFraudThresholds.linkedAccountLimit),
    automationConfidence: toPositiveNumber(value.automationConfidence, defaultFraudThresholds.automationConfidence),
    referralLoopScore: toPositiveNumber(value.referralLoopScore, defaultFraudThresholds.referralLoopScore),
  };
}

function mergeFraudDetectionConfig(value: unknown): FraudDetectionConfig {
  if (!isRecord(value)) {
    return defaultFraudDetectionConfig;
  }

  return {
    thresholds: mergeFraudThresholds(value.thresholds),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : null,
    version: typeof value.version === 'number' && Number.isFinite(value.version) ? value.version : 1,
  };
}

function activeSignalsForUser(user: FraudUserProfile, thresholds: FraudThresholds): FraudSignalKey[] {
  const activeSignals: FraudSignalKey[] = [];

  if (user.vpn) activeSignals.push('vpn');
  if (user.proxy) activeSignals.push('proxy');
  if (user.emulator) activeSignals.push('emulator');
  if (user.bot) activeSignals.push('bot');
  if (user.linkedAccounts > thresholds.linkedAccountLimit) activeSignals.push('multiple_accounts');
  if (user.sharedIpAccounts > thresholds.sharedIpLimit) activeSignals.push('duplicate_ip');
  if (user.deviceReuseCount > thresholds.deviceReuseLimit) activeSignals.push('device_fingerprint');
  if (user.clicksPerMinute > thresholds.rapidClicksPerMinute) activeSignals.push('rapid_clicking');
  if (user.watchTimeMinutes < thresholds.watchTimeMinutes) activeSignals.push('fake_watch_time');
  if (user.refreshesPerMinute > thresholds.autoRefreshesPerMinute) activeSignals.push('auto_refresh');
  if (user.automationConfidence >= thresholds.automationConfidence) activeSignals.push('automation');
  if (user.referralLoopScore >= thresholds.referralLoopScore || user.suspiciousReferrals) activeSignals.push('suspicious_referrals');

  return activeSignals;
}

function signalPenalty(key: FraudSignalKey, user: FraudUserProfile, thresholds: FraudThresholds): number {
  const signal = fraudSignalByKey.get(key);

  if (!signal) {
    return 0;
  }

  switch (key) {
    case 'multiple_accounts':
      return signal.weight + Math.max(0, user.linkedAccounts - thresholds.linkedAccountLimit) * 4;
    case 'duplicate_ip':
      return signal.weight + Math.max(0, user.sharedIpAccounts - thresholds.sharedIpLimit) * 4;
    case 'device_fingerprint':
      return signal.weight + Math.max(0, user.deviceReuseCount - thresholds.deviceReuseLimit) * 5;
    case 'rapid_clicking':
      return signal.weight + Math.max(0, user.clicksPerMinute - thresholds.rapidClicksPerMinute) * 3;
    case 'fake_watch_time':
      return signal.weight + Math.max(0, thresholds.watchTimeMinutes - user.watchTimeMinutes) * 8;
    case 'auto_refresh':
      return signal.weight + Math.max(0, user.refreshesPerMinute - thresholds.autoRefreshesPerMinute) * 4;
    case 'automation':
      return signal.weight + Math.max(0, user.automationConfidence - thresholds.automationConfidence) / 2;
    case 'suspicious_referrals':
      return signal.weight + Math.max(0, user.referralLoopScore - thresholds.referralLoopScore) / 2;
    default:
      return signal.weight;
  }
}

export function evaluateFraudProfile(user: FraudUserProfile, thresholds: FraudThresholds): FraudAssessment {
  const activeSignals = activeSignalsForUser(user, thresholds);
  const penalty = activeSignals.reduce((total, key) => total + signalPenalty(key, user, thresholds), 0);
  const score = Math.max(0, Math.round(100 - penalty));

  const decision: FraudDecision =
    score >= thresholds.block ? 'Block' : score >= thresholds.quarantine ? 'Quarantine' : score >= thresholds.review ? 'Review' : 'Monitor';

  return {
    ...user,
    score,
    decision,
    activeSignals: activeSignals.map((key) => fraudSignalByKey.get(key)?.label ?? key),
  };
}

export async function listFraudDetectionConfig(): Promise<FraudDetectionConfig> {
  const { data, error } = await supabase.from('platform_settings').select('key,value').eq('key', FRAUD_SETTING_KEY).single();

  if (error || !data) {
    return defaultFraudDetectionConfig;
  }

  return mergeFraudDetectionConfig((data as SettingRow).value);
}

export async function updateFraudDetectionConfig(thresholds: FraudThresholds, updatedBy?: string): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: FRAUD_SETTING_KEY,
      value: {
        version: 1,
        thresholds,
        savedAt: new Date().toISOString(),
        updatedBy: updatedBy ?? null,
      },
      description: 'Fraud detection engine thresholds and enforcement policy',
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}

export async function listFraudPolicyAuditTrail(limit = 8): Promise<FraudPolicyAuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_action_audit')
    .select('id,admin_id,action,resource_id,old_values,new_values,reason,created_at')
    .eq('resource_type', 'fraud_detection_policy')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: String((row as Record<string, unknown>).id),
    adminId: (row as Record<string, unknown>).admin_id == null ? null : String((row as Record<string, unknown>).admin_id),
    action: String((row as Record<string, unknown>).action ?? ''),
    resourceId: String((row as Record<string, unknown>).resource_id ?? ''),
    reason: String((row as Record<string, unknown>).reason ?? ''),
    oldValues: ((row as Record<string, unknown>).old_values as Record<string, unknown> | null) ?? null,
    newValues: ((row as Record<string, unknown>).new_values as Record<string, unknown> | null) ?? null,
    createdAt: (row as Record<string, unknown>).created_at == null ? null : String((row as Record<string, unknown>).created_at),
  }));
}

export function extractFraudThresholdsFromAuditEntry(entry: FraudPolicyAuditEntry): FraudThresholds | null {
  const values = entry.oldValues ?? entry.newValues;

  if (!values || typeof values !== 'object') {
    return null;
  }

  const nestedThresholds = (values as Record<string, unknown>).value;

  if (!nestedThresholds || typeof nestedThresholds !== 'object' || Array.isArray(nestedThresholds)) {
    return null;
  }

  const candidate = (nestedThresholds as Record<string, unknown>).thresholds;

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const source = candidate as Record<string, unknown>;

  return {
    review: toPositiveNumber(source.review, defaultFraudThresholds.review),
    quarantine: toPositiveNumber(source.quarantine, defaultFraudThresholds.quarantine),
    block: toPositiveNumber(source.block, defaultFraudThresholds.block),
    watchTimeMinutes: toPositiveNumber(source.watchTimeMinutes, defaultFraudThresholds.watchTimeMinutes),
    rapidClicksPerMinute: toPositiveNumber(source.rapidClicksPerMinute, defaultFraudThresholds.rapidClicksPerMinute),
    autoRefreshesPerMinute: toPositiveNumber(source.autoRefreshesPerMinute, defaultFraudThresholds.autoRefreshesPerMinute),
    sharedIpLimit: toPositiveNumber(source.sharedIpLimit, defaultFraudThresholds.sharedIpLimit),
    deviceReuseLimit: toPositiveNumber(source.deviceReuseLimit, defaultFraudThresholds.deviceReuseLimit),
    linkedAccountLimit: toPositiveNumber(source.linkedAccountLimit, defaultFraudThresholds.linkedAccountLimit),
    automationConfidence: toPositiveNumber(source.automationConfidence, defaultFraudThresholds.automationConfidence),
    referralLoopScore: toPositiveNumber(source.referralLoopScore, defaultFraudThresholds.referralLoopScore),
  };
}