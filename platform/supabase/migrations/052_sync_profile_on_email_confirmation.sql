-- 052_sync_profile_on_email_confirmation.sql
-- Promote a pending profile to active once Supabase confirms the email address.

CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'active'::public.user_status,
        is_active = TRUE,
        is_email_verified = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;

    INSERT INTO public.user_activity_logs (user_id, event_type, metadata)
    VALUES (NEW.id, 'email_confirmed', jsonb_build_object('email', NEW.email));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmation();