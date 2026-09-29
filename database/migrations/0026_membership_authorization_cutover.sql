CREATE TABLE "auth_workspace_challenges" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"credentials_updated_at" timestamp with time zone NOT NULL,
	"security_state_updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_workspace_challenges_hash_check" CHECK ("auth_workspace_challenges"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_workspace_challenges_expiry_check" CHECK ("auth_workspace_challenges"."expires_at" > "auth_workspace_challenges"."created_at")
);
--> statement-breakpoint
ALTER TABLE "user_access_grants" DROP CONSTRAINT "user_access_grants_tenant_user_fk";
--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" DROP CONSTRAINT "campaign_prospect_assignments_tenant_user_fk";
--> statement-breakpoint
ALTER TABLE "prospect_activities" DROP CONSTRAINT "prospect_activities_tenant_user_fk";
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" DROP CONSTRAINT "prospect_follow_ups_tenant_assigned_user_fk";
--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" DROP CONSTRAINT "prospect_follow_ups_tenant_created_by_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenant_recipient_fk";
--> statement-breakpoint
ALTER TABLE "collision_overrides" DROP CONSTRAINT "collision_overrides_tenant_prospector_fk";
--> statement-breakpoint
ALTER TABLE "collision_overrides" DROP CONSTRAINT "collision_overrides_tenant_approver_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_tenant_actor_user_fk";
--> statement-breakpoint
ALTER TABLE "idempotency_records" DROP CONSTRAINT "idempotency_records_tenant_user_fk";
--> statement-breakpoint
ALTER TABLE "auth_workspace_challenges" ADD CONSTRAINT "auth_workspace_challenges_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_workspace_challenges_expiry_idx" ON "auth_workspace_challenges" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "user_access_grants" ADD CONSTRAINT "user_access_grants_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_prospect_assignments" ADD CONSTRAINT "campaign_prospect_assignments_tenant_user_fk" FOREIGN KEY ("tenant_id","assigned_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_assigned_user_fk" FOREIGN KEY ("tenant_id","assigned_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_tenant_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_recipient_fk" FOREIGN KEY ("tenant_id","recipient_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_prospector_fk" FOREIGN KEY ("tenant_id","prospector_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collision_overrides" ADD CONSTRAINT "collision_overrides_tenant_approver_fk" FOREIGN KEY ("tenant_id","approved_by_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_actor_user_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;