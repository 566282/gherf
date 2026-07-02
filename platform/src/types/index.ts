/**
 * Core role definitions for the platform.
 * Each role has specific permissions enforced via RLS policies and UI guards.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  CAMPAIGN_MANAGER = 'campaign_manager',
  MODERATOR = 'moderator',
  ADVERTISER = 'advertiser',
  REGISTERED_USER = 'registered_user',
  GUEST = 'guest',
}

/**
 * User profile with auth metadata and role assignment.
 * Extends Supabase auth.users with profile-specific data.
 */
export interface UserProfile {
  id: string; // UUID from auth.users
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending_approval';
  createdAt: string;
  updatedAt: string;
}

/**
 * Business entity created and managed by Advertisers.
 */
export interface Business {
  id: string;
  ownerId: string; // Reference to UserProfile
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Campaign campaign structure with configurable rules and status.
 */
export interface Campaign {
  id: string;
  businessId: string;
  title: string;
  description?: string;
  bannerUrl?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
  startDate: string;
  endDate: string;
  budget: number;
  budgetCurrency: string;
  totalRewardsAllocated: number;
  maxParticipants?: number;
  currentParticipants: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Campaign rules: database-driven configuration.
 * Allows admins to modify campaign behavior without code changes.
 */
export interface CampaignRule {
  id: string;
  campaignId: string;
  ruleKey: string; // e.g., "max_tasks_per_user", "reward_multiplier"
  ruleValue: string | number | boolean; // JSON serialized if needed
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Campaign task: individual task within a campaign.
 */
export interface CampaignTask {
  id: string;
  campaignId: string;
  title: string;
  description?: string;
  taskType: 'click' | 'survey' | 'video' | 'form' | 'custom';
  mediaUrl?: string;
  rewardAmount: number;
  maxCompletions?: number;
  currentCompletions: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

/**
 * Task submission: user's submission for a specific task.
 */
export interface TaskSubmission {
  id: string;
  taskId: string;
  userId: string;
  submissionData?: Record<string, unknown>; // JSONB for flexible data capture
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reward: issued to user for completing tasks.
 */
export interface Reward {
  id: string;
  userId: string;
  campaignId: string;
  taskId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'claimed' | 'refunded';
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reward ledger: audit trail of all reward transactions.
 */
export interface RewardLedgerEntry {
  id: string;
  userId: string;
  rewardId: string;
  action: 'issued' | 'approved' | 'claimed' | 'refunded';
  amount: number;
  reason?: string;
  performedBy?: string; // Admin/system that performed the action
  createdAt: string;
}

/**
 * Admin action audit: comprehensive audit trail for all admin operations.
 */
export interface AdminActionAudit {
  id: string;
  adminId: string;
  action: string; // e.g., "campaign_pause", "user_suspend"
  resourceType: string; // e.g., "campaign", "user"
  resourceId: string;
  oldValues?: Record<string, unknown>; // JSONB
  newValues?: Record<string, unknown>; // JSONB
  reason?: string;
  createdAt: string;
}

/**
 * Platform settings: configurable feature flags, thresholds, and limits.
 * Stored in DB for admin control without code changes.
 */
export interface PlatformSettings {
  id: string;
  key: string;
  value: string | number | boolean | object;
  description?: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Auth session and state returned from Supabase.
 */
export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * API response envelope for consistency.
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
