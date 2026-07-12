import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/services/api/auth';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full border border-white/10 bg-white/5 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Restricted</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">403 - Unauthorized</h1>
        <p className="mt-3 text-mist/80">You don't have permission to access this page.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/app"
            className="inline-block rounded-xl bg-mint px-6 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(95,175,150,0.18)] transition hover:bg-[#74bea7]"
          >
            Back to Dashboard
          </Link>
          <Button type="button" variant="ghost" onClick={() => void handleSignOut()} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
