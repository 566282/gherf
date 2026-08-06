const nodeProcess = typeof process !== 'undefined' ? process : undefined;
const viteEnv = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
  ? (import.meta.env as Record<string, string | boolean | undefined>)
  : undefined;
const runtimeEnv = (viteEnv ?? nodeProcess?.env ?? {}) as Record<string, string | boolean | undefined>;

const getRuntimeValue = (key: string, fallback = ''): string => {
  const value = runtimeEnv[key];
  return typeof value === 'string' ? value : fallback;
};

const getRuntimeBoolean = (key: string, fallback = false): boolean => {
  const value = runtimeEnv[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

const getRuntimeNumber = (key: string, fallback: number): number => {
  const value = runtimeEnv[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const isProduction = getRuntimeBoolean('PROD', false) || nodeProcess?.env?.NODE_ENV === 'production';
const isDevelopment = !isProduction;

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
const missingRequiredEnv = requiredEnv.filter((key) => !getRuntimeValue(key));
const hasSupabaseEnv = missingRequiredEnv.length === 0;

if (missingRequiredEnv.length > 0) {
  const message = `Missing environment variables: ${missingRequiredEnv.join(', ')}`;

  if (isProduction) {
    throw new Error(message);
  }

  // Keep runtime signal explicit for local misconfigured deployments.
  // eslint-disable-next-line no-console
  console.warn(message);
}

export const env = {
  supabaseUrl: getRuntimeValue('VITE_SUPABASE_URL', getRuntimeValue('SUPABASE_URL', isDevelopment ? 'https://example.supabase.co' : '')),
  supabaseAnonKey: getRuntimeValue('VITE_SUPABASE_ANON_KEY', getRuntimeValue('SUPABASE_ANON_KEY', isDevelopment ? 'public-anon-key' : '')),
  publicAppUrl: getRuntimeValue('VITE_APP_PUBLIC_URL', getRuntimeValue('APP_PUBLIC_URL', '')),
  appEnv: getRuntimeValue('VITE_APP_ENV', getRuntimeValue('APP_ENV', 'development')),
  captchaSiteKey: getRuntimeValue('VITE_TURNSTILE_SITE_KEY', ''),
  captchaEnabled: getRuntimeBoolean('VITE_SECURITY_CAPTCHA_ENABLED', false),
  errorReportingEndpoint: getRuntimeValue('VITE_ERROR_REPORTING_ENDPOINT', ''),
  authSessionIdleTimeoutMinutes: getRuntimeNumber('VITE_AUTH_SESSION_IDLE_TIMEOUT_MINUTES', 30),
  authMaxSessionHours: getRuntimeNumber('VITE_AUTH_MAX_SESSION_HOURS', 24),
  authBootstrapSuperAdminUserId: getRuntimeValue('VITE_AUTH_BOOTSTRAP_SUPER_ADMIN_USER_ID', getRuntimeValue('AUTH_BOOTSTRAP_SUPER_ADMIN_USER_ID', '')),
  authBootstrapSuperAdminEmail: getRuntimeValue('VITE_AUTH_BOOTSTRAP_SUPER_ADMIN_EMAIL', getRuntimeValue('AUTH_BOOTSTRAP_SUPER_ADMIN_EMAIL', 'walterdozie7@gmail.com')),
  authCampaignManagerEmails: getRuntimeValue('VITE_AUTH_CAMPAIGN_MANAGER_EMAILS', getRuntimeValue('AUTH_CAMPAIGN_MANAGER_EMAILS', '')),
  authModeratorEmails: getRuntimeValue('VITE_AUTH_MODERATOR_EMAILS', getRuntimeValue('AUTH_MODERATOR_EMAILS', '')),
  authAdvertiserEmails: getRuntimeValue('VITE_AUTH_ADVERTISER_EMAILS', getRuntimeValue('AUTH_ADVERTISER_EMAILS', '')),
  hasSupabaseEnv,
};
