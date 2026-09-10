CREATE TYPE "public"."collision_override_reason" AS ENUM('PLANNED_ACTION', 'RECENT_CONTACT', 'ACTIVE_ASSIGNMENT');--> statement-breakpoint
CREATE TABLE "collision_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"prospector_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_by_role" "user_role" NOT NULL,
	"reason_code" "collision_override_reason" NOT NULL,
	"conflict_key" varchar(512) NOT NULL,
	"conflict_snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collision_overrides_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "collision_overrides_approver_role_check" CHECK (
        "collision_overrides"."approved_by_role"
        IN (
          'client_admin',
          'director',
          'manager'
        )
      ),
	CONSTRAINT "collision_overrides_reason_length_check" CHECK (
        char_length(
          btrim("collision_overrides"."reason")
        )
        BETWEEN 10 AND 1000
      ),
	CONSTRAINT "collision_overrides_conflict_key_check" CHECK (
        char_length(
          btrim("collision_overrides"."conflict_key")
        ) > 0
      ),
	CONSTRAINT "collision_overrides_expiry_check" CHECK (
        "collision_overrides"."expires_at"
        > "collision_overrides"."created_at"
      )
);
--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_campaign_prospect_establishment_fk" FOREIGN KEY ("tenant_id","campaign_id","campaign_prospect_id","establishment_id") REFERENCES "public"."campaign_prospects"("tenant_id","campaign_id","id","establishment_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_campaign_organization_fk" FOREIGN KEY ("tenant_id","campaign_id","organization_id") REFERENCES "public"."campaigns"("tenant_id","id","organization_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_organization_team_fk" FOREIGN KEY ("tenant_id","organization_id","team_id") REFERENCES "public"."teams"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_assignment_fk" FOREIGN KEY ("tenant_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_prospector_fk" FOREIGN KEY ("tenant_id","prospector_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_approver_fk" FOREIGN KEY ("tenant_id","approved_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "collision_overrides_tenant_prospect_idx" ON "collision_overrides" USING btree ("tenant_id","campaign_prospect_id","prospector_user_id");--> statement-breakpoint
CREATE INDEX "collision_overrides_tenant_approver_created_idx" ON "collision_overrides" USING btree ("tenant_id","approved_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "collision_overrides_tenant_team_created_idx" ON "collision_overrides" USING btree ("tenant_id","team_id","created_at");--> statement-breakpoint
CREATE INDEX "collision_overrides_validation_idx" ON "collision_overrides" USING btree ("tenant_id","campaign_prospect_id","prospector_user_id","reason_code","conflict_key","expires_at");