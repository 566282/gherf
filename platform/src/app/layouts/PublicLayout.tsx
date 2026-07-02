import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore, subscribeToAuthChanges } from '@/stores/auth';

export function PublicLayout() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
    const subscription = subscribeToAuthChanges();
    return () => subscription?.unsubscribe();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-slate to-ink">
      <Outlet />
    </div>
  );
}
