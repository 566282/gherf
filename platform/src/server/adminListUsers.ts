import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveAccountRole } from '../lib/authRole';
import { resolveMembershipLabel } from '../services/api/membership';
import type { AppRole, UserProfile } from '../types/auth';

const realtimeTransport = WebSocket as unknown as typeof globalThis.WebSocket;

const allowedRoles = new Set(['super_admin', 'campaign_manager', 'moderator', 'advertiser', 'registered_user', 'guest']);
const allowedStatuses = new Set(['active', 'suspended', 'banned', 'pending_verification']);
const profileSelect = 'id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at';

let cachedLocalEnv: Record<string, string> | null = null;

type EnvSource = 'process' | 'local-file' | 'missing';

type ResolvedServerEnv = {
  value: string;
  source: EnvSource;
};

type ListUsersEvent = {
  httpMethod?: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

type QueryRole = AppRole | null;
type QueryStatus = UserProfile['status'] | null;

function json(statusCode: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function resolveRuntimeMode(): string {
  const netlifyContext = process.env.CONTEXT?.trim();
  if (netlifyContext) {
    return `netlify:${netlifyContext}`;
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'local';
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function readLocalEnvFile(): Record<string, string> {
  if (cachedLocalEnv) {
    return cachedLocalEnv;
  }

  const loaded: Record<string, string> = {};
  const candidates = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(candidate, 'utf8'));
    Object.assign(loaded, parsed);
  }

  cachedLocalEnv = loaded;
  return loaded;
}

function resolveServerEnv(...keys: string[]): ResolvedServerEnv {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return { value: value.trim(), source: 'process' };
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const localEnv = readLocalEnvFile();
    for (const key of keys) {
      const value = localEnv[key];
      if (value && value.trim().length > 0) {
        return { value: value.trim(), source: 'local-file' };
      }
    }
  }

  return { value: '', source: 'missing' };
}

function normalizeQueryValue(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeRoleFilter(input: unknown): QueryRole {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim();
  return allowedRoles.has(normalized) ? (normalized as AppRole) : null;
}

function normalizeStatusFilter(input: unknown): QueryStatus {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim();
  return allowedStatuses.has(normalized) ? (normalized as UserProfile['status']) : null;
}

function mapProfile(row: Record<string, unknown>) {
  const levelTier = Number(row.level_tier ?? 1);

  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    fullName: (row.full_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    role: row.role,
    status: row.status,
    isActive: Boolean(row.is_active),
    isEmailVerified: Boolean(row.is_email_verified),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    referralCode: String(row.referral_code ?? ''),
    referredByCode: (row.referred_by_code as string | null) ?? null,
    walletBalance: Number(row.wallet_balance ?? 0),
    rewardBalance: Number(row.reward_balance ?? 0),
    rewardHistoryCount: Number(row.reward_history_count ?? 0),
    unreadNotificationsCount: Number(row.unread_notifications_count ?? 0),
    reputationScore: Number(row.reputation_score ?? 0),
    levelLabel: String(row.level_label ?? resolveMembershipLabel(levelTier)),
    levelTier,
    badges: Array.isArray(row.badges) ? row.badges : [],
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  };
}

export async function handler(event: ListUsersEvent) {
  try {
    if ((event.httpMethod ?? 'GET') !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }

  const supabaseUrl = resolveServerEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = resolveServerEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');
  const runtimeMode = resolveRuntimeMode();
  const runtimeHeader = {
    'X-Admin-List-Users-Runtime-Mode': runtimeMode,
    'X-Admin-List-Users-Env-Source': `supabaseUrl:${supabaseUrl.source};serviceRoleKey:${serviceRoleKey.source}`,
  };

  if (!supabaseUrl.value || !serviceRoleKey.value) {
    const missing: string[] = [];
    if (!supabaseUrl.value) {
      missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
    }
    if (!serviceRoleKey.value) {
      missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    return json(
      500,
      {
        error: `Admin users listing service is not configured. Missing: ${missing.join(', ')}.`,
        code: 'ADMIN_LIST_USERS_CONFIG_MISSING',
        runtimeMode,
        envSource: {
          supabaseUrl: supabaseUrl.source,
          serviceRoleKey: serviceRoleKey.source,
        },
      },
      runtimeHeader,
    );
  }

  const authorization = event.headers.authorization ?? event.headers.Authorization ?? '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

  if (!accessToken) {
    return json(401, { error: 'Missing authorization token.' });
  }

  const adminClient = createClient(supabaseUrl.value, serviceRoleKey.value, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });

  const { data: authUser, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !authUser.user) {
    return json(401, { error: 'Unauthorized.' });
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authUser.user.id)
    .maybeSingle();

  const callerRole = resolveAccountRole(callerProfile?.role as AppRole | null | undefined, {
    id: authUser.user.id,
    email: authUser.user.email,
    user_metadata: authUser.user.user_metadata,
    app_metadata: authUser.user.app_metadata,
  });

  if (callerProfileError || callerRole !== 'super_admin') {
    return json(403, { error: 'Only super admins can list managed users.' });
  }

  const queryInput = normalizeQueryValue(event.queryStringParameters?.query);
  const roleFilter = normalizeRoleFilter(event.queryStringParameters?.role);
  const statusFilter = normalizeStatusFilter(event.queryStringParameters?.status);

  let query = adminClient.from('profiles').select(profileSelect).order('updated_at', { ascending: false });

  if (roleFilter) {
    query = query.eq('role', roleFilter);
  }

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  if (queryInput) {
    const escapedQuery = queryInput.replace(/,/g, '\\,');
    query = query.or(`full_name.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%,referral_code.ilike.%${escapedQuery}%`);
  }

  const { data, error } = await query;
  if (error) {
    return json(400, { error: error.message || 'Unable to list users.' });
  }

    return json(200, { profiles: (data ?? []).map((row) => mapProfile(row as Record<string, unknown>)), runtimeMode }, runtimeHeader);
  } catch (error) {
    const runtimeMode = resolveRuntimeMode();

    return json(
      500,
      {
        error: error instanceof Error ? error.message : 'Unexpected error while listing managed users.',
        code: 'ADMIN_LIST_USERS_UNHANDLED',
        runtimeMode,
      },
      {
        'X-Admin-List-Users-Runtime-Mode': runtimeMode,
        'X-Admin-List-Users-Env-Source': 'supabaseUrl:unknown;serviceRoleKey:unknown',
      },
    );
  }
}