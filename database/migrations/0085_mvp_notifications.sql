ALTER TYPE "public"."notification_type" ADD VALUE 'follow_up_due';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'reservation_expired_without_summary';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'collision_or_recent_contact';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'override_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'no_activity_for_x_days';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'import_completed_with_anomalies';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "follow_up_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "scheduled_for" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_key" varchar(512) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "notifications"
SET "event_key" = 'follow_up_due:' || "follow_up_id"::text || ':' || "scheduled_for"::text
WHERE "follow_up_id" IS NOT NULL AND "scheduled_for" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_unique" UNIQUE ("tenant_id","id");--> statement-breakpoint
DROP INDEX "notifications_follow_up_reminder_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_dedup_unique" ON "notifications" USING btree ("tenant_id","recipient_user_id","type","event_key");--> statement-breakpoint
CREATE INDEX "notifications_tenant_event_key_idx" ON "notifications" USING btree ("tenant_id","event_key");--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_channel" AS ENUM('email','push');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued','sending','sent','failed');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_delivery_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_fk" FOREIGN KEY ("tenant_id","notification_id") REFERENCES "public"."notifications"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_attempts_check" CHECK ("attempts" >= 0);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_unique" UNIQUE ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_channel_unique" UNIQUE ("tenant_id","notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_queue_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_tenant_idx" ON "notification_deliveries" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_deliveries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notification_deliveries_tenant_isolation" ON "notification_deliveries"
  USING (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid);
