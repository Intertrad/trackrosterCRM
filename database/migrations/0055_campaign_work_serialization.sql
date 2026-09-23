-- Serialize creation/reopening of operational work with campaign terminal transitions.
-- FOR SHARE conflicts with the lifecycle API's campaign FOR UPDATE lock.
CREATE FUNCTION trackroster_guard_campaign_open_work() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payload jsonb := to_jsonb(NEW); is_open boolean; campaign_state text;
BEGIN
 is_open := CASE TG_TABLE_NAME
   WHEN 'campaign_prospect_assignments' THEN payload->>'ended_at' IS NULL
   WHEN 'actions' THEN payload->>'status' IN ('planned','started')
   WHEN 'prospect_follow_ups' THEN payload->>'status'='pending'
   WHEN 'reservation_records' THEN payload->>'status' IN ('pending','active') AND (payload->>'expires_at')::timestamptz>clock_timestamp()
   WHEN 'override_requests' THEN payload->>'status'='pending'
   ELSE false END;
 IF NOT is_open THEN RETURN NEW; END IF;
 SELECT status::text INTO campaign_state FROM campaigns
   WHERE tenant_id=NEW.tenant_id AND id=NEW.campaign_id FOR SHARE;
 IF campaign_state IN ('completed','archived') THEN
   RAISE EXCEPTION 'Campaign no longer accepts open work' USING ERRCODE='TR001';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER campaign_open_work_guard BEFORE INSERT OR UPDATE ON campaign_prospect_assignments FOR EACH ROW EXECUTE FUNCTION trackroster_guard_campaign_open_work();
--> statement-breakpoint
CREATE TRIGGER campaign_open_work_guard BEFORE INSERT OR UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION trackroster_guard_campaign_open_work();
--> statement-breakpoint
CREATE TRIGGER campaign_open_work_guard BEFORE INSERT OR UPDATE ON prospect_follow_ups FOR EACH ROW EXECUTE FUNCTION trackroster_guard_campaign_open_work();
--> statement-breakpoint
CREATE TRIGGER campaign_open_work_guard BEFORE INSERT OR UPDATE ON reservation_records FOR EACH ROW EXECUTE FUNCTION trackroster_guard_campaign_open_work();
--> statement-breakpoint
CREATE TRIGGER campaign_open_work_guard BEFORE INSERT OR UPDATE ON override_requests FOR EACH ROW EXECUTE FUNCTION trackroster_guard_campaign_open_work();
