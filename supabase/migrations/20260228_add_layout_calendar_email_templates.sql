-- Migration: Add team display settings + email templates table
-- Date: 2026-02-28
-- Features: Two-panel layout toggle, month calendar toggle, custom email templates

-- 1. Add display settings to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS layout_style TEXT NOT NULL DEFAULT 'single'
  CHECK (layout_style IN ('single', 'two-panel'));

ALTER TABLE teams ADD COLUMN IF NOT EXISTS calendar_style TEXT NOT NULL DEFAULT 'strip'
  CHECK (calendar_style IN ('strip', 'month'));

-- 2. Create email_templates table (one custom override per email type)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE CHECK (template_type IN (
    'booking_confirmation',
    'team_member_alert',
    'cancellation',
    'reschedule',
    'reminder'
  )),
  subject TEXT,
  body_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by active template type
CREATE INDEX IF NOT EXISTS idx_email_templates_type
  ON email_templates (template_type) WHERE is_active = true;
