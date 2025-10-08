CREATE TABLE "account_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"status" varchar NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"ip" varchar NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"blocked_until" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar,
	"file_content" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "email_rate_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar NOT NULL,
	"email" varchar NOT NULL,
	"ip" varchar NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"blocked_until" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_name" varchar,
	"device_type" varchar,
	"os" varchar,
	"browser" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"last_active" timestamp DEFAULT now(),
	"refresh_token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"geolocation" jsonb,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expires" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_recovery_codes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_password_change" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_ip_address" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_user_agent" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_city" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_country" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_browser" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_os" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_device" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_access_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_refresh_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_connected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_email" varchar;--> statement-breakpoint
ALTER TABLE "account_activity_logs" ADD CONSTRAINT "account_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_marketing_person_id_users_id_fk" FOREIGN KEY ("marketing_person_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_uploaded_by" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_rate_limits_email_ip" ON "auth_rate_limits" USING btree ("email","ip");--> statement-breakpoint
CREATE INDEX "idx_auth_rate_limits_window" ON "auth_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "idx_email_attachments_message_id" ON "email_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_thread_id" ON "email_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_from_email" ON "email_messages" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "idx_email_messages_message_type" ON "email_messages" USING btree ("message_type");--> statement-breakpoint
CREATE INDEX "idx_email_messages_sent_at" ON "email_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_email_rate_limits_action_email_ip" ON "email_rate_limits" USING btree ("action","email","ip");--> statement-breakpoint
CREATE INDEX "idx_email_rate_limits_window" ON "email_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "idx_email_threads_created_by" ON "email_threads" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_email_threads_last_message" ON "email_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_interviews_requirement_id" ON "interviews" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_consultant_id" ON "interviews" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_status" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_interviews_date" ON "interviews" USING btree ("interview_date");--> statement-breakpoint
CREATE INDEX "idx_requirements_status" ON "requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_requirements_assigned_to" ON "requirements" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_requirements_created_by" ON "requirements" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_requirements_created_at" ON "requirements" USING btree ("created_at");