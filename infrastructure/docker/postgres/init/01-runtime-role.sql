-- The role the API is meant to connect as.
--
-- Row-Level Security is created by migration 0071 on every table carrying a
-- tenant_id, with both USING and WITH CHECK against
-- current_setting('trackroster.tenant_id'). Those policies are correct, but
-- Postgres does not apply them to a table's owner unless FORCE ROW LEVEL
-- SECURITY is set — and the owner role `trackroster` additionally holds
-- SUPERUSER and BYPASSRLS.
--
-- The result is that connecting as the owner leaves every policy inert, and
-- tenant isolation depends entirely on each query remembering its own
-- WHERE tenant_id = ? predicate. This role is the second line of defence: it
-- is neither superuser, nor BYPASSRLS, nor the owner, so the policies apply
-- to it without any further configuration.
--
-- Verify with:
--   SELECT count(*) FROM organizations;
-- As `trackroster` this returns every row. As `trackroster_app`, with no
-- tenant context set, it returns 0.
--
-- Idempotent: safe to re-run against an existing database.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    -- The password is a local development default and is overridden in every
    -- deployed environment; it is never read from this file at runtime.
    CREATE ROLE trackroster_app LOGIN PASSWORD 'trackroster_app';
  END IF;
END $$;

GRANT CONNECT ON DATABASE trackroster TO trackroster_app;
GRANT USAGE ON SCHEMA public TO trackroster_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trackroster_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trackroster_app;

-- Tables created by later migrations must be reachable too, otherwise the
-- next migration silently locks the application out of its own data.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trackroster_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO trackroster_app;
