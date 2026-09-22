ALTER TABLE "idempotency_records" DROP CONSTRAINT "idempotency_records_operation_check";--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_operation_check" CHECK (
          "idempotency_records"."operation"
          ~ '^[a-z][a-z0-9_]*[.][a-z][a-z0-9_]*$'
        );