CREATE TYPE "public"."notification_type" AS ENUM('follow_up_reminder');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"type" "notification_type" DEFAULT 'follow_up_reminder' NOT NULL,
	"follow_up_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" varchar(1000) NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_recipient_fk" FOREIGN KEY ("tenant_id","recipient_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_follow_up_fk" FOREIGN KEY ("tenant_id","follow_up_id") REFERENCES "public"."prospect_follow_ups"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_follow_up_reminder_unique" ON "notifications" USING btree ("tenant_id","recipient_user_id","type","follow_up_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_tenant_recipient_created_idx" ON "notifications" USING btree ("tenant_id","recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_recipient_read_idx" ON "notifications" USING btree ("tenant_id","recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_follow_up_idx" ON "notifications" USING btree ("tenant_id","follow_up_id");