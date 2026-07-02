import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/useAuth';

interface SidebarProps {
  open: boolean;
  onToggle?: () => void;
}

export function Sidebar({ open }: SidebarProps) {
  const permissions = usePermissions();

  const menuItems = [
    { label: 'Dashboard', path: '/app', show: true },
    { label: 'Browse Campaigns', path: '/app/campaigns', show: true },
    { label: 'My Tasks', path: '/app/tasks', show: true },
    { label: 'Gamification', path: '/app/gamification', show: true },
    { label: 'Wallet', path: '/app/wallet', show: true },
    { label: 'Business Dashboard', path: '/business', show: permissions.isAdvertiser || permissions.isCampaignManager },
  ];

  return (
    <aside
      className={`${open ? 'w-64' : 'w-20'} bg-slate/50 border-r border-mist/20 transition-all duration-300 overflow-y-auto`}
    >
      <div className="p-4">
        <h1 className="font-bold text-ember text-xl">CR</h1>
      </div>

      <nav className="space-y-1 px-2 py-4">
        {menuItems
          .filter((item) => item.show)
          .map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block px-4 py-3 text-sm rounded-lg hover:bg-mist/10 text-mist hover:text-ember transition-colors"
              title={!open ? item.label : undefined}
            >
              {open ? item.label : item.label.charAt(0)}
            </Link>
          ))}
      </nav>
    </aside>
  );
}
