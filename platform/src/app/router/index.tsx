import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/hooks/ProtectedRoute';
import { UserRole } from '@/types';

const loadPublicLayout = () => import('@/app/layouts/PublicLayout');
const loadAppLayout = () => import('@/app/layouts/AppLayout');
const loadAdminLayout = () => import('@/app/layouts/AdminLayout');

const PublicLayout = lazy(() => loadPublicLayout().then((module) => ({ default: module.PublicLayout })));
const AppLayout = lazy(() => loadAppLayout().then((module) => ({ default: module.AppLayout })));
const AdminLayout = lazy(() => loadAdminLayout().then((module) => ({ default: module.AdminLayout })));

const loadLoginPage = () => import('@/features/auth/pages/LoginPage');
const loadSignupPage = () => import('@/features/auth/pages/SignupPage');
const loadDashboardPage = () => import('@/features/dashboard/pages/DashboardPage');
const loadCampaignBrowsePage = () => import('@/features/campaigns/pages/CampaignBrowsePage');

const LoginPage = lazy(() => loadLoginPage().then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => loadSignupPage().then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
);

const HomePage = lazy(() => import('@/features/home/pages/HomePage').then((module) => ({ default: module.HomePage })));
const UnauthorizedPage = lazy(() =>
  import('@/features/errors/pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage })),
);
const NotFoundPage = lazy(() => import('@/features/errors/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

const DashboardPage = lazy(() => loadDashboardPage().then((module) => ({ default: module.DashboardPage })));
const CampaignBrowsePage = lazy(() =>
  loadCampaignBrowsePage().then((module) => ({ default: module.CampaignBrowsePage })),
);
const CampaignDetailPage = lazy(() =>
  import('@/features/campaigns/pages/CampaignDetailPage').then((module) => ({ default: module.CampaignDetailPage })),
);
const UserTasksPage = lazy(() => import('@/features/rewards/pages/UserTasksPage').then((module) => ({ default: module.UserTasksPage })));
const RewardHistoryPage = lazy(() =>
  import('@/features/rewards/pages/RewardHistoryPage').then((module) => ({ default: module.RewardHistoryPage })),
);
const GamificationPage = lazy(() =>
  import('@/features/rewards/pages/GamificationPage').then((module) => ({ default: module.GamificationPage })),
);
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));

const BusinessDashboardPage = lazy(() =>
  import('@/features/admin/pages/BusinessDashboardPage').then((module) => ({ default: module.BusinessDashboardPage })),
);
const CampaignManagementPage = lazy(() =>
  import('@/features/admin/pages/CampaignManagementPage').then((module) => ({ default: module.CampaignManagementPage })),
);
const CampaignEditorPage = lazy(() =>
  import('@/features/admin/pages/CampaignEditorPage').then((module) => ({ default: module.CampaignEditorPage })),
);
const SubmissionReviewPage = lazy(() =>
  import('@/features/admin/pages/SubmissionReviewPage').then((module) => ({ default: module.SubmissionReviewPage })),
);
const GamificationAdminPage = lazy(() =>
  import('@/features/admin/pages/GamificationAdminPage').then((module) => ({ default: module.GamificationAdminPage })),
);
const CommunicationSystemPage = lazy(() =>
  import('@/features/admin/pages/CommunicationSystemPage').then((module) => ({ default: module.CommunicationSystemPage })),
);
const AnalyticsReportingPage = lazy(() =>
  import('@/features/admin/pages/AnalyticsReportingPage').then((module) => ({ default: module.AnalyticsReportingPage })),
);

const AdminPanelPage = lazy(() => import('@/features/admin/pages/AdminPanelPage').then((module) => ({ default: module.AdminPanelPage })));
const UsersManagementPage = lazy(() =>
  import('@/features/admin/pages/UsersManagementPage').then((module) => ({ default: module.UsersManagementPage })),
);
const PlatformSettingsPage = lazy(() =>
  import('@/features/admin/pages/PlatformSettingsPage').then((module) => ({ default: module.PlatformSettingsPage })),
);
const AuditLogsPage = lazy(() => import('@/features/admin/pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));

function routeElement(Component: ComponentType): JSX.Element {
  return (
    <Suspense fallback={<div className="grid min-h-[30vh] place-items-center text-sm text-mist/80">Loading page...</div>}>
      <Component />
    </Suspense>
  );
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: routeElement(PublicLayout),
    children: [
      { index: true, element: routeElement(HomePage) },
      { path: 'login', element: routeElement(LoginPage) },
      { path: 'signup', element: routeElement(SignupPage) },
      { path: 'forgot-password', element: routeElement(ForgotPasswordPage) },
      { path: 'reset-password', element: routeElement(ResetPasswordPage) },
      { path: 'unauthorized', element: routeElement(UnauthorizedPage) },
    ],
  },

  // Authenticated user routes
  {
    path: '/app',
    element: (
      <ProtectedRoute requiredRoles={[UserRole.REGISTERED_USER]}>
        {routeElement(AppLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: routeElement(DashboardPage) },
      { path: 'profile', element: routeElement(ProfilePage) },
      { path: 'campaigns', element: routeElement(CampaignBrowsePage) },
      { path: 'campaigns/:id', element: routeElement(CampaignDetailPage) },
      { path: 'tasks', element: routeElement(UserTasksPage) },
      { path: 'wallet', element: routeElement(RewardHistoryPage) },
      { path: 'rewards', element: routeElement(RewardHistoryPage) },
      { path: 'gamification', element: routeElement(GamificationPage) },
    ],
  },

  // Advertiser/Campaign Manager routes
  {
    path: '/business',
    element: (
      <ProtectedRoute requiredRoles={[UserRole.ADVERTISER, UserRole.CAMPAIGN_MANAGER]}>
        {routeElement(AppLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: routeElement(BusinessDashboardPage) },
      { path: 'campaigns', element: routeElement(CampaignManagementPage) },
      { path: 'campaigns/new', element: routeElement(CampaignEditorPage) },
      { path: 'campaigns/:id/edit', element: routeElement(CampaignEditorPage) },
      { path: 'submissions/:campaignId', element: routeElement(SubmissionReviewPage) },
    ],
  },

  // Super Admin routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
        {routeElement(AdminLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: routeElement(AdminPanelPage) },
      { path: 'verification', element: routeElement(SubmissionReviewPage) },
      { path: 'gamification', element: routeElement(GamificationAdminPage) },
      { path: 'communications', element: routeElement(CommunicationSystemPage) },
      { path: 'analytics', element: routeElement(AnalyticsReportingPage) },
      { path: 'users', element: routeElement(UsersManagementPage) },
      { path: 'settings', element: routeElement(PlatformSettingsPage) },
      { path: 'audit-logs', element: routeElement(AuditLogsPage) },
    ],
  },

  // Catch-all
  { path: '*', element: routeElement(NotFoundPage) },
];

export const router = createBrowserRouter(routes);

export function preloadCriticalRoutes(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const preload = () => {
    void Promise.allSettled([
      loadPublicLayout(),
      loadLoginPage(),
      loadSignupPage(),
      loadAppLayout(),
      loadDashboardPage(),
      loadCampaignBrowsePage(),
      loadAdminLayout(),
    ]);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1800 });
    return;
  }

  window.setTimeout(preload, 900);
}
