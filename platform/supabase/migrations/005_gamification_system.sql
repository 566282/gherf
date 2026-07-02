-- 005_gamification_system.sql
-- Phase 8 gamification, progression, and leaderboard support.

CREATE TABLE IF NOT EXISTS gamification_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_key TEXT NOT NULL UNIQUE,
  module_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cadence TEXT NOT NULL,
  reward_label TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gamification_user_state (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level_tier INTEGER NOT NULL DEFAULT 1,
  streak_count INTEGER NOT NULL DEFAULT 0,
  season_points INTEGER NOT NULL DEFAULT 0,
  wheel_spins_remaining INTEGER NOT NULL DEFAULT 0,
  mystery_rewards_available INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  daily_login_claimed_at TIMESTAMPTZ,
  season_name TEXT NOT NULL DEFAULT 'Season of Momentum',
  season_theme TEXT NOT NULL DEFAULT 'Daily wins and long-term progression',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gamification_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES gamification_modules(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress',
  unlocked_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS gamification_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gamification_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  streak_count INTEGER NOT NULL DEFAULT 0,
  level_tier INTEGER NOT NULL DEFAULT 1,
  badge_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_name, snapshot_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gamification_modules_module_type ON gamification_modules(module_type);
CREATE INDEX IF NOT EXISTS idx_gamification_modules_is_active ON gamification_modules(is_active);
CREATE INDEX IF NOT EXISTS idx_gamification_progress_user_id ON gamification_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_progress_module_id ON gamification_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_gamification_activity_log_user_id_created_at ON gamification_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_leaderboard_snapshots_season_date_rank ON gamification_leaderboard_snapshots(season_name, snapshot_date, rank);

ALTER TABLE gamification_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gamification_modules_select_authenticated ON gamification_modules;
CREATE POLICY gamification_modules_select_authenticated ON gamification_modules
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS gamification_modules_manage_super_admin ON gamification_modules;
CREATE POLICY gamification_modules_manage_super_admin ON gamification_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_user_state_select_own ON gamification_user_state;
CREATE POLICY gamification_user_state_select_own ON gamification_user_state
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_user_state_insert_own ON gamification_user_state;
CREATE POLICY gamification_user_state_insert_own ON gamification_user_state
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_user_state_update_own ON gamification_user_state;
CREATE POLICY gamification_user_state_update_own ON gamification_user_state
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_progress_select_own ON gamification_progress;
CREATE POLICY gamification_progress_select_own ON gamification_progress
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_progress_insert_own ON gamification_progress;
CREATE POLICY gamification_progress_insert_own ON gamification_progress
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_progress_update_own ON gamification_progress;
CREATE POLICY gamification_progress_update_own ON gamification_progress
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_activity_log_select_own ON gamification_activity_log;
CREATE POLICY gamification_activity_log_select_own ON gamification_activity_log
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_activity_log_insert_own ON gamification_activity_log;
CREATE POLICY gamification_activity_log_insert_own ON gamification_activity_log
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS gamification_leaderboard_snapshots_select_authenticated ON gamification_leaderboard_snapshots;
CREATE POLICY gamification_leaderboard_snapshots_select_authenticated ON gamification_leaderboard_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS gamification_leaderboard_snapshots_manage_super_admin ON gamification_leaderboard_snapshots;
CREATE POLICY gamification_leaderboard_snapshots_manage_super_admin ON gamification_leaderboard_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

CREATE TRIGGER gamification_modules_updated_at BEFORE UPDATE ON gamification_modules
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER gamification_user_state_updated_at BEFORE UPDATE ON gamification_user_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER gamification_progress_updated_at BEFORE UPDATE ON gamification_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO gamification_modules (module_key, module_type, title, description, cadence, reward_label, xp_reward, config)
VALUES
  ('dailyLogin', 'daily_login', 'Daily login', 'Reward the first app open of the day and keep sessions returning consistently.', 'Daily', 'Daily bonus', 20, '{"enabled":true}'::jsonb),
  ('streaks', 'streaks', 'Streaks', 'Increase rewards and protection when users keep their streak alive.', 'Rolling week', 'Streak bonus', 12, '{"enabled":true}'::jsonb),
  ('achievements', 'achievements', 'Achievements', 'Unlock milestones for behavior depth, consistency, and referral quality.', 'Event driven', 'Milestone reward', 80, '{"enabled":true}'::jsonb),
  ('xpLevels', 'xp_levels', 'XP and levels', 'Convert every engagement action into a measurable progression track.', 'Always on', 'Progress XP', 25, '{"enabled":true}'::jsonb),
  ('leaderboards', 'leaderboards', 'Leaderboards', 'Show top users by XP, streak, mission completion, and seasonal points.', 'Weekly reset', 'Ranking boost', 30, '{"enabled":true}'::jsonb),
  ('luckyWheel', 'lucky_wheel', 'Lucky wheel', 'Offer chance-based bonuses with capped daily spins and controlled odds.', 'Daily spins', 'Wheel spin', 10, '{"enabled":true}'::jsonb),
  ('mysteryRewards', 'mystery_rewards', 'Mystery rewards', 'Drop surprise rewards for surprise-and-delight loops and retention nudges.', 'Triggered', 'Mystery gift', 45, '{"enabled":true}'::jsonb),
  ('spinBonuses', 'spin_bonuses', 'Spin bonuses', 'Award extra spins after achievements, referrals, and mission streaks.', 'Triggered', 'Bonus spin', 18, '{"enabled":true}'::jsonb),
  ('missions', 'missions', 'Missions', 'Bundle multi-step objectives around app usage, referrals, and campaign actions.', 'Weekly', 'Mission reward', 60, '{"enabled":true}'::jsonb),
  ('seasonalEvents', 'seasonal_events', 'Seasonal events', 'Run themed campaigns with countdown windows, boosted XP, and event prizes.', 'Seasonal', 'Event prize', 100, '{"enabled":true}'::jsonb),
  ('dailyQuests', 'daily_quests', 'Daily quests', 'Give short, repeatable tasks that reset every day and keep engagement active.', 'Daily reset', 'Quest reward', 15, '{"enabled":true}'::jsonb)
ON CONFLICT (module_key) DO UPDATE
  SET module_type = EXCLUDED.module_type,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      cadence = EXCLUDED.cadence,
      reward_label = EXCLUDED.reward_label,
      xp_reward = EXCLUDED.xp_reward,
      config = EXCLUDED.config,
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP;
