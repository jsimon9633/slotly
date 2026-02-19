-- Migration: Many-to-many relationship between teams and event types
-- Run this in Supabase SQL Editor

-- 1. Create join table
CREATE TABLE IF NOT EXISTS team_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, event_type_id)
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_event_types_team ON team_event_types(team_id);
CREATE INDEX IF NOT EXISTS idx_team_event_types_event ON team_event_types(event_type_id);

-- 3. Migrate existing team_id data into the join table
INSERT INTO team_event_types (team_id, event_type_id)
SELECT team_id, id
FROM event_types
WHERE team_id IS NOT NULL
ON CONFLICT (team_id, event_type_id) DO NOTHING;

-- 4. Enable RLS (match existing pattern)
ALTER TABLE team_event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on team_event_types"
ON team_event_types
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
