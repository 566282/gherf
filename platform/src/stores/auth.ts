import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import { getUserProfile } from '@/services/auth';
import { UserProfile, AuthState } from '@/types';

interface AuthStore extends AuthState {
  initialize: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        set({ user: profile, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize auth';
      set({ error: message, loading: false });
    }
  },

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearAuth: () => set({ user: null, loading: false, error: null }),
}));

/**
 * Subscribe to real-time auth state changes.
 * Called once in the app root to keep state in sync.
 */
export function subscribeToAuthChanges() {
  const { setUser, clearAuth } = useAuthStore.getState();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const profile = await getUserProfile(session.user.id);
      setUser(profile);
    } else if (event === 'SIGNED_OUT') {
      clearAuth();
    }
  });

  return subscription;
}
