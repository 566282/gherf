import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { env } from '@/lib/env';
import { clearSecuritySessionState } from '@/lib/security';
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

    const idleTimeoutMs = Math.max(5, env.authSessionIdleTimeoutMinutes) * 60 * 1000;
    let timeoutHandle: number | undefined;

    const clearIdleTimeout = () => {
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    };

    const scheduleIdleTimeout = () => {
      clearIdleTimeout();
      timeoutHandle = window.setTimeout(() => {
        void supabase.auth.signOut();
        clearSecuritySessionState();
      }, idleTimeoutMs);
    };

    const onActivity = () => {
      scheduleIdleTimeout();
    };

    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('visibilitychange', onActivity);
    scheduleIdleTimeout();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSecuritySessionState();
      }

      onActivity();
      void refreshProfile();
    });

    return () => {
      clearIdleTimeout();
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('visibilitychange', onActivity);
      subscription.unsubscribe();
    };
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
