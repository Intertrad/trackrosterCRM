CREATE TABLE "membership_access_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"digest" varchar(64) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_access_evidence" ADD CONSTRAINT "membership_access_evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_access_evidence_timeline_idx" ON "membership_access_evidence" USING btree ("tenant_id","membership_id","occurred_at","id");--> statement-breakpoint
-- Capture the public API event shape; source audit retention must not erase access evidence.
INSERT INTO membership_access_evidence (id,tenant_id,membership_id,payload,digest,occurred_at)
SELECT id,tenant_id,CASE WHEN resource_type='tenant_membership' THEN resource_id::uuid ELSE (metadata->>'targetUserId')::uuid END,
 p,encode(sha256(convert_to(p::text,'UTF8')),'hex'),occurred_at
FROM audit_events a CROSS JOIN LATERAL (SELECT jsonb_build_object('id',a.id,'tenantId',a.tenant_id,'actorType',a.actor_type,'actorUserId',a.actor_user_id,'action',a.action,'resourceType',a.resource_type,'resourceId',a.resource_id,'metadata',a.metadata,'occurredAt',a.occurred_at) p) j
WHERE (action LIKE 'membership.%' OR action LIKE 'access_grant.%') AND
 ((resource_type='tenant_membership' AND resource_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') OR (resource_type='access_grant' AND metadata->>'targetUserId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'));
--> statement-breakpoint
CREATE FUNCTION trackroster_capture_membership_access() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; p jsonb;
BEGIN
 IF NEW.action NOT LIKE 'membership.%' AND NEW.action NOT LIKE 'access_grant.%' THEN RETURN NEW; END IF;
 target := CASE WHEN NEW.resource_type='tenant_membership' THEN NEW.resource_id WHEN NEW.resource_type='access_grant' THEN NEW.metadata->>'targetUserId' END;
 IF target IS NULL OR target !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN RETURN NEW; END IF;
 p := jsonb_build_object('id',NEW.id,'tenantId',NEW.tenant_id,'actorType',NEW.actor_type,'actorUserId',NEW.actor_user_id,'action',NEW.action,'resourceType',NEW.resource_type,'resourceId',NEW.resource_id,'metadata',NEW.metadata,'occurredAt',NEW.occurred_at);
 INSERT INTO membership_access_evidence VALUES (NEW.id,NEW.tenant_id,target::uuid,p,encode(sha256(convert_to(p::text,'UTF8')),'hex'),NEW.occurred_at);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER capture_membership_access AFTER INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION trackroster_capture_membership_access();
--> statement-breakpoint
CREATE FUNCTION trackroster_protect_membership_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' AND pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 -- Whole-tenant deletion is the only supported retention boundary, not membership deletion.
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM tenants WHERE id=OLD.tenant_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Membership access evidence is append-only' USING ERRCODE='42501';
END $$;
--> statement-breakpoint
CREATE TRIGGER protect_membership_access BEFORE INSERT OR UPDATE OR DELETE ON membership_access_evidence FOR EACH ROW EXECUTE FUNCTION trackroster_protect_membership_access();
--> statement-breakpoint
CREATE TRIGGER protect_membership_access_truncate BEFORE TRUNCATE ON membership_access_evidence FOR EACH STATEMENT EXECUTE FUNCTION trackroster_protect_membership_access();
