CREATE TABLE "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_member_emoji_unique" UNIQUE("tenant_id","message_id","membership_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_tenant_id_membership_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_reactions_message_idx" ON "message_reactions" USING btree ("tenant_id","message_id");--> statement-breakpoint
ALTER TABLE "message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "message_reactions_tenant_isolation" ON "message_reactions"
  USING (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('trackroster.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "message_reactions" FORCE ROW LEVEL SECURITY;
