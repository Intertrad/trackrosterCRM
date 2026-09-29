CREATE TABLE IF NOT EXISTS "script_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "organization_id" uuid,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "channel" varchar(16) NOT NULL,
  "sector" varchar(80),
  "subject" varchar(255),
  "body" varchar(20000) NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "script_templates_channel_check" CHECK ("channel" IN ('call','visit','email')),
  CONSTRAINT "script_templates_email_subject_check" CHECK ("channel" <> 'email' OR nullif(btrim("subject"), '') IS NOT NULL),
  CONSTRAINT "script_templates_body_check" CHECK (char_length(btrim("body")) > 0),
  CONSTRAINT "script_templates_org_fk" FOREIGN KEY ("tenant_id", "organization_id") REFERENCES "organizations"("tenant_id", "id") ON DELETE SET NULL,
  CONSTRAINT "script_templates_created_by_fk" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "tenant_memberships"("tenant_id", "id"),
  CONSTRAINT "script_templates_updated_by_fk" FOREIGN KEY ("tenant_id", "updated_by") REFERENCES "tenant_memberships"("tenant_id", "id")
);
CREATE INDEX IF NOT EXISTS "script_templates_tenant_idx" ON "script_templates" ("tenant_id", "updated_at");
ALTER TABLE "script_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "script_templates_tenant_isolation" ON "script_templates";
CREATE POLICY "script_templates_tenant_isolation" ON "script_templates"
  USING (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid);
ALTER TABLE "script_templates" FORCE ROW LEVEL SECURITY;
