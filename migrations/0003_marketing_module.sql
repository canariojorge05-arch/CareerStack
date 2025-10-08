-- Marketing Module Migration
-- Add role field to users table for role-based access control

ALTER TABLE "users" ADD COLUMN "role" varchar DEFAULT 'user'; -- user, marketing, admin
UPDATE "users" SET "role" = 'user' WHERE "role" IS NULL;

-- Create consultants table
CREATE TABLE IF NOT EXISTS "consultants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL UNIQUE,
	"phone" varchar,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"experience" integer,
	"status" varchar DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create requirements table
CREATE TABLE IF NOT EXISTS "requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"status" varchar DEFAULT 'New' NOT NULL,
	"assigned_to" varchar,
	"next_step" text,
	"applied_for" varchar DEFAULT 'Rahul' NOT NULL,
	"rate" text,
	"remote" text,
	"duration" text,
	"marketing_comments" jsonb DEFAULT '[]' NOT NULL,
	"client_company" varchar,
	"imp_name" varchar,
	"client_website" varchar,
	"imp_website" varchar,
	"vendor_company" varchar,
	"vendor_website" varchar,
	"vendor_person_name" varchar,
	"vendor_phone" varchar,
	"vendor_email" varchar,
	"requirement_entered_date" timestamp DEFAULT now(),
	"got_requirement" timestamp,
	"job_title" varchar,
	"primary_tech_stack" varchar,
	"complete_job_description" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create interviews table
CREATE TABLE IF NOT EXISTS "interviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"requirement_id" varchar NOT NULL,
	"interview_date" timestamp,
	"interview_time" varchar,
	"timezone" varchar DEFAULT 'EST' NOT NULL,
	"interview_type" varchar,
	"status" varchar DEFAULT 'Confirmed' NOT NULL,
	"consultant_id" varchar,
	"marketing_person_id" varchar,
	"vendor_company" varchar,
	"interview_with" varchar,
	"result" varchar,
	"round" varchar,
	"mode" varchar,
	"meeting_type" varchar,
	"duration" varchar,
	"subject_line" text,
	"interviewer" text,
	"interview_link" text,
	"interview_focus" varchar,
	"special_note" text,
	"job_description" text,
	"feedback_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create email_threads table
CREATE TABLE IF NOT EXISTS "email_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject" varchar NOT NULL,
	"participant_emails" text[] NOT NULL,
	"last_message_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create email_messages table
CREATE TABLE IF NOT EXISTS "email_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"thread_id" varchar NOT NULL,
	"from_email" varchar NOT NULL,
	"to_emails" text[] NOT NULL,
	"cc_emails" text[] DEFAULT '{}' NOT NULL,
	"bcc_emails" text[] DEFAULT '{}' NOT NULL,
	"subject" varchar NOT NULL,
	"html_body" text,
	"text_body" text,
	"message_type" varchar DEFAULT 'received' NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_starred" boolean DEFAULT false,
	"is_important" boolean DEFAULT false,
	"sent_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create email_attachments table
CREATE TABLE IF NOT EXISTS "email_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"message_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar,
	"file_content" text,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_assigned_to_consultants_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "consultants"("id") ON DELETE set null;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "interviews" ADD CONSTRAINT "interviews_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE cascade;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE set null;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_marketing_person_id_users_id_fk" FOREIGN KEY ("marketing_person_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE cascade;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE cascade;

-- Create indexes for performance
CREATE INDEX "idx_consultants_email" ON "consultants" ("email");
CREATE INDEX "idx_consultants_status" ON "consultants" ("status");

CREATE INDEX "idx_requirements_status" ON "requirements" ("status");
CREATE INDEX "idx_requirements_assigned_to" ON "requirements" ("assigned_to");
CREATE INDEX "idx_requirements_created_by" ON "requirements" ("created_by");
CREATE INDEX "idx_requirements_created_at" ON "requirements" ("created_at");

CREATE INDEX "idx_interviews_requirement_id" ON "interviews" ("requirement_id");
CREATE INDEX "idx_interviews_consultant_id" ON "interviews" ("consultant_id");
CREATE INDEX "idx_interviews_status" ON "interviews" ("status");
CREATE INDEX "idx_interviews_date" ON "interviews" ("interview_date");

CREATE INDEX "idx_email_threads_created_by" ON "email_threads" ("created_by");
CREATE INDEX "idx_email_threads_last_message" ON "email_threads" ("last_message_at");

CREATE INDEX "idx_email_messages_thread_id" ON "email_messages" ("thread_id");
CREATE INDEX "idx_email_messages_from_email" ON "email_messages" ("from_email");
CREATE INDEX "idx_email_messages_message_type" ON "email_messages" ("message_type");
CREATE INDEX "idx_email_messages_sent_at" ON "email_messages" ("sent_at");

CREATE INDEX "idx_email_attachments_message_id" ON "email_attachments" ("message_id");