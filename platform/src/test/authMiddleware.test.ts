import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guestOnlyMiddleware, requireAuthMiddleware } from '@/app/router/middleware';
import { UserRole } from '@/types';

const { mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}));

const onboardingGateState = vi.hoisted(() => ({
  resolveOnboardingGate: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

vi.mock('@/services/api/onboardingGate', () => ({
  resolveOnboardingGate: onboardingGateState.resolveOnboardingGate,
}));

describe('requireAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingGateState.resolveOnboardingGate.mockResolvedValue({
      blocked: false,
      reason: null,
      allowedModuleKeys: ['*'],
    });
  });

  it('redirects a signed-in super-admin user to /admin from guest pages even when profile role is stale', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            user_metadata: { role: 'super_admin' },
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'registered_user' }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    mockFrom.mockReturnValue({ select });

    const loader = guestOnlyMiddleware();
    const result = await loader();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe('/admin');
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

  it('allows advertiser dashboard access when auth metadata resolves advertiser role', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-2',
            email: 'advertiser@example.com',
            user_metadata: { role: 'advertiser' },
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'user-2',
        role: 'registered_user',
        status: 'active',
        is_active: true,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    mockFrom.mockReturnValue({ select });

    const loader = requireAuthMiddleware([UserRole.ADVERTISER, UserRole.CAMPAIGN_MANAGER]);
    const result = await loader({ request: new Request('https://example.com/business') } as never);

    expect(result).toBeNull();
  });

  it('redirects blocked users to onboarding for gated app modules', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-3',
            email: 'user3@example.com',
            user_metadata: { role: 'registered_user' },
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'user-3',
        role: 'registered_user',
        status: 'active',
        is_active: true,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    onboardingGateState.resolveOnboardingGate.mockResolvedValue({
      blocked: true,
      reason: 'Complete onboarding first.',
      allowedModuleKeys: ['onboarding', 'profile'],
    });

    const loader = requireAuthMiddleware([UserRole.REGISTERED_USER]);
    const result = await loader({ request: new Request('https://example.com/app/tasks') } as never);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toContain('/app/onboarding?blocked=1');
  });
});
