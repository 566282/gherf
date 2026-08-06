import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAuthMiddleware } from '@/app/router/middleware';
import { UserRole } from '@/types';

const { mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

describe('requireAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an authenticated user to enter the app when the profile row has not been hydrated yet', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
        },
      },
      error: null,
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    mockFrom.mockReturnValue({ select });

    const loader = requireAuthMiddleware([UserRole.REGISTERED_USER]);
    const result = await loader({ request: new Request('https://example.com/app') } as never);

    expect(result).toBeNull();
    expect(select).toHaveBeenCalledWith('id,role,status,is_active');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
