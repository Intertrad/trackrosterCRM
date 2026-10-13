ALTER TABLE "messages" ADD COLUMN "is_request" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_request_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_conversation_id_unique" UNIQUE("tenant_id","conversation_id","id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_request_fk" FOREIGN KEY ("tenant_id","conversation_id","reply_to_request_id") REFERENCES "public"."messages"("tenant_id","conversation_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_one_active_reply_idx" ON "messages" USING btree ("tenant_id","reply_to_request_id") WHERE "messages"."reply_to_request_id" IS NOT NULL AND "messages"."status" <> 'deleted';--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_reply_check" CHECK (NOT "messages"."is_request" OR "messages"."reply_to_request_id" IS NULL);--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_no_self_reply_check" CHECK ("messages"."reply_to_request_id" IS NULL OR "messages"."reply_to_request_id" <> "messages"."id");