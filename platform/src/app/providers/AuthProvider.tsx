import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { env } from '@/lib/env';
import { resolveAccountRole } from '@/lib/authRole';
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

const PROFILE_REFRESH_RETRY_DELAY_MS = 500;
const PROFILE_REFRESH_MAX_ATTEMPTS = 12;
const PROFILE_REFRESH_BACKGROUND_RETRY_DELAY_MS = 5000;
const SESSION_RECOVERY_RETRY_DELAY_MS = 1000;
const SESSION_RECOVERY_MAX_ATTEMPTS = 5;

function buildFallbackProfile(sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) {
  return {
    id: sessionUser.id,
    email: sessionUser.email ?? null,
    fullName: (sessionUser.user_metadata?.full_name as string | undefined) ?? null,
    avatarUrl: null,
    role: resolveAccountRole(undefined, sessionUser),
    status: 'active' as const,
    isActive: true,
    isEmailVerified: true,
    twoFactorEnabled: false,
    referralCode: `PENDING-${sessionUser.id.slice(0, 8).toUpperCase()}`,
    referredByCode: null,
    walletBalance: 0,
    rewardBalance: 0,
    rewardHistoryCount: 0,
    unreadNotificationsCount: 0,
    reputationScore: 0,
    levelLabel: 'Starter',
    levelTier: 1,
    badges: [],
    lastLoginAt: null,
  };
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AuthState>(defaultState);
  const authStateRef = useRef<AuthState>(defaultState);
  const profileRefreshTimeoutRef = useRef<number | undefined>(undefined);
  const profileRefreshAttemptsRef = useRef(0);
  const sessionRecoveryAttemptsRef = useRef(0);

  useEffect(() => {
    authStateRef.current = state;
  }, [state]);

  const clearProfileRefreshRetry = () => {
    if (profileRefreshTimeoutRef.current !== undefined) {
      window.clearTimeout(profileRefreshTimeoutRef.current);
      profileRefreshTimeoutRef.current = undefined;
    }
  };

  const resetProfileRefreshRetry = () => {
    profileRefreshAttemptsRef.current = 0;
    sessionRecoveryAttemptsRef.current = 0;
    clearProfileRefreshRetry();
  };

  const clearAuthState = () => {
    setState({
      isLoading: false,
      isAuthenticated: false,
      profile: null,
    });
  };

  const refreshProfile = async () => {
    clearProfileRefreshRetry();
    setState((prev) => ({ ...prev, isLoading: !prev.isAuthenticated }));

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      sessionRecoveryAttemptsRef.current += 1;

      if (authStateRef.current.isAuthenticated && sessionRecoveryAttemptsRef.current < SESSION_RECOVERY_MAX_ATTEMPTS) {
        setState((prev) => ({ ...prev, isLoading: false }));
        profileRefreshTimeoutRef.current = window.setTimeout(() => {
          void refreshProfile();
        }, SESSION_RECOVERY_RETRY_DELAY_MS);
        return;
      }

      resetProfileRefreshRetry();
      clearAuthState();
      return;
    }

    if (!session?.user) {
      sessionRecoveryAttemptsRef.current += 1;

      if (authStateRef.current.isAuthenticated && sessionRecoveryAttemptsRef.current < SESSION_RECOVERY_MAX_ATTEMPTS) {
        setState((prev) => ({ ...prev, isLoading: false }));
        profileRefreshTimeoutRef.current = window.setTimeout(() => {
          void refreshProfile();
        }, SESSION_RECOVERY_RETRY_DELAY_MS);
        return;
      }

      resetProfileRefreshRetry();
      clearAuthState();
      return;
    }

    sessionRecoveryAttemptsRef.current = 0;

    const profile = await getCurrentProfile();

    if (profile) {
      resetProfileRefreshRetry();
      setState({
        isLoading: false,
        isAuthenticated: true,
        profile,
      });
      return;
    }

    const { error: userError } = await supabase.auth.getUser();
    if (userError?.message?.includes('User from sub claim in JWT does not exist')) {
      await supabase.auth.signOut();
      clearSecuritySessionState();
      resetProfileRefreshRetry();
      clearAuthState();
      return;
    }

    profileRefreshAttemptsRef.current += 1;

    if (profileRefreshAttemptsRef.current >= PROFILE_REFRESH_MAX_ATTEMPTS) {
      // Avoid dropping a valid auth session if profile hydration is temporarily delayed.
      setState((prev) => ({
        isLoading: false,
        isAuthenticated: true,
        profile: prev.profile ?? buildFallbackProfile(session.user),
      }));

      profileRefreshTimeoutRef.current = window.setTimeout(() => {
        void refreshProfile();
      }, PROFILE_REFRESH_BACKGROUND_RETRY_DELAY_MS);
      return;
    }

    setState((prev) => ({
      isLoading: true,
      isAuthenticated: true,
      profile: prev.profile ?? buildFallbackProfile(session.user),
    }));

    profileRefreshTimeoutRef.current = window.setTimeout(() => {
      void refreshProfile();
    }, PROFILE_REFRESH_RETRY_DELAY_MS);
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
      clearProfileRefreshRetry();
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
