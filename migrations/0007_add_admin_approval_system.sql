-- Migration: Add Admin Approval System
-- Date: 2025-10-14
-- Purpose: Add approval status and workflow for new user registrations

-- Add approval status columns to users table
ALTER TABLE "users" 
ADD COLUMN "approval_status" varchar NOT NULL DEFAULT 'approved',
ADD COLUMN "approved_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN "approved_at" timestamp,
ADD COLUMN "rejected_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN "rejected_at" timestamp,
ADD COLUMN "rejection_reason" text;

-- Set all existing users to 'approved' status (they're already using the system)
UPDATE "users" 
SET "approval_status" = 'approved', 
    "approved_at" = "created_at"
WHERE "approval_status" = 'approved';

-- Create index for faster queries on approval status
CREATE INDEX IF NOT EXISTS "idx_users_approval_status" ON "users" ("approval_status");
CREATE INDEX IF NOT EXISTS "idx_users_approved_by" ON "users" ("approved_by");

-- Log the migration
DO $$
DECLARE
    total_users INTEGER;
    approved_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM "users";
    SELECT COUNT(*) INTO approved_users FROM "users" WHERE "approval_status" = 'approved';
    
    RAISE NOTICE 'Admin Approval System Migration completed:';
    RAISE NOTICE '  - Total users: %', total_users;
    RAISE NOTICE '  - Auto-approved existing users: %', approved_users;
    RAISE NOTICE '  - New registrations will require admin approval';
END $$;
