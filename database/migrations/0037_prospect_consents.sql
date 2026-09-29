CREATE TABLE "contact_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "contact_consents_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid,
	"channel" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"reason" varchar(2000) NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" uuid NOT NULL,
	CONSTRAINT "contact_consents_channel_check" CHECK ("contact_consents"."channel" IN ('all','phone','email','sms','visit')),
	CONSTRAINT "contact_consents_status_check" CHECK ("contact_consents"."status" IN ('allowed','blocked','unknown')),
	CONSTRAINT "contact_consents_reason_check" CHECK (length(btrim("contact_consents"."reason")) > 0),
	CONSTRAINT "contact_consents_dates_check" CHECK ("contact_consents"."expires_at" IS NULL OR "contact_consents"."expires_at" > "contact_consents"."effective_at")
);
--> statement-breakpoint
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_prospect_fk" FOREIGN KEY ("tenant_id","prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_contact_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."establishment_contacts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_recorder_fk" FOREIGN KEY ("tenant_id","recorded_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_consents_resolution_idx" ON "contact_consents" USING btree ("tenant_id","prospect_id","contact_id","channel","effective_at","sequence");--> statement-breakpoint
CREATE FUNCTION trackroster_consent_blocked(p_tenant uuid,p_prospect uuid,p_channel text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
   SELECT 1 FROM (
     SELECT DISTINCT ON (contact_id,channel) status,expires_at,channel
     FROM contact_consents WHERE tenant_id=p_tenant AND prospect_id=p_prospect AND effective_at <= statement_timestamp()
     ORDER BY contact_id,channel,effective_at DESC,sequence DESC
   ) latest WHERE status='blocked' AND (expires_at IS NULL OR expires_at > statement_timestamp())
     AND (p_channel IS NULL OR latest.channel='all' OR latest.channel=p_channel)
 );
$$;
--> statement-breakpoint
CREATE FUNCTION trackroster_validate_consent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Consent history is append only' USING ERRCODE='23514'; END IF;
 PERFORM id FROM establishments WHERE tenant_id=NEW.tenant_id AND id=NEW.prospect_id FOR UPDATE;
 IF NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM establishment_contacts WHERE tenant_id=NEW.tenant_id AND id=NEW.contact_id AND establishment_id=NEW.prospect_id) THEN
   RAISE EXCEPTION 'Consent contact belongs to another prospect' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER contact_consents_validate BEFORE INSERT OR UPDATE ON contact_consents FOR EACH ROW EXECUTE FUNCTION trackroster_validate_consent();
--> statement-breakpoint
CREATE FUNCTION trackroster_guard_contact_operation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE contact_channel text;
BEGIN
 IF TG_TABLE_NAME='prospect_follow_ups' THEN
   IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
   contact_channel := CASE NEW.channel::text WHEN 'call' THEN 'phone' WHEN 'message' THEN 'sms' ELSE NEW.channel::text END;
 ELSE
   contact_channel := CASE NEW.type::text WHEN 'call' THEN 'phone' WHEN 'message' THEN 'sms' ELSE NEW.type::text END;
 END IF;
 PERFORM id FROM establishments WHERE tenant_id=NEW.tenant_id AND id=NEW.establishment_id FOR SHARE;
 IF trackroster_consent_blocked(NEW.tenant_id,NEW.establishment_id,contact_channel) THEN
   RAISE EXCEPTION 'Prospect opposition blocks this contact channel' USING ERRCODE='PCC01';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER prospect_activities_consent_guard BEFORE INSERT ON prospect_activities FOR EACH ROW EXECUTE FUNCTION trackroster_guard_contact_operation();
--> statement-breakpoint
CREATE TRIGGER prospect_follow_ups_consent_guard BEFORE INSERT OR UPDATE ON prospect_follow_ups FOR EACH ROW EXECUTE FUNCTION trackroster_guard_contact_operation();
