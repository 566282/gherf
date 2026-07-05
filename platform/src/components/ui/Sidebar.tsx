import { Link, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/useAuth';
import clsx from 'clsx';

interface SidebarProps {
  open: boolean;
  onToggle?: () => void;
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const permissions = usePermissions();
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', path: '/app' },
    { label: 'Browse Campaigns', path: '/app/campaigns' },
    { label: 'My Tasks', path: '/app/tasks' },
    { label: 'Notifications', path: '/app/notifications' },
    { label: 'Gamification', path: '/app/gamification' },
    { label: 'Wallet', path: '/app/wallet' },
    ...(permissions.isAdvertiser || permissions.isCampaignManager
      ? [{ label: 'Business Dashboard', path: '/business' }]
      : []),
  ];

  return (
    <aside
      aria-label="App navigation"
      className={clsx(
        open ? 'w-64' : 'w-20',
        'flex flex-col overflow-y-auto border-r border-border bg-surface/80 transition-all duration-300',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <span className="text-xl font-bold text-accent" aria-hidden={!open || undefined}>
          {open ? 'CR Platform' : 'CR'}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="ml-auto rounded text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {open ? '←' : '→'}
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="space-y-1 px-2 py-4">
        {menuItems.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={!open ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'block rounded-lg px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-foreground hover:bg-surface-elevated hover:text-accent',
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
