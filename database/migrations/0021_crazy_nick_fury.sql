CREATE TYPE "public"."prospect_follow_up_category" AS ENUM('todo', 'follow_up', 'meeting');--> statement-breakpoint
CREATE TYPE "public"."prospect_follow_up_channel" AS ENUM('call', 'email', 'message', 'visit', 'letter');--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD COLUMN "category" "prospect_follow_up_category" DEFAULT 'follow_up' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect_follow_ups" ADD COLUMN "channel" "prospect_follow_up_channel";