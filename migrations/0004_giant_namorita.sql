CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"email_address" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"smtp_host" varchar,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true,
	"imap_host" varchar,
	"imap_port" integer,
	"imap_secure" boolean DEFAULT true,
	"username" varchar,
	"password" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sync_enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_frequency" integer DEFAULT 300,
	"inbox_folder" varchar DEFAULT 'INBOX',
	"sent_folder" varchar DEFAULT 'SENT',
	"drafts_folder" varchar DEFAULT 'DRAFTS',
	"trash_folder" varchar DEFAULT 'TRASH',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "email_account_id" varchar;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "external_message_id" varchar;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "external_folder" varchar;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "original_path" varchar;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_accounts_user_id" ON "email_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_accounts_email" ON "email_accounts" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_email_accounts_provider" ON "email_accounts" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_email_accounts_user_email" ON "email_accounts" USING btree ("user_id","email_address");--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE set null ON UPDATE no action;