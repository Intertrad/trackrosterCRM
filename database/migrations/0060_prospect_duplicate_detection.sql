CREATE FUNCTION trackroster_detect_prospect_duplicates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'active' THEN RETURN NEW; END IF;
 INSERT INTO prospect_duplicates(tenant_id,left_prospect_id,right_prospect_id,matching_keys)
 SELECT NEW.tenant_id,least(NEW.id,e.id),greatest(NEW.id,e.id),jsonb_build_array('normalized_name','country_code',CASE WHEN nullif(NEW.postal_code,'')=e.postal_code THEN 'postal_code' WHEN nullif(NEW.phone,'')=e.phone THEN 'phone' ELSE 'city' END)
 FROM establishments e WHERE e.tenant_id=NEW.tenant_id AND e.id<>NEW.id AND e.status='active' AND e.normalized_name=NEW.normalized_name AND e.country_code=NEW.country_code
 AND ((nullif(NEW.postal_code,'') IS NOT NULL AND NEW.postal_code=e.postal_code) OR (nullif(NEW.phone,'') IS NOT NULL AND NEW.phone=e.phone) OR (nullif(NEW.city,'') IS NOT NULL AND lower(NEW.city)=lower(e.city)))
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER establishments_duplicate_detection AFTER INSERT OR UPDATE OF normalized_name,country_code,postal_code,city,phone,status ON establishments FOR EACH ROW EXECUTE FUNCTION trackroster_detect_prospect_duplicates();
--> statement-breakpoint
INSERT INTO prospect_duplicates(tenant_id,left_prospect_id,right_prospect_id,matching_keys)
SELECT l.tenant_id,l.id,r.id,'["normalized_name","country_code","location_or_phone"]'::jsonb FROM establishments l JOIN establishments r ON r.tenant_id=l.tenant_id AND r.id>l.id AND r.normalized_name=l.normalized_name AND r.country_code=l.country_code WHERE l.status='active' AND r.status='active' AND ((nullif(l.postal_code,'') IS NOT NULL AND l.postal_code=r.postal_code) OR (nullif(l.phone,'') IS NOT NULL AND l.phone=r.phone) OR (nullif(l.city,'') IS NOT NULL AND lower(l.city)=lower(r.city))) ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trackroster_consent_blocked(p_tenant uuid,p_prospect uuid,p_channel text) RETURNS boolean LANGUAGE sql STABLE AS $$
 WITH RECURSIVE family(id) AS (
  SELECT p_prospect UNION SELECT m.source_id FROM prospect_merges m JOIN family f ON m.target_id=f.id WHERE m.tenant_id=p_tenant
 ), latest AS (
  SELECT DISTINCT ON (prospect_id,contact_id,channel) status,expires_at,channel
  FROM contact_consents WHERE tenant_id=p_tenant AND prospect_id IN(SELECT id FROM family) AND effective_at<=statement_timestamp()
  ORDER BY prospect_id,contact_id,channel,effective_at DESC,sequence DESC
 ) SELECT EXISTS(SELECT 1 FROM latest WHERE status='blocked' AND (expires_at IS NULL OR expires_at>statement_timestamp()) AND (p_channel IS NULL OR channel='all' OR channel=p_channel));
$$;
--> statement-breakpoint
CREATE FUNCTION trackroster_protect_merged_prospect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'archived' AND EXISTS(SELECT 1 FROM prospect_merges WHERE tenant_id=NEW.tenant_id AND source_id=NEW.id) THEN
  RAISE EXCEPTION 'Merged prospects cannot be restored' USING ERRCODE='TR002';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER establishments_merged_protection BEFORE UPDATE OF status ON establishments FOR EACH ROW EXECUTE FUNCTION trackroster_protect_merged_prospect();
