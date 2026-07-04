import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface AdminSidebarProps {
  open: boolean;
  onToggle?: () => void;
}

type MenuItem =
  | { label: string; path: string; hash?: undefined }
  | { label: string; path: string; hash: string };

export function AdminSidebar({ open, onToggle }: AdminSidebarProps) {
  const location = useLocation();

  const menuItems: MenuItem[] = [
    { label: 'Overview',       path: '/admin', hash: 'overview' },
    { label: 'Operations',     path: '/admin', hash: 'operations' },
    { label: 'Finance',        path: '/admin', hash: 'finance' },
    { label: 'Insights',       path: '/admin', hash: 'insights' },
    { label: 'Trust',          path: '/admin', hash: 'trust' },
    { label: 'Content',        path: '/admin', hash: 'content' },
    { label: 'Platform',       path: '/admin', hash: 'platform' },
    { label: 'CMS',            path: '/admin/cms' },
    { label: 'Gamification',   path: '/admin/gamification' },
    { label: 'Communications', path: '/admin/communications' },
    { label: 'Analytics',      path: '/admin/analytics' },
    { label: 'Verification',   path: '/admin/verification' },
    { label: 'Users',          path: '/admin/users' },
    { label: 'Settings',       path: '/admin/settings' },
    { label: 'Audit Logs',     path: '/admin/audit-logs' },
  ];

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
        {menuItems.map((item) => {
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
