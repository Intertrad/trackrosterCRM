CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(128) NOT NULL,
	"resource_type" varchar(128) NOT NULL,
	"resource_id" varchar(512) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_check" CHECK (
        (
          "audit_events"."actor_type" = 'user'
          AND
          "audit_events"."actor_user_id" IS NOT NULL
        )
        OR
        (
          "audit_events"."actor_type" = 'system'
          AND
          "audit_events"."actor_user_id" IS NULL
        )
      ),
	CONSTRAINT "audit_events_action_not_blank_check" CHECK (
        char_length(
          btrim("audit_events"."action")
        ) > 0
      ),
	CONSTRAINT "audit_events_resource_type_not_blank_check" CHECK (
        char_length(
          btrim("audit_events"."resource_type")
        ) > 0
      ),
	CONSTRAINT "audit_events_resource_id_not_blank_check" CHECK (
        char_length(
          btrim("audit_events"."resource_id")
        ) > 0
      )
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_actor_user_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_actor_occurred_idx" ON "audit_events" USING btree ("tenant_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_resource_occurred_idx" ON "audit_events" USING btree ("tenant_id","resource_type","resource_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_action_occurred_idx" ON "audit_events" USING btree ("tenant_id","action","occurred_at");