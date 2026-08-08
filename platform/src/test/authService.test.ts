import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, getSessionMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
    },
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { getCurrentProfile, getCurrentProfileForPostLogin } from '@/services/api/auth';

describe('getCurrentProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('retries the auth lookup once the fresh session is available', async () => {
    const authUser = {
      id: 'user-1',
      email: 'admin@example.com',
      user_metadata: { role: 'super_admin' },
      app_metadata: {},
    };

    getUserMock
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: authUser }, error: null });

    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });

    fromMock.mockReturnValue({
      select: selectMock,
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    });
    selectMock.mockReturnValue({ eq: eqMock });
eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    const profile = await getCurrentProfile();

    expect(profile?.role).toBe('super_admin');
    expect(getUserMock).toHaveBeenCalledTimes(2);
  });

  it('retries post-login profile resolution when the first profile read is unavailable', async () => {
    const authUser = {
      id: 'user-1',
      email: 'admin@example.com',
      user_metadata: { role: 'super_admin' },
      app_metadata: {},
    };

    getUserMock.mockResolvedValue({ data: { user: authUser }, error: null });

    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const maybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'temporary profile read failure' },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-1',
          email: 'admin@example.com',
          full_name: 'Admin User',
          avatar_url: null,
          role: 'super_admin',
          status: 'active',
          is_active: true,
          is_email_verified: true,
          two_factor_enabled: false,
          referral_code: null,
          referred_by_code: null,
          wallet_balance: 0,
          reward_balance: 0,
          reward_history_count: 0,
          unread_notifications_count: 0,
          reputation_score: 0,
          level_label: null,
          level_tier: 1,
          badges: [],
          last_login_at: null,
        },
        error: null,
      });

    fromMock.mockReturnValue({
      select: selectMock,
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    });
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    const profile = await getCurrentProfileForPostLogin(2);

    expect(profile?.role).toBe('super_admin');
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to session user role when profile hydration remains unavailable', async () => {
    const authUser = {
      id: 'user-1',
      email: 'admin@example.com',
      user_metadata: { role: 'super_admin' },
      app_metadata: {},
    };

    getUserMock.mockResolvedValue({ data: { user: authUser }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: { user: authUser } }, error: null });

    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'temporary profile read failure' },
    });

    fromMock.mockReturnValue({
      select: selectMock,
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    });
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });

    const profile = await getCurrentProfileForPostLogin(2);

    expect(profile?.role).toBe('super_admin');
    expect(profile?.id).toBe('user-1');
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });
});
