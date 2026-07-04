import { useAuth as useAuthContext } from '@/app/providers/AuthProvider';
import { UserRole } from '@/types';

/**
 * Hook to access current user profile and auth state.
 */
export function useAuth() {
  const { isLoading, profile } = useAuthContext();

  return { user: profile, loading: isLoading, error: null };
}

/**
 * Hook to check if user has any of the specified roles.
 */
export function useHasRole(...roles: UserRole[]): boolean {
  const { profile } = useAuthContext();

  if (!profile) return false;

  return roles.includes(profile.role as UserRole);
}

/**
 * Hook to check if user is authenticated.
 */
export function useIsAuthenticated(): boolean {
  const { isLoading, isAuthenticated } = useAuthContext();

  return !isLoading && isAuthenticated;
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
  const { profile } = useAuthContext();

  return {
    isAdmin: profile?.role === UserRole.SUPER_ADMIN,
    isCampaignManager: profile?.role === UserRole.CAMPAIGN_MANAGER,
    isAdvertiser: profile?.role === UserRole.ADVERTISER,
    isModerator: profile?.role === UserRole.MODERATOR,
    isUser: profile?.role === UserRole.REGISTERED_USER,
    isGuest: profile?.role === UserRole.GUEST,
  };
}
