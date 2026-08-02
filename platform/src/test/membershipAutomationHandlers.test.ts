import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler as automationHandler } from '@/server/membershipAutomationRunner';
import { handler as gatewayWebhookHandler } from '@/server/membershipGatewayWebhook';

const membershipAdminState = vi.hoisted(() => ({
  runMembershipAutomationJobs: vi.fn(),
}));

const membershipGatewayState = vi.hoisted(() => ({
  ingestMembershipGatewayWebhook: vi.fn(),
}));

vi.mock('@/services/api/membershipAdmin', () => ({
  runMembershipAutomationJobs: membershipAdminState.runMembershipAutomationJobs,
}));

vi.mock('@/services/api/membershipGateway', () => ({
  ingestMembershipGatewayWebhook: membershipGatewayState.ingestMembershipGatewayWebhook,
}));

describe('membership automation handlers', () => {
  beforeEach(() => {
    membershipAdminState.runMembershipAutomationJobs.mockReset();
    membershipGatewayState.ingestMembershipGatewayWebhook.mockReset();
  });

  it('runs membership automation jobs for POST requests', async () => {
    membershipAdminState.runMembershipAutomationJobs.mockResolvedValue(undefined);

    const response = await automationHandler({ httpMethod: 'POST' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(membershipAdminState.runMembershipAutomationJobs).toHaveBeenCalledTimes(1);
  });

  it('rejects non-POST automation requests', async () => {
    const response = await automationHandler({ httpMethod: 'GET' });

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({ error: 'Method not allowed.' });
  });

  it('ingests valid membership gateway webhooks', async () => {
    membershipGatewayState.ingestMembershipGatewayWebhook.mockResolvedValue(undefined);

    const response = await gatewayWebhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        providerKey: 'paystack',
        eventType: 'charge.success',
        paymentReference: 'mult-user1-123',
        payload: { status: 'success', amount: 5000 },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(membershipGatewayState.ingestMembershipGatewayWebhook).toHaveBeenCalledWith({
      providerKey: 'paystack',
      eventType: 'charge.success',
      paymentReference: 'mult-user1-123',
      payload: { status: 'success', amount: 5000 },
    });
  });

  it('rejects malformed membership gateway webhook payloads', async () => {
    const response = await gatewayWebhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: '{invalid json',
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Invalid JSON payload.' });
  });

  it('returns a 500 when the gateway ingestion flow fails', async () => {
    membershipGatewayState.ingestMembershipGatewayWebhook.mockRejectedValue(new Error('provider failure'));

    const response = await gatewayWebhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        providerKey: 'stripe',
        eventType: 'payment_intent.succeeded',
        paymentReference: 'pi_123',
      }),
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'provider failure' });
  });
});
