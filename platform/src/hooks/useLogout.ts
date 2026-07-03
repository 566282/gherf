import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSecuritySessionState } from '@/lib/security';
import { logError } from '@/lib/logger';
import { signOut } from '@/services/supabase';

export function useLogout(): {
  handleLogout: () => Promise<void>;
  isLoggingOut: boolean;
} {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      await signOut();
      clearSecuritySessionState();
      navigate('/');
    } catch (error) {
      logError(error, 'Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  }, [navigate]);

  return { handleLogout, isLoggingOut };
}
