CREATE TABLE "collision_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"detected_by" uuid NOT NULL,
	"decision" varchar(24) NOT NULL,
	"reason_code" varchar(40) NOT NULL,
	"conflict_key" varchar(512),
	"evaluation" jsonb NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "collision_events_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "collision_events_request_context_unique" UNIQUE("tenant_id","id","campaign_prospect_id","detected_by"),
	CONSTRAINT "collision_events_decision_check" CHECK ("collision_events"."decision" IN ('block','warn','require_override')),
	CONSTRAINT "collision_events_reason_check" CHECK ("collision_events"."reason_code" IN ('ACTIVE_RESERVATION','ACTIVE_ASSIGNMENT','PLANNED_ACTION','RECENT_CONTACT')),
	CONSTRAINT "collision_events_expiry_check" CHECK ("collision_events"."expires_at">"collision_events"."created_at")
);
--> statement-breakpoint
CREATE TABLE "override_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"collision_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decision_reason" varchar(1000),
	"decided_at" timestamp with time zone,
	"override_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "override_requests_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "override_requests_reason_check" CHECK (length(btrim("override_requests"."reason")) BETWEEN 10 AND 1000),
	CONSTRAINT "override_requests_state_check" CHECK (("override_requests"."status"='pending' AND "override_requests"."decided_by" IS NULL AND "override_requests"."decided_at" IS NULL AND "override_requests"."decision_reason" IS NULL AND "override_requests"."override_id" IS NULL) OR ("override_requests"."status" IN ('approved','rejected','cancelled') AND "override_requests"."decided_by" IS NOT NULL AND "override_requests"."decided_at" IS NOT NULL AND "override_requests"."decision_reason" IS NOT NULL AND length(btrim("override_requests"."decision_reason")) BETWEEN 10 AND 1000 AND (("override_requests"."status"='approved' AND "override_requests"."override_id" IS NOT NULL AND "override_requests"."decided_by"<>"override_requests"."requested_by") OR ("override_requests"."status"<>'approved' AND "override_requests"."override_id" IS NULL))))
);
--> statement-breakpoint
ALTER TABLE "collision_events" ADD CONSTRAINT "collision_events_prospect_fk" FOREIGN KEY ("tenant_id","campaign_id","campaign_prospect_id","establishment_id") REFERENCES "public"."campaign_prospects"("tenant_id","campaign_id","id","establishment_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collision_events" ADD CONSTRAINT "collision_events_assignment_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","campaign_prospect_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collision_events" ADD CONSTRAINT "collision_events_actor_fk" FOREIGN KEY ("tenant_id","detected_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "override_requests" ADD CONSTRAINT "override_requests_collision_fk" FOREIGN KEY ("tenant_id","collision_id","campaign_prospect_id","requested_by") REFERENCES "public"."collision_events"("tenant_id","id","campaign_prospect_id","detected_by") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "override_requests" ADD CONSTRAINT "override_requests_decider_fk" FOREIGN KEY ("tenant_id","decided_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "override_requests" ADD CONSTRAINT "override_requests_approval_fk" FOREIGN KEY ("tenant_id","override_id") REFERENCES "public"."collision_overrides"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collision_events_queue_idx" ON "collision_events" USING btree ("tenant_id","campaign_id","id");--> statement-breakpoint
CREATE INDEX "collision_events_prospect_idx" ON "collision_events" USING btree ("tenant_id","campaign_prospect_id");--> statement-breakpoint
CREATE INDEX "collision_events_assignment_idx" ON "collision_events" USING btree ("tenant_id","assignment_id");--> statement-breakpoint
CREATE INDEX "collision_events_actor_idx" ON "collision_events" USING btree ("tenant_id","detected_by");--> statement-breakpoint
CREATE UNIQUE INDEX "override_requests_one_pending" ON "override_requests" USING btree ("tenant_id","campaign_prospect_id","requested_by") WHERE "override_requests"."status"='pending';--> statement-breakpoint
CREATE INDEX "override_requests_queue_idx" ON "override_requests" USING btree ("tenant_id","status","id");--> statement-breakpoint
CREATE INDEX "override_requests_collision_idx" ON "override_requests" USING btree ("tenant_id","collision_id");--> statement-breakpoint
CREATE INDEX "override_requests_decider_idx" ON "override_requests" USING btree ("tenant_id","decided_by");--> statement-breakpoint
CREATE INDEX "override_requests_approval_idx" ON "override_requests" USING btree ("tenant_id","override_id");--> statement-breakpoint
-- System-written evidence is immutable. Privileged retention/deletion remains separate.
CREATE FUNCTION trackroster_collision_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Collision evidence is append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER collision_events_no_update BEFORE UPDATE ON collision_events
FOR EACH ROW EXECUTE FUNCTION trackroster_collision_evidence_immutable();
--> statement-breakpoint
CREATE FUNCTION trackroster_override_request_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' OR NEW.status = 'pending' OR
    ROW(NEW.id,NEW.tenant_id,NEW.collision_id,NEW.campaign_prospect_id,NEW.requested_by,NEW.reason,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.collision_id,OLD.campaign_prospect_id,OLD.requested_by,OLD.reason,OLD.created_at) THEN
    RAISE EXCEPTION 'Only a pending request may receive one immutable decision' USING ERRCODE = '23514';
  END IF;
  IF NEW.status='cancelled' AND NEW.decided_by<>NEW.requested_by THEN
    RAISE EXCEPTION 'Only the requester can cancel' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER override_requests_one_decision BEFORE UPDATE ON override_requests
FOR EACH ROW EXECUTE FUNCTION trackroster_override_request_transition();
