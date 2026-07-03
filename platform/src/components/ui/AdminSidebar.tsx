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
        open ? 'w-64' : 'w-20',
        'bg-slate/50 border-r border-ember/30 transition-all duration-300 overflow-y-auto flex flex-col',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <span className="font-bold text-ember text-xl" aria-hidden={!open || undefined}>
          {open ? 'Admin' : 'A'}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="ml-auto text-ember hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember rounded"
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
                'block px-4 py-3 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember',
                active
                  ? 'bg-ember/20 text-ember font-medium'
                  : 'text-mist hover:bg-ember/10 hover:text-ember',
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
