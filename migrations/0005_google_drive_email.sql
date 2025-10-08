-- Migration: Add google_drive_email to users

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_drive_email VARCHAR;

CREATE INDEX IF NOT EXISTS idx_users_google_drive_email ON users(google_drive_email);
