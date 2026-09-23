ALTER TABLE "prospect_duplicates" DROP CONSTRAINT "prospect_duplicates_tenant_id_left_prospect_id_establishments_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "prospect_duplicates" DROP CONSTRAINT "prospect_duplicates_tenant_id_right_prospect_id_establishments_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "prospect_duplicates" ADD CONSTRAINT "prospect_duplicates_tenant_id_left_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","left_prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_duplicates" ADD CONSTRAINT "prospect_duplicates_tenant_id_right_prospect_id_establishments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","right_prospect_id") REFERENCES "public"."establishments"("tenant_id","id") ON DELETE cascade ON UPDATE no action;