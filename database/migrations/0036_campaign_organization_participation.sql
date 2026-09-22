CREATE TABLE "campaign_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"access_mode" varchar(16) DEFAULT 'participate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "campaign_organizations_mode_check" CHECK ("campaign_organizations"."access_mode" IN ('participate','read_only'))
);
--> statement-breakpoint
ALTER TABLE "campaign_organizations" ADD CONSTRAINT "campaign_organizations_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_organizations" ADD CONSTRAINT "campaign_organizations_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_organizations_active_unique" ON "campaign_organizations" USING btree ("tenant_id","campaign_id","organization_id") WHERE "campaign_organizations"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "campaign_organizations_organization_idx" ON "campaign_organizations" USING btree ("tenant_id","organization_id");