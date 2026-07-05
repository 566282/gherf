import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendAdminPaymentNotification } from '@/services/api/communications';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('sendAdminPaymentNotification', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('calls the notify_super_admins rpc and returns the inserted count', async () => {
    rpcMock.mockResolvedValueOnce({ data: 3, error: null });

    const result = await sendAdminPaymentNotification({
      amount: 1250,
      currency: 'USD',
      source: 'deposit',
      title: 'Business deposit posted',
      message: 'A reserve deposit was recorded.',
      metadata: { businessId: 'biz-1' },
    });

    expect(rpcMock).toHaveBeenCalledWith('notify_super_admins', {
      p_title: 'Business deposit posted',
      p_message: 'A reserve deposit was recorded.',
      p_type: 'info',
      p_channel: 'in_app',
      p_category: 'transactional',
      p_template_key: null,
      p_metadata: {
        source: 'deposit',
        amount: 1250,
        currency: 'USD',
        businessId: 'biz-1',
      },
    });
    expect(result).toBe(3);
  });

  it('throws if the rpc fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') });

    await expect(
      sendAdminPaymentNotification({
        amount: 50,
        source: 'payment',
      }),
    ).rejects.toThrow('rpc failed');
  });
});
