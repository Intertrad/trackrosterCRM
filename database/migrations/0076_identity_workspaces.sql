-- The workspace list an identity can switch between.
--
-- `AccountService.memberships` backs the workspace switcher: it answers "which
-- workspaces is this account a member of, and with what roles in each". That is
-- cross-tenant by definition. It runs inside an authenticated request, so
-- `trackroster.tenant_id` is set to the workspace the caller is *currently* in,
-- and under RLS the query then returns that one workspace — the switcher shows
-- a single entry and switching becomes impossible.
--
-- Widening the policies is not an option: `tenant_memberships`,
-- `user_access_grants` and `membership_resource_scopes` are exactly the tables
-- that decide authority. So, as with `trackroster_authentication_memberships`
-- (0072), the cross-tenant question is answered by a definer function over a
-- fixed projection.
--
-- What it discloses is bounded by the identity argument: a caller sees its own
-- memberships and its own roles, which is precisely what the endpoint is for
-- and strictly less than the session it already holds. It exposes no other
-- user's grants, and no campaign, prospect or action data.
--
-- The role list mirrors the query it replaces, including the two presentation
-- aliases (`client_admin` -> `tenant_admin`, `observer` -> `auditor`) and the
-- union of direct grants with resource scopes, so the endpoint's output is
-- unchanged. Ordering is kept here too, so the caller does not have to re-sort.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path.
--   * No dynamic SQL; the only input is a uuid.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.

CREATE OR REPLACE FUNCTION trackroster_identity_workspaces(identity uuid)
RETURNS TABLE (
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  display_name text,
  roles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.id,
    t.id,
    t.name,
    m.display_name,
    (
      SELECT coalesce(jsonb_agg(DISTINCT CASE role_grants.role
        WHEN 'client_admin' THEN 'tenant_admin'
        WHEN 'observer' THEN 'auditor'
        ELSE role_grants.role::text END), '[]'::jsonb)
      FROM (
        SELECT g.role FROM user_access_grants g
        WHERE g.tenant_id = m.tenant_id AND g.user_id = m.id
        UNION
        SELECT s.role FROM membership_resource_scopes s
        WHERE s.tenant_id = m.tenant_id AND s.user_id = m.id
      ) role_grants
    )
  FROM tenant_memberships m
  JOIN tenants t ON t.id = m.tenant_id AND t.status = 'active'
  WHERE m.identity_id = identity
    AND m.status = 'active'
  ORDER BY t.name ASC, m.id ASC;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_identity_workspaces(uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_identity_workspaces(uuid) TO trackroster_app';
  END IF;
END $$;
