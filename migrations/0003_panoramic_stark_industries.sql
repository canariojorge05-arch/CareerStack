CREATE TABLE "consultant_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"project_name" varchar NOT NULL,
	"project_domain" varchar,
	"project_city" varchar,
	"project_state" varchar,
	"project_start_date" varchar,
	"project_end_date" varchar,
	"is_currently_working" boolean DEFAULT false,
	"project_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar DEFAULT 'Active' NOT NULL,
	"name" text NOT NULL,
	"visa_status" text,
	"date_of_birth" timestamp,
	"address" text,
	"email" varchar NOT NULL,
	"phone" varchar,
	"timezone" text,
	"degree_name" varchar,
	"university" varchar,
	"year_of_passing" varchar,
	"ssn" varchar,
	"how_did_you_get_visa" text,
	"year_came_to_us" varchar,
	"country_of_origin" varchar,
	"why_looking_for_new_job" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DROP INDEX "idx_requirements_assigned_to";--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "consultant_id" varchar;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "ephemeral" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "session_id" varchar;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "consultant_projects" ADD CONSTRAINT "consultant_projects_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consultant_projects_consultant_id" ON "consultant_projects" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "idx_consultant_projects_created_at" ON "consultant_projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_consultants_status" ON "consultants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_consultants_email" ON "consultants" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_consultants_created_by" ON "consultants" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_consultants_created_at" ON "consultants" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_requirements_consultant_id" ON "requirements" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "idx_resumes_user_ephemeral" ON "resumes" USING btree ("user_id","ephemeral");--> statement-breakpoint
CREATE INDEX "idx_resumes_expires_at" ON "resumes" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "requirements" DROP COLUMN "assigned_to";