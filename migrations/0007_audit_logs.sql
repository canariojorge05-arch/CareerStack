-- Add audit logs table for compliance and security tracking
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" varchar NOT NULL,
  "entity_type" varchar NOT NULL,
  "entity_id" varchar NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "ip_address" varchar,
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at");

-- Comment on table
COMMENT ON TABLE "audit_logs" IS 'Audit trail for all data modifications in the system';
COMMENT ON COLUMN "audit_logs"."action" IS 'Type of action: CREATE, UPDATE, DELETE, VIEW';
COMMENT ON COLUMN "audit_logs"."entity_type" IS 'Type of entity: requirement, consultant, interview, etc.';
COMMENT ON COLUMN "audit_logs"."old_value" IS 'Previous value before modification (for UPDATE and DELETE)';
COMMENT ON COLUMN "audit_logs"."new_value" IS 'New value after modification (for CREATE and UPDATE)';
