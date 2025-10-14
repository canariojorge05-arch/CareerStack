-- Migration: Add Login Tracking and History
-- Date: 2025-10-14
-- Purpose: Track user login locations, devices, and detect suspicious activity

-- Create login_history table
CREATE TABLE IF NOT EXISTS "login_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  
  -- Login status
  "status" varchar NOT NULL,
  "failure_reason" varchar,
  
  -- IP and Geolocation
  "ip_address" varchar NOT NULL,
  "city" varchar,
  "region" varchar,
  "country" varchar,
  "country_code" varchar,
  "timezone" varchar,
  "isp" varchar,
  "latitude" varchar,
  "longitude" varchar,
  
  -- Device Information
  "user_agent" text,
  "browser" varchar,
  "browser_version" varchar,
  "os" varchar,
  "os_version" varchar,
  "device_type" varchar,
  "device_vendor" varchar,
  
  -- Security flags
  "is_suspicious" boolean DEFAULT false,
  "suspicious_reasons" text[],
  "is_new_location" boolean DEFAULT false,
  "is_new_device" boolean DEFAULT false,
  
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "idx_login_history_user_id" ON "login_history" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_login_history_status" ON "login_history" ("status");
CREATE INDEX IF NOT EXISTS "idx_login_history_created_at" ON "login_history" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_login_history_ip_address" ON "login_history" ("ip_address");
CREATE INDEX IF NOT EXISTS "idx_login_history_suspicious" ON "login_history" ("is_suspicious");

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Login Tracking System Migration completed:';
    RAISE NOTICE '  - login_history table created';
    RAISE NOTICE '  - All login attempts will now be tracked';
    RAISE NOTICE '  - Geolocation and device info will be captured';
    RAISE NOTICE '  - Suspicious activity detection enabled';
END $$;
