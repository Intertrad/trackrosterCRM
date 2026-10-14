/*
 * Repair databases where migration 0095 is recorded as applied but its
 * messaging request/reply columns were not present. Every statement is
 * idempotent so this can safely run against both drifted and complete schemas.
 */
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "is_request" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "reply_to_request_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_tenant_conversation_id_unique'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_tenant_conversation_id_unique"
      UNIQUE ("tenant_id", "conversation_id", "id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_reply_request_fk'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_reply_request_fk"
      FOREIGN KEY ("tenant_id", "conversation_id", "reply_to_request_id")
      REFERENCES "public"."messages" ("tenant_id", "conversation_id", "id");
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_one_active_reply_idx"
  ON "messages" USING btree ("tenant_id", "reply_to_request_id")
  WHERE "reply_to_request_id" IS NOT NULL AND "status" <> 'deleted';
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_request_reply_check'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_request_reply_check"
      CHECK (NOT "is_request" OR "reply_to_request_id" IS NULL);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_no_self_reply_check'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_no_self_reply_check"
      CHECK ("reply_to_request_id" IS NULL OR "reply_to_request_id" <> "id");
  END IF;
END $$;
