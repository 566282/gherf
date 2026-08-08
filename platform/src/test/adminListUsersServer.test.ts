import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '@/server/adminListUsers';

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('admin list users handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns managed users for a super admin caller', async () => {
    const callerProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
    };

    const usersQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'user-1',
            email: 'member@example.com',
            full_name: 'Member One',
            avatar_url: null,
            role: 'registered_user',
            status: 'active',
            is_active: true,
            is_email_verified: true,
            two_factor_enabled: false,
            referral_code: 'MEM-1001',
            referred_by_code: null,
            wallet_balance: 10,
            reward_balance: 1,
            reward_history_count: 2,
            unread_notifications_count: 0,
            reputation_score: 100,
            level_label: 'Starter',
            level_tier: 1,
            badges: [],
            last_login_at: null,
          },
        ],
        error: null,
      }),
    };

    const adminClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-1',
              email: 'admin@example.com',
              user_metadata: {},
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: vi
        .fn()
        .mockReturnValueOnce(callerProfileQuery)
        .mockReturnValueOnce(usersQuery),
    };

    createClientMock.mockReturnValue(adminClient);

    const response = await handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer access-token' },
      queryStringParameters: {
        role: 'registered_user',
        query: 'member',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(usersQuery.eq).toHaveBeenCalledWith('role', 'registered_user');
    expect(usersQuery.or).toHaveBeenCalled();
    expect(response.body).toContain('member@example.com');
  });

  it('rejects non-super-admin callers', async () => {
    const callerProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'registered_user' }, error: null }),
    };

    const adminClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              user_metadata: {},
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(callerProfileQuery),
    };

    createClientMock.mockReturnValue(adminClient);

    const response = await handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer access-token' },
      queryStringParameters: null,
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Only super admins can list managed users.');
  });
});
