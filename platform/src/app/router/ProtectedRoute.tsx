import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasRoleAccess } from '@/lib/rbac';
import type { AppRole } from '@/types/auth';
import { useAuth } from '@/app/providers/AuthProvider';

interface ProtectedRouteProps {
  minimumRole?: AppRole;
}

export function ProtectedRoute({ children, minimumRole = 'registered_user' }: PropsWithChildren<ProtectedRouteProps>): JSX.Element {
  const location = useLocation();
  const { isLoading, isAuthenticated, profile } = useAuth();

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-mist">Loading session...</div>;
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile.isActive || !hasRoleAccess(profile.role, minimumRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
