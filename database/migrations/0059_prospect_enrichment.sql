CREATE TABLE "prospect_custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"field_key" varchar(64) NOT NULL,
	"label" varchar(100) NOT NULL,
	"data_type" varchar(16) NOT NULL,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_fields_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "custom_fields_key_unique" UNIQUE("tenant_id","field_key"),
	CONSTRAINT "custom_fields_type_check" CHECK ("prospect_custom_field_definitions"."data_type" IN ('text','number','date','boolean','select','multi_select','json'))
);
--> statement-breakpoint
CREATE TABLE "prospect_custom_field_values" (
	"tenant_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_custom_field_values_tenant_id_prospect_id_definition_id_pk" PRIMARY KEY("tenant_id","prospect_id","definition_id")
);
--> statement-breakpoint
CREATE TABLE "prospect_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"left_prospect_id" uuid NOT NULL,
	"right_prospect_id" uuid NOT NULL,
	"matching_keys" jsonb NOT NULL,
	"resolution" varchar(20) DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicates_pair_unique" UNIQUE("tenant_id","left_prospect_id","right_prospect_id"),
	CONSTRAINT "duplicates_order_check" CHECK ("prospect_duplicates"."left_prospect_id"<"prospect_duplicates"."right_prospect_id"),
	CONSTRAINT "duplicates_resolution_check" CHECK ("prospect_duplicates"."resolution" IN ('pending','not_duplicate','merged'))
);
--> statement-breakpoint
CREATE TABLE "prospect_merges" (
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"merged_by" uuid NOT NULL,
	CONSTRAINT "prospect_merges_tenant_id_source_id_pk" PRIMARY KEY("tenant_id","source_id"),
	CONSTRAINT "prospect_merges_distinct" CHECK ("prospect_merges"."source_id"<>"prospect_merges"."target_id")
);
--> statement-breakpoint
CREATE TABLE "prospect_tags" (
	"tenant_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "prospect_tags_tenant_id_prospect_id_tag_id_pk" PRIMARY KEY("tenant_id","prospect_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(7),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tags_name_check" CHECK (length(btrim("tags"."name"))>0)
);
--> statement-breakpoint
ALTER TABLE "prospect_custom_field_definitions" ADD CONSTRAINT "prospect_custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_custom_field_values" ADD CONSTRAINT "prospect_custom_field_values_tenant_id_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_custom_field_values" ADD CONSTRAINT "prospect_custom_field_values_tenant_id_definition_id_prospect_custom_field_definitions_tenant_id_id_fk" FOREIGN KEY ("tenant_id","definition_id") REFERENCES "public"."prospect_custom_field_definitions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_custom_field_values" ADD CONSTRAINT "prospect_custom_field_values_tenant_id_updated_by_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","updated_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_duplicates" ADD CONSTRAINT "prospect_duplicates_tenant_id_left_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","left_prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_duplicates" ADD CONSTRAINT "prospect_duplicates_tenant_id_right_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","right_prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_duplicates" ADD CONSTRAINT "prospect_duplicates_tenant_id_resolved_by_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","resolved_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_merges" ADD CONSTRAINT "prospect_merges_tenant_id_source_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_merges" ADD CONSTRAINT "prospect_merges_tenant_id_target_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","target_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_merges" ADD CONSTRAINT "prospect_merges_tenant_id_merged_by_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","merged_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_tenant_id_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_tenant_id_tag_id_tags_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_values_definition_idx" ON "prospect_custom_field_values" USING btree ("tenant_id","definition_id");--> statement-breakpoint
CREATE INDEX "duplicates_status_idx" ON "prospect_duplicates" USING btree ("tenant_id","resolution","id");--> statement-breakpoint
CREATE INDEX "prospect_merges_target_idx" ON "prospect_merges" USING btree ("tenant_id","target_id");--> statement-breakpoint
CREATE INDEX "prospect_tags_tag_idx" ON "prospect_tags" USING btree ("tenant_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique" ON "tags" USING btree ("tenant_id",lower("name"));