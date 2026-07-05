-- 009_universal_task_engine.sql
-- Extends campaign tasks with flexible metadata so new task types can be added without code changes.

ALTER TABLE campaign_tasks
  ALTER COLUMN task_type TYPE TEXT USING task_type::text,
  ADD COLUMN IF NOT EXISTS task_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maximum_attempts INTEGER,
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'manual_review',
  ADD COLUMN IF NOT EXISTS fraud_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;