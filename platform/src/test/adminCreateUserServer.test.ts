import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '@/server/adminCreateUser';

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('admin create user handler', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    vi.useRealTimers();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('creates a profile row when the signup trigger has not materialized one yet', async () => {
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: { role: 'super_admin' }, error: null })
        .mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
    };

    const profileUpsertQuery = {
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'new.member@example.com',
          full_name: 'New Member',
          avatar_url: null,
          role: 'registered_user',
          status: 'active',
          is_active: true,
          is_email_verified: true,
          two_factor_enabled: false,
          referral_code: 'NEW-1234',
          referred_by_code: null,
          wallet_balance: 0,
          reward_balance: 0,
          reward_history_count: 0,
          unread_notifications_count: 0,
          reputation_score: 0,
          level_label: 'Balanced',
          level_tier: 2,
          badges: [],
          last_login_at: null,
        },
        error: null,
      }),
    };

    const auditQuery = {
      insert: vi.fn().mockResolvedValue({ error: null }),
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
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-123',
                email: 'new.member@example.com',
              },
            },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({}),
        },
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return profileQuery;
        }

        if (table === 'admin_action_audit') {
          return auditQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    createClientMock.mockReturnValue(adminClient);

    profileQuery.upsert.mockReturnValue(profileUpsertQuery);

    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer access-token' },
      body: JSON.stringify({
        email: 'new.member@example.com',
        password: 'secure-pass-123',
        fullName: 'New Member',
        role: 'registered_user',
        levelTier: 2,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(profileQuery.upsert).toHaveBeenCalled();
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(response.body).toContain('new.member@example.com');
  });
});
