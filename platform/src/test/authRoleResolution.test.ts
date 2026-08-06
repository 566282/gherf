import { describe, expect, it } from 'vitest';
import { resolveAccountRole } from '@/lib/authRole';

describe('resolveAccountRole', () => {
  it('prefers an admin role from auth metadata over a stale profile role', () => {
    const role = resolveAccountRole('registered_user', {
      user_metadata: { role: 'super_admin' },
      app_metadata: {},
    });

    expect(role).toBe('super_admin');
  });

  it('falls back to the profile role when no metadata role is present', () => {
    const role = resolveAccountRole('campaign_manager', {
      user_metadata: {},
      app_metadata: {},
    });

    expect(role).toBe('campaign_manager');
  });

  it('resolves super_admin from bootstrap user id and exact bootstrap email when metadata is absent', () => {
    const role = resolveAccountRole(
      'registered_user',
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'walterdozie7@gmail.com',
        user_metadata: {},
        app_metadata: {},
      },
      {
        bootstrapSuperAdminUserId: '00000000-0000-0000-0000-000000000001',
        bootstrapSuperAdminEmail: 'walterdozie7@gmail.com',
      },
    );

    expect(role).toBe('super_admin');
  });

  it('does not resolve super_admin when bootstrap user id matches but email is different', () => {
    const role = resolveAccountRole(
      'registered_user',
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'other-admin@example.com',
        user_metadata: {},
        app_metadata: {},
      },
      {
        bootstrapSuperAdminUserId: '00000000-0000-0000-0000-000000000001',
        bootstrapSuperAdminEmail: 'walterdozie7@gmail.com',
      },
    );

    expect(role).toBe('registered_user');
  });

  it('resolves advertiser from trusted email when metadata is absent', () => {
    const role = resolveAccountRole(
      'registered_user',
      {
        email: 'advertiser@g4w.org',
        user_metadata: {},
        app_metadata: {},
      },
      {
        advertiserEmails: ['advertiser@g4w.org'],
      },
    );

    expect(role).toBe('advertiser');
  });
});
