CREATE TABLE "prospect_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"label" varchar(100),
	"line1" varchar(255) NOT NULL,
	"line2" varchar(255),
	"postal_code" varchar(32),
	"city" varchar(150),
	"region" varchar(150),
	"country_code" varchar(2) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"is_primary" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_addresses_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "prospect_addresses_coordinates_check" CHECK (("prospect_addresses"."latitude" IS NULL AND "prospect_addresses"."longitude" IS NULL) OR ("prospect_addresses"."latitude" IS NOT NULL AND "prospect_addresses"."longitude" IS NOT NULL AND "prospect_addresses"."latitude" BETWEEN -90 AND 90 AND "prospect_addresses"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "prospect_addresses_country_check" CHECK ("prospect_addresses"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "prospect_addresses" ADD CONSTRAINT "prospect_addresses_tenant_id_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_addresses_parent_idx" ON "prospect_addresses" USING btree ("tenant_id","prospect_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_addresses_primary_unique" ON "prospect_addresses" USING btree ("tenant_id","prospect_id") WHERE "prospect_addresses"."is_primary" AND "prospect_addresses"."deleted_at" IS NULL;