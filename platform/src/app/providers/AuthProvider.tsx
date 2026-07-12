import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { env } from '@/lib/env';
import { clearSecuritySessionState, getDeviceFingerprintInput, getOrCreateSessionId } from '@/lib/security';
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
    setState((prev) => ({ ...prev, isLoading: prev.profile ? prev.isLoading : true }));

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setState({
        isLoading: false,
        isAuthenticated: false,
        profile: null,
      });
      return;
    }

    const profile = await getCurrentProfile();

    if (profile) {
      setState({
        isLoading: false,
        isAuthenticated: true,
        profile,
      });
      return;
    }

    // Avoid dropping a valid signed-in session on transient profile fetch failures.
    setState((prev) => {
      if (prev.profile?.id === session.user.id) {
        return {
          isLoading: false,
          isAuthenticated: true,
          profile: prev.profile,
        };
      }

      return {
        isLoading: false,
        isAuthenticated: false,
        profile: null,
      };
    });
  };

  useEffect(() => {
    void refreshProfile();

    const registerSession = async (isTrusted = false) => {
      const sessionId = getOrCreateSessionId();
      const expiresAt = new Date(Date.now() + Math.max(1, env.authMaxSessionHours) * 60 * 60 * 1000).toISOString();
      await supabase.rpc('security_register_session', {
        p_session_id: sessionId,
        p_expires_at: expiresAt,
        p_device_fingerprint: getDeviceFingerprintInput(),
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        p_is_trusted: isTrusted,
      });
    };

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

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void registerSession(false);
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
