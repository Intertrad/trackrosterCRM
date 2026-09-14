CREATE TYPE "public"."idempotency_record_status" AS ENUM('processing', 'completed', 'uncertain');--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" varchar(128) NOT NULL,
	"idempotency_key_hash" varchar(64) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status" "idempotency_record_status" DEFAULT 'processing' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_boundary_unique" UNIQUE("tenant_id","user_id","operation","idempotency_key_hash"),
	CONSTRAINT "idempotency_records_key_hash_check" CHECK (
          "idempotency_records"."idempotency_key_hash"
          ~ '^[0-9a-f]{64}$'
        ),
	CONSTRAINT "idempotency_records_request_hash_check" CHECK (
          "idempotency_records"."request_hash"
          ~ '^[0-9a-f]{64}$'
        ),
	CONSTRAINT "idempotency_records_operation_check" CHECK (
          "idempotency_records"."operation"
          ~ '^[a-z][a-z0-9_]*.[a-z][a-z0-9_]*$'
        ),
	CONSTRAINT "idempotency_records_expiry_check" CHECK (
          "idempotency_records"."expires_at"
          > "idempotency_records"."created_at"
        ),
	CONSTRAINT "idempotency_records_state_check" CHECK (
          (
            "idempotency_records"."status" = 'processing'
            AND "idempotency_records"."response_status" IS NULL
            AND "idempotency_records"."response_body" IS NULL
            AND "idempotency_records"."finalized_at" IS NULL
          )
          OR
          (
            "idempotency_records"."status" = 'completed'
            AND "idempotency_records"."response_status"
              BETWEEN 100 AND 599
            AND "idempotency_records"."finalized_at" IS NOT NULL
          )
          OR
          (
            "idempotency_records"."status" = 'uncertain'
            AND "idempotency_records"."response_status" IS NULL
            AND "idempotency_records"."response_body" IS NULL
            AND "idempotency_records"."finalized_at" IS NOT NULL
          )
        )
);
--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_records_tenant_status_idx" ON "idempotency_records" USING btree ("tenant_id","status");