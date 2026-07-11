-- 025_gamification_and_internal_rpc_tidy.sql
-- Reduce remaining linter warnings on gamification policies and internal RPC exposure.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_referral_commission_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_fraud_detection_policy_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;