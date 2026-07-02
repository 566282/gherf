import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@/types';

/**
 * Hook to access current user profile and auth state.
 */
export function useAuth() {
  const { user, loading, error } = useAuthStore();
  return { user, loading, error };
}

/**
 * Hook to check if user has any of the specified roles.
 */
export function useHasRole(...roles: UserRole[]): boolean {
  const { user } = useAuthStore();
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Hook to check if user is authenticated.
 */
export function useIsAuthenticated(): boolean {
  const { user, loading } = useAuthStore();
  return !loading && user !== null;
}

/**
 * Hook to verify user can perform admin actions.
 */
export function useIsAdmin(): boolean {
  return useHasRole(UserRole.SUPER_ADMIN);
}

/**
 * Hook to verify user can manage campaigns.
 */
export function useCanManageCampaigns(): boolean {
  return useHasRole(UserRole.SUPER_ADMIN, UserRole.CAMPAIGN_MANAGER, UserRole.ADVERTISER);
}

/**
 * Hook to verify user can moderate submissions.
 */
export function useCanModerate(): boolean {
  return useHasRole(UserRole.SUPER_ADMIN, UserRole.MODERATOR, UserRole.CAMPAIGN_MANAGER);
}

/**
 * Hook to get permission level for UI decisions.
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  return {
    isAdmin: user?.role === UserRole.SUPER_ADMIN,
    isCampaignManager: user?.role === UserRole.CAMPAIGN_MANAGER,
    isAdvertiser: user?.role === UserRole.ADVERTISER,
    isModerator: user?.role === UserRole.MODERATOR,
    isUser: user?.role === UserRole.REGISTERED_USER,
    isGuest: user?.role === UserRole.GUEST,
  };
}
