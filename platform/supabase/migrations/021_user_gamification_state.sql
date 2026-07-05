-- 021_user_gamification_state.sql
-- Per-user gamification progress persisted in Supabase instead of browser storage.

CREATE TABLE IF NOT EXISTS user_gamification_state (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_gamification_state_updated_at ON user_gamification_state(updated_at DESC);

ALTER TABLE user_gamification_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_gamification_state_select_owner_or_admin ON user_gamification_state;
CREATE POLICY user_gamification_state_select_owner_or_admin ON user_gamification_state
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS user_gamification_state_insert_owner_or_admin ON user_gamification_state;
CREATE POLICY user_gamification_state_insert_owner_or_admin ON user_gamification_state
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS user_gamification_state_update_owner_or_admin ON user_gamification_state;
CREATE POLICY user_gamification_state_update_owner_or_admin ON user_gamification_state
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

CREATE TRIGGER user_gamification_state_updated_at BEFORE UPDATE ON user_gamification_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at();