CREATE TABLE "reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"owner_membership_id" uuid NOT NULL,
	"lease" jsonb NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_records_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "reservation_records_status_check" CHECK ("reservation_records"."status" IN ('pending','active','released','expired','lost','failed'))
);
--> statement-breakpoint
CREATE TABLE "reservation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid,
	"duration_minutes" integer DEFAULT 20 NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"max_hold_minutes" integer DEFAULT 120 NOT NULL,
	"allow_heartbeat" boolean DEFAULT true NOT NULL,
	"allow_extension" boolean DEFAULT true NOT NULL,
	"allow_manager_override" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_rules_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "reservation_rules_bounds" CHECK ("reservation_rules"."duration_minutes" BETWEEN 1 AND 240 AND "reservation_rules"."max_hold_minutes" BETWEEN "reservation_rules"."duration_minutes" AND 1440 AND "reservation_rules"."cooldown_minutes" BETWEEN 0 AND 10080)
);
--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_record_fk" FOREIGN KEY ("tenant_id","reservation_id") REFERENCES "public"."reservation_records"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_records" ADD CONSTRAINT "reservation_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rules" ADD CONSTRAINT "reservation_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rules" ADD CONSTRAINT "reservation_rules_campaign_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."campaigns"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservation_events_record_idx" ON "reservation_events" USING btree ("tenant_id","reservation_id","created_at");--> statement-breakpoint
CREATE INDEX "reservation_records_queue_idx" ON "reservation_records" USING btree ("tenant_id","status","id");--> statement-breakpoint
CREATE INDEX "reservation_records_due_idx" ON "reservation_records" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "reservation_records_scope_idx" ON "reservation_records" USING btree ("tenant_id","campaign_prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_rules_active_tenant" ON "reservation_rules" USING btree ("tenant_id") WHERE "reservation_rules"."is_active" AND "reservation_rules"."campaign_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_rules_active_campaign" ON "reservation_rules" USING btree ("tenant_id","campaign_id") WHERE "reservation_rules"."is_active" AND "reservation_rules"."campaign_id" IS NOT NULL;--> statement-breakpoint
CREATE FUNCTION trackroster_reservation_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Reservation evidence is append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reservation_events_no_update BEFORE UPDATE ON reservation_events
FOR EACH ROW EXECUTE FUNCTION trackroster_reservation_evidence_immutable();
