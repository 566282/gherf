import { generateReferralCode, getUserLevel } from '@/lib/auth';
import { env } from '@/lib/env';
import { getDeviceFingerprintInput, getOrCreateSessionId, sanitizeEmail } from '@/lib/security';
import { releaseWithdrawalHolds } from '@/services/api/wallet';
import type {
  ActivityLogItem,
  AdminUserFilters,
  AppRole,
  DeviceSession,
  MfaFactor,
  NotificationItem,
  RewardLedgerItem,
  UserProfile,
  WalletActivity,
} from '@/types/auth';
import { supabase } from '@/services/supabase/client';

type OAuthProvider = 'google' | 'facebook' | 'apple';

export interface ReferralSignupRequest {
  email: string;
  password: string;
  options: {
    emailRedirectTo: string;
    data: {
      full_name: string;
      referral_code: string;
      referred_by_code: string | null;
      role: AppRole;
    };
  };
}

type LockStatusRow = {
  is_locked: boolean;
  locked_until: string | null;
  remaining_seconds: number;
  failed_attempts: number;
};

let authLockRpcAvailable: boolean | null = null;

type SecuritySessionRow = {
  id: string;
  session_id: string;
  is_trusted: boolean;
  is_revoked: boolean;
  revoked_reason: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  device_hash: string | null;
  user_agent_hash: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  status: UserProfile['status'];
  is_active: boolean;
  is_email_verified: boolean;
  two_factor_enabled: boolean;
  referral_code: string | null;
  referred_by_code: string | null;
  wallet_balance: number | null;
  reward_balance: number | null;
  reward_history_count: number | null;
  unread_notifications_count: number | null;
  reputation_score: number | null;
  level_label: string | null;
  level_tier: number | null;
  badges: string[] | null;
  last_login_at: string | null;
};

function mapProfile(row: ProfileRow, email: string | null): UserProfile {
  const level = getUserLevel(row.reputation_score ?? 0);

  return {
    id: row.id,
    email: row.email ?? email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    isActive: row.is_active && row.status === 'active',
    isEmailVerified: row.is_email_verified,
    twoFactorEnabled: row.two_factor_enabled,
    referralCode: row.referral_code ?? generateReferralCode(row.full_name ?? '', row.email ?? email ?? ''),
    referredByCode: row.referred_by_code,
    walletBalance: row.wallet_balance ?? 0,
    rewardBalance: row.reward_balance ?? 0,
    rewardHistoryCount: row.reward_history_count ?? 0,
    unreadNotificationsCount: row.unread_notifications_count ?? 0,
    reputationScore: row.reputation_score ?? 0,
    levelLabel: row.level_label ?? level.label,
    levelTier: row.level_tier ?? level.tier,
    badges: row.badges ?? [],
    lastLoginAt: row.last_login_at,
  };
}

async function checkAuthLock(email: string): Promise<LockStatusRow> {
  if (authLockRpcAvailable === false) {
    return {
      is_locked: false,
      locked_until: null,
      remaining_seconds: 0,
      failed_attempts: 0,
    };
  }

  const normalizedEmail = sanitizeEmail(email);
  const { data, error } = await supabase.rpc('security_is_auth_locked', {
    p_email: normalizedEmail,
  });

  if (error) {
    const serializedError = JSON.stringify(error);
    if (
      serializedError.includes('security_is_auth_locked') ||
      serializedError.includes('PGRST') ||
      serializedError.includes('404') ||
      serializedError.includes('406')
    ) {
      authLockRpcAvailable = false;
    }

    return {
      is_locked: false,
      locked_until: null,
      remaining_seconds: 0,
      failed_attempts: 0,
    };
  }

  authLockRpcAvailable = true;

  if (!Array.isArray(data) || data.length === 0) {
    return {
      is_locked: false,
      locked_until: null,
      remaining_seconds: 0,
      failed_attempts: 0,
    };
  }

  const row = data[0] as LockStatusRow;
  return {
    is_locked: Boolean(row.is_locked),
    locked_until: row.locked_until,
    remaining_seconds: Number(row.remaining_seconds ?? 0),
    failed_attempts: Number(row.failed_attempts ?? 0),
  };
}

async function registerCurrentSession(rememberLogin = false): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const now = Date.now();
  const ttlHours = rememberLogin ? 24 * 7 : Math.max(1, env.authMaxSessionHours);
  const expiresAt = new Date(now + ttlHours * 60 * 60 * 1000).toISOString();

  await supabase.rpc('security_register_session', {
    p_session_id: sessionId,
    p_expires_at: expiresAt,
    p_device_fingerprint: getDeviceFingerprintInput(),
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    p_is_trusted: rememberLogin,
  });
}

async function signInWithOAuthProvider(provider: OAuthProvider, rememberLogin = false): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/app`,
      queryParams: rememberLogin ? { prompt: 'consent' } : undefined,
    },
  });

  if (error) {
    throw error;
  }
}

export function buildReferralSignupRequest(
  email: string,
  password: string,
  fullName: string,
  referralCode?: string,
  role: AppRole = 'registered_user',
  redirectOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
): ReferralSignupRequest {
  return {
    email,
    password,
    options: {
      emailRedirectTo: `${redirectOrigin}/login`,
      data: {
        full_name: fullName,
        referral_code: generateReferralCode(fullName, email),
        referred_by_code: referralCode || null,
        role,
      },
    },
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at')
    .eq('id', authData.user.id)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;
  return mapProfile(data, authData.user.email ?? null);
}

export async function signIn(email: string, password: string, rememberLogin = false): Promise<void> {
  const normalizedEmail = sanitizeEmail(email);
  const lockStatus = await checkAuthLock(normalizedEmail);

  if (lockStatus.is_locked) {
    throw new Error(`Account temporarily locked. Try again in ${Math.max(1, Math.ceil(lockStatus.remaining_seconds / 60))} minute(s).`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

  if (error) {
    await supabase.rpc('security_handle_auth_failure', {
      p_email: normalizedEmail,
      p_reason: 'invalid_credentials',
    });
    throw error;
  }

  await supabase.rpc('security_handle_auth_success', {
    p_email: normalizedEmail,
  });
  await registerCurrentSession(rememberLogin);

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    await supabase.rpc('security_attach_auth_state_user', {
      p_email: normalizedEmail,
      p_user_id: userData.user.id,
    });

    const now = new Date().toISOString();
    await supabase.from('profiles').update({ last_login_at: now }).eq('id', userData.user.id);
    await supabase.from('user_activity_logs').insert({
      user_id: userData.user.id,
      event_type: 'login',
      metadata: { method: 'password' },
    });
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithOAuthProvider('google');
}

export async function signInWithFacebook(): Promise<void> {
  await signInWithOAuthProvider('facebook');
}

export async function signInWithApple(): Promise<void> {
  await signInWithOAuthProvider('apple');
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    throw error;
  }
}

export async function verifyPhoneOtp(phone: string, token: string, rememberLogin = false): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) {
    throw error;
  }

  await registerCurrentSession(rememberLogin);

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.email) {
    await supabase.rpc('security_attach_auth_state_user', {
      p_email: userData.user.email,
      p_user_id: userData.user.id,
    });
    await supabase.rpc('security_handle_auth_success', {
      p_email: userData.user.email,
    });
  }
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  referralCode?: string,
  role: AppRole = 'registered_user',
): Promise<void> {
  const { error } = await supabase.auth.signUp(buildReferralSignupRequest(email, password, fullName, referralCode, role));

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    await supabase.from('user_activity_logs').insert({
      user_id: userData.user.id,
      event_type: 'logout',
      metadata: { method: 'manual' },
    });
  }

  await supabase.rpc('security_revoke_session', {
    p_session_id: getOrCreateSessionId(),
    p_reason: 'logout',
  });

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function listMfaFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw error;
  }

  const factors = [...(data.totp ?? []), ...(data.phone ?? [])];
  return factors.map((factor) => ({
    id: factor.id,
    factorType: factor.factor_type,
    status: factor.status,
    friendlyName: factor.friendly_name ?? null,
    createdAt: factor.created_at,
  }));
}

export async function enrollTotpFactor(friendlyName?: string): Promise<{ factorId: string; qrCode: string }> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: friendlyName ?? 'InvestPro Authenticator',
  });

  if (error) {
    throw error;
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
  };
}

export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    throw challengeError;
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (error) {
    throw error;
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('profiles').update({ two_factor_enabled: true }).eq('id', authData.user.id);
  }
}

export async function challengeMfa(factorId: string): Promise<string> {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) {
    throw error;
  }

  return data.id;
}

export async function verifyMfaChallenge(factorId: string, challengeId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (error) {
    throw error;
  }
}

export async function unenrollMfaFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw error;
  }

  const factors = await listMfaFactors();
  const hasVerifiedFactor = factors.some((factor) => factor.status === 'verified');
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('profiles').update({ two_factor_enabled: hasVerifiedFactor }).eq('id', authData.user.id);
  }
}

export async function listActiveSessions(): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('security_sessions')
    .select('id,session_id,is_trusted,is_revoked,revoked_reason,created_at,last_seen_at,expires_at,device_hash,user_agent_hash')
    .order('last_seen_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const typed = row as SecuritySessionRow;
    return {
      id: typed.id,
      sessionId: typed.session_id,
      isTrusted: typed.is_trusted,
      isRevoked: typed.is_revoked,
      revokedReason: typed.revoked_reason,
      createdAt: typed.created_at,
      lastSeenAt: typed.last_seen_at,
      expiresAt: typed.expires_at,
      deviceHash: typed.device_hash,
      userAgentHash: typed.user_agent_hash,
      isCurrentSession: typed.session_id === getOrCreateSessionId(),
    };
  });
}

export async function revokeSession(sessionId: string, reason = 'manual_revocation'): Promise<void> {
  const { error } = await supabase.rpc('security_revoke_session', {
    p_session_id: sessionId,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'fullName' | 'avatarUrl' | 'twoFactorEnabled'>>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: updates.fullName,
      avatar_url: updates.avatarUrl,
      two_factor_enabled: updates.twoFactorEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at')
    .single<ProfileRow>();

  if (error) throw error;
  return mapProfile(data, data.email);
}

function getPlanLabelForTier(levelTier: number): string {
  if (levelTier >= 3) {
    return 'Premium';
  }

  if (levelTier >= 2) {
    return 'Balanced';
  }

  return 'Starter';
}

export async function updateMemberPlan(userId: string, levelTier: number): Promise<UserProfile> {
  const resolvedTier = Math.max(1, Math.round(levelTier));
  const { data, error } = await supabase
    .from('profiles')
    .update({
      level_tier: resolvedTier,
      level_label: getPlanLabelForTier(resolvedTier),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at')
    .single<ProfileRow>();

  if (error) throw error;

  if (resolvedTier >= 2) {
    await releaseWithdrawalHolds(userId, resolvedTier);
  }

  return mapProfile(data, data.email);
}

export async function listUsers(filters: AdminUserFilters = {}): Promise<UserProfile[]> {
  let query = supabase
    .from('profiles')
    .select('id,email,full_name,avatar_url,role,status,is_active,is_email_verified,two_factor_enabled,referral_code,referred_by_code,wallet_balance,reward_balance,reward_history_count,unread_notifications_count,reputation_score,level_label,level_tier,badges,last_login_at')
    .order('updated_at', { ascending: false });

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.query) {
    query = query.or(
      `full_name.ilike.%${filters.query}%,email.ilike.%${filters.query}%,referral_code.ilike.%${filters.query}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => mapProfile(row as ProfileRow, row.email ?? null));
}

export async function suspendUser(userId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'suspended', suspension_reason: reason ?? null })
    .eq('id', userId);

  if (error) throw error;
}

export async function banUser(userId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'banned', ban_reason: reason ?? null })
    .eq('id', userId);

  if (error) throw error;
}

export async function verifyUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_email_verified: true, verified_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

export async function adjustWalletBalance(
  userId: string,
  amount: number,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('record_wallet_adjustment', {
    p_user_id: userId,
    p_wallet_type: 'main',
    p_amount: amount,
    p_currency: 'USD',
    p_transaction_type: 'admin_adjustment',
    p_reason: reason ?? 'Admin balance adjustment',
    p_performed_by: null,
  });

  if (error) throw error;
}

export async function resetUserPassword(email: string): Promise<void> {
  await requestPasswordReset(email);
}

export async function listActivityLogs(limit = 50): Promise<ActivityLogItem[]> {
  const { data, error } = await supabase
    .from('admin_action_audit')
    .select('id,admin_id,action,resource_type,resource_id,reason,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function listNotifications(userId: string, limit = 8, offset = 0): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,title,message,type,is_read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return;

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .in('id', notificationIds);

  if (error) throw error;
}

export async function listRewardLedger(userId: string): Promise<RewardLedgerItem[]> {
  const { data, error } = await supabase
    .from('reward_ledger')
    .select('id,amount,currency,status,action,reason,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function listWalletActivity(userId: string): Promise<WalletActivity[]> {
  const { data, error } = await supabase
    .from('wallet_audit_logs')
    .select('id,amount,balance_after,note,wallet_type,event_type,currency,status,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after ?? 0),
    entryType: row.event_type,
    note: row.note,
    walletType: row.wallet_type,
    transactionType: row.event_type,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  }));
}
