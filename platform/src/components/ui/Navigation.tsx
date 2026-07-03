import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';

export function Navigation({ onSidebarToggle }: { onSidebarToggle?: () => void }) {
  const { user } = useAuth();
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <nav className="bg-slate/50 border-b border-mist/20 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onSidebarToggle && (
          <button type="button" onClick={onSidebarToggle} className="text-mist hover:text-ember">
            ☰
          </button>
        )}
        <Link to="/app" className="text-lg font-bold text-ember">
          CampaignReward
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-mist">{user?.fullName}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="px-4 py-2 text-sm bg-slate hover:bg-slate/70 rounded-lg transition-colors"
        >
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
