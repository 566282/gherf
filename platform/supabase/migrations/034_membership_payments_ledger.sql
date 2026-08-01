-- 034_membership_payments_ledger.sql
-- Persist membership plan changes as Supabase-backed payment/ledger events.

CREATE TABLE IF NOT EXISTS membership_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level_tier INTEGER NOT NULL CHECK (level_tier >= 1),
  level_label TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL DEFAULT 'membership_plan_update',
  reference_id TEXT,
  note TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_payments_user_created
  ON membership_payments(user_id, created_at DESC);

CREATE TRIGGER membership_payments_updated_at BEFORE UPDATE ON membership_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE membership_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_payments_admin_read ON membership_payments;
CREATE POLICY membership_payments_admin_read ON membership_payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS membership_payments_admin_insert ON membership_payments;
CREATE POLICY membership_payments_admin_insert ON membership_payments
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_payments_admin_update ON membership_payments;
CREATE POLICY membership_payments_admin_update ON membership_payments
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS membership_payments_admin_delete ON membership_payments;
CREATE POLICY membership_payments_admin_delete ON membership_payments
  FOR DELETE USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.record_member_plan_change(
  p_user_id UUID,
  p_level_tier INTEGER,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'USD',
  p_source TEXT DEFAULT 'membership_plan_update',
  p_reference_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_tier INTEGER := GREATEST(1, LEAST(3, COALESCE(p_level_tier, 1)));
  resolved_label TEXT;
  payment_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'You can only change your own membership plan';
  END IF;

  resolved_label := CASE
    WHEN resolved_tier >= 3 THEN 'Premium'
    WHEN resolved_tier >= 2 THEN 'Balanced'
    ELSE 'Starter'
  END;

  UPDATE profiles
  SET level_tier = resolved_tier,
      level_label = resolved_label,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  INSERT INTO membership_payments (
    user_id,
    level_tier,
    level_label,
    amount,
    currency,
    source,
    reference_id,
    note,
    recorded_by
  ) VALUES (
    p_user_id,
    resolved_tier,
    resolved_label,
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_currency, ''), 'USD'),
    COALESCE(NULLIF(p_source, ''), 'membership_plan_update'),
    NULLIF(p_reference_id, ''),
    NULLIF(p_note, ''),
    CASE WHEN public.is_super_admin() THEN auth.uid() ELSE auth.uid() END
  )
  RETURNING id INTO payment_id;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'levelTier', resolved_tier,
    'levelLabel', resolved_label,
    'paymentId', payment_id,
    'amount', COALESCE(p_amount, 0),
    'currency', COALESCE(NULLIF(p_currency, ''), 'USD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_member_plan_change(UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_member_plan_change(UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
