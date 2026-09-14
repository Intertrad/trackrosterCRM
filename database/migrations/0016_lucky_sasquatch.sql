CREATE TYPE "public"."region_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."region_type" AS ENUM('country', 'administrative', 'city', 'sales_territory');--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100),
	"type" "region_type" NOT NULL,
	"parent_region_id" uuid,
	"status" "region_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "regions_name_not_blank_check" CHECK (
        length(
          btrim("regions"."name")
        ) > 0
      ),
	CONSTRAINT "regions_code_not_blank_check" CHECK (
        "regions"."code" IS NULL
        OR length(
          btrim("regions"."code")
        ) > 0
      ),
	CONSTRAINT "regions_parent_not_self_check" CHECK (
        "regions"."parent_region_id" IS NULL
        OR "regions"."parent_region_id" <> "regions"."id"
      )
);
--> statement-breakpoint
ALTER TABLE "establishments" ADD COLUMN "location" geometry(point) GENERATED ALWAYS AS (
        CASE
          WHEN
            "establishments"."latitude" IS NULL
            OR "establishments"."longitude" IS NULL
          THEN NULL
          ELSE ST_SetSRID(
            ST_MakePoint(
              "establishments"."longitude",
              "establishments"."latitude"
            ),
            4326
          )
        END
      ) STORED;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_tenant_parent_region_fk" FOREIGN KEY ("tenant_id","parent_region_id") REFERENCES "public"."regions"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "regions_tenant_code_unique" ON "regions" USING btree ("tenant_id","code") WHERE "regions"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "regions_tenant_id_idx" ON "regions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "regions_tenant_parent_idx" ON "regions" USING btree ("tenant_id","parent_region_id");--> statement-breakpoint
CREATE INDEX "regions_tenant_type_idx" ON "regions" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "regions_tenant_status_idx" ON "regions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "establishments_location_gist_idx" ON "establishments" USING gist ("location") WHERE "establishments"."location" IS NOT NULL;