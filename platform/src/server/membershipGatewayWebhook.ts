import { ingestMembershipGatewayWebhook } from '../services/api/membershipGateway';

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

export type MembershipGatewayWebhookEvent = {
  httpMethod?: string;
  body: string | null;
  headers: Record<string, string | undefined>;
};

export async function handler(event: MembershipGatewayWebhookEvent) {
  if ((event.httpMethod ?? 'POST') !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON payload.' });
  }

  const providerKey = typeof payload.providerKey === 'string' ? payload.providerKey.trim() : '';
  const eventType = typeof payload.eventType === 'string' ? payload.eventType.trim() : '';
  const paymentReference = typeof payload.paymentReference === 'string' ? payload.paymentReference.trim() : '';
  const webhookPayload = (payload.payload as Record<string, unknown>) ?? payload;

  if (!providerKey || !eventType || !paymentReference) {
    return json(400, { error: 'providerKey, eventType, and paymentReference are required.' });
  }

  try {
    await ingestMembershipGatewayWebhook({
      providerKey,
      eventType,
      paymentReference,
      payload: webhookPayload,
    });

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unable to process webhook.' });
  }
}
