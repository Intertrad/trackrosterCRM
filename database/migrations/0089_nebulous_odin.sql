ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD COLUMN "deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "campaign_prospect_assignments_tenant_manager_fk" FOREIGN KEY ("tenant_id","manager_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "campaign_prospect_assignments_tenant_manager_idx" ON "campaign_prospect_assignments" USING btree ("tenant_id","manager_id");--> statement-breakpoint
CREATE INDEX "campaign_prospect_assignments_tenant_deadline_idx" ON "campaign_prospect_assignments" USING btree ("tenant_id","deadline_at");