import { describe, expect, it, vi } from 'vitest';
import { buildReferralSignupRequest, signUp } from '@/services/api/auth';

const supabaseState = vi.hoisted(() => ({
  signUp: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: supabaseState.signUp,
    },
  },
}));

describe('referral signup path', () => {
  it('builds the referral signup request payload for the auth trigger path', () => {
    const request = buildReferralSignupRequest('referral@example.com', 'Password123!', 'Referral User', 'REF-1234', 'registered_user', 'http://localhost');

    expect(request).toEqual(
      expect.objectContaining({
        email: 'referral@example.com',
        password: 'Password123!',
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost/login',
          data: expect.objectContaining({
            full_name: 'Referral User',
            referral_code: expect.any(String),
            referred_by_code: 'REF-1234',
            role: 'registered_user',
          }),
        }),
      }),
    );
  });

  it('sends referral metadata through the auth signup request', async () => {
    supabaseState.signUp.mockResolvedValue({ error: null });

    await signUp('referral@example.com', 'Password123!', 'Referral User', 'REF-1234');

    expect(supabaseState.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'referral@example.com',
        password: 'Password123!',
        options: expect.objectContaining({
          data: expect.objectContaining({
            full_name: 'Referral User',
            referred_by_code: 'REF-1234',
            role: 'registered_user',
          }),
        }),
      }),
    );
  });
});