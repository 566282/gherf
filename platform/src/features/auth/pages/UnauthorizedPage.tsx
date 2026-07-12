import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/services/api/auth';

export function UnauthorizedPage(): JSX.Element {
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
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-xl text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-3 text-mist/80">Your role does not have permission to access this area.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className="inline-block text-ember hover:text-[#ff902f]">
            Return to dashboard
          </Link>
          <Button type="button" variant="ghost" onClick={() => void handleSignOut()} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
