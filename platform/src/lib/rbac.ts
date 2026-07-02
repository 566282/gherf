import type { AppRole } from '@/types/auth';

const roleOrder: Record<AppRole, number> = {
  guest: 0,
  registered_user: 1,
  advertiser: 2,
  moderator: 3,
  campaign_manager: 4,
  super_admin: 5,
};

export function hasRoleAccess(userRole: AppRole, minimumRole: AppRole): boolean {
  return roleOrder[userRole] >= roleOrder[minimumRole];
}

export function canManageCampaigns(role: AppRole): boolean {
  return hasRoleAccess(role, 'campaign_manager') || role === 'advertiser';
}
