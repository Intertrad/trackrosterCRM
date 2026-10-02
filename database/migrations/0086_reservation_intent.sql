CREATE TABLE "reservation_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_prospect_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"owner_membership_id" uuid NOT NULL,
	"lease" jsonb NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_intents"
	ADD CONSTRAINT "reservation_intents_tenant_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "reservation_intents_tenant_idx"
	ON "reservation_intents" USING btree ("tenant_id", "created_at", "id");
--> statement-breakpoint
ALTER TABLE "reservation_intents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reservation_intents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "reservation_intents_tenant_isolation" ON "reservation_intents"
	USING (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid)
	WITH CHECK (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
		EXECUTE 'GRANT SELECT, INSERT ON reservation_intents TO trackroster_app';
		EXECUTE 'REVOKE UPDATE, DELETE ON reservation_intents FROM trackroster_app';
	END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trackroster_reconcilable_reservation_intents(batch_size integer)
RETURNS TABLE (id uuid, tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT i.id, i.tenant_id
	FROM reservation_intents i
	LEFT JOIN reservation_records r
		ON r.tenant_id = i.tenant_id AND r.id = i.id
	WHERE r.id IS NULL OR r.status = 'pending'
	ORDER BY i.created_at, i.id
	LIMIT greatest(batch_size, 0);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_reconcilable_reservation_intents(integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
		EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_reconcilable_reservation_intents(integer) TO trackroster_app';
	END IF;
END $$;
