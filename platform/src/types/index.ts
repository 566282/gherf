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

export const campaignTypeValues = [
  'watch_videos',
  'click_advertisements',
  'visit_websites',
  'read_articles',
  'install_mobile_apps',
  'register_accounts',
  'complete_surveys',
  'social_media_follows',
  'social_media_likes',
  'comments',
  'shares',
  'join_telegram',
  'join_discord',
  'subscribe_to_youtube',
  'download_files',
  'daily_tasks',
  'weekly_challenges',
  'seasonal_campaigns',
  'referral_campaigns',
  'custom_tasks',
] as const;

export type CampaignType = (typeof campaignTypeValues)[number];

export const campaignVerificationMethods = [
  'automatic_verification',
  'manual_review',
  'screenshot_upload',
  'video_proof',
  'link_validation',
  'api_verification',
  'timer_verification',
  'random_audit',
] as const;

export type CampaignVerificationMethod = (typeof campaignVerificationMethods)[number];

export const verificationRiskChecks = [
  'fraud_detection',
  'duplicate_detection',
  'vpn_detection',
  'proxy_detection',
  'bot_detection',
] as const;

export type VerificationRiskCheck = (typeof verificationRiskChecks)[number];

export const verificationEvidenceTypes = [
  'screenshot_upload',
  'video_proof',
  'link_validation',
  'api_verification',
  'timer_verification',
] as const;

export type VerificationEvidenceType = (typeof verificationEvidenceTypes)[number];

export interface VerificationPolicy {
  primaryMethod: CampaignVerificationMethod;
  requiredEvidence: VerificationEvidenceType[];
  riskChecks: VerificationRiskCheck[];
  randomAuditRate: number;
  fraudThreshold: number;
  appealWindowHours: number;
}

export const campaignDurationUnits = ['minutes', 'hours', 'days', 'weeks'] as const;

export type CampaignDurationUnit = (typeof campaignDurationUnits)[number];

export const campaignDeviceRestrictions = ['any', 'desktop', 'mobile', 'tablet'] as const;

export type CampaignDeviceRestriction = (typeof campaignDeviceRestrictions)[number];

export const campaignBrowserRestrictions = ['any', 'chrome', 'firefox', 'safari', 'edge', 'opera'] as const;

export type CampaignBrowserRestriction = (typeof campaignBrowserRestrictions)[number];

export interface CampaignTargetAudience {
  ageRange: string;
  interests: string[];
  regions: string[];
  languages: string[];
  tags: string[];
  notes: string;
}

export interface CampaignEngineConfig {
  campaignType: CampaignType;
  instructions: string;
  rewardAmount: number;
  durationValue: number;
  durationUnit: CampaignDurationUnit;
  completionLimit: number;
  dailyLimit: number;
  countryRestrictions: string[];
  deviceRestrictions: CampaignDeviceRestriction[];
  browserRestrictions: CampaignBrowserRestriction[];
  verificationMethod: CampaignVerificationMethod;
  autoApproval: boolean;
  manualApproval: boolean;
  budget: number;
  totalParticipants: number;
  targetAudience: CampaignTargetAudience;
  activeFrom: string;
  activeTo: string;
  priority: number;
  requiredScreenshots: number;
  requiredProof: string;
  verificationPolicy: VerificationPolicy;
  timeDelayBeforeReward: number;
  cooldownPeriod: number;
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
  campaignType: CampaignType;
  instructions: string;
  engineConfig: CampaignEngineConfig;
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

export const taskVerificationStatuses = [
  'pending_approval',
  'approved',
  'rejected',
  'fraud_alert',
  'appeal_review',
] as const;

export type TaskVerificationStatus = (typeof taskVerificationStatuses)[number];

export const appealStatuses = ['none', 'open', 'resolved'] as const;

export type AppealStatus = (typeof appealStatuses)[number];

export interface TaskVerificationCase {
  id: string;
  taskId: string;
  taskTitle: string;
  campaignTitle: string;
  userId: string;
  verificationMethod: CampaignVerificationMethod;
  status: TaskVerificationStatus;
  evidence: VerificationEvidenceType[];
  riskFlags: VerificationRiskCheck[];
  verificationScore: number;
  duplicateOf?: string;
  reviewerId?: string;
  submittedAt: string;
  reviewedAt?: string;
  appealStatus: AppealStatus;
  appealNote?: string;
  notes?: string;
}

/**
 * Reward: issued to user for completing tasks.
 */
export interface Reward {
  id: string;
  userId: string;
  campaignId: string;
  taskId?: string;
  submissionId?: string;
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
  status: 'pending' | 'approved' | 'claimed' | 'refunded';
  action: 'issued' | 'approved' | 'claimed' | 'refunded';
  amount: number;
  reason?: string;
  performedBy?: string; // Admin/system that performed the action
  createdAt: string;
}

export const walletWithdrawalMethods = [
  'bank_transfer',
  'crypto',
  'paypal',
  'gift_cards',
  'manual_payout',
] as const;

export type WalletWithdrawalMethod = (typeof walletWithdrawalMethods)[number];

export const walletApprovalWorkflows = ['manual', 'automatic', 'hybrid'] as const;

export type WalletApprovalWorkflow = (typeof walletApprovalWorkflows)[number];

export const walletTransactionTypes = [
  'earning',
  'bonus_reward',
  'referral_commission',
  'cashback',
  'promotional_reward',
  'achievement_reward',
  'withdrawal_request',
  'withdrawal_reversal',
  'processing_fee',
  'admin_adjustment',
  'exchange_adjustment',
] as const;

export type WalletTransactionType = (typeof walletTransactionTypes)[number];

export const walletTransactionStatuses = [
  'pending',
  'available',
  'reserved',
  'processing',
  'completed',
  'rejected',
  'failed',
] as const;

export type WalletTransactionStatus = (typeof walletTransactionStatuses)[number];

export interface WalletExchangeRate {
  currency: string;
  rate: number;
  label?: string;
  updatedAt?: string;
}

export interface WalletSettings {
  minWithdrawal: number;
  maxWithdrawal: number;
  processingFeePercent: number;
  currency: string;
  approvalWorkflow: WalletApprovalWorkflow;
  exchangeRates: WalletExchangeRate[];
  supportedMethods: WalletWithdrawalMethod[];
}

export interface WalletSummary {
  currency: string;
  earnings: number;
  pendingEarnings: number;
  withdrawableBalance: number;
  bonusRewards: number;
  referralCommissions: number;
  cashback: number;
  promotionalRewards: number;
  achievementRewards: number;
  processingFees: number;
  reservedWithdrawals: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  transactionType: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  currency: string;
  status: WalletTransactionStatus;
  method?: WalletWithdrawalMethod | null;
  referenceId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WithdrawalRequestInput {
  amount: number;
  method: WalletWithdrawalMethod;
  destinationLabel: string;
  destinationValue: string;
  destinationCurrency?: string;
  note?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  walletTransactionId?: string | null;
  method: WalletWithdrawalMethod;
  destinationLabel: string;
  destinationValue?: string | null;
  destinationCurrency: string;
  currency: string;
  amount: number;
  processingFee: number;
  exchangeRate: number;
  netAmount: number;
  approvalWorkflow: WalletApprovalWorkflow;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  adminNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDashboard {
  summary: WalletSummary;
  settings: WalletSettings;
  transactions: WalletTransaction[];
  withdrawals: WithdrawalRequest[];
}

export interface AdminFeatureConfig {
  enabled: boolean;
  mode: string;
  policy: string;
  scope: string;
  note: string;
}

export const themeModes = ['light', 'dark', 'auto'] as const;

export type ThemeMode = (typeof themeModes)[number];

export const themePalettes = ['deep-blue', 'royal-blue', 'emerald', 'indigo'] as const;

export type ThemePalette = (typeof themePalettes)[number];

export const themeFonts = ['Inter', 'Geist', 'Plus Jakarta Sans'] as const;

export type ThemeFont = (typeof themeFonts)[number];

export interface AdminThemeConfig {
  mode: ThemeMode;
  palette: ThemePalette;
  fontFamily: ThemeFont;
}

export const themePresets = ['classic', 'editorial', 'growth', 'contrast', 'custom'] as const;

export type ThemePreset = (typeof themePresets)[number];

export const layoutModes = ['stacked', 'sidebar', 'split'] as const;

export type LayoutMode = (typeof layoutModes)[number];

export const cardStyles = ['flat', 'elevated', 'glass'] as const;

export type CardStyle = (typeof cardStyles)[number];

export const buttonStyles = ['rounded', 'pill', 'sharp'] as const;

export type ButtonStyle = (typeof buttonStyles)[number];

export const tokenDensityModes = ['compact', 'balanced', 'cozy'] as const;

export type TokenDensityMode = (typeof tokenDensityModes)[number];

export const tokenRadiusModes = ['sharp', 'balanced', 'soft'] as const;

export type TokenRadiusMode = (typeof tokenRadiusModes)[number];

export const tokenElevationModes = ['flat', 'layered', 'floating'] as const;

export type TokenElevationMode = (typeof tokenElevationModes)[number];

export const tokenAnimationModes = ['calm', 'polished', 'expressive'] as const;

export type TokenAnimationMode = (typeof tokenAnimationModes)[number];

export const tokenGridModes = ['12-column', '14-column', '16-column'] as const;

export type TokenGridMode = (typeof tokenGridModes)[number];

export const templateModes = ['starter', 'balanced', 'premium'] as const;

export type TemplateMode = (typeof templateModes)[number];

export interface AdminBrandingConfig {
  logoMark: string;
  logoText: string;
  iconStyle: 'line' | 'solid' | 'duotone';
}

export interface AdminLayoutConfig {
  mode: LayoutMode;
  sidebar: 'expanded' | 'compact';
  dashboardWidgets: 'stacked' | 'bento' | 'dense';
  landingPageSections: 'full' | 'focused' | 'minimal';
  navigation: 'top' | 'side' | 'hybrid';
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
}

export interface AdminTrustConfig {
  sslSecurityIndicators: boolean;
  verifiedAdvertiserBadges: boolean;
  verifiedUserBadges: boolean;
  realTimeStatistics: boolean;
  transparentPayoutHistory: boolean;
  auditLogs: boolean;
  fraudProtectionMessaging: boolean;
  userTestimonials: boolean;
  professionalCertifications: boolean;
  systemStatusIndicators: boolean;
}

export interface AdminTemplateConfig {
  campaignTemplate: TemplateMode;
  emailTemplate: TemplateMode;
  notificationTemplate: TemplateMode;
  rewardRules: TemplateMode;
}

export interface AdminTokenConfig {
  spacing: TokenDensityMode;
  typography: ThemeFont;
  radius: TokenRadiusMode;
  elevation: TokenElevationMode;
  animations: TokenAnimationMode;
  icons: 'line' | 'solid' | 'duotone';
  transitions: 'snappy' | 'standard' | 'slow';
  opacity: 'subtle' | 'balanced' | 'bold';
  gridSystem: TokenGridMode;
  breakpoints: 'standard' | 'touch-optimized' | 'foldable-aware';
}

export interface AdminCustomizationConfig {
  themePreset: ThemePreset;
  customCss: string;
  branding: AdminBrandingConfig;
  layout: AdminLayoutConfig;
  trust: AdminTrustConfig;
  templates: AdminTemplateConfig;
  tokens: AdminTokenConfig;
}

export interface AdminConsoleConfig {
  features: Record<string, AdminFeatureConfig>;
  theme: AdminThemeConfig;
  customization: AdminCustomizationConfig;
}

export const cmsPageKeys = [
  'home',
  'faqs',
  'help-center',
  'privacy-policy',
  'terms',
  'blog',
  'landing-pages',
  'advertiser-pages',
  'user-guides',
] as const;

export type CmsPageKey = (typeof cmsPageKeys)[number];

export interface CmsContentItem {
  title: string;
  body: string;
  meta?: string;
  href?: string;
}

export interface CmsPageContent {
  eyebrow: string;
  title: string;
  summary: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  highlights: string[];
  items: CmsContentItem[];
}

export interface CmsConfig {
  siteName: string;
  pages: Record<CmsPageKey, CmsPageContent>;
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
