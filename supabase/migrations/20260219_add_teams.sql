-- ============================================
-- Teams & Team Memberships
-- ============================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_slug ON teams (slug) WHERE is_active = true;

-- Team memberships (many-to-many: team_members <-> teams)
CREATE TABLE IF NOT EXISTS team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, team_member_id)
);

CREATE INDEX idx_team_memberships_team ON team_memberships (team_id) WHERE is_active = true;
CREATE INDEX idx_team_memberships_member ON team_memberships (team_member_id) WHERE is_active = true;

-- Add team_id to event_types (nullable first for backfill, then NOT NULL)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
CREATE INDEX idx_event_types_team ON event_types (team_id) WHERE is_active = true;

-- ============================================
-- Backfill: seed a default team
-- ============================================

INSERT INTO teams (id, name, slug, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Team',
  'default',
  'Auto-created default team'
) ON CONFLICT (slug) DO NOTHING;

-- Assign all existing event_types to the default team
UPDATE event_types
SET team_id = '00000000-0000-0000-0000-000000000001'
WHERE team_id IS NULL;

-- Create memberships for all existing team_members
INSERT INTO team_memberships (team_id, team_member_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'member'
FROM team_members
ON CONFLICT (team_id, team_member_id) DO NOTHING;

-- Now make team_id NOT NULL
ALTER TABLE event_types ALTER COLUMN team_id SET NOT NULL;
