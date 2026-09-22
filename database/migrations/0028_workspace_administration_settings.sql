CREATE TABLE "team_settings" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"manager_membership_id" uuid,
	"capacity" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_settings_capacity_check" CHECK ("team_settings"."capacity" between 1 and 100000)
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"locale" varchar(35) DEFAULT 'en' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_team_fk" FOREIGN KEY ("tenant_id","organization_id","team_id") REFERENCES "public"."teams"("tenant_id","organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_manager_fk" FOREIGN KEY ("tenant_id","manager_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;