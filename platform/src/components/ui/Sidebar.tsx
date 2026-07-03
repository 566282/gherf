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
        'bg-slate/50 border-r border-mist/20 transition-all duration-300 overflow-y-auto flex flex-col',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <span className="font-bold text-ember text-xl" aria-hidden={!open || undefined}>
          {open ? 'CR Platform' : 'CR'}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="ml-auto text-mist hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember rounded"
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
                'block px-4 py-3 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember',
                active
                  ? 'bg-ember/20 text-ember font-medium'
                  : 'text-mist hover:bg-mist/10 hover:text-ember',
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
