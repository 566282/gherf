import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWalletAdjustment, reconcileWalletBalances, releaseWithdrawalHolds, transferWalletBalance } from '@/services/api/wallet';

const notificationState = vi.hoisted(() => ({
  sendUserNotification: vi.fn(),
}));

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

vi.mock('@/services/api/communications', () => ({
  sendUserNotification: notificationState.sendUserNotification,
  notifySuperAdmins: vi.fn(),
}));

describe('wallet money paths', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    notificationState.sendUserNotification.mockReset();
  });

  it('rejects invalid wallet transfer directions before calling Supabase', async () => {
    await expect(transferWalletBalance('user-1', 'main', 'reward', 25)).rejects.toThrow(
      'Transfers are only allowed from bonus, referral, cashback, or reward wallets into the main wallet.',
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('calls the Supabase RPC for a valid wallet transfer', async () => {
    rpcMock.mockResolvedValueOnce({ data: { transfer_id: 'transfer-1' }, error: null });

    await expect(transferWalletBalance('user-1', 'reward', 'main', 25, 'claim into main', 'USD')).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('transfer_wallet_balance', {
      p_user_id: 'user-1',
      p_from_wallet_type: 'reward',
      p_to_wallet_type: 'main',
      p_amount: 25,
      p_currency: 'USD',
      p_note: 'claim into main',
    });
  });

  it('calls the Supabase RPC for an admin wallet adjustment', async () => {
    rpcMock.mockResolvedValueOnce({ data: { transaction_id: 'tx-1' }, error: null });

    await expect(applyWalletAdjustment('user-2', 'bonus', 50, 'promo credit', 'USD')).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('record_wallet_adjustment', {
      p_user_id: 'user-2',
      p_wallet_type: 'bonus',
      p_amount: 50,
      p_currency: 'USD',
      p_transaction_type: 'deposit',
      p_reason: 'promo credit',
      p_performed_by: null,
    });
  });

  it('calls the Supabase RPC for reconciliation', async () => {
    rpcMock.mockResolvedValueOnce({ data: { reconciled_count: 4, adjusted_count: 2, user_id: 'user-3' }, error: null });

    await expect(reconcileWalletBalances('user-3')).resolves.toEqual({ reconciledCount: 4, adjustedCount: 2, userId: 'user-3' });
    expect(rpcMock).toHaveBeenCalledWith('reconcile_wallet_accounts', {
      p_user_id: 'user-3',
    });
  });

  it('releases held withdrawals after a plan upgrade', async () => {
    rpcMock.mockResolvedValueOnce({ data: { released_count: 2 }, error: null });

    await expect(releaseWithdrawalHolds('user-4', 2)).resolves.toBe(2);

    expect(rpcMock).toHaveBeenCalledWith('release_user_withdrawal_holds', {
      p_user_id: 'user-4',
    });
    expect(notificationState.sendUserNotification).toHaveBeenCalledWith(
      'user-4',
      expect.objectContaining({
        title: 'Withdrawal hold released',
      }),
    );
  });
});
