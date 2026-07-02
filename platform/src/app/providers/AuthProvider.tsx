import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { getCurrentProfile } from '@/services/api/auth';
import { supabase } from '@/services/supabase/client';
import type { AuthState } from '@/types/auth';

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const defaultState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  profile: null,
};

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AuthState>(defaultState);

  const refreshProfile = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const profile = await getCurrentProfile();
    setState({
      isLoading: false,
      isAuthenticated: Boolean(profile),
      profile,
    });
  };

  useEffect(() => {
    void refreshProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ ...state, refreshProfile }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
