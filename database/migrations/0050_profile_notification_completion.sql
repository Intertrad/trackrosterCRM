ALTER TABLE "account_settings" ADD COLUMN "avatar" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "severity" varchar(16) DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_severity_check" CHECK ("notifications"."severity" IN ('info','warning','error','critical'));