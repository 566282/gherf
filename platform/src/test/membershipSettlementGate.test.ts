import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMemberPlan } from '@/services/api/auth';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));

const upgradeRequestState = vi.hoisted(() => ({
  createMembershipUpgradeRequest: vi.fn(),
}));

const walletState = vi.hoisted(() => ({
  releaseWithdrawalHolds: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

vi.mock('@/services/api/membershipUpgradeRequests', () => ({
  createMembershipUpgradeRequest: upgradeRequestState.createMembershipUpgradeRequest,
}));

vi.mock('@/services/api/wallet', () => ({
  releaseWithdrawalHolds: walletState.releaseWithdrawalHolds,
}));

describe('membership settlement gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabaseState.from.mockReturnValue({
      select: supabaseState.select,
    });

    supabaseState.select.mockReturnValue({
      eq: supabaseState.eq,
    });

    supabaseState.eq.mockReturnValue({
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
        level_label: 'Starter',
        level_tier: 1,
        badges: [],
        last_login_at: null,
      },
      error: null,
    });
  });

  it('creates pending request and keeps current tier until settlement confirmation', async () => {
    upgradeRequestState.createMembershipUpgradeRequest.mockResolvedValue({ id: 'req-1' });

    const profile = await updateMemberPlan('user-1', 2, 1000, 'NGN');

    expect(upgradeRequestState.createMembershipUpgradeRequest).toHaveBeenCalledWith({
      userId: 'user-1',
      targetTier: 2,
      paymentAmount: 1000,
      paymentCurrency: 'NGN',
    });
    expect(profile.levelTier).toBe(1);
    expect(walletState.releaseWithdrawalHolds).not.toHaveBeenCalled();
  });
});
