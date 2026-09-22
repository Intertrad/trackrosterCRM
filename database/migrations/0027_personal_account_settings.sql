CREATE TABLE "account_settings" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" varchar(40),
	"locale" varchar(35) DEFAULT 'en' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_tenant_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;