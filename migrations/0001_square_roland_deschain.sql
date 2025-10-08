ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_point_groups_resume_id" ON "point_groups" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "idx_processing_history_resume_id" ON "processing_history" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "idx_processing_history_created_at" ON "processing_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_resumes_user_id" ON "resumes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_resumes_status" ON "resumes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_resumes_uploaded_at" ON "resumes" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_resumes_user_status" ON "resumes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_tech_stacks_resume_id" ON "tech_stacks" USING btree ("resume_id");