-- Migration: Meeting type tags + web search enrichment
-- Date: 2026-03-01
-- Features:
--   1. meeting_type tag on event_types (groups event types by meeting scenario)
--   2. Web search result columns on booking_enrichments

-- 1. Add meeting_type tag to event_types
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT NULL;

-- 2. Add web search columns to booking_enrichments
ALTER TABLE booking_enrichments ADD COLUMN IF NOT EXISTS web_search_result JSONB DEFAULT NULL;
ALTER TABLE booking_enrichments ADD COLUMN IF NOT EXISTS person_confidence TEXT DEFAULT NULL
  CHECK (person_confidence IN ('high', 'medium', 'low', 'none'));
