import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [liquidity, analytics, withdrawalTimeouts] = await Promise.all([
    admin.rpc('run_p2p_liquidity_health_job'),
    admin.rpc('run_p2p_merchant_analytics_job'),
    admin.rpc('process_withdrawal_assignment_timeouts', { p_limit: 200 }),
  ]);

  if (liquidity.error || analytics.error || withdrawalTimeouts.error) {
    return new Response(
      JSON.stringify({
        error: liquidity.error?.message ?? analytics.error?.message ?? withdrawalTimeouts.error?.message ?? 'Unable to run P2P escrow jobs.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      liquidity: liquidity.data,
      analytics: analytics.data,
      withdrawalTimeouts: withdrawalTimeouts.data,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
