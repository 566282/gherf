import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminUser } from '@/services/api/auth';

const supabaseState = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: supabaseState.getSession,
    },
  },
}));

vi.mock('@/services/api/wallet', () => ({
  releaseWithdrawalHolds: vi.fn(),
}));

describe('admin user creation', () => {
  beforeEach(() => {
    supabaseState.getSession.mockReset();
    supabaseState.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token-1',
        },
      },
      error: null,
    });
  });

  it('posts the admin creation payload to the server-side function with the current access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          id: 'user-1',
          email: 'new.member@example.com',
          fullName: 'New Member',
          avatarUrl: null,
          role: 'registered_user',
          status: 'active',
          isActive: true,
          isEmailVerified: true,
          twoFactorEnabled: false,
          referralCode: 'NEW-1234',
          referredByCode: null,
          walletBalance: 0,
          rewardBalance: 0,
          rewardHistoryCount: 0,
          unreadNotificationsCount: 0,
          reputationScore: 0,
          levelLabel: 'Balanced',
          levelTier: 2,
          badges: [],
          lastLoginAt: null,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createAdminUser({
        email: 'new.member@example.com',
        password: 'secure-pass-123',
        fullName: 'New Member',
        role: 'registered_user',
        levelTier: 2,
      }),
    ).resolves.toMatchObject({
      email: 'new.member@example.com',
      levelTier: 2,
      levelLabel: 'Balanced',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/create-user|\/.netlify\/functions\/create-admin-user/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token-1',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
