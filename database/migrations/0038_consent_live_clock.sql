-- Resolve scheduled/expired evidence against evaluation time, including after a lock wait.
CREATE OR REPLACE FUNCTION trackroster_consent_blocked(p_tenant uuid,p_prospect uuid,p_channel text) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS (
   SELECT 1 FROM (
     SELECT DISTINCT ON (contact_id,channel) status,expires_at,channel
     FROM contact_consents WHERE tenant_id=p_tenant AND prospect_id=p_prospect AND effective_at <= clock_timestamp()
     ORDER BY contact_id,channel,effective_at DESC,sequence DESC
   ) latest WHERE status='blocked' AND (expires_at IS NULL OR expires_at > clock_timestamp())
     AND (p_channel IS NULL OR latest.channel='all' OR latest.channel=p_channel)
 );
$$;
--> statement-breakpoint
