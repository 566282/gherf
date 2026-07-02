import type { AppRole, UserProfile } from '@/types/auth';
import { supabase } from '@/services/supabase/client';

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

function mapProfile(row: ProfileRow, email: string | null): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    email,
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role,is_active')
    .eq('id', authData.user.id)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;
  return mapProfile(data, authData.user.email ?? null);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
