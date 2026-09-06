CREATE TYPE "public"."access_scope" AS ENUM('tenant', 'organization', 'team');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client_admin', 'director', 'manager', 'prospector', 'observer');--> statement-breakpoint
CREATE TABLE "user_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"scope_type" "access_scope" NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_access_grants_scope_shape_check" CHECK (
        (
          "user_access_grants"."scope_type" = 'tenant'
          AND "user_access_grants"."organization_id" IS NULL
          AND "user_access_grants"."team_id" IS NULL
        )
        OR
        (
          "user_access_grants"."scope_type" = 'organization'
          AND "user_access_grants"."organization_id" IS NOT NULL
          AND "user_access_grants"."team_id" IS NULL
        )
        OR
        (
          "user_access_grants"."scope_type" = 'team'
          AND "user_access_grants"."organization_id" IS NOT NULL
          AND "user_access_grants"."team_id" IS NOT NULL
        )
      ),
	CONSTRAINT "user_access_grants_role_scope_check" CHECK (
        (
          "user_access_grants"."role" = 'client_admin'
          AND "user_access_grants"."scope_type" = 'tenant'
        )
        OR
        (
          "user_access_grants"."role" = 'director'
          AND "user_access_grants"."scope_type" = 'organization'
        )
        OR
        (
          "user_access_grants"."role" = 'manager'
          AND "user_access_grants"."scope_type" = 'team'
        )
        OR
        (
          "user_access_grants"."role" = 'prospector'
          AND "user_access_grants"."scope_type" = 'team'
        )
        OR
        (
          "user_access_grants"."role" = 'observer'
          AND "user_access_grants"."scope_type" IN (
            'tenant',
            'organization',
            'team'
          )
        )
      )
);
--> statement-breakpoint
ALTER TABLE "users"
ADD CONSTRAINT "users_tenant_id_id_unique"
UNIQUE ("tenant_id", "id");
--> statement-breakpoint

ALTER TABLE "teams"
ADD CONSTRAINT "teams_tenant_organization_id_id_unique"
UNIQUE ("tenant_id", "organization_id", "id");
--> statement-breakpoint
ALTER TABLE "user_access_grants" ADD CONSTRAINT "user_access_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_access_grants" ADD CONSTRAINT "user_access_grants_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_access_grants" ADD CONSTRAINT "user_access_grants_tenant_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_access_grants" ADD CONSTRAINT "user_access_grants_tenant_organization_team_fk" FOREIGN KEY ("tenant_id","organization_id","team_id") REFERENCES "public"."teams"("tenant_id","organization_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_access_grants_tenant_id_idx" ON "user_access_grants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_access_grants_tenant_user_idx" ON "user_access_grants" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "user_access_grants_tenant_organization_idx" ON "user_access_grants" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "user_access_grants_tenant_team_idx" ON "user_access_grants" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_grants_tenant_scope_unique" ON "user_access_grants" USING btree ("tenant_id","user_id","role") WHERE "user_access_grants"."scope_type" = 'tenant';--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_grants_organization_scope_unique" ON "user_access_grants" USING btree ("tenant_id","user_id","role","organization_id") WHERE "user_access_grants"."scope_type" = 'organization';--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_grants_team_scope_unique" ON "user_access_grants" USING btree ("tenant_id","user_id","role","organization_id","team_id") WHERE "user_access_grants"."scope_type" = 'team';