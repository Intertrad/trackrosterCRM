CREATE TYPE "public"."prospect_activity_type" AS ENUM(
  'call',
  'email',
  'message',
  'visit'
);
--> statement-breakpoint

ALTER TABLE "campaign_prospects"
ADD CONSTRAINT "campaign_prospects_activity_reference_unique"
UNIQUE(
  "tenant_id",
  "campaign_id",
  "id",
  "establishment_id"
);
--> statement-breakpoint

CREATE TABLE "prospect_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "campaign_prospect_id" uuid NOT NULL,
  "establishment_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "reservation_id" uuid NOT NULL,
  "type" "prospect_activity_type" NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "prospect_activities_tenant_id_id_unique"
    UNIQUE("tenant_id", "id")
);
--> statement-breakpoint

ALTER TABLE "prospect_activities"
ADD CONSTRAINT "prospect_activities_tenant_id_tenants_id_fk"
FOREIGN KEY ("tenant_id")
REFERENCES "public"."tenants"("id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "prospect_activities"
ADD CONSTRAINT "prospect_activities_tenant_campaign_prospect_establishment_fk"
FOREIGN KEY (
  "tenant_id",
  "campaign_id",
  "campaign_prospect_id",
  "establishment_id"
)
REFERENCES "public"."campaign_prospects"(
  "tenant_id",
  "campaign_id",
  "id",
  "establishment_id"
)
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "prospect_activities"
ADD CONSTRAINT "prospect_activities_tenant_assignment_fk"
FOREIGN KEY (
  "tenant_id",
  "assignment_id"
)
REFERENCES "public"."campaign_prospect_assignments"(
  "tenant_id",
  "id"
)
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "prospect_activities"
ADD CONSTRAINT "prospect_activities_tenant_user_fk"
FOREIGN KEY (
  "tenant_id",
  "user_id"
)
REFERENCES "public"."users"(
  "tenant_id",
  "id"
)
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

CREATE INDEX "prospect_activities_tenant_establishment_occurred_idx"
ON "prospect_activities"
USING btree (
  "tenant_id",
  "establishment_id",
  "occurred_at"
);
--> statement-breakpoint

CREATE INDEX "prospect_activities_tenant_prospect_occurred_idx"
ON "prospect_activities"
USING btree (
  "tenant_id",
  "campaign_prospect_id",
  "occurred_at"
);
--> statement-breakpoint

CREATE INDEX "prospect_activities_tenant_user_occurred_idx"
ON "prospect_activities"
USING btree (
  "tenant_id",
  "user_id",
  "occurred_at"
);