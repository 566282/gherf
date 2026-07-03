import type { PropsWithChildren } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLogout } from '@/hooks/useLogout';
import { Button } from '@/components/ui/Button';

export function AppLayout({ children }: PropsWithChildren): JSX.Element {
  const { profile } = useAuth();
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <div className="min-h-screen bg-hero text-mist">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ember focus:px-4 focus:py-2 focus:text-ink">
        Skip to main content
      </a>
      <header className="border-b border-white/10 bg-ink/70 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/" className="text-lg font-semibold text-mist">
            Campaign Reward Platform
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-mist/80 sm:inline">
              {profile?.fullName ?? 'Guest'} ({profile?.role ?? 'guest'})
            </span>
            <Link to="/app/profile" className="text-sm text-mist/90 hover:text-ember">
              Profile
            </Link>
            {profile ? (
              <Button variant="ghost" disabled={isLoggingOut} onClick={() => void handleLogout()}>
                {isLoggingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            ) : (
              <Link to="/login" className="text-sm text-mist/90">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
