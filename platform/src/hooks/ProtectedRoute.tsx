import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useHasRole } from './useAuth';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  fallback?: ReactNode;
}

/**
 * ProtectedRoute: Guard routes to require authentication and optionally specific roles.
 * If user is not authenticated, redirects to /login.
 * If user lacks required role, redirects to /unauthorized.
 */
export function ProtectedRoute({
  children,
  requiredRoles,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  // hasRole must be called unconditionally to satisfy React's Rules of Hooks.
  const hasRole = useHasRole(...(requiredRoles ?? []));

  if (loading) {
    return fallback || <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && !hasRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

/**
 * ConditionalRender: Render children only if user has required roles.
 * Useful for showing/hiding UI elements based on permissions.
 */
export function ConditionalRender({
  children,
  requiredRoles,
  fallback,
}: {
  children: ReactNode;
  requiredRoles: UserRole[];
  fallback?: ReactNode;
}) {
  const hasRole = useHasRole(...requiredRoles);
  return hasRole ? <>{children}</> : <>{fallback ?? null}</>;
}
