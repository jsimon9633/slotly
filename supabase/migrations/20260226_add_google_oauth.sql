-- Migration: Add Google OAuth columns to team_members
-- Run this in Supabase SQL Editor

-- OAuth-related columns on team_members
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS google_oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_oauth_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_oauth_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_oauth_scopes TEXT,
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Make google_calendar_id nullable (OAuth callback sets it from userinfo)
ALTER TABLE team_members ALTER COLUMN google_calendar_id DROP NOT NULL;

-- Index for connection status lookups in admin panel
CREATE INDEX IF NOT EXISTS idx_team_members_oauth_status
  ON team_members (google_oauth_connected_at, google_oauth_revoked_at)
  WHERE is_active = true;

-- Re-auth tokens for Slack-sent reconnect links
CREATE TABLE IF NOT EXISTS reauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reauth_tokens_token
  ON reauth_tokens (token) WHERE is_used = false;

-- Slack config columns in site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_bot_token TEXT;
