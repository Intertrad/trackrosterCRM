CREATE INDEX "organizations_name_trgm_idx" ON "organizations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organizations_slug_trgm_idx" ON "organizations" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "establishments_name_trgm_idx" ON "establishments" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "establishments_city_trgm_idx" ON "establishments" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "campaigns_name_trgm_idx" ON "campaigns" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "campaigns_description_trgm_idx" ON "campaigns" USING gin ("description" gin_trgm_ops);