-- 009_admin_list_optimization.sql
-- Targeted index support for common admin profile list filters.

CREATE INDEX IF NOT EXISTS idx_profiles_role_updated_at_desc
  ON profiles(role, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_status_updated_at_desc
  ON profiles(status, updated_at DESC);
