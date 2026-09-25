-- Make the tenant policies apply to the table owner as well.
--
-- Migration 0071 enabled Row-Level Security and created a
-- `<table>_tenant_isolation` policy on every table carrying a `tenant_id`.
-- Those policies are correct. They were also, until this migration, almost
-- entirely decorative, for two independent reasons:
--
--   1. PostgreSQL does not apply RLS to a table's owner unless the table is
--      marked FORCE ROW LEVEL SECURITY. `trackroster` owns all 81 of them.
--   2. `trackroster` is additionally SUPERUSER and BYPASSRLS, and a superuser
--      bypasses RLS whether or not FORCE is set.
--
-- So this migration on its own changes nothing observable: it closes (1), and
-- (2) still lets the owner see everything. That is deliberate and it is worth
-- being precise about, because it is easy to read a FORCE migration as "RLS
-- is now enforced" when it is not. What actually enforces the policies is the
-- application connecting as `trackroster_app` — a role that is neither the
-- owner, nor SUPERUSER, nor BYPASSRLS (see
-- infrastructure/docker/postgres/init/01-runtime-role.sql). FORCE is the
-- second half of the pair: it means that if the owner is ever de-superusered,
-- or if some future tool connects as the owner by accident, the policies
-- still apply instead of silently not applying.
--
-- Migrations and seeds continue to run as the owner and are unaffected while
-- the owner remains SUPERUSER. If the owner is ever de-superusered, seeds
-- that write across tenants must set `trackroster.tenant_id` per tenant or
-- run as a role holding BYPASSRLS.
--
-- The table set is derived the same way 0071 derives it — from the presence
-- of a `tenant_id` column — so the two stay in agreement. Both are one-shot,
-- which is why `tenant-rls.integration.spec.ts` asserts coverage over the
-- live catalog: a table added later with a `tenant_id` and no policy fails
-- that test rather than quietly becoming a hole.
--
-- Idempotent: FORCE ROW LEVEL SECURITY is a no-op when already set.

DO $$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target);
  END LOOP;
END $$;
