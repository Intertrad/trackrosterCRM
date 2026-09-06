CREATE TYPE "public"."establishment_source" AS ENUM('manual', 'import', 'api');--> statement-breakpoint
CREATE TYPE "public"."establishment_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_reference" varchar(255),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"address_line1" varchar(255),
	"postal_code" varchar(32),
	"city" varchar(150),
	"country_code" varchar(2) NOT NULL,
	"phone" varchar(50),
	"website" varchar(2048),
	"latitude" double precision,
	"longitude" double precision,
	"status" "establishment_status" DEFAULT 'active' NOT NULL,
	"source" "establishment_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "establishments_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "establishments_country_code_uppercase_check" CHECK (
        "establishments"."country_code"
        =
        upper("establishments"."country_code")
      ),
	CONSTRAINT "establishments_coordinates_pair_check" CHECK (
        (
          "establishments"."latitude" IS NULL
          AND "establishments"."longitude" IS NULL
        )
        OR
        (
          "establishments"."latitude" IS NOT NULL
          AND "establishments"."longitude" IS NOT NULL
        )
      ),
	CONSTRAINT "establishments_latitude_range_check" CHECK (
        "establishments"."latitude" IS NULL
        OR
        (
          "establishments"."latitude" >= -90
          AND "establishments"."latitude" <= 90
        )
      ),
	CONSTRAINT "establishments_longitude_range_check" CHECK (
        "establishments"."longitude" IS NULL
        OR
        (
          "establishments"."longitude" >= -180
          AND "establishments"."longitude" <= 180
        )
      )
);
--> statement-breakpoint
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "establishments_tenant_source_external_reference_unique" ON "establishments" USING btree ("tenant_id","source","external_reference") WHERE "establishments"."external_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "establishments_tenant_id_idx" ON "establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "establishments_tenant_normalized_name_idx" ON "establishments" USING btree ("tenant_id","normalized_name");--> statement-breakpoint
CREATE INDEX "establishments_tenant_postal_code_idx" ON "establishments" USING btree ("tenant_id","postal_code");--> statement-breakpoint
CREATE INDEX "establishments_tenant_city_idx" ON "establishments" USING btree ("tenant_id","city");