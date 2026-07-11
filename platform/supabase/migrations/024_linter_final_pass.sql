-- 024_linter_final_pass.sql
-- Tighten remaining linter findings after the main and follow-up hardening passes.

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION moddatetime SET SCHEMA extensions;

REVOKE EXECUTE ON FUNCTION public.apply_referral_commission(uuid, uuid, uuid, integer, numeric, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet_accounts(uuid, text, numeric, numeric, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_referral_milestones(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_fraud_detection_policy() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_referral_attribution_for_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_reward_video_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_super_admins(text, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_notification_queue(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_notification_queue_item(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_user_withdrawal_holds(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_wallet_adjustment(uuid, text, numeric, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_wallet_balance(uuid, text, text, numeric, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_reward_video_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_super_admins(text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_notification_queue(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_notification_queue_item(uuid) TO authenticated;