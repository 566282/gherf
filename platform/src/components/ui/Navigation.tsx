import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';

export function Navigation({ onSidebarToggle }: { onSidebarToggle?: () => void }) {
  const { user } = useAuth();
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <nav className="flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        {onSidebarToggle && (
          <button type="button" onClick={onSidebarToggle} className="text-muted transition hover:text-accent">
            ☰
          </button>
        )}
        <Link to="/app" className="text-lg font-bold text-accent">
          CampaignReward
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-foreground">{user?.fullName}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
        >
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
