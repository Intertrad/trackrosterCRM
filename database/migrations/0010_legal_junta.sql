CREATE TYPE "public"."prospect_follow_up_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "prospect_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"created_by" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "prospect_follow_up_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_follow_ups_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "prospect_follow_ups_status_timestamp_check" CHECK (
        (
          "prospect_follow_ups"."status" = 'pending'
          AND "prospect_follow_ups"."completed_at" IS NULL
          AND "prospect_follow_ups"."cancelled_at" IS NULL
        )
        OR
        (
          "prospect_follow_ups"."status" = 'completed'
          AND "prospect_follow_ups"."completed_at" IS NOT NULL
          AND "prospect_follow_ups"."cancelled_at" IS NULL
        )
        OR
        (
          "prospect_follow_ups"."status" = 'cancelled'
          AND "prospect_follow_ups"."cancelled_at" IS NOT NULL
          AND "prospect_follow_ups"."completed_at" IS NULL
        )
      )
);
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_campaign_prospect_establishment_fk" FOREIGN KEY ("tenant_id","campaign_id","campaign_prospect_id","establishment_id") REFERENCES "public"."campaign_prospects"("tenant_id","campaign_id","id","establishment_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_assignment_fk" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_assigned_user_fk" FOREIGN KEY ("tenant_id","assigned_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_tenant_establishment_status_due_idx" ON "prospect_follow_ups" USING btree ("tenant_id","establishment_id","status","due_at");--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_tenant_prospect_status_due_idx" ON "prospect_follow_ups" USING btree ("tenant_id","campaign_prospect_id","status","due_at");--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_tenant_user_status_due_idx" ON "prospect_follow_ups" USING btree ("tenant_id","assigned_user_id","status","due_at");