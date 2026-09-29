CREATE TABLE "action_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"type" varchar(24) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"outcome_code" varchar(40) NOT NULL,
	"notes" varchar(10000),
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_outcomes_one_per_action" UNIQUE("tenant_id","action_id")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assignee_membership_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'planned' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"notes" varchar(10000),
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"reservation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actions_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "actions_type_check" CHECK ("actions"."type" IN ('call','email','message','visit','task','note')),
	CONSTRAINT "actions_status_check" CHECK ("actions"."status" IN ('planned','started','completed','cancelled')),
	CONSTRAINT "actions_subject_check" CHECK (length(btrim("actions"."subject"))>0)
);
--> statement-breakpoint
ALTER TABLE "action_effects" ADD CONSTRAINT "action_effects_action_fk" FOREIGN KEY ("tenant_id","action_id") REFERENCES "public"."actions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_action_fk" FOREIGN KEY ("tenant_id","action_id") REFERENCES "public"."actions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_actor_fk" FOREIGN KEY ("tenant_id","actor_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_outcomes" ADD CONSTRAINT "action_outcomes_action_fk" FOREIGN KEY ("tenant_id","action_id") REFERENCES "public"."actions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_outcomes" ADD CONSTRAINT "action_outcomes_actor_fk" FOREIGN KEY ("tenant_id","recorded_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_prospect_fk" FOREIGN KEY ("tenant_id","campaign_id","campaign_prospect_id","establishment_id") REFERENCES "public"."campaign_prospects"("tenant_id","campaign_id","id","establishment_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_assignment_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","campaign_prospect_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_assignee_fk" FOREIGN KEY ("tenant_id","assignee_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_creator_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_effects_pending_idx" ON "action_effects" USING btree ("created_at") WHERE "action_effects"."delivered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "action_events_action_idx" ON "action_events" USING btree ("tenant_id","action_id","created_at");--> statement-breakpoint
CREATE INDEX "actions_queue_idx" ON "actions" USING btree ("tenant_id","assignee_membership_id","status","due_at");--> statement-breakpoint
CREATE INDEX "actions_prospect_idx" ON "actions" USING btree ("tenant_id","establishment_id");--> statement-breakpoint
CREATE FUNCTION trackroster_action_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Action history is append only' USING ERRCODE='23514'; END $$;
--> statement-breakpoint
CREATE TRIGGER action_events_no_update BEFORE UPDATE ON action_events FOR EACH ROW EXECUTE FUNCTION trackroster_action_history_immutable();
--> statement-breakpoint
CREATE TRIGGER action_outcomes_no_update BEFORE UPDATE ON action_outcomes FOR EACH ROW EXECUTE FUNCTION trackroster_action_history_immutable();
