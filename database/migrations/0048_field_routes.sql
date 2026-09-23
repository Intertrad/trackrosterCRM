CREATE TABLE "field_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"start_point" jsonb NOT NULL,
	"end_point" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_routes_tenant_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "field_routes_status" CHECK ("field_routes"."status" IN ('draft','active','completed','cancelled')),
	CONSTRAINT "field_routes_name" CHECK (length(btrim("field_routes"."name"))>0)
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"action_id" uuid,
	"position" integer NOT NULL,
	"point" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"eta" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"outcome" varchar(2000),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_stops_prospect_once" UNIQUE("tenant_id","route_id","campaign_prospect_id"),
	CONSTRAINT "route_stops_position" CHECK ("route_stops"."position">0),
	CONSTRAINT "route_stops_status" CHECK ("route_stops"."status" IN ('pending','arrived','completed','skipped'))
);
--> statement-breakpoint
ALTER TABLE "field_routes" ADD CONSTRAINT "field_routes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_routes" ADD CONSTRAINT "field_routes_team_fk" FOREIGN KEY ("tenant_id","team_id") REFERENCES "public"."teams"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_routes" ADD CONSTRAINT "field_routes_owner_fk" FOREIGN KEY ("tenant_id","owner_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_fk" FOREIGN KEY ("tenant_id","route_id") REFERENCES "public"."field_routes"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_prospect_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id") REFERENCES "public"."campaign_prospects"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_action_fk" FOREIGN KEY ("tenant_id","action_id") REFERENCES "public"."actions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_routes_owner_day" ON "field_routes" USING btree ("tenant_id","owner_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "route_stops_order" ON "route_stops" USING btree ("tenant_id","route_id","position");