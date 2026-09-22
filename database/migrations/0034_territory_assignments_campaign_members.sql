ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_unique" UNIQUE("tenant_id","id");
--> statement-breakpoint
CREATE TABLE "campaign_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid,
	"team_id" uuid,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_role" varchar(24) DEFAULT 'member' NOT NULL,
	CONSTRAINT "campaign_members_subject_check" CHECK (("campaign_members"."membership_id" IS NOT NULL)::int + ("campaign_members"."team_id" IS NOT NULL)::int = 1),
	CONSTRAINT "campaign_members_dates_check" CHECK ("campaign_members"."ends_at" IS NULL OR "campaign_members"."ends_at" > "campaign_members"."starts_at"),
	CONSTRAINT "campaign_members_role_check" CHECK ("campaign_members"."campaign_role" IN ('member','coordinator','observer'))
);
--> statement-breakpoint
CREATE TABLE "territory_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid,
	"team_id" uuid,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"territory_id" uuid NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "territory_assignments_subject_check" CHECK (("territory_assignments"."membership_id" IS NOT NULL)::int + ("territory_assignments"."team_id" IS NOT NULL)::int = 1),
	CONSTRAINT "territory_assignments_dates_check" CHECK ("territory_assignments"."ends_at" IS NULL OR "territory_assignments"."ends_at" > "territory_assignments"."starts_at"),
	CONSTRAINT "territory_assignments_priority_check" CHECK ("territory_assignments"."priority" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_resource_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_member_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_team_fk" FOREIGN KEY ("tenant_id","team_id") REFERENCES "public"."teams"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_assignments" ADD CONSTRAINT "territory_assignments_resource_fk" FOREIGN KEY ("tenant_id","territory_id") REFERENCES "public"."territories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_assignments" ADD CONSTRAINT "territory_assignments_member_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_assignments" ADD CONSTRAINT "territory_assignments_team_fk" FOREIGN KEY ("tenant_id","team_id") REFERENCES "public"."teams"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_members_resource_idx" ON "campaign_members" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_members_member_idx" ON "campaign_members" USING btree ("tenant_id","membership_id");--> statement-breakpoint
CREATE INDEX "campaign_members_team_idx" ON "campaign_members" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE INDEX "territory_assignments_resource_idx" ON "territory_assignments" USING btree ("tenant_id","territory_id");--> statement-breakpoint
CREATE INDEX "territory_assignments_member_idx" ON "territory_assignments" USING btree ("tenant_id","membership_id");--> statement-breakpoint
CREATE INDEX "territory_assignments_team_idx" ON "territory_assignments" USING btree ("tenant_id","team_id");--> statement-breakpoint
-- Tenant/team unique key is created before its dependent foreign keys.--> statement-breakpoint
-- Drizzle does not model exclusion constraints. Keep these alongside this
-- migration: they enforce non-overlapping live periods even for direct SQL.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE territory_assignments ADD CONSTRAINT territory_assignments_member_period_excl
  EXCLUDE USING gist (tenant_id WITH =, territory_id WITH =, membership_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (membership_id IS NOT NULL AND revoked_at IS NULL);
--> statement-breakpoint
ALTER TABLE territory_assignments ADD CONSTRAINT territory_assignments_team_period_excl
  EXCLUDE USING gist (tenant_id WITH =, territory_id WITH =, team_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (team_id IS NOT NULL AND revoked_at IS NULL);
--> statement-breakpoint
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_member_period_excl
  EXCLUDE USING gist (tenant_id WITH =, campaign_id WITH =, membership_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (membership_id IS NOT NULL AND revoked_at IS NULL);
--> statement-breakpoint
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_team_period_excl
  EXCLUDE USING gist (tenant_id WITH =, campaign_id WITH =, team_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (team_id IS NOT NULL AND revoked_at IS NULL);
