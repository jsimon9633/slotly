-- Add per-team round-robin toggle to team_memberships
-- When false, the member is still in the team but excluded from round-robin scheduling
ALTER TABLE team_memberships
ADD COLUMN IF NOT EXISTS in_round_robin BOOLEAN NOT NULL DEFAULT true;
