-- Migration: Update existing users with role and assign admin
-- Date: 2025-10-14
-- Purpose: Assign roles to existing users and set admin for specified email

-- Set default role for all existing users that don't have a role
UPDATE "users" 
SET "role" = 'user' 
WHERE "role" IS NULL OR "role" = '';

-- Assign admin role to the specified admin email
UPDATE "users"
SET "role" = 'admin'
WHERE "email" = '12shivamtiwari219@gmail.com';

-- Add index on role column for faster queries
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");

-- Log the role assignments
DO $$
DECLARE
    user_count INTEGER;
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM "users" WHERE "role" = 'user';
    SELECT COUNT(*) INTO admin_count FROM "users" WHERE "role" = 'admin';
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '  - Users with "user" role: %', user_count;
    RAISE NOTICE '  - Users with "admin" role: %', admin_count;
END $$;
