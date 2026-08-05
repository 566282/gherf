import { createClient } from 'npm:@supabase/supabase-js@2';

type DispatchInput = {
  notifications?: Array<{
    userId?: string;
    title?: string;
    message?: string;
    channel?: string;
    category?: string;
    templateKey?: string;
    metadata?: Record<string, unknown>;
  }>;
};

type RoleRow = {
  role: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const pushEndpoint = Deno.env.get('PUSH_DISPATCH_ENDPOINT') ?? '';
const pushApiKey = Deno.env.get('PUSH_DISPATCH_API_KEY') ?? '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Supabase environment variables are not configured.' });
  }

  if (!pushEndpoint) {
    return jsonResponse(500, { error: 'PUSH_DISPATCH_ENDPOINT is not configured.' });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const caller = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const userResult = await caller.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    return jsonResponse(401, { error: 'Unauthorized caller.' });
  }

  const roleResult = await admin
    .from('profiles')
    .select('role')
    .eq('id', userResult.data.user.id)
    .maybeSingle<RoleRow>();

  if (roleResult.error || roleResult.data?.role !== 'super_admin') {
    return jsonResponse(403, { error: 'Only super admins can dispatch push notifications.' });
  }

  let input: DispatchInput;
  try {
    input = await request.json() as DispatchInput;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' });
  }

  const notifications = Array.isArray(input.notifications) ? input.notifications : [];
  if (!notifications.length) {
    return jsonResponse(400, { error: 'No notifications were provided.' });
  }

  const providerResponse = await fetch(pushEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(pushApiKey ? { Authorization: `Bearer ${pushApiKey}` } : {}),
    },
    body: JSON.stringify({ notifications }),
  });

  if (!providerResponse.ok) {
    const body = await providerResponse.text();
    return jsonResponse(providerResponse.status, {
      error: body || 'Push provider rejected request.',
    });
  }

  let providerPayload: unknown = null;
  try {
    providerPayload = await providerResponse.json();
  } catch {
    providerPayload = null;
  }

  return jsonResponse(200, {
    ok: true,
    dispatched: notifications.length,
    provider: providerPayload,
  });
});
