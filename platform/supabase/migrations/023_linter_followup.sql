-- 023_linter_followup.sql
-- Finish remaining Supabase linter warnings after the first hardening pass.

CREATE OR REPLACE FUNCTION public.current_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

ALTER FUNCTION public.security_attach_auth_state_user(text, uuid) SET search_path = public;
ALTER FUNCTION public.security_handle_auth_failure(text, text, integer, integer) SET search_path = public;
ALTER FUNCTION public.security_handle_auth_success(text) SET search_path = public;
ALTER FUNCTION public.security_is_auth_locked(text) SET search_path = public;
ALTER FUNCTION public.ensure_wallet_accounts(uuid, text, numeric, numeric, boolean) SET search_path = public;
ALTER FUNCTION public.sync_wallet_accounts_from_profile() SET search_path = public;
ALTER FUNCTION public.record_wallet_adjustment(uuid, text, numeric, text, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.transfer_wallet_balance(uuid, text, text, numeric, text, text) SET search_path = public;
ALTER FUNCTION public.sync_referral_leaderboard_snapshot(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.evaluate_referral_milestones(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.apply_referral_commission(uuid, uuid, uuid, integer, numeric, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.get_fraud_detection_policy() SET search_path = public;
ALTER FUNCTION public.process_referral_attribution_for_profile() SET search_path = public;
ALTER FUNCTION public.claim_reward_video_session(uuid) SET search_path = public;
ALTER FUNCTION public.notify_super_admins(text, text, text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.process_notification_queue(integer) SET search_path = public;
ALTER FUNCTION public.retry_notification_queue_item(uuid) SET search_path = public;
ALTER FUNCTION public.release_user_withdrawal_holds(uuid) SET search_path = public;