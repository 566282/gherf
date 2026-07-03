-- 006_communication_system.sql
-- Phase 9 communication system for internal messaging, live announcements, and promotional notifications.

ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS is_promotional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_notifications_category_created_at
  ON user_notifications(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_promotional
  ON user_notifications(is_promotional, created_at DESC);

DROP POLICY IF EXISTS user_notifications_insert_super_admin ON user_notifications;
CREATE POLICY user_notifications_insert_super_admin ON user_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  push_title TEXT,
  push_body TEXT,
  sms_body TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT NOT NULL REFERENCES communication_templates(key) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  audience_scope TEXT NOT NULL DEFAULT 'all_users',
  audience_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communication_campaigns_status_created_at
  ON communication_campaigns(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_campaigns_category_created_at
  ON communication_campaigns(category, created_at DESC);

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_templates_select_authenticated ON communication_templates;
CREATE POLICY communication_templates_select_authenticated ON communication_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS communication_templates_manage_super_admin ON communication_templates;
CREATE POLICY communication_templates_manage_super_admin ON communication_templates
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

DROP POLICY IF EXISTS communication_campaigns_select_authenticated ON communication_campaigns;
CREATE POLICY communication_campaigns_select_authenticated ON communication_campaigns
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS communication_campaigns_manage_super_admin ON communication_campaigns;
CREATE POLICY communication_campaigns_manage_super_admin ON communication_campaigns
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

CREATE TRIGGER communication_templates_updated_at BEFORE UPDATE ON communication_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER communication_campaigns_updated_at BEFORE UPDATE ON communication_campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO communication_templates (key, name, description, channels, subject, body, push_title, push_body, sms_body, is_enabled, metadata)
VALUES
  (
    'internal_message',
    'Internal message',
    'Direct in-app messages from admins to selected users.',
    ARRAY['in_app']::TEXT[],
    'Message from support',
    'Hello {{full_name}},\n\n{{message_body}}\n\nRegards,\n{{sender_name}}',
    'New internal message',
    'You received a new message from the admin team.',
    'New internal message in your Campaign Reward inbox.',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  ),
  (
    'email_verification',
    'Email verification',
    'Transactional verification email copy.',
    ARRAY['email']::TEXT[],
    'Verify your account',
    'Hi {{full_name}},\n\nPlease verify your email to activate your account: {{verification_link}}',
    'Verify your account',
    'Finish account setup by verifying your email.',
    'Verify your account: {{verification_link}}',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  ),
  (
    'password_reset',
    'Password reset',
    'Recovery message sent when password reset is requested.',
    ARRAY['email','sms']::TEXT[],
    'Reset your password',
    'Hi {{full_name}},\n\nUse this secure link to reset your password: {{reset_link}}',
    'Password reset requested',
    'A password reset was requested for your account.',
    'Reset your password using this link: {{reset_link}}',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  ),
  (
    'reward_update',
    'Reward update',
    'Notifications for reward approvals and wallet changes.',
    ARRAY['in_app','email','push']::TEXT[],
    'Your reward was updated',
    'Hi {{full_name}},\n\nYour reward status changed to {{reward_status}}. Amount: {{amount}}.',
    'Reward update',
    'Your reward status changed to {{reward_status}}.',
    'Reward update: status {{reward_status}}, amount {{amount}}.',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  ),
  (
    'live_announcement',
    'Live announcement',
    'Urgent or time-sensitive announcements shown live in-app.',
    ARRAY['in_app','push']::TEXT[],
    'Live platform announcement',
    '{{announcement_title}}\n\n{{announcement_body}}',
    '{{announcement_title}}',
    '{{announcement_body}}',
    'Announcement: {{announcement_title}}',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  ),
  (
    'promotional_blast',
    'Promotional blast',
    'Marketing promotions and campaign incentives.',
    ARRAY['in_app','email','push','sms']::TEXT[],
    'New promotion is live',
    'Hi {{full_name}},\n\n{{promo_headline}}\n\n{{promo_body}}\n\nClaim now: {{cta_link}}',
    '{{promo_headline}}',
    '{{promo_body}}',
    '{{promo_headline}} - {{cta_link}}',
    TRUE,
    '{"phase":"phase_9"}'::jsonb
  )
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      channels = EXCLUDED.channels,
      subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      push_title = EXCLUDED.push_title,
      push_body = EXCLUDED.push_body,
      sms_body = EXCLUDED.sms_body,
      is_enabled = EXCLUDED.is_enabled,
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP;

INSERT INTO platform_settings (key, value, description)
VALUES
  (
    'communication_config',
    '{
      "timezone":"UTC",
      "quietHoursStart":"22:00",
      "quietHoursEnd":"07:00",
      "emailEnabled":true,
      "pushEnabled":true,
      "smsEnabled":false,
      "promotionalEnabled":true,
      "liveAnnouncementsEnabled":true
    }'::jsonb,
    'Phase 9 communication system controls and global channel settings'
  )
ON CONFLICT (key) DO UPDATE
  SET value = jsonb_strip_nulls(
        COALESCE(platform_settings.value, '{}'::jsonb) || EXCLUDED.value
      ),
      description = EXCLUDED.description,
      updated_at = CURRENT_TIMESTAMP;
