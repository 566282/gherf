-- 008_campaign_catalog.sql
-- Adds database-backed campaign type/category catalogs and missing campaign builder fields.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_url TEXT,
  ADD COLUMN IF NOT EXISTS age_restriction_min INTEGER,
  ADD COLUMN IF NOT EXISTS age_restriction_max INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_config JSONB NOT NULL DEFAULT '{"enabled":false,"frequency":"weekly","interval":1,"daysOfWeek":[],"timezone":"UTC","endsAt":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS campaign_categories TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS campaign_type_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  default_instructions TEXT,
  default_verification_method TEXT NOT NULL DEFAULT 'manual_review',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_type_definitions_active_sort
  ON campaign_type_definitions(is_active, sort_order, label);

CREATE INDEX IF NOT EXISTS idx_campaign_categories_active_sort
  ON campaign_categories(is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_image_url ON campaigns(campaign_image_url);
CREATE INDEX IF NOT EXISTS idx_campaigns_landing_url ON campaigns(landing_url);
CREATE INDEX IF NOT EXISTS idx_campaigns_video_url ON campaigns(video_url);

ALTER TABLE campaign_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_type_definitions_select_authenticated ON campaign_type_definitions;
CREATE POLICY campaign_type_definitions_select_authenticated ON campaign_type_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS campaign_type_definitions_manage_admin ON campaign_type_definitions;
CREATE POLICY campaign_type_definitions_manage_admin ON campaign_type_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'campaign_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'campaign_manager')
    )
  );

DROP POLICY IF EXISTS campaign_categories_select_authenticated ON campaign_categories;
CREATE POLICY campaign_categories_select_authenticated ON campaign_categories
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS campaign_categories_manage_admin ON campaign_categories;
CREATE POLICY campaign_categories_manage_admin ON campaign_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'campaign_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'campaign_manager')
    )
  );

CREATE TRIGGER campaign_type_definitions_updated_at BEFORE UPDATE ON campaign_type_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER campaign_categories_updated_at BEFORE UPDATE ON campaign_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO campaign_type_definitions (slug, label, description, default_instructions, default_verification_method, is_system, sort_order)
VALUES
  ('watch_videos', 'Watch videos', 'Reward completed video views with configurable verification and cooldowns.', 'Watch the full video until the completion threshold is met.', 'video_proof', TRUE, 10),
  ('click_advertisements', 'Click advertisements', 'Run click-through campaigns with device and browser restrictions.', 'Open the advertisement and keep it visible for the required delay.', 'link_validation', TRUE, 20),
  ('visit_websites', 'Visit websites', 'Track traffic, dwell time, and proof of page visits.', 'Visit the target page and stay on it for the instructed delay.', 'timer_verification', TRUE, 30),
  ('read_articles', 'Read articles', 'Measure article engagement and reading completion.', 'Read the article completely before submitting proof.', 'timer_verification', TRUE, 40),
  ('install_mobile_apps', 'Install mobile apps', 'Require app installs, launches, and optional screenshot proof.', 'Install the app, launch it once, and attach proof if requested.', 'screenshot_upload', TRUE, 50),
  ('register_accounts', 'Register accounts', 'Support sign-up campaigns with manual or automated verification.', 'Register an account using the provided partner flow.', 'automatic_verification', TRUE, 60),
  ('complete_surveys', 'Complete surveys', 'Collect survey responses with completion and quality thresholds.', 'Answer all survey questions honestly and submit the final page.', 'manual_review', TRUE, 70),
  ('social_media_follows', 'Social media follows', 'Reward follows across social networks with proof requirements.', 'Follow the requested social profile and provide proof of completion.', 'screenshot_upload', TRUE, 80),
  ('social_media_likes', 'Social media likes', 'Track likes on posts and social updates.', 'Like the target post and submit the resulting proof.', 'screenshot_upload', TRUE, 90),
  ('comments', 'Comments', 'Collect written comments and validate message quality.', 'Leave a relevant comment that matches the campaign rules.', 'manual_review', TRUE, 100),
  ('shares', 'Shares', 'Reward content shares and reposts.', 'Share the provided content through the allowed network.', 'screenshot_upload', TRUE, 110),
  ('join_telegram', 'Join Telegram', 'Validate Telegram community joins with invite-based workflows.', 'Join the Telegram community and keep membership active.', 'random_audit', TRUE, 120),
  ('join_discord', 'Join Discord', 'Handle Discord membership, role checks, and proof uploads.', 'Join the Discord server and complete any role or verification steps.', 'manual_review', TRUE, 130),
  ('subscribe_to_youtube', 'Subscribe to YouTube', 'Track channel subscriptions and optional watch-time follow-up.', 'Subscribe to the requested channel and keep the subscription active.', 'screenshot_upload', TRUE, 140),
  ('download_files', 'Download files', 'Control file downloads with proof and cooldown windows.', 'Download the file from the approved source and confirm completion.', 'link_validation', TRUE, 150),
  ('daily_tasks', 'Daily tasks', 'Repeatable tasks with daily caps and cooldown control.', 'Complete the task once per day within the allowed window.', 'manual_review', TRUE, 160),
  ('weekly_challenges', 'Weekly challenges', 'Recurring weekly missions with flexible proof and reward pacing.', 'Finish the weekly challenge before the deadline expires.', 'random_audit', TRUE, 170),
  ('seasonal_campaigns', 'Seasonal campaigns', 'Campaigns tied to limited seasonal windows and special rewards.', 'Complete the seasonal task before the active window ends.', 'random_audit', TRUE, 180),
  ('referral_campaigns', 'Referral campaigns', 'Reward successful referrals and downstream conversions.', 'Invite eligible users and confirm the referral criteria.', 'api_verification', TRUE, 190),
  ('custom_tasks', 'Custom tasks', 'Free-form campaigns for any workflow not covered by a preset.', 'Follow the custom instructions exactly as written by the admin.', 'manual_review', TRUE, 200)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO campaign_categories (slug, name, description, is_system, sort_order)
VALUES
  ('acquisition', 'Acquisition', 'User acquisition and top-of-funnel growth campaigns.', TRUE, 10),
  ('activation', 'Activation', 'First-time user activation and onboarding journeys.', TRUE, 20),
  ('engagement', 'Engagement', 'Retention and engagement boosting campaigns.', TRUE, 30),
  ('referrals', 'Referrals', 'Invite and referral-driven campaigns.', TRUE, 40),
  ('social', 'Social', 'Social network interaction campaigns.', TRUE, 50),
  ('content', 'Content', 'Video, article, and media consumption campaigns.', TRUE, 60),
  ('surveys', 'Surveys', 'Feedback and survey completion campaigns.', TRUE, 70),
  ('seasonal', 'Seasonal', 'Limited-time and event-based campaigns.', TRUE, 80)
ON CONFLICT (slug) DO NOTHING;