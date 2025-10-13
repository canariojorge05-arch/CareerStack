-- Next Step Comments Migration
-- Create a separate table for next step comments to support threaded comments

CREATE TABLE IF NOT EXISTS "next_step_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"requirement_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "next_step_comments" ADD CONSTRAINT "next_step_comments_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE cascade;
ALTER TABLE "next_step_comments" ADD CONSTRAINT "next_step_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade;

-- Create indexes for performance
CREATE INDEX "idx_next_step_comments_requirement_id" ON "next_step_comments" ("requirement_id");
CREATE INDEX "idx_next_step_comments_created_by" ON "next_step_comments" ("created_by");
CREATE INDEX "idx_next_step_comments_created_at" ON "next_step_comments" ("created_at");

-- Migrate existing next_step data to the new comments table
-- Only migrate non-null and non-empty next_step values
INSERT INTO "next_step_comments" ("requirement_id", "comment", "created_by", "created_at", "updated_at")
SELECT 
    "id" as requirement_id,
    "next_step" as comment,
    "created_by",
    "created_at",
    "updated_at"
FROM "requirements" 
WHERE "next_step" IS NOT NULL AND TRIM("next_step") != '';

-- Keep the original next_step column for backward compatibility
-- We'll deprecate it gradually in future versions
-- ALTER TABLE "requirements" DROP COLUMN "next_step";
