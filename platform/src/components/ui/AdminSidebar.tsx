import { Link } from 'react-router-dom';

interface AdminSidebarProps {
  open: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ open }: AdminSidebarProps) {
  const menuItems = [
    { label: 'Overview', path: '/admin#overview' },
    { label: 'Operations', path: '/admin#operations' },
    { label: 'Finance', path: '/admin#finance' },
    { label: 'Insights', path: '/admin#insights' },
    { label: 'Gamification', path: '/admin/gamification' },
    { label: 'Trust', path: '/admin#trust' },
    { label: 'Content', path: '/admin#content' },
    { label: 'Platform', path: '/admin#platform' },
    { label: 'Communications', path: '/admin/communications' },
    { label: 'Verification', path: '/admin/verification' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Audit Logs', path: '/admin/audit-logs' },
  ];

  return (
    <aside
      className={`${open ? 'w-64' : 'w-20'} bg-slate/50 border-r border-ember/30 transition-all duration-300 overflow-y-auto`}
    >
      <div className="p-4">
        <h1 className="font-bold text-ember text-xl">ADMIN</h1>
      </div>

      <nav className="space-y-1 px-2 py-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="block px-4 py-3 text-sm rounded-lg hover:bg-ember/10 text-mist hover:text-ember transition-colors"
            title={!open ? item.label : undefined}
          >
            {open ? item.label : item.label.charAt(0)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
