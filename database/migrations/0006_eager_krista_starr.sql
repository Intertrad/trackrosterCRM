CREATE TYPE "public"."establishment_contact_source" AS ENUM('manual', 'import', 'api');--> statement-breakpoint
CREATE TYPE "public"."establishment_contact_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TABLE "establishment_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"establishment_id" uuid NOT NULL,
	"name" varchar(255),
	"job_title" varchar(150),
	"email" varchar(320),
	"phone" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "establishment_contact_status" DEFAULT 'active' NOT NULL,
	"source" "establishment_contact_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "establishment_contacts_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "establishment_contacts_identity_check" CHECK (
        nullif(btrim("establishment_contacts"."name"), '') IS NOT NULL
        OR nullif(btrim("establishment_contacts"."email"), '') IS NOT NULL
        OR nullif(btrim("establishment_contacts"."phone"), '') IS NOT NULL
      ),
	CONSTRAINT "establishment_contacts_email_lowercase_check" CHECK (
        "establishment_contacts"."email" IS NULL
        OR "establishment_contacts"."email" = lower(btrim("establishment_contacts"."email"))
      ),
	CONSTRAINT "establishment_contacts_primary_active_check" CHECK (
    "establishment_contacts"."is_primary" = false
    OR "establishment_contacts"."status" = 'active'
  )
);
--> statement-breakpoint
ALTER TABLE "establishment_contacts" ADD CONSTRAINT "establishment_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "establishment_contacts" ADD CONSTRAINT "establishment_contacts_tenant_establishment_fk" FOREIGN KEY ("tenant_id","establishment_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "establishment_contacts_tenant_establishment_email_unique" ON "establishment_contacts" USING btree ("tenant_id","establishment_id","email") WHERE "establishment_contacts"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "establishment_contacts_primary_unique" ON "establishment_contacts" USING btree ("tenant_id","establishment_id") WHERE "establishment_contacts"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "establishment_contacts_tenant_id_idx" ON "establishment_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "establishment_contacts_establishment_id_idx" ON "establishment_contacts" USING btree ("tenant_id","establishment_id");