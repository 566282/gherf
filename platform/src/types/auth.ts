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
  role: AppRole;
  isActive: boolean;
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
}
