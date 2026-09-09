CREATE TYPE "public"."organization_coordination_policy_type" AS ENUM('shared', 'coordinated', 'delayed', 'independent');--> statement-breakpoint
CREATE TABLE "organization_coordination_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_a_id" uuid NOT NULL,
	"organization_b_id" uuid NOT NULL,
	"policy" "organization_coordination_policy_type" DEFAULT 'shared' NOT NULL,
	"delay_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_coordination_policies_pair_unique" UNIQUE("tenant_id","organization_a_id","organization_b_id"),
	CONSTRAINT "organization_coordination_policies_distinct_organizations_check" CHECK (
        "organization_coordination_policies"."organization_a_id"
        <> "organization_coordination_policies"."organization_b_id"
      ),
	CONSTRAINT "organization_coordination_policies_canonical_pair_check" CHECK (
        "organization_coordination_policies"."organization_a_id"
        < "organization_coordination_policies"."organization_b_id"
      ),
	CONSTRAINT "organization_coordination_policies_delay_check" CHECK (
        (
          "organization_coordination_policies"."policy" = 'delayed'
          AND "organization_coordination_policies"."delay_minutes" IS NOT NULL
          AND "organization_coordination_policies"."delay_minutes" > 0
        )
        OR
        (
          "organization_coordination_policies"."policy" <> 'delayed'
          AND "organization_coordination_policies"."delay_minutes" IS NULL
        )
      )
);
--> statement-breakpoint
ALTER TABLE "organization_coordination_policies" ADD CONSTRAINT "organization_coordination_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organization_coordination_policies" ADD CONSTRAINT "organization_coordination_policies_organization_a_fk" FOREIGN KEY ("tenant_id","organization_a_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organization_coordination_policies" ADD CONSTRAINT "organization_coordination_policies_organization_b_fk" FOREIGN KEY ("tenant_id","organization_b_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "organization_coordination_policies_tenant_a_idx" ON "organization_coordination_policies" USING btree ("tenant_id","organization_a_id");--> statement-breakpoint
CREATE INDEX "organization_coordination_policies_tenant_b_idx" ON "organization_coordination_policies" USING btree ("tenant_id","organization_b_id");--> statement-breakpoint
CREATE INDEX "organization_coordination_policies_tenant_policy_idx" ON "organization_coordination_policies" USING btree ("tenant_id","policy");