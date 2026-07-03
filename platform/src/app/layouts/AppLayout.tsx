import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { signOut } from '@/services/api/auth';
import { Button } from '@/components/ui/Button';

export function AppLayout({ children }: PropsWithChildren): JSX.Element {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-hero text-mist">
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
              <Button variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            ) : (
              <Link to="/login" className="text-sm text-mist/90">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
