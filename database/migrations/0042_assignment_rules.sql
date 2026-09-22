CREATE TABLE "assignment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"strategy" varchar(20) NOT NULL,
	"targets" jsonb NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_target" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_rules_strategy_check" CHECK ("assignment_rules"."strategy" IN ('capacity', 'round_robin')),
	CONSTRAINT "assignment_rules_bounds_check" CHECK ("assignment_rules"."priority" BETWEEN 0 AND 10000 AND "assignment_rules"."next_target" BETWEEN 0 AND 49 AND length(trim("assignment_rules"."name")) > 0),
	CONSTRAINT "assignment_rules_targets_check" CHECK (jsonb_typeof("assignment_rules"."targets") = 'array' AND jsonb_array_length("assignment_rules"."targets") BETWEEN 1 AND 50)
);
--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_rules_campaign_order_idx" ON "assignment_rules" USING btree ("tenant_id","campaign_id","priority","id");