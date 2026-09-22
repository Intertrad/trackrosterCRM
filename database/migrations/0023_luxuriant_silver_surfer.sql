SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '5min';
--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "campaign_prospect_assignments_tenant_prospect_id_unique" UNIQUE("tenant_id","campaign_prospect_id","id");
--> statement-breakpoint
CREATE INDEX "prospect_activities_tenant_assignment_prospect_idx" ON "prospect_activities" USING btree ("tenant_id","assignment_id","campaign_prospect_id");
--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_tenant_assignment_prospect_idx" ON "prospect_follow_ups" USING btree ("tenant_id","assignment_id","campaign_prospect_id");
--> statement-breakpoint
CREATE INDEX "collision_overrides_tenant_assignment_prospect_idx" ON "collision_overrides" USING btree ("tenant_id","assignment_id","campaign_prospect_id");
--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_tenant_prospect_assignment_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","campaign_prospect_id","id") ON DELETE restrict ON UPDATE cascade NOT VALID;
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_prospect_assignment_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","campaign_prospect_id","id") ON DELETE restrict ON UPDATE cascade NOT VALID;
--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_prospect_assignment_fk" FOREIGN KEY ("tenant_id","campaign_prospect_id","assignment_id") REFERENCES "public"."campaign_prospect_assignments"("tenant_id","campaign_prospect_id","id") ON DELETE restrict ON UPDATE cascade NOT VALID;
--> statement-breakpoint
ALTER TABLE "prospect_activities" VALIDATE CONSTRAINT "prospect_activities_tenant_prospect_assignment_fk";
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" VALIDATE CONSTRAINT "prospect_follow_ups_tenant_prospect_assignment_fk";
--> statement-breakpoint
ALTER TABLE "collision_overrides" VALIDATE CONSTRAINT "collision_overrides_tenant_prospect_assignment_fk";
--> statement-breakpoint
ALTER TABLE "prospect_activities" DROP CONSTRAINT "prospect_activities_tenant_assignment_fk";
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" DROP CONSTRAINT "prospect_follow_ups_tenant_assignment_fk";
--> statement-breakpoint
ALTER TABLE "collision_overrides" DROP CONSTRAINT "collision_overrides_tenant_assignment_fk";
