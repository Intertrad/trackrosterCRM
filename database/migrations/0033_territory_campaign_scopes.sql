CREATE TABLE "campaign_territories" (
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"territory_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_territories_tenant_id_campaign_id_territory_id_pk" PRIMARY KEY("tenant_id","campaign_id","territory_id")
);
--> statement-breakpoint
CREATE TABLE "membership_resource_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"scope_type" varchar(16) NOT NULL,
	"territory_id" uuid,
	"campaign_id" uuid,
	"access_level" varchar(16) DEFAULT 'read' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_scopes_shape_check" CHECK (("membership_resource_scopes"."scope_type" = 'territory' AND "membership_resource_scopes"."territory_id" IS NOT NULL AND "membership_resource_scopes"."campaign_id" IS NULL) OR ("membership_resource_scopes"."scope_type" = 'campaign' AND "membership_resource_scopes"."campaign_id" IS NOT NULL AND "membership_resource_scopes"."territory_id" IS NULL)),
	CONSTRAINT "resource_scopes_level_check" CHECK ("membership_resource_scopes"."access_level" IN ('read','read_write','manage')),
	CONSTRAINT "resource_scopes_role_check" CHECK (("membership_resource_scopes"."role" IN ('director','manager')) OR ("membership_resource_scopes"."role" IN ('prospector','observer') AND "membership_resource_scopes"."access_level" = 'read'))
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"code" varchar(100),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"boundary" geometry(MultiPolygon,4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "territories_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "territories_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "territories_status_check" CHECK ("territories"."status" in ('active','inactive')),
	CONSTRAINT "territories_name_check" CHECK (length(btrim("territories"."name")) > 0),
	CONSTRAINT "territories_parent_check" CHECK ("territories"."parent_id" IS NULL OR "territories"."parent_id" <> "territories"."id"),
	CONSTRAINT "territories_boundary_check" CHECK ("territories"."boundary" IS NULL OR (ST_IsValid("territories"."boundary") AND NOT ST_IsEmpty("territories"."boundary") AND ST_CoveredBy("territories"."boundary", ST_MakeEnvelope(-180,-90,180,90,4326))))
);
--> statement-breakpoint
ALTER TABLE "campaign_territories" ADD CONSTRAINT "campaign_territories_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_territories" ADD CONSTRAINT "campaign_territories_territory_fk" FOREIGN KEY ("tenant_id","territory_id") REFERENCES "public"."territories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_resource_scopes" ADD CONSTRAINT "resource_scopes_membership_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_resource_scopes" ADD CONSTRAINT "resource_scopes_territory_fk" FOREIGN KEY ("tenant_id","territory_id") REFERENCES "public"."territories"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_resource_scopes" ADD CONSTRAINT "resource_scopes_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_tenant_parent_fk" FOREIGN KEY ("tenant_id","parent_id") REFERENCES "public"."territories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_territories_territory_idx" ON "campaign_territories" USING btree ("tenant_id","territory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_scopes_campaign_unique" ON "membership_resource_scopes" USING btree ("tenant_id","user_id","role","campaign_id") WHERE "membership_resource_scopes"."campaign_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_scopes_territory_unique" ON "membership_resource_scopes" USING btree ("tenant_id","user_id","role","territory_id") WHERE "membership_resource_scopes"."territory_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "resource_scopes_member_idx" ON "membership_resource_scopes" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "territories_parent_idx" ON "territories" USING btree ("tenant_id","parent_id");