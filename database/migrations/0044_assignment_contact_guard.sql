-- Keep table-specific record fields and enum literals in separate PL/pgSQL branches.
CREATE OR REPLACE FUNCTION trackroster_assignment_contact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment_state text;
BEGIN
 IF TG_TABLE_NAME='actions' THEN
   IF NEW.type IN ('task','note') OR NEW.status NOT IN ('started','completed') THEN RETURN NEW; END IF;
 END IF;
 SELECT status INTO assignment_state FROM campaign_prospect_assignments WHERE tenant_id=NEW.tenant_id AND id=NEW.assignment_id FOR SHARE;
 IF assignment_state='paused' THEN RAISE EXCEPTION 'Assignment is paused' USING ERRCODE='PAA01'; END IF;
 RETURN NEW;
END $$;
