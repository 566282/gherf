import { supabase } from '../services/supabase/client';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export type P2POrderWebhookEvent = {
  httpMethod?: string;
  body: string | null;
};

export async function handler(event: P2POrderWebhookEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON payload.' });
  }

  const orderCode = typeof payload.orderCode === 'string' ? payload.orderCode : '';
  const state = typeof payload.state === 'string' ? payload.state : '';

  if (!orderCode || !state) {
    return json(400, { error: 'orderCode and state are required.' });
  }

  try {
    const { error } = await supabase
      .from('p2p_orders')
      .update({
        current_state: state,
        updated_at: new Date().toISOString(),
        metadata: payload,
      })
      .eq('order_code', orderCode);

    if (error) throw error;

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to process P2P order webhook.' });
  }
}
