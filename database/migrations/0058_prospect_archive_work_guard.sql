-- Override requests reference campaign prospects instead of a direct campaign ID.
-- Serialize creation/reopening of operational work with campaign terminal transitions.
-- FOR SHARE conflicts with the lifecycle API's campaign FOR UPDATE lock.
CREATE OR REPLACE FUNCTION trackroster_guard_campaign_open_work() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payload jsonb := to_jsonb(NEW); is_open boolean; campaign_state text; target_campaign uuid; prospect_state text;
BEGIN
 is_open := CASE TG_TABLE_NAME
   WHEN 'campaign_prospect_assignments' THEN payload->>'ended_at' IS NULL
   WHEN 'actions' THEN payload->>'status' IN ('planned','started')
   WHEN 'prospect_follow_ups' THEN payload->>'status'='pending'
   WHEN 'reservation_records' THEN payload->>'status' IN ('pending','active') AND (payload->>'expires_at')::timestamptz>clock_timestamp()
   WHEN 'override_requests' THEN payload->>'status'='pending'
   ELSE false END;
 IF NOT is_open THEN RETURN NEW; END IF;
 target_campaign := (payload->>'campaign_id')::uuid;
 IF target_campaign IS NULL THEN
   SELECT campaign_id INTO target_campaign FROM campaign_prospects WHERE tenant_id=NEW.tenant_id AND id=NEW.campaign_prospect_id;
 END IF;
 SELECT status::text INTO campaign_state FROM campaigns
   WHERE tenant_id=NEW.tenant_id AND id=target_campaign FOR SHARE;
 IF campaign_state IN ('completed','archived') THEN
   RAISE EXCEPTION 'Campaign no longer accepts open work' USING ERRCODE='TR001';
 END IF;
 SELECT e.status::text INTO prospect_state FROM establishments e JOIN campaign_prospects p ON p.tenant_id=e.tenant_id AND p.establishment_id=e.id
   WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.campaign_prospect_id FOR SHARE OF e;
 IF prospect_state='archived' THEN
   RAISE EXCEPTION 'Prospect is archived' USING ERRCODE='TR002';
 END IF;
 RETURN NEW;
END $$;
