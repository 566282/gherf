-- 022_linter_hardening.sql
-- Address Supabase informational and security linter findings after the main schema rollout.

ALTER VIEW wallet_audit_logs SET (security_invoker = true);

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.security_check_rate_limit(text, text, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.security_log_captcha_event(text, text, boolean, numeric, text, jsonb) SET search_path = public;
ALTER FUNCTION public.security_issue_csrf_token(uuid, integer) SET search_path = public;
ALTER FUNCTION public.security_validate_csrf_token(uuid, text) SET search_path = public;
ALTER FUNCTION public.security_register_session(uuid, timestamptz, text, text, text, boolean) SET search_path = public;
ALTER FUNCTION public.security_revoke_session(uuid, text) SET search_path = public;
ALTER FUNCTION public.security_observe_ip(text, integer, jsonb) SET search_path = public;
ALTER FUNCTION public.security_observe_device(text, integer, jsonb) SET search_path = public;
ALTER FUNCTION public.security_write_audit(text, text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.claim_reward_video_session(uuid) SET search_path = public;
ALTER FUNCTION public.process_referral_attribution_for_profile() SET search_path = public;
ALTER FUNCTION public.sync_referral_leaderboard_snapshot(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.evaluate_referral_milestones(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.apply_referral_commission(uuid, uuid, uuid, integer, numeric, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.sync_referral_program_updated_at() SET search_path = public;
ALTER FUNCTION public.sync_referral_record_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_referral_commission_insert() SET search_path = public;
ALTER FUNCTION public.notify_super_admins(text, text, text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.process_notification_queue(integer) SET search_path = public;
ALTER FUNCTION public.retry_notification_queue_item(uuid) SET search_path = public;
ALTER FUNCTION public.release_user_withdrawal_holds(uuid) SET search_path = public;