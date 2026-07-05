import { createBrowserRouter, RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/hooks/ProtectedRoute';
import { UserRole } from '@/types';
import { guestOnlyMiddleware, requireAuthMiddleware } from '@/app/router/middleware';

// Layouts
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AdminLayout } from '@/app/layouts/AdminLayout';

// Auth pages
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

// Public pages
import { HomePage } from '@/features/home/pages/HomePage';
import { CmsPublicPage } from '@/features/content/pages/CmsPublicPage';
import { UnauthorizedPage } from '@/features/errors/pages/UnauthorizedPage';
import { NotFoundPage } from '@/features/errors/pages/NotFoundPage';

// Authenticated pages
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { CampaignBrowsePage } from '@/features/campaigns/pages/CampaignBrowsePage';
import { CampaignDetailPage } from '@/features/campaigns/pages/CampaignDetailPage';
import { UserTasksPage } from '@/features/rewards/pages/UserTasksPage';
import { RewardHistoryPage } from '@/features/rewards/pages/RewardHistoryPage';
import { GamificationPage } from '@/features/rewards/pages/GamificationPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { NotificationHistoryPage } from '@/features/profile/pages/NotificationHistoryPage';

// Admin/Campaign Manager pages
import { DashboardAnalyticsPage } from '@/features/admin/pages/DashboardAnalyticsPage';
import { AdManagementPage } from '@/features/admin/pages/AdManagementPage';
import { VideoManagementPage } from '@/features/admin/pages/VideoManagementPage';
import { RewardSettingsPage } from '@/features/admin/pages/RewardSettingsPage';
import { ReferralSettingsPage } from '@/features/admin/pages/ReferralSettingsPage';
import { ReferralOpsPage } from '@/features/admin/pages/ReferralOpsPage';
import { FraudDetectionPage } from '@/features/admin/pages/FraudDetectionPage';
import { ReportsPage } from '@/features/admin/pages/ReportsPage';
import { WalletManagementPage } from '@/features/admin/pages/WalletManagementPage';
import { SystemSettingsPage } from '@/features/admin/pages/SystemSettingsPage';
import { EmailTemplatesPage } from '@/features/admin/pages/EmailTemplatesPage';
import { NotificationCenterPage } from '@/features/admin/pages/NotificationCenterPage';
import { SupportTicketsPage } from '@/features/admin/pages/SupportTicketsPage';
import { TaskEnginePage } from '@/features/admin/pages/TaskEnginePage';
import { PermissionsPage } from '@/features/admin/pages/PermissionsPage';
import { BusinessDashboardPage } from '@/features/admin/pages/BusinessDashboardPage';
import { CampaignManagementPage } from '@/features/admin/pages/CampaignManagementPage';
import { CampaignEditorPage } from '@/features/admin/pages/CampaignEditorPage';
import { CommunicationSystemPage } from '@/features/admin/pages/CommunicationSystemPage';
import { AnalyticsReportingPage } from '@/features/admin/pages/AnalyticsReportingPage';
import { GamificationAdminPage } from '@/features/admin/pages/GamificationAdminPage';
import { SubmissionReviewPage } from '@/features/admin/pages/SubmissionReviewPage';

// Super Admin pages
import { AdminPanelPage } from '@/features/admin/pages/AdminPanelPage';
import { CmsManagementPage } from '@/features/admin/pages/CmsManagementPage';
import { UsersManagementPage } from '@/features/admin/pages/UsersManagementPage';
import { PlatformSettingsPage } from '@/features/admin/pages/PlatformSettingsPage';
import { AuditLogsPage } from '@/features/admin/pages/AuditLogsPage';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <CmsPublicPage pageKey="about" /> },
      { path: 'contact', element: <CmsPublicPage pageKey="contact" /> },
      { path: 'news', element: <CmsPublicPage pageKey="news" /> },
      { path: 'announcements', element: <CmsPublicPage pageKey="announcements" /> },
      { path: 'faqs', element: <CmsPublicPage pageKey="faqs" /> },
      { path: 'faq', element: <CmsPublicPage pageKey="faqs" /> },
      { path: 'help-center', element: <CmsPublicPage pageKey="help-center" /> },
      { path: 'privacy-policy', element: <CmsPublicPage pageKey="privacy-policy" /> },
      { path: 'terms', element: <CmsPublicPage pageKey="terms" /> },
      { path: 'blog', element: <CmsPublicPage pageKey="blog" /> },
      { path: 'seo', element: <CmsPublicPage pageKey="seo" /> },
      { path: 'meta-tags', element: <CmsPublicPage pageKey="meta-tags" /> },
      { path: 'open-graph', element: <CmsPublicPage pageKey="open-graph" /> },
      { path: 'sitemap', element: <CmsPublicPage pageKey="sitemap" /> },
      { path: 'robots', element: <CmsPublicPage pageKey="robots" /> },
      { path: 'custom-urls', element: <CmsPublicPage pageKey="custom-urls" /> },
      { path: 'landing-pages', element: <CmsPublicPage pageKey="landing-pages" /> },
      { path: 'advertiser-pages', element: <CmsPublicPage pageKey="advertiser-pages" /> },
      { path: 'user-guides', element: <CmsPublicPage pageKey="user-guides" /> },
      { path: 'login', loader: guestOnlyMiddleware(), element: <LoginPage /> },
      { path: 'signup', loader: guestOnlyMiddleware(), element: <SignupPage /> },
      { path: 'forgot-password', loader: guestOnlyMiddleware(), element: <ForgotPasswordPage /> },
      { path: 'reset-password', loader: guestOnlyMiddleware(), element: <ResetPasswordPage /> },
      { path: 'unauthorized', element: <UnauthorizedPage /> },
    ],
  },

  // Authenticated user routes
  {
    path: '/app',
    loader: requireAuthMiddleware([UserRole.REGISTERED_USER]),
    element: (
      <ProtectedRoute requiredRoles={[UserRole.REGISTERED_USER]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'campaigns', element: <CampaignBrowsePage /> },
      { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      { path: 'tasks', element: <UserTasksPage /> },
      { path: 'wallet', element: <RewardHistoryPage /> },
      { path: 'notifications', element: <NotificationHistoryPage /> },
      { path: 'rewards', element: <Navigate to="/app/wallet" replace /> },
      { path: 'gamification', element: <GamificationPage /> },
    ],
  },

  // Advertiser/Campaign Manager routes
  {
    path: '/business',
    loader: requireAuthMiddleware([UserRole.ADVERTISER, UserRole.CAMPAIGN_MANAGER]),
    element: (
      <ProtectedRoute requiredRoles={[UserRole.ADVERTISER, UserRole.CAMPAIGN_MANAGER]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <BusinessDashboardPage /> },
      { path: 'campaigns', element: <CampaignManagementPage /> },
      { path: 'campaigns/new', element: <CampaignEditorPage /> },
      { path: 'campaigns/:id/edit', element: <CampaignEditorPage /> },
      { path: 'submissions/:campaignId', element: <SubmissionReviewPage /> },
      { path: 'gamification', element: <GamificationAdminPage /> },
      { path: 'communications', element: <CommunicationSystemPage /> },
      { path: 'analytics', element: <AnalyticsReportingPage /> },
    ],
  },

  // Super Admin routes
  {
    path: '/admin',
    loader: requireAuthMiddleware([UserRole.SUPER_ADMIN]),
    element: (
      <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminPanelPage /> },
      { path: 'dashboard-analytics', element: <DashboardAnalyticsPage /> },
      { path: 'ad-management', element: <AdManagementPage /> },
      { path: 'video-management', element: <VideoManagementPage /> },
      { path: 'reward-settings', element: <RewardSettingsPage /> },
      { path: 'referral-settings', element: <ReferralSettingsPage /> },
      { path: 'referral-ops', element: <ReferralOpsPage /> },
      { path: 'fraud-detection', element: <FraudDetectionPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'withdrawal-approval', element: <PlatformSettingsPage /> },
      { path: 'settings', element: <Navigate to="/admin/withdrawal-approval" replace /> },
      { path: 'wallet', element: <WalletManagementPage /> },
      { path: 'task-engine', element: <TaskEnginePage /> },
      { path: 'system-settings', element: <SystemSettingsPage /> },
      { path: 'email-templates', element: <EmailTemplatesPage /> },
      { path: 'notification-center', element: <NotificationCenterPage /> },
      { path: 'support-tickets', element: <SupportTicketsPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'cms', element: <CmsManagementPage /> },
      { path: 'users', element: <UsersManagementPage /> },
      { path: 'verification', element: <SubmissionReviewPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
