CREATE TABLE "tenant_security_policies" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"require_mfa" boolean DEFAULT false NOT NULL,
	"password_min_length" integer DEFAULT 12 NOT NULL,
	"session_max_hours" integer DEFAULT 168 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_security_password_length_check" CHECK ("tenant_security_policies"."password_min_length" BETWEEN 12 AND 128),
	CONSTRAINT "tenant_security_session_hours_check" CHECK ("tenant_security_policies"."session_max_hours" BETWEEN 1 AND 168)
);
--> statement-breakpoint
CREATE TABLE "membership_invitations" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_invitation_attempts_check" CHECK ("membership_invitations"."attempts" BETWEEN 0 AND 10)
);
--> statement-breakpoint
ALTER TABLE "tenant_security_policies" ADD CONSTRAINT "tenant_security_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_tenant_id_membership_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_invitations_membership_idx" ON "membership_invitations" USING btree ("tenant_id","membership_id");