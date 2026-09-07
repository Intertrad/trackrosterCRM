CREATE TABLE "campaign_prospect_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "campaign_id" uuid NOT NULL,
        "campaign_prospect_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "assigned_user_id" uuid,
        "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
        "ended_at" timestamp with time zone,
        CONSTRAINT "campaign_prospect_assignments_tenant_id_id_unique" UNIQUE("tenant_id","id"),
        CONSTRAINT "campaign_prospect_assignments_date_range_check" CHECK (
        "campaign_prospect_assignments"."ended_at" IS NULL
        OR "campaign_prospect_assignments"."ended_at" >= "campaign_prospect_assignments"."assigned_at"
      )
);
--> statement-breakpoint

ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_tenant_id_organization_id_unique"
UNIQUE("tenant_id","id","organization_id");
--> statement-breakpoint

ALTER TABLE "campaign_prospects"
ADD CONSTRAINT "campaign_prospects_tenant_campaign_id_id_unique"
UNIQUE("tenant_id","campaign_id","id");
--> statement-breakpoint

ALTER TABLE "campaign_prospect_assignments"
ADD CONSTRAINT "campaign_prospect_assignments_tenant_id_tenants_id_fk"
FOREIGN KEY ("tenant_id")
REFERENCES "public"."tenants"("id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "campaign_prospect_assignments"
ADD CONSTRAINT "campaign_prospect_assignments_tenant_campaign_prospect_fk"
FOREIGN KEY ("tenant_id","campaign_id","campaign_prospect_id")
REFERENCES "public"."campaign_prospects"("tenant_id","campaign_id","id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "campaign_prospect_assignments"
ADD CONSTRAINT "campaign_prospect_assignments_tenant_campaign_organization_fk"
FOREIGN KEY ("tenant_id","campaign_id","organization_id")
REFERENCES "public"."campaigns"("tenant_id","id","organization_id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "campaign_prospect_assignments"
ADD CONSTRAINT "campaign_prospect_assignments_tenant_organization_team_fk"
FOREIGN KEY ("tenant_id","organization_id","team_id")
REFERENCES "public"."teams"("tenant_id","organization_id","id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

ALTER TABLE "campaign_prospect_assignments"
ADD CONSTRAINT "campaign_prospect_assignments_tenant_user_fk"
FOREIGN KEY ("tenant_id","assigned_user_id")
REFERENCES "public"."users"("tenant_id","id")
ON DELETE restrict
ON UPDATE cascade;
--> statement-breakpoint

CREATE UNIQUE INDEX "campaign_prospect_assignments_active_unique"
ON "campaign_prospect_assignments"
USING btree ("tenant_id","campaign_prospect_id")
WHERE "campaign_prospect_assignments"."ended_at" IS NULL;
--> statement-breakpoint

CREATE INDEX "campaign_prospect_assignments_tenant_campaign_idx"
ON "campaign_prospect_assignments"
USING btree ("tenant_id","campaign_id");
--> statement-breakpoint

CREATE INDEX "campaign_prospect_assignments_tenant_prospect_idx"
ON "campaign_prospect_assignments"
USING btree ("tenant_id","campaign_prospect_id");
--> statement-breakpoint

CREATE INDEX "campaign_prospect_assignments_tenant_team_idx"
ON "campaign_prospect_assignments"
USING btree ("tenant_id","team_id");
--> statement-breakpoint

CREATE INDEX "campaign_prospect_assignments_tenant_user_idx"
ON "campaign_prospect_assignments"
USING btree ("tenant_id","assigned_user_id");