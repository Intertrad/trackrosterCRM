CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."campaign_prospect_status" AS ENUM('active', 'excluded');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "campaigns_name_not_blank_check" CHECK (
        length(
          btrim("campaigns"."name")
        ) > 0
      ),
	CONSTRAINT "campaigns_date_range_check" CHECK (
        "campaigns"."starts_at" IS NULL
        OR "campaigns"."ends_at" IS NULL
        OR "campaigns"."ends_at" >= "campaigns"."starts_at"
      )
);
--> statement-breakpoint
CREATE TABLE "campaign_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"status" "campaign_prospect_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_prospects_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "campaign_prospects_tenant_campaign_establishment_unique" UNIQUE("tenant_id","campaign_id","establishment_id")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_tenant_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_tenant_establishment_fk" FOREIGN KEY ("tenant_id","establishment_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_organization_idx" ON "campaigns" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_status_idx" ON "campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "campaign_prospects_tenant_campaign_idx" ON "campaign_prospects" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_prospects_tenant_establishment_idx" ON "campaign_prospects" USING btree ("tenant_id","establishment_id");--> statement-breakpoint
CREATE INDEX "campaign_prospects_tenant_campaign_status_idx" ON "campaign_prospects" USING btree ("tenant_id","campaign_id","status");