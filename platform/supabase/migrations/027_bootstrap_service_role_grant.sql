-- 027_bootstrap_service_role_grant.sql
-- Allow the narrow privileged service context to bootstrap the first super admin.

GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid) TO service_role;