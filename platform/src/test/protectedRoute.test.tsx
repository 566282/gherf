import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/hooks/ProtectedRoute';
import { UserRole } from '@/types';
import type { UserProfile } from '@/types/auth';

const authState = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: false,
  profile: null as UserProfile | null,
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => authState,
}));

const baseProfile: UserProfile = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  role: 'registered_user',
  status: 'active',
  isActive: true,
  isEmailVerified: true,
  twoFactorEnabled: false,
  referralCode: 'TEST123',
  referredByCode: null,
  walletBalance: 0,
  rewardBalance: 0,
  rewardHistoryCount: 0,
  unreadNotificationsCount: 0,
  reputationScore: 0,
  levelLabel: 'Starter',
  levelTier: 1,
  badges: [],
  lastLoginAt: null,
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isLoading = false;
    authState.isAuthenticated = false;
    authState.profile = null;
  });

  it('redirects unauthenticated users to login', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route
            path="/app"
            element={
              <ProtectedRoute requiredRoles={[UserRole.REGISTERED_USER]}>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('allows users with the required role', () => {
    authState.isAuthenticated = true;
    authState.profile = baseProfile;

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized screen</div>} />
          <Route
            path="/app"
            element={
              <ProtectedRoute requiredRoles={[UserRole.REGISTERED_USER]}>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });
});