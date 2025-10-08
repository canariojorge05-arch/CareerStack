-- Migration: add ephemeral resume fields and indexes
-- Adds ephemeral deletion semantics for short-lived resumes

ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "ephemeral" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "session_id" varchar,
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp;

-- Helpful indexes for fast cleanup
CREATE INDEX IF NOT EXISTS "idx_resumes_user_ephemeral" ON "resumes" ("user_id", "ephemeral");
CREATE INDEX IF NOT EXISTS "idx_resumes_expires_at" ON "resumes" ("expires_at");
