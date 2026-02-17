-- Slotly Database Schema
-- Run this in Supabase SQL Editor to set up your tables

-- Team members (people who can be booked)
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  google_calendar_id TEXT NOT NULL, -- their Google Calendar ID (usually their email)
  is_active BOOLEAN DEFAULT true,
  last_booked_at TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z', -- for round-robin
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Event types (e.g., "15-min Intro", "30-min Call", "60-min Deep Dive")
CREATE TABLE event_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly name: "intro", "call", "deep-dive"
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  color TEXT DEFAULT '#2563EB', -- hex color for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id UUID REFERENCES event_types(id) NOT NULL,
  team_member_id UUID REFERENCES team_members(id) NOT NULL,

  -- Invitee info
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_notes TEXT,

  -- Scheduling
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  google_event_id TEXT, -- ID from Google Calendar

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Availability rules (working hours per team member)
CREATE TABLE availability_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_member_id UUID REFERENCES team_members(id) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon...
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN DEFAULT true,
  UNIQUE(team_member_id, day_of_week)
);

-- Indexes
CREATE INDEX idx_bookings_start ON bookings(start_time);
CREATE INDEX idx_bookings_team_member ON bookings(team_member_id);
CREATE INDEX idx_team_members_active ON team_members(is_active);
CREATE INDEX idx_event_types_slug ON event_types(slug);

-- Seed data: sample event types
INSERT INTO event_types (slug, title, description, duration_minutes, color) VALUES
  ('intro', '15-Min Intro Call', 'Quick introductory chat to see if we''re a fit.', 15, '#7C3AED'),
  ('call', '30-Min Strategy Call', 'Discuss your needs and how we can help.', 30, '#2563EB'),
  ('deep-dive', '60-Min Deep Dive', 'In-depth session to dig into specifics.', 60, '#059669');
