CREATE TABLE "auth_mfa_challenges" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"purpose" varchar(16) NOT NULL,
	"encrypted_secret" text,
	"credentials_updated_at" timestamp with time zone NOT NULL,
	"security_state_updated_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_mfa_challenge_purpose_check" CHECK (("auth_mfa_challenges"."purpose" = 'login' AND "auth_mfa_challenges"."encrypted_secret" IS NULL) OR ("auth_mfa_challenges"."purpose" = 'enroll' AND "auth_mfa_challenges"."encrypted_secret" IS NOT NULL)),
	CONSTRAINT "auth_mfa_challenge_attempts_check" CHECK ("auth_mfa_challenges"."attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "auth_mfa_factors" (
	"identity_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_secret" text NOT NULL,
	"last_used_step" integer DEFAULT -1 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_mfa_recovery_codes" (
	"code_hash" varchar(64) PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth_mfa_challenges" ADD CONSTRAINT "auth_mfa_challenges_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa_factors" ADD CONSTRAINT "auth_mfa_factors_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa_recovery_codes" ADD CONSTRAINT "auth_mfa_recovery_codes_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_mfa_challenge_identity_idx" ON "auth_mfa_challenges" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "auth_mfa_challenge_expiry_idx" ON "auth_mfa_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_mfa_recovery_identity_idx" ON "auth_mfa_recovery_codes" USING btree ("identity_id");