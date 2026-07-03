import { createBrowserRouter, RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/hooks/ProtectedRoute';
import { UserRole } from '@/types';

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

// Admin/Campaign Manager pages
import { BusinessDashboardPage } from '@/features/admin/pages/BusinessDashboardPage';
import { CampaignManagementPage } from '@/features/admin/pages/CampaignManagementPage';
import { CampaignEditorPage } from '@/features/admin/pages/CampaignEditorPage';
import { CommunicationSystemPage } from '@/features/admin/pages/CommunicationSystemPage';
import { AnalyticsReportingPage } from '@/features/admin/pages/AnalyticsReportingPage';
import { GamificationAdminPage } from '@/features/admin/pages/GamificationAdminPage';
import { SubmissionReviewPage } from '@/features/admin/pages/SubmissionReviewPage';

// Super Admin pages
import { AdminPanelPage } from '@/features/admin/pages/AdminPanelPage';
import { UsersManagementPage } from '@/features/admin/pages/UsersManagementPage';
import { PlatformSettingsPage } from '@/features/admin/pages/PlatformSettingsPage';
import { AuditLogsPage } from '@/features/admin/pages/AuditLogsPage';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'unauthorized', element: <UnauthorizedPage /> },
    ],
  },

  // Authenticated user routes
  {
    path: '/app',
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
      { path: 'rewards', element: <Navigate to="/app/wallet" replace /> },
      { path: 'gamification', element: <GamificationPage /> },
    ],
  },

  // Advertiser/Campaign Manager routes
  {
    path: '/business',
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
    element: (
      <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminPanelPage /> },
      { path: 'users', element: <UsersManagementPage /> },
      { path: 'settings', element: <PlatformSettingsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
