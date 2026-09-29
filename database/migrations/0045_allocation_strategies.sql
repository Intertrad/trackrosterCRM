ALTER TABLE "assignment_rules" DROP CONSTRAINT "assignment_rules_strategy_check";--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD COLUMN "required_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD COLUMN "max_distance_km" double precision;--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_distance_check" CHECK ("assignment_rules"."max_distance_km" IS NULL OR "assignment_rules"."max_distance_km" BETWEEN 0.001 AND 20040);--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_strategy_check" CHECK ("assignment_rules"."strategy" IN ('capacity', 'round_robin','skill','proximity'));