-- Migration: Add Google Drive OAuth token fields to users table
-- Adds nullable columns for access/refresh tokens, expiry timestamp, and a boolean flag

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS google_drive_connected BOOLEAN DEFAULT false;

-- Index for quicker lookups when checking connected users
CREATE INDEX IF NOT EXISTS idx_users_google_drive_connected ON users(google_drive_connected);
