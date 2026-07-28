import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWithdrawalRequest } from '@/services/api/wallet';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  delete: vi.fn(),
}));

const notificationState = vi.hoisted(() => ({
  notifySuperAdmins: vi.fn(),
  sendUserNotification: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
    rpc: supabaseState.rpc,
  },
}));

vi.mock('@/services/api/communications', () => ({
  notifySuperAdmins: notificationState.notifySuperAdmins,
  sendUserNotification: notificationState.sendUserNotification,
}));

describe('withdrawal notifications', () => {
  beforeEach(() => {
    supabaseState.from.mockReset();
    supabaseState.rpc.mockReset();
    supabaseState.update.mockReset();
    supabaseState.insert.mockReset();
    supabaseState.select.mockReset();
    supabaseState.in.mockReset();
    supabaseState.eq.mockReset();
    supabaseState.single.mockReset();
    supabaseState.delete.mockReset();
    notificationState.notifySuperAdmins.mockReset();
    notificationState.sendUserNotification.mockReset();

    const profileQuery = {
      select: supabaseState.select,
      eq: supabaseState.eq,
      single: supabaseState.single,
      update: supabaseState.update,
    };

    const walletTransactionQuery = {
      insert: supabaseState.insert,
      select: supabaseState.select,
      single: supabaseState.single,
      delete: supabaseState.delete,
      eq: supabaseState.eq,
    };

    const withdrawalQuery = {
      insert: supabaseState.insert,
      select: supabaseState.select,
      single: supabaseState.single,
      eq: supabaseState.eq,
      update: supabaseState.update,
    };

    const settingsQuery = {
      select: supabaseState.select,
      in: supabaseState.in,
    };

    supabaseState.from.mockImplementation((table: string) => {
      if (table === 'platform_settings') return settingsQuery;
      if (table === 'profiles') return profileQuery;
      if (table === 'wallet_transactions') return walletTransactionQuery;
      if (table === 'withdrawal_requests') return withdrawalQuery;
      return profileQuery;
    });

    supabaseState.select.mockReturnValue({
      eq: supabaseState.eq,
      single: supabaseState.single,
      in: supabaseState.in,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    supabaseState.in.mockResolvedValue({ data: [], error: null });

    supabaseState.eq.mockReturnValue({
      single: supabaseState.single,
      update: supabaseState.update,
      delete: supabaseState.delete,
      select: supabaseState.select,
      in: supabaseState.in,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: supabaseState.eq,
    });

    supabaseState.update.mockReturnValue({ eq: supabaseState.eq });
    supabaseState.insert.mockReturnValue({ select: supabaseState.select, single: supabaseState.single });
    supabaseState.delete.mockReturnValue({ eq: supabaseState.eq });
    supabaseState.rpc.mockResolvedValue({ data: 1, error: null });
    notificationState.notifySuperAdmins.mockResolvedValue(1);
    notificationState.sendUserNotification.mockResolvedValue(undefined);
  });

  it('rejects free members before creating a withdrawal request', async () => {
    supabaseState.single.mockResolvedValueOnce({
      data: { wallet_balance: 500, full_name: 'Ada Example', email: 'ada@example.com', level_tier: 1, level_label: 'Starter' },
      error: null,
    });

    await expect(
      createWithdrawalRequest('user-1', {
        amount: 125,
        method: 'bank_transfer',
        destinationLabel: 'Primary payout account',
        destinationValue: '9876543210',
        destinationCurrency: 'USD',
        scheduledFor: '2026-07-30',
        note: 'Monthly payout',
      }),
    ).rejects.toThrow('Free members cannot withdraw funds');

    expect(notificationState.notifySuperAdmins).not.toHaveBeenCalled();
    expect(notificationState.sendUserNotification).not.toHaveBeenCalled();
  });

  it('notifies admins and users with the withdrawal limit and date for paid members', async () => {
    supabaseState.single
      .mockResolvedValueOnce({ data: { wallet_balance: 500, full_name: 'Ada Example', email: 'ada@example.com', level_tier: 2, level_label: 'Balanced' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'tx-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'withdrawal-1',
          user_id: 'user-1',
          wallet_transaction_id: 'tx-1',
          method: 'bank_transfer',
          destination_label: 'Primary payout account',
          destination_value: '9876543210',
          destination_currency: 'USD',
          currency: 'USD',
          amount: 125,
          processing_fee: 1.88,
          exchange_rate: 1,
          net_amount: 123.12,
          approval_workflow: 'manual',
          status: 'pending',
          scheduled_for: '2026-07-30T00:00:00.000Z',
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-07-05T12:00:00.000Z',
          updated_at: '2026-07-05T12:00:00.000Z',
        },
        error: null,
      });

    const result = await createWithdrawalRequest('user-1', {
      amount: 125,
      method: 'bank_transfer',
      destinationLabel: 'Primary payout account',
      destinationValue: '9876543210',
      destinationCurrency: 'USD',
      scheduledFor: '2026-07-30',
      note: 'Monthly payout',
    });

    expect(result.id).toBe('withdrawal-1');
    expect(notificationState.notifySuperAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Withdrawal request submitted',
        message: expect.stringContaining('Ada Example submitted a withdrawal request for USD 125.00 on Jul 30, 2026.'),
        metadata: expect.objectContaining({
          userId: 'user-1',
          amount: 125,
          effectiveWithdrawalLimit: 500,
          scheduledFor: '2026-07-30T00:00:00.000Z',
        }),
      }),
    );

    expect(notificationState.sendUserNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Withdrawal pending',
        message: expect.stringContaining('Withdrawals are not allowed until Jul 30, 2026.'),
      }),
    );
  });

  it('holds withdrawals for paid users after four successful withdrawals', async () => {
    supabaseState.in.mockResolvedValueOnce({ data: [], error: null });
    supabaseState.in.mockResolvedValueOnce({ data: [{}, {}, {}, {}], error: null });
    supabaseState.single
      .mockResolvedValueOnce({ data: { wallet_balance: 500, full_name: 'Ada Example', email: 'ada@example.com', level_tier: 2, level_label: 'Balanced' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'tx-3' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'withdrawal-3',
          user_id: 'user-1',
          wallet_transaction_id: 'tx-3',
          method: 'bank_transfer',
          destination_label: 'Primary payout account',
          destination_value: '9876543210',
          destination_currency: 'USD',
          currency: 'USD',
          amount: 75,
          processing_fee: 1.13,
          exchange_rate: 1,
          net_amount: 73.87,
          approval_workflow: 'manual',
          status: 'held',
          scheduled_for: null,
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-07-05T12:00:00.000Z',
          updated_at: '2026-07-05T12:00:00.000Z',
        },
        error: null,
      });

    const result = await createWithdrawalRequest('user-1', {
      amount: 75,
      method: 'bank_transfer',
      destinationLabel: 'Primary payout account',
      destinationValue: '9876543210',
      destinationCurrency: 'USD',
      note: 'Plan-gated payout',
    });

    expect(result.status).toBe('held');
    expect(notificationState.notifySuperAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Withdrawal placed on hold',
        metadata: expect.objectContaining({
          successfulWithdrawalCount: 4,
          holdThreshold: 4,
          memberPlanTier: 2,
        }),
      }),
    );

    expect(notificationState.sendUserNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Withdrawal on hold',
        message: expect.stringContaining('This request is on hold until you upgrade your plan.'),
      }),
    );
  });

  it('keeps admin alerts immediate while the withdrawal stays restricted until the fixed date', async () => {
    supabaseState.single
      .mockResolvedValueOnce({ data: { wallet_balance: 500, full_name: 'Ada Example', email: 'ada@example.com', level_tier: 2, level_label: 'Balanced' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'tx-2' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'withdrawal-2',
          user_id: 'user-1',
          wallet_transaction_id: 'tx-2',
          method: 'bank_transfer',
          destination_label: 'Primary payout account',
          destination_value: '9876543210',
          destination_currency: 'USD',
          currency: 'USD',
          amount: 50,
          processing_fee: 0.75,
          exchange_rate: 1,
          net_amount: 49.25,
          approval_workflow: 'manual',
          status: 'pending',
          scheduled_for: '2026-07-31T00:00:00.000Z',
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-07-05T12:00:00.000Z',
          updated_at: '2026-07-05T12:00:00.000Z',
        },
        error: null,
      });

    await createWithdrawalRequest('user-1', {
      amount: 50,
      method: 'bank_transfer',
      destinationLabel: 'Primary payout account',
      destinationValue: '9876543210',
      destinationCurrency: 'USD',
      scheduledFor: '2026-07-31',
      note: 'Future payout',
    });

    expect(notificationState.notifySuperAdmins).toHaveBeenCalledTimes(1);
    expect(notificationState.sendUserNotification).toHaveBeenCalledTimes(1);
    expect(notificationState.sendUserNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Withdrawal pending',
        message: expect.stringContaining('Withdrawals are not allowed until Jul 31, 2026.'),
      }),
    );
  });
});
