-- Credential resolution for a caller that has no tenant context yet.
--
-- Sign-in is the one operation that cannot be tenant-scoped, because it is
-- the operation that *discovers* which tenants apply. `identities` is already
-- deliberately outside Row-Level Security for exactly this reason, but the
-- memberships behind it are not: once the API connects as the non-privileged
-- runtime role, `tenant_memberships` and `users` return zero rows to an
-- unauthenticated request and every sign-in fails with 401.
--
-- Widening those policies would trade the whole tenant boundary for one
-- lookup. Instead this function runs as its owner over a fixed projection:
-- the caller supplies an identity id it has already proven possession of by
-- verifying the password, and receives only what is needed to choose a
-- workspace. No campaign, prospect or action data is reachable through it.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path, so a caller cannot shadow
--     the referenced tables with their own.
--   * No dynamic SQL, and the only input is a uuid.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.
--   * Filters to active identity, active membership and active tenant, which
--     is the same condition the repository query applies.

CREATE OR REPLACE FUNCTION trackroster_authentication_memberships(identity uuid)
RETURNS TABLE (
  identity_id uuid,
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  display_name text,
  legacy_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.identity_id,
    m.id,
    m.tenant_id,
    t.name,
    m.display_name,
    u.id
  FROM tenant_memberships m
  JOIN identities i ON i.id = m.identity_id AND i.status = 'active'
  JOIN tenants t ON t.id = m.tenant_id AND t.status = 'active'
  LEFT JOIN users u
    ON u.id = m.id
   AND u.tenant_id = m.tenant_id
   AND u.email = i.email
   AND u.password_hash = i.password_hash
   AND u.status = 'active'
  WHERE m.identity_id = identity
    AND m.status = 'active'
  ORDER BY t.name ASC, m.id ASC;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_authentication_memberships(uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_authentication_memberships(uuid) TO trackroster_app';
  END IF;
END $$;
