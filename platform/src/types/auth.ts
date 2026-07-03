export type AppRole =
  | 'super_admin'
  | 'campaign_manager'
  | 'moderator'
  | 'advertiser'
  | 'registered_user'
  | 'guest';

export interface UserProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl?: string | null;
  role: AppRole;
  status: 'active' | 'suspended' | 'banned' | 'pending_verification';
  isActive: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  referralCode: string;
  referredByCode: string | null;
  walletBalance: number;
  rewardBalance: number;
  rewardHistoryCount: number;
  unreadNotificationsCount: number;
  reputationScore: number;
  levelLabel: string;
  levelTier: number;
  badges: string[];
  lastLoginAt: string | null;
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  channel?: 'in_app' | 'email' | 'push' | 'sms';
  category?: 'internal' | 'transactional' | 'live_announcement' | 'promotional';
  templateKey?: string | null;
  isPromotional?: boolean;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface RewardLedgerItem {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'claimed' | 'refunded';
  action: 'issued' | 'approved' | 'claimed' | 'refunded';
  reason?: string | null;
  createdAt: string;
}

export interface WalletActivity {
  id: string;
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
}

export interface AdminUserFilters {
  query?: string;
  role?: AppRole;
  status?: UserProfile['status'];
}

export interface ActivityLogItem {
  id: string;
  adminId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason?: string | null;
  createdAt: string;
}
