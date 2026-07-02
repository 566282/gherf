import { Link } from 'react-router-dom';
import { signOut } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

export function AdminNavigation({ onSidebarToggle }: { onSidebarToggle?: () => void }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-slate/50 border-b border-ember/30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onSidebarToggle && (
          <button onClick={onSidebarToggle} className="text-ember hover:text-mint">
            ☰
          </button>
        )}
        <Link to="/admin" className="text-lg font-bold text-ember">
          Admin Panel
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm bg-ember/20 border border-ember text-ember hover:bg-ember hover:text-ink rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
