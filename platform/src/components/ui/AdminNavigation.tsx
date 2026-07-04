import { Link } from 'react-router-dom';
import { useLogout } from '@/hooks/useLogout';

export function AdminNavigation({ onSidebarToggle }: { onSidebarToggle?: () => void }) {
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <nav className="flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        {onSidebarToggle && (
          <button type="button" onClick={onSidebarToggle} className="text-accent transition hover:text-success">
            ☰
          </button>
        )}
        <Link to="/admin" className="text-lg font-bold text-accent">
          Admin Panel
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-accent transition hover:bg-accent hover:text-accent-foreground"
        >
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
