-- 028_seed_default_super_admin.sql
-- Safe bootstrap path for a default super admin without committing plaintext passwords.

CREATE OR REPLACE FUNCTION public.seed_default_super_admin(p_email text)
RETURNS uuid AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  SELECT u.id
  INTO target_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'auth user not found for %', p_email;
  END IF;

  UPDATE public.profiles
  SET role = 'super_admin'::user_role,
      status = 'active'::user_status,
      is_active = TRUE,
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', target_user_id;
  END IF;

  RETURN target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.seed_default_super_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_super_admin(text) TO service_role;