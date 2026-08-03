import { createClient } from 'npm:@supabase/supabase-js@2';

type DispatchInput = {
  notifications?: Array<{
    userId?: string;
    title?: string;
    message?: string;
    category?: string;
    templateKey?: string;
    metadata?: Record<string, unknown>;
  }>;
};

type RecipientRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const emailFrom = Deno.env.get('EMAIL_FROM') ?? '';

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

  if (!resendApiKey || !emailFrom) {
    return jsonResponse(500, { error: 'Email provider environment variables are not configured.' });
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
    .maybeSingle<{ role: string }>();

  if (roleResult.error || roleResult.data?.role !== 'super_admin') {
    return jsonResponse(403, { error: 'Only super admins can dispatch email notifications.' });
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

  const userIds = Array.from(new Set(notifications
    .map((item) => item.userId)
    .filter((value): value is string => Boolean(value && value.trim()))));

  if (!userIds.length) {
    return jsonResponse(400, { error: 'No valid recipient user IDs were provided.' });
  }

  const recipientResult = await admin
    .from('profiles')
    .select('id,email,full_name')
    .in('id', userIds);

  if (recipientResult.error) {
    return jsonResponse(500, { error: recipientResult.error.message ?? 'Unable to load recipients.' });
  }

  const recipients = (recipientResult.data ?? []) as RecipientRow[];
  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));

  let sent = 0;
  let skipped = 0;
  const failures: Array<{ userId: string; reason: string }> = [];

  for (const notification of notifications) {
    const userId = notification.userId ?? '';
    const title = (notification.title ?? '').trim();
    const message = (notification.message ?? '').trim();
    const recipient = recipientMap.get(userId);

    if (!recipient?.email) {
      skipped += 1;
      failures.push({ userId, reason: 'Recipient has no email address.' });
      continue;
    }

    if (!title || !message) {
      skipped += 1;
      failures.push({ userId, reason: 'Notification title/body missing.' });
      continue;
    }

    const personalizedText = `Hello ${recipient.full_name ?? 'there'},\n\n${message}\n\nRegards,\nAdmin Team`;
    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipient.email],
        subject: title,
        text: personalizedText,
      }),
    });

    if (!providerResponse.ok) {
      skipped += 1;
      const body = await providerResponse.text();
      failures.push({ userId, reason: body || 'Provider rejected request.' });
      continue;
    }

    sent += 1;
  }

  return jsonResponse(200, {
    ok: true,
    sent,
    skipped,
    failures,
  });
});
