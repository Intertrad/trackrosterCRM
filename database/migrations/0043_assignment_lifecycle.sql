ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "status" varchar(16) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "priority" varchar(16) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE campaign_prospect_assignments SET status='revoked',end_reason='Legacy assignment ended' WHERE ended_at IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "assignment_status_check" CHECK ("campaign_prospect_assignments"."status" IN ('active','paused','completed','revoked'));--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "assignment_priority_check" CHECK ("campaign_prospect_assignments"."priority" IN ('low','normal','high','critical'));--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "assignment_ended_status_check" CHECK (("campaign_prospect_assignments"."ended_at" IS NULL AND "campaign_prospect_assignments"."status" IN ('active','paused')) OR ("campaign_prospect_assignments"."ended_at" IS NOT NULL AND "campaign_prospect_assignments"."status" IN ('completed','revoked')));
--> statement-breakpoint
CREATE FUNCTION trackroster_assignment_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.ended_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Ended assignment history cannot change' USING ERRCODE='23514';
 END IF;
 IF NEW.ended_at IS NOT NULL AND NEW.status IN ('active','paused') THEN
   NEW.status := 'revoked';
   NEW.end_reason := COALESCE(NEW.end_reason,'Legacy assignment ended');
 END IF;
 IF TG_OP='UPDATE' THEN NEW.updated_at := clock_timestamp(); END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER assignment_lifecycle_guard BEFORE INSERT OR UPDATE ON campaign_prospect_assignments FOR EACH ROW EXECUTE FUNCTION trackroster_assignment_lifecycle();
--> statement-breakpoint
CREATE FUNCTION trackroster_assignment_contact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment_state text;
BEGIN
 IF TG_TABLE_NAME='actions' AND (NEW.type IN ('task','note') OR NEW.status NOT IN ('started','completed')) THEN RETURN NEW; END IF;
 SELECT status INTO assignment_state FROM campaign_prospect_assignments WHERE tenant_id=NEW.tenant_id AND id=NEW.assignment_id FOR SHARE;
 IF assignment_state='paused' THEN RAISE EXCEPTION 'Assignment is paused' USING ERRCODE='PAA01'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER activities_assignment_state_guard BEFORE INSERT ON prospect_activities FOR EACH ROW EXECUTE FUNCTION trackroster_assignment_contact_guard();
--> statement-breakpoint
CREATE TRIGGER actions_assignment_state_guard BEFORE INSERT OR UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION trackroster_assignment_contact_guard();
