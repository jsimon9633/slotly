-- ================================================================
-- Migration: No-Show Prediction + Smart Scheduling
-- Date: 2026-02-19
-- ================================================================

-- 1. Add no_show status to bookings
-- (status already supports confirmed/cancelled/completed — add no_show)
-- No enum change needed since we use text column, but ensure consistency:
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS no_show_score integer,
  ADD COLUMN IF NOT EXISTS risk_tier text CHECK (risk_tier IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IN ('completed', 'no_show', 'cancelled')),
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz;

-- 2. Add index for the reminder cron job
-- (find confirmed bookings in a time window that haven't been reminded)
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending
  ON bookings (start_time, status)
  WHERE reminder_sent_at IS NULL AND status = 'confirmed';

-- 3. Add index for repeat booker lookup
CREATE INDEX IF NOT EXISTS idx_bookings_invitee_email
  ON bookings (invitee_email);

-- 4. Add index for smart scheduling aggregation
-- (query bookings by start_time hour for heatmap)
CREATE INDEX IF NOT EXISTS idx_bookings_created_status
  ON bookings (created_at, status);

-- 5. Add invitee_phone column if not exists
-- (may already exist from earlier migration)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS invitee_phone text;

-- 6. Allow 'no_show' in status column
-- (If using a CHECK constraint, update it; if text, no change needed)
-- Most Supabase setups use text with no constraint, but just in case:
DO $$
BEGIN
  -- Drop old constraint if it exists, then re-add with no_show
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    BEGIN
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    EXCEPTION WHEN undefined_object THEN
      NULL; -- no constraint to drop
    END;
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show'));
  END IF;
END $$;

-- Done!
-- After running: verify with:
--   SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings';
