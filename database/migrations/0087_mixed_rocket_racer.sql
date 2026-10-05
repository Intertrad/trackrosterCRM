CREATE TYPE "public"."prospect_follow_up_review_status" AS ENUM('none', 'pending');--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD COLUMN "review_status" "prospect_follow_up_review_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD COLUMN "completed_late" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
/* Preserve requests created before the durable review state was introduced. */
UPDATE "prospect_follow_ups" f
SET "review_status" = 'pending'
FROM "audit_events" request
WHERE request."tenant_id" = f."tenant_id"
  AND request."resource_type" = 'follow_up_review'
  AND request."action" = 'follow_up.reschedule_requested'
  AND request."metadata"->>'followUpId' = f."id"::text
  AND NOT EXISTS (
    SELECT 1
    FROM "audit_events" decision
    WHERE decision."tenant_id" = request."tenant_id"
      AND decision."resource_type" = 'follow_up_review'
      AND decision."resource_id" = request."resource_id"
      AND decision."action" IN (
        'follow_up.reschedule_approved',
        'follow_up.reschedule_rejected',
        'follow_up.completed_late'
      )
  );
--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_tenant_review_status_idx"
  ON "prospect_follow_ups" USING btree ("tenant_id", "review_status", "updated_at");
