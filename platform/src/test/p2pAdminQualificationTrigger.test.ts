import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMerchantWalletOperation } from '@/services/api/p2pAdmin';

const supabaseState = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

const complianceState = vi.hoisted(() => ({
  evaluateMerchantQualification: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: supabaseState.rpc,
  },
}));

vi.mock('@/services/api/p2pCompliance', () => ({
  evaluateMerchantQualification: complianceState.evaluateMerchantQualification,
}));

describe('p2p admin wallet qualification trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    complianceState.evaluateMerchantQualification.mockResolvedValue({ ok: true });
  });

  it('re-evaluates merchant qualification after wallet operation', async () => {
    await applyMerchantWalletOperation({
      merchantId: 'merchant-1',
      entryType: 'top_up',
      amount: 100,
      currency: 'usd',
      note: 'Liquidity top up',
    });

    expect(supabaseState.rpc).toHaveBeenCalledWith('merchant_wallet_apply_entry', expect.any(Object));
    expect(complianceState.evaluateMerchantQualification).toHaveBeenCalledWith('merchant-1');
  });
});
