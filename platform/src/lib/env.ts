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
};
