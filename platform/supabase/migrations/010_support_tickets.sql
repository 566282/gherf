-- 010_support_tickets.sql
-- Support ticket storage for user help requests and admin review

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  body TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'waiting_on_you', 'resolved', 'closed')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated_at ON support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated_at ON support_tickets(status, updated_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_own ON support_tickets;
CREATE POLICY support_tickets_select_own ON support_tickets
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS support_tickets_insert_own ON support_tickets;
CREATE POLICY support_tickets_insert_own ON support_tickets
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS support_tickets_update_super_admin ON support_tickets;
CREATE POLICY support_tickets_update_super_admin ON support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
