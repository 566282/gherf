-- 014_fraud_detection_audit.sql
-- Fraud detection policy audit trail and admin action insert policy.

DROP POLICY IF EXISTS admin_action_audit_insert_super_admin ON admin_action_audit;
CREATE POLICY admin_action_audit_insert_super_admin ON admin_action_audit
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.log_fraud_detection_policy_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'fraud_detection_policy' THEN
    INSERT INTO admin_action_audit (
      admin_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      reason
    )
    VALUES (
      COALESCE(NEW.updated_by, auth.uid()),
      CASE WHEN TG_OP = 'INSERT' THEN 'create_fraud_detection_policy' ELSE 'update_fraud_detection_policy' END,
      'fraud_detection_policy',
      NEW.key,
      CASE
        WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
          'key', OLD.key,
          'value', OLD.value,
          'description', OLD.description,
          'updated_by', OLD.updated_by,
          'updated_at', OLD.updated_at
        )
        ELSE NULL
      END,
      jsonb_build_object(
        'key', NEW.key,
        'value', NEW.value,
        'description', NEW.description,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at
      ),
      'Fraud detection policy changed from admin console'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_fraud_detection_policy_change ON platform_settings;
CREATE TRIGGER trg_log_fraud_detection_policy_change
AFTER INSERT OR UPDATE ON platform_settings
FOR EACH ROW
WHEN (NEW.key = 'fraud_detection_policy')
EXECUTE FUNCTION public.log_fraud_detection_policy_change();