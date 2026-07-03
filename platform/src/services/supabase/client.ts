import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getDeviceFingerprintInput, getOrCreateCsrfToken, getOrCreateSessionId } from '@/lib/security';

const secureFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers ?? undefined);
  headers.set('X-CSRF-Token', getOrCreateCsrfToken());
  headers.set('X-Client-Session', getOrCreateSessionId());
  headers.set('X-Client-Device', getDeviceFingerprintInput());

  return fetch(input, {
    ...init,
    headers,
  });
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  global: {
    fetch: secureFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'investpro.auth.token',
  },
});
