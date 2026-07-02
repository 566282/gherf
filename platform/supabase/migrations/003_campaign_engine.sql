-- 003_campaign_engine.sql
-- Adds JSON-backed campaign engine fields so admins can edit campaign behavior without code changes.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'custom_tasks',
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS engine_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);
