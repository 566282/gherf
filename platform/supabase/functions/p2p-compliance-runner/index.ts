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

  const compliance = await admin.rpc('run_p2p_compliance_job');

  if (compliance.error) {
    return new Response(
      JSON.stringify({
        error: compliance.error.message ?? 'Unable to run P2P compliance job.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, compliance: compliance.data }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
