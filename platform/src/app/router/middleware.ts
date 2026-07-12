import type { LoaderFunctionArgs } from 'react-router-dom';
import { redirect } from 'react-router-dom';
import { supabase } from '@/services/supabase/client';
import { UserRole } from '@/types';
import type { AppRole } from '@/types/auth';

type ProfileGuardRow = {
  id: string;
  role: AppRole;
  status: 'active' | 'suspended' | 'banned' | 'pending_verification';
  is_active: boolean;
};

function getDefaultRouteForRole(role: AppRole | null | undefined): string {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'advertiser':
    case 'campaign_manager':
      return '/business';
    case 'registered_user':
    case 'moderator':
    case 'guest':
    default:
      return '/app';
  }
}

function hasAnyRequiredRole(userRole: AppRole, requiredRoles: UserRole[]): boolean {
  if (userRole === 'super_admin') {
    return true;
  }

  return requiredRoles.some((role) => userRole === (role as AppRole));
}

function getReturnTo(request: Request): string {
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  return encodeURIComponent(returnTo);
}

export function guestOnlyMiddleware() {
  return async (_args: LoaderFunctionArgs) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<{ role: AppRole }>();

      throw redirect(getDefaultRouteForRole(profile?.role));
    }

    return null;
  };
}

export function requireAuthMiddleware(requiredRoles?: UserRole[]) {
  return async ({ request }: LoaderFunctionArgs) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw redirect(`/login?redirect=${getReturnTo(request)}`);
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id,role,status,is_active')
      .eq('id', session.user.id)
      .maybeSingle<ProfileGuardRow>();

    if (error || !profile || !profile.is_active || profile.status !== 'active') {
      throw redirect('/unauthorized');
    }

    if (requiredRoles && requiredRoles.length > 0 && !hasAnyRequiredRole(profile.role, requiredRoles)) {
      throw redirect('/unauthorized');
    }

    return null;
  };
}
