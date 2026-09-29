CREATE TABLE "auth_mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encrypted_payload" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_password_resets" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"credentials_updated_at" timestamp with time zone NOT NULL,
	"security_state_updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_password_resets" ADD CONSTRAINT "auth_password_resets_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_mail_outbox_pending_idx" ON "auth_mail_outbox" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "auth_password_resets_identity_idx" ON "auth_password_resets" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "auth_password_resets_expiry_idx" ON "auth_password_resets" USING btree ("expires_at");