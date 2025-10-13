ALTER TABLE "consultants" ADD COLUMN "display_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "display_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "display_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_display_id_unique" UNIQUE("display_id");--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_display_id_unique" UNIQUE("display_id");--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_display_id_unique" UNIQUE("display_id");