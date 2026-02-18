-- Create invite_tokens table (admin generates these to send invite links)
CREATE TABLE invite_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'admin',
  used_by_email TEXT,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);

-- Create join_requests table for onboarding flow
CREATE TABLE join_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL REFERENCES invite_tokens(token),
  calendar_shared BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for admin dashboard queries
CREATE INDEX idx_join_requests_status ON join_requests(status, created_at DESC);

-- Unique constraint on email to prevent duplicate requests
CREATE UNIQUE INDEX idx_join_requests_email ON join_requests(email);
