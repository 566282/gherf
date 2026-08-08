import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveAccountRole } from '../lib/authRole';
import { resolveMembershipLabel, resolveMembershipPlan } from '../services/api/membership';
import type { AppRole } from '../types/auth';

const allowedRoles = new Set(['super_admin', 'campaign_manager', 'moderator', 'advertiser', 'registered_user', 'guest']);
const profileSelect = 'id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at';

let cachedLocalEnv: Record<string, string> | null = null;

type EnvSource = 'process' | 'local-file' | 'missing';

type ResolvedServerEnv = {
  value: string;
  source: EnvSource;
};

function getPlanLabelForTier(levelTier: number): string {
  return resolveMembershipLabel(levelTier);
}

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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

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

  // Local development fallback: read .env.local/.env when function runner did not inject process.env.
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

function normalizeTier(input: unknown): number {
  const parsed = typeof input === 'string' || typeof input === 'number' ? Number(input) : 1;
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return resolveMembershipPlan(parsed).level;
}

function normalizeRole(input: unknown): string {
  return typeof input === 'string' && allowedRoles.has(input) ? input : 'registered_user';
}

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
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
    levelLabel: String(row.level_label ?? getPlanLabelForTier(levelTier)),
    levelTier,
    badges: Array.isArray(row.badges) ? row.badges : [],
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  };
}

export type AdminCreateUserHandlerEvent = {
  httpMethod?: string;
  headers: Record<string, string | undefined>;
  body: string | null;
};

export async function handler(event: AdminCreateUserHandlerEvent) {
  if ((event.httpMethod ?? 'GET') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = resolveServerEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = resolveServerEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');
  const runtimeMode = resolveRuntimeMode();
  const runtimeHeader = {
    'X-Admin-Create-User-Runtime-Mode': runtimeMode,
    'X-Admin-Create-User-Env-Source': `supabaseUrl:${supabaseUrl.source};serviceRoleKey:${serviceRoleKey.source}`,
  };

  if (!supabaseUrl.value || !serviceRoleKey.value) {
    const missing: string[] = [];
    if (!supabaseUrl.value) {
      missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
    }
    if (!serviceRoleKey.value) {
      missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    return json(500, {
      error: `Admin creation service is not configured. Missing: ${missing.join(', ')}.`,
      code: 'ADMIN_CREATE_USER_CONFIG_MISSING',
      runtimeMode,
      envSource: {
        supabaseUrl: supabaseUrl.source,
        serviceRoleKey: serviceRoleKey.source,
      },
    }, runtimeHeader);
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
    return json(403, { error: 'Only super admins can create managed users.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON payload.' });
  }

  const email = normalizeText(payload.email);
  const password = normalizeText(payload.password);
  const fullName = normalizeText(payload.fullName);
  const role = normalizeRole(payload.role);
  const levelTier = normalizeTier(payload.levelTier);

  if (!email) {
    return json(400, { error: 'Email is required.' });
  }

  if (!password || password.length < 8) {
    return json(400, { error: 'Password must be at least 8 characters long.' });
  }

  if (!fullName) {
    return json(400, { error: 'Full name is required.' });
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      admin_managed: true,
    },
    user_metadata: {
      full_name: fullName,
      role,
      level_tier: levelTier,
      level_label: getPlanLabelForTier(levelTier),
    },
  });

  if (createError || !createdUser.user) {
    return json(400, { error: createError?.message ?? 'Unable to create user.' });
  }

  let profileRow: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await adminClient
      .from('profiles')
      .select(profileSelect)
      .eq('id', createdUser.user.id)
      .maybeSingle();

    if (data && !error) {
      profileRow = data as Record<string, unknown>;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  if (!profileRow) {
    const { data: bootstrappedProfile, error: profileBootstrapError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: createdUser.user.id,
          email,
          full_name: fullName,
          avatar_url: null,
          role,
          status: 'active',
          is_active: true,
          is_email_verified: true,
          two_factor_enabled: false,
          referral_code: null,
          referred_by_code: null,
          wallet_balance: 0,
          reward_balance: 0,
          reward_history_count: 0,
          unread_notifications_count: 0,
          reputation_score: 0,
          level_label: getPlanLabelForTier(levelTier),
          level_tier: levelTier,
          badges: [],
          last_login_at: null,
        },
        { onConflict: 'id' },
      )
      .select(profileSelect)
      .maybeSingle();

    if (profileBootstrapError || !bootstrappedProfile) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      return json(500, { error: 'User was created in Auth, but the profile bootstrap step failed.' });
    }

    profileRow = bootstrappedProfile as Record<string, unknown>;
  }

  const { error: auditError } = await adminClient.from('admin_action_audit').insert({
    admin_id: authUser.user.id,
    action: 'admin_create_user',
    resource_type: 'profile',
    resource_id: createdUser.user.id,
    new_values: {
      email,
      fullName,
      role,
      levelTier,
    },
    reason: `Created ${email} with ${role} role and ${getPlanLabelForTier(levelTier)} membership.`,
  });

  if (auditError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id);
    return json(500, { error: 'User was created, but the audit entry failed to save.' });
  }

  return json(200, { profile: mapProfile(profileRow), runtimeMode }, runtimeHeader);
}
