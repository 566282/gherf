-- 030_event_tracking_campaign_engine.sql
-- Idempotent external events and deterministic event-to-task fulfillment.

CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_name TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS campaign_event_task_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES campaign_tasks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, provider, event_name)
);

CREATE TABLE IF NOT EXISTS campaign_event_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES campaign_events(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES campaign_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'fulfilled' CHECK (status IN ('fulfilled', 'suppressed', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_occurred ON campaign_events(campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_external_actor ON campaign_events(actor_user_id, provider, event_name);
CREATE INDEX IF NOT EXISTS idx_campaign_event_mappings_lookup ON campaign_event_task_mappings(campaign_id, provider, event_name) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_event_completions_user_task ON campaign_event_completions(user_id, task_id, created_at DESC);

ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_event_task_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_event_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_events_owner_or_admin_read ON campaign_events FOR SELECT USING (
  actor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'campaign_manager', 'advertiser'))
);
CREATE POLICY campaign_event_mappings_admin_manage ON campaign_event_task_mappings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'campaign_manager', 'advertiser'))
);
CREATE POLICY campaign_event_completions_owner_or_admin_read ON campaign_event_completions FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'campaign_manager', 'advertiser'))
);
