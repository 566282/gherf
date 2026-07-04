const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
const missingRequiredEnv = requiredEnv.filter((key) => !import.meta.env[key]);

if (missingRequiredEnv.length > 0) {
  const message = `Missing environment variables: ${missingRequiredEnv.join(', ')}`;

  if (import.meta.env.PROD) {
    throw new Error(message);
  }

  // Keep runtime signal explicit for local misconfigured deployments.
  // eslint-disable-next-line no-console
  console.warn(message);
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'development',
  captchaSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  captchaEnabled: (import.meta.env.VITE_SECURITY_CAPTCHA_ENABLED ?? 'false').toLowerCase() === 'true',
  errorReportingEndpoint: import.meta.env.VITE_ERROR_REPORTING_ENDPOINT ?? '',
  authSessionIdleTimeoutMinutes: Number(import.meta.env.VITE_AUTH_SESSION_IDLE_TIMEOUT_MINUTES ?? '30'),
  authMaxSessionHours: Number(import.meta.env.VITE_AUTH_MAX_SESSION_HOURS ?? '24'),
};
