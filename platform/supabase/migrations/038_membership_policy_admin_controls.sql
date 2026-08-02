-- 038_membership_policy_admin_controls.sql
-- Persist the admin-controlled membership rollout mode and strict fee blocking defaults.

INSERT INTO membership_rollout_flags (flag_key, mode, rollout_percent, metadata)
VALUES
  ('membership_rules_engine_v2', 'enforced', 100, '{"updated_via":"migration","controls":"admin_toggle"}'::JSONB)
ON CONFLICT (flag_key) DO UPDATE
SET mode = EXCLUDED.mode,
    rollout_percent = EXCLUDED.rollout_percent,
    metadata = COALESCE(membership_rollout_flags.metadata, '{}'::JSONB) || EXCLUDED.metadata;

INSERT INTO platform_settings (key, value, description)
VALUES
  ('membership_fee_block_without_settlement', 'true'::jsonb, 'Block withdrawals when a membership fee invoice remains unpaid'),
  ('membership_fee_enforce_from_withdrawal_count', '2'::jsonb, 'Withdrawal count from which fee settlement enforcement begins')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;
