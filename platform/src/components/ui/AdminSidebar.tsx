import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { usePermissions } from '@/hooks/useAuth';

interface AdminSidebarProps {
  open: boolean;
  onToggle?: () => void;
}

type MenuItem =
  | { label: string; path: string; hash?: undefined; adminOnly?: boolean }
  | { label: string; path: string; hash: string; adminOnly?: boolean };

export function AdminSidebar({ open, onToggle }: AdminSidebarProps) {
  const location = useLocation();
  const permissions = usePermissions();

  const menuItems: MenuItem[] = [
    { label: 'Overview',       path: '/admin', hash: 'overview' },
    { label: 'Operations',     path: '/admin', hash: 'operations' },
    { label: 'Finance',        path: '/admin', hash: 'finance' },
    { label: 'Insights',       path: '/admin', hash: 'insights' },
    { label: 'Trust',          path: '/admin', hash: 'trust' },
    { label: 'Content',        path: '/admin', hash: 'content' },
    { label: 'Platform',       path: '/admin', hash: 'platform' },
    { label: 'Dashboard Analytics', path: '/admin/dashboard-analytics', adminOnly: true },
    { label: 'Ad Management', path: '/admin/ad-management', adminOnly: true },
    { label: 'Ad Platform', path: '/admin/ad-platform', adminOnly: true },
    { label: 'Reward Settings', path: '/admin/reward-settings', adminOnly: true },
    { label: 'Referral Settings', path: '/admin/referral-settings', adminOnly: true },
    { label: 'Fraud Detection', path: '/admin/fraud-detection', adminOnly: true },
    { label: 'Reports', path: '/admin/reports', adminOnly: true },
    { label: 'Withdrawal Approval', path: '/admin/withdrawal-approval', adminOnly: true },
    { label: 'Wallet Management', path: '/admin/wallet', adminOnly: true },
    { label: 'Membership Plans', path: '/admin/membership-plans', adminOnly: true },
    { label: 'Membership Benefits', path: '/admin/membership-benefits', adminOnly: true },
    { label: 'Membership Rules', path: '/admin/membership-rules', adminOnly: true },
    { label: 'Membership Workflow', path: '/admin/membership-workflow', adminOnly: true },
    { label: 'Reward Multiplier', path: '/admin/membership-multiplier', adminOnly: true },
    { label: 'Membership Fees', path: '/admin/membership-fees', adminOnly: true },
    { label: 'Membership Analytics', path: '/admin/membership-analytics', adminOnly: true },
    { label: 'P2P Merchants', path: '/admin/p2p-merchants', adminOnly: true },
    { label: 'P2P Disputes', path: '/admin/p2p-disputes', adminOnly: true },
    { label: 'P2P Risk Console', path: '/admin/p2p-risk', adminOnly: true },
    { label: 'Compliance Policies', path: '/admin/compliance-policies', adminOnly: true },
    { label: 'Compliance Dashboard', path: '/admin/compliance-dashboard', adminOnly: true },
    { label: 'Withdrawal Compliance', path: '/admin/withdrawal-compliance', adminOnly: true },
    { label: 'Appeals Management', path: '/admin/appeals-management', adminOnly: true },
    { label: 'Social Platforms', path: '/admin/social-platforms', adminOnly: true },
    { label: 'Suspension Cases', path: '/admin/suspension-cases', adminOnly: true },
    { label: 'Classroom Ops', path: '/admin/classroom-ops', adminOnly: true },
    { label: 'Classroom Catalog', path: '/admin/classroom-catalog', adminOnly: true },
    { label: 'Classroom Providers', path: '/admin/classroom-providers', adminOnly: true },
    { label: 'Classroom Fraud Review', path: '/admin/classroom-fraud-review', adminOnly: true },
    { label: 'Classroom Analytics', path: '/admin/classroom-analytics', adminOnly: true },
    { label: 'Task Engine', path: '/admin/task-engine', adminOnly: true },
    { label: 'System Settings', path: '/admin/system-settings', adminOnly: true },
    { label: 'Email Templates', path: '/admin/email-templates', adminOnly: true },
    { label: 'Notification Center', path: '/admin/notification-center', adminOnly: true },
    { label: 'Support Tickets', path: '/admin/support-tickets', adminOnly: true },
    { label: 'Permissions', path: '/admin/permissions', adminOnly: true },
    { label: 'CMS', path: '/admin/cms', adminOnly: true },
    { label: 'Gamification', path: '/admin/gamification', adminOnly: true },
    { label: 'Communications', path: '/admin/communications', adminOnly: true },
    { label: 'Analytics', path: '/admin/analytics', adminOnly: true },
    { label: 'Verification', path: '/admin/verification', adminOnly: true },
    { label: 'Users', path: '/admin/users', adminOnly: true },
    { label: 'Audit Logs', path: '/admin/audit-logs', adminOnly: true },
  ];

  const visibleMenuItems = menuItems.filter((item) => !item.adminOnly || permissions.isAdmin);

  return (
    <aside
      aria-label="Admin navigation"
      className={clsx(
        'admin-sidebar',
        !open && 'admin-sidebar-collapsed',
        'flex flex-col overflow-y-auto border-r border-border bg-surface/80 transition-all duration-300',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <span className="text-xl font-bold text-accent" aria-hidden={!open || undefined}>
          {open ? 'Admin' : 'A'}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="ml-auto rounded text-accent transition hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {open ? '←' : '→'}
          </button>
        )}
      </div>

      <nav aria-label="Admin" className="space-y-1 px-2 py-4">
        {visibleMenuItems.map((item) => {
          const active = item.hash
            ? location.pathname === item.path && location.hash === `#${item.hash}`
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const to = item.hash ? { pathname: item.path, hash: `#${item.hash}` } : item.path;

          return (
            <Link
              key={item.hash ? `${item.path}#${item.hash}` : item.path}
              to={to}
              aria-label={!open ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'block rounded-lg px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-foreground hover:bg-accent-soft hover:text-accent',
              )}
            >
              {open ? item.label : <span aria-hidden="true">{item.label.charAt(0)}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
