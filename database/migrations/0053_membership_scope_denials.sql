CREATE TABLE "membership_scope_denials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scope_type" varchar(20) NOT NULL,
	"resource_id" uuid NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_scope_denials_type_check" CHECK ("membership_scope_denials"."scope_type" IN ('tenant','organization','team','campaign','territory')),
	CONSTRAINT "membership_scope_denials_reason_check" CHECK (char_length(btrim("membership_scope_denials"."reason"))>=3)
);
--> statement-breakpoint
ALTER TABLE "membership_scope_denials" ADD CONSTRAINT "membership_scope_denials_tenant_id_user_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_scope_denials_unique" ON "membership_scope_denials" USING btree ("tenant_id","user_id","scope_type","resource_id");--> statement-breakpoint
CREATE INDEX "membership_scope_denials_member_idx" ON "membership_scope_denials" USING btree ("tenant_id","user_id");