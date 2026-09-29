CREATE TABLE "organization_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_organization_id" uuid NOT NULL,
	"child_organization_id" uuid NOT NULL,
	"relationship_type" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "organization_relationships_type_check" CHECK ("organization_relationships"."relationship_type" IN ('parent','brand','partner','coordination')),
	CONSTRAINT "organization_relationships_self_check" CHECK ("organization_relationships"."parent_organization_id" <> "organization_relationships"."child_organization_id"),
	CONSTRAINT "organization_relationships_order_check" CHECK ("organization_relationships"."relationship_type" NOT IN ('partner','coordination') OR "organization_relationships"."parent_organization_id" < "organization_relationships"."child_organization_id")
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"team_role" varchar(16) DEFAULT 'member' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_memberships_role_check" CHECK ("team_memberships"."team_role" IN ('manager','member')),
	CONSTRAINT "team_memberships_dates_check" CHECK ("team_memberships"."ends_at" IS NULL OR "team_memberships"."ends_at" > "team_memberships"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_parent_fk" FOREIGN KEY ("tenant_id","parent_organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_child_fk" FOREIGN KEY ("tenant_id","child_organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_fk" FOREIGN KEY ("tenant_id","team_id") REFERENCES "public"."teams"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_member_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_relationships_active_pair_unique" ON "organization_relationships" USING btree ("tenant_id","parent_organization_id","child_organization_id","relationship_type") WHERE "organization_relationships"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_relationships_active_parent_unique" ON "organization_relationships" USING btree ("tenant_id","child_organization_id","relationship_type") WHERE "organization_relationships"."ended_at" IS NULL AND "organization_relationships"."relationship_type" IN ('parent','brand');--> statement-breakpoint
CREATE INDEX "organization_relationships_parent_idx" ON "organization_relationships" USING btree ("tenant_id","parent_organization_id");--> statement-breakpoint
CREATE INDEX "organization_relationships_child_idx" ON "organization_relationships" USING btree ("tenant_id","child_organization_id");--> statement-breakpoint
CREATE INDEX "team_memberships_team_idx" ON "team_memberships" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE INDEX "team_memberships_member_idx" ON "team_memberships" USING btree ("tenant_id","membership_id");--> statement-breakpoint
-- Exclusion constraints are maintained in migration SQL (not represented by
-- Drizzle snapshots). btree_gist was enabled by migration 0034.
ALTER TABLE team_memberships ADD CONSTRAINT team_memberships_period_excl
  EXCLUDE USING gist (tenant_id WITH =, team_id WITH =, membership_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (revoked_at IS NULL);
