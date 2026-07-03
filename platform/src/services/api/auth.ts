import { generateReferralCode, getUserLevel } from '@/lib/auth';
import type {
  ActivityLogItem,
  AdminUserFilters,
  AppRole,
  NotificationItem,
  RewardLedgerItem,
  UserProfile,
  WalletActivity,
} from '@/types/auth';
import { supabase } from '@/services/supabase/client';

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

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/app`,
    },
  });

  if (error) throw error;
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  referralCode?: string,
  role: AppRole = 'registered_user',
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name: fullName,
        referral_code: generateReferralCode(fullName, email),
        referred_by_code: referralCode || null,
        role,
      },
    },
  });

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

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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
  const { data: currentProfile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single<{ wallet_balance: number | null }>();

  if (profileError) throw profileError;

  const nextBalance = (currentProfile.wallet_balance ?? 0) + amount;
  const { error } = await supabase.from('profiles').update({ wallet_balance: nextBalance }).eq('id', userId);

  if (error) throw error;

  await supabase.from('wallet_transactions').insert({
    user_id: userId,
    transaction_type: 'admin_adjustment',
    amount,
    balance_after: nextBalance,
    currency: 'USD',
    status: 'available',
    note: reason ?? 'Admin balance adjustment',
    metadata: { source: 'admin_adjustment' },
  });

  await supabase.from('wallet_ledger').insert({
    user_id: userId,
    amount,
    balance_after: nextBalance,
    reason: reason ?? 'Admin balance adjustment',
  });
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

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,title,message,type,channel,category,template_key,is_promotional,metadata,is_read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    channel: row.channel,
    category: row.category,
    templateKey: row.template_key,
    isPromotional: row.is_promotional,
    metadata: row.metadata,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
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
    .from('wallet_ledger')
    .select('id,amount,balance_after,note,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    note: row.note,
    createdAt: row.created_at,
  }));
}
