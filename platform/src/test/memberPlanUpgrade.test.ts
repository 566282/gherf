import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMemberPlan } from '@/services/api/auth';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

const walletState = vi.hoisted(() => ({
  releaseWithdrawalHolds: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

vi.mock('@/services/api/wallet', () => ({
  releaseWithdrawalHolds: walletState.releaseWithdrawalHolds,
}));

describe('member plan upgrades', () => {
  beforeEach(() => {
    supabaseState.from.mockImplementation(() => ({
      update: supabaseState.update,
      eq: supabaseState.eq,
      select: supabaseState.select,
      single: supabaseState.single,
    }));

    supabaseState.update.mockReturnValue({
      eq: supabaseState.eq,
    });

    supabaseState.eq.mockReturnValue({
      select: supabaseState.select,
    });

    supabaseState.select.mockReturnValue({
      single: supabaseState.single,
    });

    supabaseState.single.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'ada@example.com',
        full_name: 'Ada Example',
        avatar_url: null,
        role: 'registered_user',
        status: 'active',
        is_active: true,
        is_email_verified: true,
        two_factor_enabled: false,
        referral_code: 'ADA123',
        referred_by_code: null,
        wallet_balance: 200,
        reward_balance: 0,
        reward_history_count: 0,
        unread_notifications_count: 0,
        reputation_score: 100,
        level_label: 'Balanced',
        level_tier: 2,
        badges: [],
        last_login_at: null,
      },
      error: null,
    });

    walletState.releaseWithdrawalHolds.mockReset();
  });

  it('updates the profile tier and releases held withdrawals for upgraded users', async () => {
    walletState.releaseWithdrawalHolds.mockResolvedValueOnce(2);

    await expect(updateMemberPlan('user-1', 2)).resolves.toMatchObject({
      levelTier: 2,
      levelLabel: 'Balanced',
    });

    expect(walletState.releaseWithdrawalHolds).toHaveBeenCalledWith('user-1', 2);
  });

  it('does not try to release holds for starter plan updates', async () => {
    await expect(updateMemberPlan('user-1', 1)).resolves.toMatchObject({
      levelTier: 2,
      levelLabel: 'Balanced',
    });

    expect(walletState.releaseWithdrawalHolds).not.toHaveBeenCalled();
  });
});
