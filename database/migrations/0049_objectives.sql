CREATE TABLE "objective_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"campaign_id" uuid,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"metric" varchar(40) NOT NULL,
	"target" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objectives_tenant_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "objectives_name" CHECK (length(btrim("objectives"."name"))>0),
	CONSTRAINT "objectives_target" CHECK ("objectives"."target" BETWEEN 1 AND 10000000),
	CONSTRAINT "objectives_period" CHECK ("objectives"."ends_at">"objectives"."starts_at" AND "objectives"."ends_at"<="objectives"."starts_at"+interval '366 days'),
	CONSTRAINT "objectives_metric" CHECK ("objectives"."metric" IN ('completed_actions','completed_visits','qualified_prospects','converted_prospects','completed_follow_ups'))
);
--> statement-breakpoint
ALTER TABLE "objective_history" ADD CONSTRAINT "objective_history_objective_fk" FOREIGN KEY ("tenant_id","objective_id") REFERENCES "public"."objectives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_history" ADD CONSTRAINT "objective_history_actor_fk" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_team_fk" FOREIGN KEY ("tenant_id","organization_id","team_id") REFERENCES "public"."teams"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id","organization_id") REFERENCES "public"."campaigns"("tenant_id","id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_fk" FOREIGN KEY ("tenant_id","owner_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "objective_history_order" ON "objective_history" USING btree ("tenant_id","objective_id","created_at");--> statement-breakpoint
CREATE INDEX "objectives_scope_period" ON "objectives" USING btree ("tenant_id","organization_id","team_id","ends_at");