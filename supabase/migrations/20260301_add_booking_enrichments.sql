-- AI Meeting Prep: booking enrichment pipeline
-- Stores signal analysis and Claude AI synthesis for each booking

CREATE TABLE IF NOT EXISTS booking_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Signal analysis (zero-cost)
  email_analysis JSONB,
  phone_analysis JSONB,
  behavior_signals JSONB,
  keyword_signals JSONB,
  tier1_score INTEGER,

  -- Claude AI synthesis
  ai_summary TEXT,
  ai_qualification_score INTEGER,
  ai_talking_points JSONB,
  ai_risk_flags JSONB,
  ai_recommended_approach TEXT,
  ai_model TEXT,
  ai_tokens_used INTEGER,

  -- Web search / person intel
  web_search_result JSONB,
  person_confidence TEXT,

  -- Meta
  enrichment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending','processing','completed','failed')),
  total_cost_cents INTEGER DEFAULT 0,
  error_message TEXT,
  prep_email_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One enrichment per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_enrichments_booking
  ON booking_enrichments(booking_id);

-- Find pending/processing enrichments for cron retry
CREATE INDEX IF NOT EXISTS idx_booking_enrichments_status
  ON booking_enrichments(enrichment_status)
  WHERE enrichment_status IN ('pending','processing');

-- Quick enrichment status check on bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT NULL;
