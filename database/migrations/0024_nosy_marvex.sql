SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '5min';
--> statement-breakpoint
CREATE TYPE "public"."identity_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."tenant_membership_status" AS ENUM('invited', 'active', 'suspended', 'departed');--> statement-breakpoint
CREATE TYPE "public"."platform_access_grant_source" AS ENUM('bootstrap', 'platform_admin');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('super_admin', 'support_operator');--> statement-breakpoint
CREATE TYPE "public"."support_access_grant_status" AS ENUM('requested', 'approved', 'denied', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."support_access_scope" AS ENUM('read_only');--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255),
	"status" "identity_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"mfa_enrolled_at" timestamp with time zone,
	"mfa_recovery_codes_rotated_at" timestamp with time zone,
	"last_authenticated_at" timestamp with time zone,
	"credentials_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"security_state_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_email_unique" UNIQUE("email"),
	CONSTRAINT "identities_email_normalized_check" CHECK ("identities"."email" = lower(btrim("identities"."email"))),
	CONSTRAINT "identities_email_not_blank_check" CHECK (char_length("identities"."email") > 0),
	CONSTRAINT "identities_password_hash_not_blank_check" CHECK ("identities"."password_hash" IS NULL OR char_length(btrim("identities"."password_hash")) > 0),
	CONSTRAINT "identities_mfa_recovery_state_check" CHECK ("identities"."mfa_recovery_codes_rotated_at" IS NULL OR "identities"."mfa_enrolled_at" IS NOT NULL),
	CONSTRAINT "identities_status_timestamps_check" CHECK (
        (
          "identities"."status" = 'active'
          AND "identities"."suspended_at" IS NULL
          AND "identities"."disabled_at" IS NULL
        )
        OR
        (
          "identities"."status" = 'suspended'
          AND "identities"."suspended_at" IS NOT NULL
          AND "identities"."disabled_at" IS NULL
        )
        OR
        (
          "identities"."status" = 'disabled'
          AND "identities"."disabled_at" IS NOT NULL
        )
      ),
	CONSTRAINT "identities_timestamp_order_check" CHECK (
        "identities"."updated_at" >= "identities"."created_at"
        AND "identities"."credentials_updated_at" >= "identities"."created_at"
        AND "identities"."security_state_updated_at" >= "identities"."created_at"
        AND (
          "identities"."email_verified_at" IS NULL
          OR "identities"."email_verified_at" >= "identities"."created_at"
        )
        AND (
          "identities"."mfa_enrolled_at" IS NULL
          OR "identities"."mfa_enrolled_at" >= "identities"."created_at"
        )
        AND (
          "identities"."mfa_recovery_codes_rotated_at" IS NULL
          OR "identities"."mfa_recovery_codes_rotated_at" >= "identities"."mfa_enrolled_at"
        )
        AND (
          "identities"."last_authenticated_at" IS NULL
          OR "identities"."last_authenticated_at" >= "identities"."created_at"
        )
        AND (
          "identities"."suspended_at" IS NULL
          OR "identities"."suspended_at" >= "identities"."created_at"
        )
        AND (
          "identities"."disabled_at" IS NULL
          OR "identities"."disabled_at" >= "identities"."created_at"
        )
      )
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"display_name" varchar(120),
	"status" "tenant_membership_status" DEFAULT 'invited' NOT NULL,
	"default_organization_id" uuid,
	"default_team_id" uuid,
	"invited_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"departed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_tenant_identity_unique" UNIQUE("tenant_id","identity_id"),
	CONSTRAINT "tenant_memberships_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tenant_memberships_display_name_check" CHECK (
        "tenant_memberships"."display_name" IS NULL
        OR (
          "tenant_memberships"."display_name" = btrim("tenant_memberships"."display_name")
          AND char_length("tenant_memberships"."display_name") > 0
        )
      ),
	CONSTRAINT "tenant_memberships_status_timestamps_check" CHECK (
        (
          "tenant_memberships"."status" = 'invited'
          AND "tenant_memberships"."invited_at" IS NOT NULL
          AND "tenant_memberships"."activated_at" IS NULL
          AND "tenant_memberships"."suspended_at" IS NULL
          AND "tenant_memberships"."departed_at" IS NULL
        )
        OR
        (
          "tenant_memberships"."status" = 'active'
          AND "tenant_memberships"."activated_at" IS NOT NULL
          AND "tenant_memberships"."suspended_at" IS NULL
          AND "tenant_memberships"."departed_at" IS NULL
        )
        OR
        (
          "tenant_memberships"."status" = 'suspended'
          AND "tenant_memberships"."activated_at" IS NOT NULL
          AND "tenant_memberships"."suspended_at" IS NOT NULL
          AND "tenant_memberships"."departed_at" IS NULL
        )
        OR
        (
          "tenant_memberships"."status" = 'departed'
          AND "tenant_memberships"."departed_at" IS NOT NULL
        )
      ),
	CONSTRAINT "tenant_memberships_timestamp_order_check" CHECK (
        "tenant_memberships"."updated_at" >= "tenant_memberships"."created_at"
        AND (
          "tenant_memberships"."invited_at" IS NULL
          OR "tenant_memberships"."invited_at" >= "tenant_memberships"."created_at"
        )
        AND (
          "tenant_memberships"."activated_at" IS NULL
          OR "tenant_memberships"."activated_at" >= COALESCE("tenant_memberships"."invited_at", "tenant_memberships"."created_at")
        )
        AND (
          "tenant_memberships"."suspended_at" IS NULL
          OR "tenant_memberships"."suspended_at" >= "tenant_memberships"."activated_at"
        )
        AND (
          "tenant_memberships"."departed_at" IS NULL
          OR "tenant_memberships"."departed_at" >= COALESCE(
            "tenant_memberships"."suspended_at",
            "tenant_memberships"."activated_at",
            "tenant_memberships"."invited_at",
            "tenant_memberships"."created_at"
          )
        )
      ),
	CONSTRAINT "tenant_memberships_default_scope_shape_check" CHECK ("tenant_memberships"."default_team_id" IS NULL OR "tenant_memberships"."default_organization_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "platform_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"role" "platform_role" NOT NULL,
	"grant_source" "platform_access_grant_source" NOT NULL,
	"granted_by_identity_id" uuid,
	"grant_reason" varchar(1000) NOT NULL,
	"external_reference" varchar(255) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by_identity_id" uuid,
	"revoked_at" timestamp with time zone,
	"revocation_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_access_grants_identity_id_role_unique" UNIQUE("identity_id","id","role"),
	CONSTRAINT "platform_access_grants_source_actor_check" CHECK (
        (
          "platform_access_grants"."grant_source" = 'bootstrap'
          AND "platform_access_grants"."role" = 'super_admin'
          AND "platform_access_grants"."granted_by_identity_id" IS NULL
        )
        OR
        (
          "platform_access_grants"."grant_source" = 'platform_admin'
          AND "platform_access_grants"."granted_by_identity_id" IS NOT NULL
          AND "platform_access_grants"."granted_by_identity_id" <> "platform_access_grants"."identity_id"
        )
      ),
	CONSTRAINT "platform_access_grants_reason_check" CHECK (
        "platform_access_grants"."grant_reason" = btrim("platform_access_grants"."grant_reason")
        AND char_length("platform_access_grants"."grant_reason") > 0
      ),
	CONSTRAINT "platform_access_grants_external_reference_check" CHECK (
        "platform_access_grants"."external_reference" = btrim("platform_access_grants"."external_reference")
        AND char_length("platform_access_grants"."external_reference") > 0
      ),
	CONSTRAINT "platform_access_grants_revocation_check" CHECK (
        (
          "platform_access_grants"."revoked_at" IS NULL
          AND "platform_access_grants"."revoked_by_identity_id" IS NULL
          AND "platform_access_grants"."revocation_reason" IS NULL
        )
        OR
        (
          "platform_access_grants"."revoked_at" IS NOT NULL
          AND "platform_access_grants"."revoked_by_identity_id" IS NOT NULL
          AND "platform_access_grants"."revocation_reason" IS NOT NULL
          AND "platform_access_grants"."revocation_reason" = btrim("platform_access_grants"."revocation_reason")
          AND char_length("platform_access_grants"."revocation_reason") > 0
        )
      ),
	CONSTRAINT "platform_access_grants_timestamp_order_check" CHECK (
        "platform_access_grants"."updated_at" >= "platform_access_grants"."created_at"
        AND "platform_access_grants"."granted_at" >= "platform_access_grants"."created_at"
        AND (
          "platform_access_grants"."revoked_at" IS NULL
          OR "platform_access_grants"."revoked_at" >= "platform_access_grants"."granted_at"
        )
      )
);
--> statement-breakpoint
CREATE TABLE "support_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_identity_id" uuid NOT NULL,
	"platform_access_grant_id" uuid NOT NULL,
	"platform_role" "platform_role" DEFAULT 'support_operator' NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scope" "support_access_scope" DEFAULT 'read_only' NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"external_reference" varchar(255) NOT NULL,
	"status" "support_access_grant_status" DEFAULT 'requested' NOT NULL,
	"requested_by_identity_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_identity_id" uuid,
	"approved_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"denied_by_identity_id" uuid,
	"denied_at" timestamp with time zone,
	"denial_reason" varchar(1000),
	"revoked_by_identity_id" uuid,
	"revoked_at" timestamp with time zone,
	"revocation_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_access_grants_platform_role_check" CHECK ("support_access_grants"."platform_role" = 'support_operator'),
	CONSTRAINT "support_access_grants_reason_not_blank_check" CHECK ("support_access_grants"."reason" = btrim("support_access_grants"."reason") AND char_length("support_access_grants"."reason") > 0),
	CONSTRAINT "support_access_grants_external_reference_not_blank_check" CHECK (
        "support_access_grants"."external_reference" = btrim("support_access_grants"."external_reference")
        AND char_length("support_access_grants"."external_reference") > 0
      ),
	CONSTRAINT "support_access_grants_decision_actor_separation_check" CHECK (
        (
          "support_access_grants"."approved_by_identity_id" IS NULL
          OR (
            "support_access_grants"."approved_by_identity_id" <> "support_access_grants"."platform_identity_id"
            AND "support_access_grants"."approved_by_identity_id" <> "support_access_grants"."requested_by_identity_id"
          )
        )
        AND (
          "support_access_grants"."denied_by_identity_id" IS NULL
          OR (
            "support_access_grants"."denied_by_identity_id" <> "support_access_grants"."platform_identity_id"
            AND "support_access_grants"."denied_by_identity_id" <> "support_access_grants"."requested_by_identity_id"
          )
        )
      ),
	CONSTRAINT "support_access_grants_state_shape_check" CHECK (
        (
          "support_access_grants"."status" = 'requested'
          AND "support_access_grants"."approved_by_identity_id" IS NULL
          AND "support_access_grants"."approved_at" IS NULL
          AND "support_access_grants"."activated_at" IS NULL
          AND "support_access_grants"."expires_at" IS NULL
          AND "support_access_grants"."denied_by_identity_id" IS NULL
          AND "support_access_grants"."denied_at" IS NULL
          AND "support_access_grants"."denial_reason" IS NULL
          AND "support_access_grants"."revoked_by_identity_id" IS NULL
          AND "support_access_grants"."revoked_at" IS NULL
          AND "support_access_grants"."revocation_reason" IS NULL
        )
        OR
        (
          "support_access_grants"."status" = 'approved'
          AND "support_access_grants"."approved_by_identity_id" IS NOT NULL
          AND "support_access_grants"."approved_at" IS NOT NULL
          AND "support_access_grants"."activated_at" IS NOT NULL
          AND "support_access_grants"."expires_at" IS NOT NULL
          AND "support_access_grants"."denied_by_identity_id" IS NULL
          AND "support_access_grants"."denied_at" IS NULL
          AND "support_access_grants"."denial_reason" IS NULL
          AND "support_access_grants"."revoked_by_identity_id" IS NULL
          AND "support_access_grants"."revoked_at" IS NULL
          AND "support_access_grants"."revocation_reason" IS NULL
        )
        OR
        (
          "support_access_grants"."status" = 'denied'
          AND "support_access_grants"."approved_by_identity_id" IS NULL
          AND "support_access_grants"."approved_at" IS NULL
          AND "support_access_grants"."activated_at" IS NULL
          AND "support_access_grants"."expires_at" IS NULL
          AND "support_access_grants"."denied_by_identity_id" IS NOT NULL
          AND "support_access_grants"."denied_at" IS NOT NULL
          AND "support_access_grants"."denial_reason" IS NOT NULL
          AND "support_access_grants"."revoked_by_identity_id" IS NULL
          AND "support_access_grants"."revoked_at" IS NULL
          AND "support_access_grants"."revocation_reason" IS NULL
        )
        OR
        (
          "support_access_grants"."status" = 'revoked'
          AND "support_access_grants"."approved_by_identity_id" IS NOT NULL
          AND "support_access_grants"."approved_at" IS NOT NULL
          AND "support_access_grants"."activated_at" IS NOT NULL
          AND "support_access_grants"."expires_at" IS NOT NULL
          AND "support_access_grants"."denied_by_identity_id" IS NULL
          AND "support_access_grants"."denied_at" IS NULL
          AND "support_access_grants"."denial_reason" IS NULL
          AND "support_access_grants"."revoked_by_identity_id" IS NOT NULL
          AND "support_access_grants"."revoked_at" IS NOT NULL
          AND "support_access_grants"."revocation_reason" IS NOT NULL
        )
      ),
	CONSTRAINT "support_access_grants_decision_reason_check" CHECK (
        (
          "support_access_grants"."denial_reason" IS NULL
          OR (
            "support_access_grants"."denial_reason" = btrim("support_access_grants"."denial_reason")
            AND char_length("support_access_grants"."denial_reason") > 0
          )
        )
        AND (
          "support_access_grants"."revocation_reason" IS NULL
          OR (
            "support_access_grants"."revocation_reason" = btrim("support_access_grants"."revocation_reason")
            AND char_length("support_access_grants"."revocation_reason") > 0
          )
        )
      ),
	CONSTRAINT "support_access_grants_timestamp_order_check" CHECK (
        "support_access_grants"."updated_at" >= "support_access_grants"."created_at"
        AND "support_access_grants"."requested_at" >= "support_access_grants"."created_at"
        AND (
          "support_access_grants"."approved_at" IS NULL
          OR "support_access_grants"."approved_at" >= "support_access_grants"."requested_at"
        )
        AND (
          "support_access_grants"."activated_at" IS NULL
          OR "support_access_grants"."activated_at" >= "support_access_grants"."approved_at"
        )
        AND (
          "support_access_grants"."expires_at" IS NULL
          OR (
            "support_access_grants"."expires_at" > "support_access_grants"."activated_at"
            AND "support_access_grants"."expires_at" <= "support_access_grants"."activated_at" + interval '8 hours'
          )
        )
        AND (
          "support_access_grants"."denied_at" IS NULL
          OR "support_access_grants"."denied_at" >= "support_access_grants"."requested_at"
        )
        AND (
          "support_access_grants"."revoked_at" IS NULL
          OR "support_access_grants"."revoked_at" >= "support_access_grants"."approved_at"
        )
      )
);
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_identity_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_default_organization_fk" FOREIGN KEY ("tenant_id","default_organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_default_team_fk" FOREIGN KEY ("tenant_id","default_organization_id","default_team_id") REFERENCES "public"."teams"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform_access_grants" ADD CONSTRAINT "platform_access_grants_identity_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform_access_grants" ADD CONSTRAINT "platform_access_grants_granted_by_identity_fk" FOREIGN KEY ("granted_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform_access_grants" ADD CONSTRAINT "platform_access_grants_revoked_by_identity_fk" FOREIGN KEY ("revoked_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_platform_identity_grant_role_fk" FOREIGN KEY ("platform_identity_id","platform_access_grant_id","platform_role") REFERENCES "public"."platform_access_grants"("identity_id","id","role") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_requested_by_identity_fk" FOREIGN KEY ("requested_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_approved_by_identity_fk" FOREIGN KEY ("approved_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_denied_by_identity_fk" FOREIGN KEY ("denied_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_revoked_by_identity_fk" FOREIGN KEY ("revoked_by_identity_id") REFERENCES "public"."identities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "identities_status_idx" ON "identities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_memberships_identity_status_idx" ON "tenant_memberships" USING btree ("identity_id","status");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_status_idx" ON "tenant_memberships" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_default_organization_idx" ON "tenant_memberships" USING btree ("tenant_id","default_organization_id");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_default_team_idx" ON "tenant_memberships" USING btree ("tenant_id","default_organization_id","default_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_access_grants_identity_role_unrevoked_unique" ON "platform_access_grants" USING btree ("identity_id","role") WHERE "platform_access_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "platform_access_grants_unrevoked_role_identity_idx" ON "platform_access_grants" USING btree ("role","identity_id") WHERE "platform_access_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "platform_access_grants_granted_by_identity_idx" ON "platform_access_grants" USING btree ("granted_by_identity_id");--> statement-breakpoint
CREATE INDEX "platform_access_grants_revoked_by_identity_idx" ON "platform_access_grants" USING btree ("revoked_by_identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_access_grants_pending_unique" ON "support_access_grants" USING btree ("platform_identity_id","tenant_id","scope") WHERE "support_access_grants"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "support_access_grants_platform_identity_grant_idx" ON "support_access_grants" USING btree ("platform_identity_id","platform_access_grant_id");--> statement-breakpoint
CREATE INDEX "support_access_grants_effective_lookup_idx" ON "support_access_grants" USING btree ("platform_identity_id","tenant_id","expires_at") WHERE "support_access_grants"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "support_access_grants_tenant_history_idx" ON "support_access_grants" USING btree ("tenant_id","requested_at");--> statement-breakpoint
CREATE INDEX "support_access_grants_requested_queue_idx" ON "support_access_grants" USING btree ("requested_at") WHERE "support_access_grants"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "support_access_grants_requested_by_identity_idx" ON "support_access_grants" USING btree ("requested_by_identity_id");--> statement-breakpoint
CREATE INDEX "support_access_grants_approved_by_identity_idx" ON "support_access_grants" USING btree ("approved_by_identity_id");--> statement-breakpoint
CREATE INDEX "support_access_grants_denied_by_identity_idx" ON "support_access_grants" USING btree ("denied_by_identity_id");--> statement-breakpoint
CREATE INDEX "support_access_grants_revoked_by_identity_idx" ON "support_access_grants" USING btree ("revoked_by_identity_id");
--> statement-breakpoint
CREATE FUNCTION public.sync_legacy_user_identity_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  affected_rows integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.identities (
      id,
      email,
      password_hash,
      status,
      credentials_updated_at,
      security_state_updated_at,
      suspended_at,
      disabled_at,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      NEW.password_hash,
      NEW.status::text::public.identity_status,
      NEW.updated_at,
      NEW.updated_at,
      CASE WHEN NEW.status::text = 'suspended' THEN NEW.updated_at ELSE NULL END,
      CASE WHEN NEW.status::text = 'disabled' THEN NEW.updated_at ELSE NULL END,
      NEW.created_at,
      NEW.updated_at
    );

    INSERT INTO public.tenant_memberships (
      id,
      tenant_id,
      identity_id,
      display_name,
      status,
      activated_at,
      suspended_at,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.tenant_id,
      NEW.id,
      NEW.display_name,
      CASE
        WHEN NEW.status::text = 'active' THEN 'active'::public.tenant_membership_status
        ELSE 'suspended'::public.tenant_membership_status
      END,
      NEW.created_at,
      CASE
        WHEN NEW.status::text IN ('suspended', 'disabled') THEN NEW.updated_at
        ELSE NULL
      END,
      NEW.created_at,
      NEW.updated_at
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'Legacy user IDs are immutable during the identity transition';
    END IF;

    UPDATE public.identities AS identity
    SET
      email = NEW.email,
      password_hash = NEW.password_hash,
      status = NEW.status::text::public.identity_status,
      credentials_updated_at = CASE
        WHEN NEW.email IS DISTINCT FROM OLD.email
          OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
        THEN NEW.updated_at
        ELSE identity.credentials_updated_at
      END,
      security_state_updated_at = CASE
        WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.updated_at
        ELSE identity.security_state_updated_at
      END,
      suspended_at = CASE
        WHEN NEW.status::text = 'active' THEN NULL
        WHEN NEW.status::text = 'suspended' THEN
          CASE
            WHEN OLD.status::text IN ('suspended', 'disabled')
            THEN COALESCE(identity.suspended_at, NEW.updated_at)
            ELSE NEW.updated_at
          END
        WHEN NEW.status::text = 'disabled' THEN
          CASE
            WHEN OLD.status::text IN ('suspended', 'disabled') THEN identity.suspended_at
            ELSE NULL
          END
      END,
      disabled_at = CASE
        WHEN NEW.status::text = 'disabled' THEN
          CASE
            WHEN OLD.status::text = 'disabled' THEN identity.disabled_at
            ELSE NEW.updated_at
          END
        ELSE NULL
      END,
      updated_at = NEW.updated_at
    WHERE identity.id = OLD.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = format(
          'Identity mirror missing for legacy user %s',
          OLD.id
        );
    END IF;

    UPDATE public.tenant_memberships AS membership
    SET
      tenant_id = NEW.tenant_id,
      display_name = NEW.display_name,
      status = CASE
        WHEN NEW.status::text = 'active' THEN 'active'::public.tenant_membership_status
        ELSE 'suspended'::public.tenant_membership_status
      END,
      default_organization_id = CASE
        WHEN NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN NULL
        ELSE membership.default_organization_id
      END,
      default_team_id = CASE
        WHEN NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN NULL
        ELSE membership.default_team_id
      END,
      suspended_at = CASE
        WHEN NEW.status::text = 'active' THEN NULL
        WHEN OLD.status::text = 'active' THEN NEW.updated_at
        ELSE membership.suspended_at
      END,
      updated_at = NEW.updated_at
    WHERE membership.id = OLD.id
      AND membership.identity_id = OLD.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = format(
          'Tenant membership mirror missing for legacy user %s',
          OLD.id
        );
    END IF;

    RETURN NEW;
  END IF;

  DELETE FROM public.tenant_memberships AS membership
  WHERE membership.id = OLD.id
    AND membership.tenant_id = OLD.tenant_id
    AND membership.identity_id = OLD.id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Tenant membership mirror missing for deleted legacy user %s',
        OLD.id
      );
  END IF;

  DELETE FROM public.identities AS identity
  WHERE identity.id = OLD.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships AS membership
      WHERE membership.identity_id = OLD.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.platform_access_grants AS platform_grant
      WHERE platform_grant.identity_id = OLD.id
        OR platform_grant.granted_by_identity_id = OLD.id
        OR platform_grant.revoked_by_identity_id = OLD.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.support_access_grants AS support_grant
      WHERE support_grant.platform_identity_id = OLD.id
        OR support_grant.requested_by_identity_id = OLD.id
        OR support_grant.approved_by_identity_id = OLD.id
        OR support_grant.denied_by_identity_id = OLD.id
        OR support_grant.revoked_by_identity_id = OLD.id
    );

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.identities AS identity
      WHERE identity.id = OLD.id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = format(
          'Identity mirror missing for deleted legacy user %s',
          OLD.id
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships AS membership
      WHERE membership.identity_id = OLD.id
    ) THEN
      UPDATE public.identities AS identity
      SET
        status = 'disabled'::public.identity_status,
        security_state_updated_at = clock_timestamp(),
        disabled_at = COALESCE(identity.disabled_at, clock_timestamp()),
        updated_at = GREATEST(identity.updated_at, clock_timestamp())
      WHERE identity.id = OLD.id;
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.sync_legacy_user_identity_membership() FROM PUBLIC;
--> statement-breakpoint
COMMENT ON FUNCTION public.sync_legacy_user_identity_membership() IS
  'Phase A compatibility bridge. Legacy users remain authoritative until the identity cutover removes this trigger.';
--> statement-breakpoint
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $preflight$
DECLARE
  violation_count bigint;
  violation_sample text;
BEGIN
  WITH duplicate_normalized_emails AS (
    SELECT lower(btrim(email)) AS normalized_email
    FROM public.users
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ),
  violations AS (
    SELECT 'users.email_not_normalized' AS issue, id::text AS row_id
    FROM public.users
    WHERE email IS DISTINCT FROM lower(btrim(email))

    UNION ALL

    SELECT 'users.email_blank', id::text
    FROM public.users
    WHERE char_length(btrim(email)) = 0

    UNION ALL

    SELECT 'users.password_hash_blank', id::text
    FROM public.users
    WHERE char_length(btrim(password_hash)) = 0

    UNION ALL

    SELECT 'users.display_name_invalid', id::text
    FROM public.users
    WHERE display_name IS NOT NULL
      AND (
        display_name IS DISTINCT FROM btrim(display_name)
        OR char_length(display_name) = 0
      )

    UNION ALL

    SELECT 'users.timestamp_order', id::text
    FROM public.users
    WHERE updated_at < created_at

    UNION ALL

    SELECT 'users.normalized_email_duplicate', normalized_email
    FROM duplicate_normalized_emails

    UNION ALL

    SELECT 'users.tenant_missing', users.id::text
    FROM public.users AS users
    LEFT JOIN public.tenants AS tenants
      ON tenants.id = users.tenant_id
    WHERE tenants.id IS NULL

    UNION ALL

    SELECT 'user_access_grants.user_tenant_mismatch', grants.id::text
    FROM public.user_access_grants AS grants
    LEFT JOIN public.users AS users
      ON users.id = grants.user_id
    WHERE users.id IS NULL
      OR users.tenant_id IS DISTINCT FROM grants.tenant_id

    UNION ALL

    SELECT 'auth_sessions.user_missing', sessions.id::text
    FROM public.auth_sessions AS sessions
    LEFT JOIN public.users AS users
      ON users.id = sessions.user_id
    WHERE users.id IS NULL
  )
  SELECT
    count(*),
    (
      SELECT string_agg(format('%s[%s]', issue, row_id), ', ' ORDER BY issue, row_id)
      FROM (
        SELECT issue, row_id
        FROM violations
        ORDER BY issue, row_id
        LIMIT 20
      ) AS sample
    )
  INTO violation_count, violation_sample
  FROM violations;

  IF violation_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Identity backfill preflight failed with %s violation(s): %s',
        violation_count,
        violation_sample
      );
  END IF;
END;
$preflight$;
--> statement-breakpoint
INSERT INTO public.identities (
  id,
  email,
  password_hash,
  status,
  credentials_updated_at,
  security_state_updated_at,
  suspended_at,
  disabled_at,
  created_at,
  updated_at
)
SELECT
  users.id,
  users.email,
  users.password_hash,
  users.status::text::public.identity_status,
  users.updated_at,
  users.updated_at,
  CASE WHEN users.status::text = 'suspended' THEN users.updated_at ELSE NULL END,
  CASE WHEN users.status::text = 'disabled' THEN users.updated_at ELSE NULL END,
  users.created_at,
  users.updated_at
FROM public.users AS users;
--> statement-breakpoint
INSERT INTO public.tenant_memberships (
  id,
  tenant_id,
  identity_id,
  display_name,
  status,
  activated_at,
  suspended_at,
  created_at,
  updated_at
)
SELECT
  users.id,
  users.tenant_id,
  users.id,
  users.display_name,
  CASE
    WHEN users.status::text = 'active' THEN 'active'::public.tenant_membership_status
    ELSE 'suspended'::public.tenant_membership_status
  END,
  users.created_at,
  CASE
    WHEN users.status::text IN ('suspended', 'disabled') THEN users.updated_at
    ELSE NULL
  END,
  users.created_at,
  users.updated_at
FROM public.users AS users;
--> statement-breakpoint
DO $reconciliation$
DECLARE
  source_count bigint;
  identity_count bigint;
  membership_count bigint;
  identity_mismatch_count bigint;
  membership_mismatch_count bigint;
  grant_mismatch_count bigint;
  session_mismatch_count bigint;
  platform_grant_count bigint;
  support_grant_count bigint;
BEGIN
  SELECT count(*) INTO source_count FROM public.users;
  SELECT count(*) INTO identity_count FROM public.identities;
  SELECT count(*) INTO membership_count FROM public.tenant_memberships;
  SELECT count(*) INTO platform_grant_count FROM public.platform_access_grants;
  SELECT count(*) INTO support_grant_count FROM public.support_access_grants;

  SELECT count(*)
  INTO identity_mismatch_count
  FROM public.users AS users
  FULL JOIN public.identities AS identities
    ON identities.id = users.id
  WHERE users.id IS NULL
    OR identities.id IS NULL
    OR identities.email IS DISTINCT FROM users.email
    OR identities.password_hash IS DISTINCT FROM users.password_hash
    OR identities.status::text IS DISTINCT FROM users.status::text
    OR identities.credentials_updated_at IS DISTINCT FROM users.updated_at
    OR identities.security_state_updated_at IS DISTINCT FROM users.updated_at
    OR identities.suspended_at IS DISTINCT FROM CASE
      WHEN users.status::text = 'suspended' THEN users.updated_at
      ELSE NULL
    END
    OR identities.disabled_at IS DISTINCT FROM CASE
      WHEN users.status::text = 'disabled' THEN users.updated_at
      ELSE NULL
    END
    OR identities.email_verified_at IS NOT NULL
    OR identities.mfa_enrolled_at IS NOT NULL
    OR identities.mfa_recovery_codes_rotated_at IS NOT NULL
    OR identities.last_authenticated_at IS NOT NULL
    OR identities.created_at IS DISTINCT FROM users.created_at
    OR identities.updated_at IS DISTINCT FROM users.updated_at;

  SELECT count(*)
  INTO membership_mismatch_count
  FROM public.users AS users
  FULL JOIN public.tenant_memberships AS memberships
    ON memberships.id = users.id
  WHERE users.id IS NULL
    OR memberships.id IS NULL
    OR memberships.tenant_id IS DISTINCT FROM users.tenant_id
    OR memberships.identity_id IS DISTINCT FROM users.id
    OR memberships.display_name IS DISTINCT FROM users.display_name
    OR memberships.status::text IS DISTINCT FROM CASE
      WHEN users.status::text = 'active' THEN 'active'
      ELSE 'suspended'
    END
    OR memberships.invited_at IS NOT NULL
    OR memberships.activated_at IS DISTINCT FROM users.created_at
    OR memberships.suspended_at IS DISTINCT FROM CASE
      WHEN users.status::text IN ('suspended', 'disabled') THEN users.updated_at
      ELSE NULL
    END
    OR memberships.departed_at IS NOT NULL
    OR memberships.default_organization_id IS NOT NULL
    OR memberships.default_team_id IS NOT NULL
    OR memberships.created_at IS DISTINCT FROM users.created_at
    OR memberships.updated_at IS DISTINCT FROM users.updated_at;

  SELECT count(*)
  INTO grant_mismatch_count
  FROM public.user_access_grants AS grants
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = grants.tenant_id
    AND memberships.id = grants.user_id
  WHERE memberships.id IS NULL;

  SELECT count(*)
  INTO session_mismatch_count
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.user_id
  WHERE identities.id IS NULL;

  IF source_count <> identity_count
    OR source_count <> membership_count
    OR identity_mismatch_count <> 0
    OR membership_mismatch_count <> 0
    OR grant_mismatch_count <> 0
    OR session_mismatch_count <> 0
    OR platform_grant_count <> 0
    OR support_grant_count <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Identity reconciliation failed: users=%s identities=%s memberships=%s identity_mismatches=%s membership_mismatches=%s grant_mismatches=%s session_mismatches=%s platform_grants=%s support_grants=%s',
        source_count,
        identity_count,
        membership_count,
        identity_mismatch_count,
        membership_mismatch_count,
        grant_mismatch_count,
        session_mismatch_count,
        platform_grant_count,
        support_grant_count
      );
  END IF;
END;
$reconciliation$;
--> statement-breakpoint
CREATE TRIGGER users_identity_membership_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_legacy_user_identity_membership();
--> statement-breakpoint
COMMENT ON TRIGGER users_identity_membership_sync_trigger ON public.users IS
  'Phase A one-way mirror from legacy users into identities and tenant_memberships.';
