import { Link } from 'react-router-dom';
import { useLogout } from '@/hooks/useLogout';

export function AdminNavigation({ onSidebarToggle }: { onSidebarToggle?: () => void }) {
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <nav className="bg-slate/50 border-b border-ember/30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onSidebarToggle && (
          <button type="button" onClick={onSidebarToggle} className="text-ember hover:text-mint">
            ☰
          </button>
        )}
        <Link to="/admin" className="text-lg font-bold text-ember">
          Admin Panel
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="px-4 py-2 text-sm bg-ember/20 border border-ember text-ember hover:bg-ember hover:text-ink rounded-lg transition-colors"
        >
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
