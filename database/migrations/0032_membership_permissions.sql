CREATE TABLE "membership_settings" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"capacity" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_capacity_check" CHECK ("membership_settings"."capacity" IS NULL OR "membership_settings"."capacity" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
CREATE TABLE "tenant_role_permissions" (
	"tenant_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"permissions" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_role_permissions_tenant_id_role_pk" PRIMARY KEY("tenant_id","role"),
	CONSTRAINT "tenant_role_permissions_role_check" CHECK ("tenant_role_permissions"."role" IN ('director', 'manager', 'prospector', 'auditor')),
	CONSTRAINT "tenant_role_permissions_array_check" CHECK (jsonb_typeof("tenant_role_permissions"."permissions") = 'array')
);
--> statement-breakpoint
ALTER TABLE "membership_settings" ADD CONSTRAINT "membership_settings_tenant_id_membership_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;