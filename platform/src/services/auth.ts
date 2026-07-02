import { supabase } from './supabase';
import { UserProfile, UserRole } from '@/types';

/**
 * Fetch user profile from the profiles table.
 * Includes role and status information.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, status, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    role: data.role as UserRole,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create or update user profile after signup.
 * Called by a Supabase trigger automatically on auth.users insert.
 * This function is for explicit profile updates.
 */
export async function upsertUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: updates.fullName,
      avatar_url: updates.avatarUrl,
      role: updates.role || UserRole.REGISTERED_USER,
      status: updates.status || 'active',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    role: data.role as UserRole,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * List all users (admin only, enforced by RLS).
 */
export async function listUsers(
  filters?: Partial<{
    role: UserRole;
    status: string;
    search: string;
  }>,
) {
  let query = supabase.from('profiles').select('*');

  if (filters?.role) {
    query = query.eq('role', filters.role);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('full_name', `%${filters.search}%`).or(`ilike(email, '%${filters.search}%')`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    role: user.role as UserRole,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  })) as UserProfile[];
}

/**
 * Update user role (admin only, enforced by RLS).
 */
export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Suspend or restore user (admin only, enforced by RLS).
 */
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'pending_approval',
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}
