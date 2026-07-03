const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

for (const key of requiredEnv) {
  if (!import.meta.env[key]) {
    // Keep runtime signal explicit for misconfigured deployments.
    // eslint-disable-next-line no-console
    console.warn(`Missing environment variable: ${key}`);
  }
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
  captchaSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  captchaEnabled: (import.meta.env.VITE_SECURITY_CAPTCHA_ENABLED ?? 'false').toLowerCase() === 'true',
  authSessionIdleTimeoutMinutes: Number(import.meta.env.VITE_AUTH_SESSION_IDLE_TIMEOUT_MINUTES ?? '30'),
  authMaxSessionHours: Number(import.meta.env.VITE_AUTH_MAX_SESSION_HOURS ?? '24'),
};
