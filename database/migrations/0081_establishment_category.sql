-- The business taxonomy managers dispatch on.
--
-- Management selects prospecting work by what an establishment *is* —
-- gendarmeries and commissariats first, then douanes and CRA — and the
-- presentation shows exactly one section per establishment. Nothing in the
-- schema carried that: `status` is the record's lifecycle (active, inactive,
-- archived), `source` is where the row came from, and `tags` is the free-form,
-- coloured, many-to-many labelling prospectors apply. None of them answer
-- "which kind of organisation is this", which is the question the dispatch
-- screen is built around.
--
-- Single-valued, as an enum beside the two enums it sits next to, because an
-- establishment is a police station or a hospital and not both. A join table
-- would buy flexibility nobody has asked for and would make the dispatch
-- filter a join instead of a predicate.
--
-- Nullable and not backfilled: the establishments already in the database
-- predate this and are not invalid for lacking a category. The import assigns
-- one going forward, and an uncategorised row simply does not match a category
-- filter.
--
-- Adding a category later is `ALTER TYPE ... ADD VALUE`. If the taxonomy ever
-- has to differ per client, the precedent to follow is `outcome_settings`,
-- which already holds a tenant-configurable set — that is a bigger change and
-- is not what an internal tool for one group needs today.

CREATE TYPE "public"."establishment_category" AS ENUM('prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs');
--> statement-breakpoint
ALTER TABLE "establishments" ADD COLUMN "category" "public"."establishment_category";
--> statement-breakpoint
CREATE INDEX "establishments_tenant_category_idx" ON "establishments" USING btree ("tenant_id", "category");
