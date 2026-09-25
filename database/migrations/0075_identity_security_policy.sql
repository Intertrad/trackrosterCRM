-- Security policy resolution for an identity, across all of its workspaces.
--
-- `SecurityPolicyService.forIdentity` deliberately aggregates over every active
-- membership an identity holds — `bool_or(require_mfa)` and
-- `max(password_min_length)` — so that the strictest workspace an account
-- belongs to sets the bar for that account's password and MFA. That is a
-- cross-tenant question by construction: there is no single value of
-- `trackroster.tenant_id` under which it can be asked, and the flows that ask
-- it are the ones that have no tenant context at all — sign-in, password
-- recovery and invitation acceptance.
--
-- `tenant_memberships` and `tenant_security_policies` both carry `tenant_id`
-- and both received RLS policies in 0071. Once the API connects as
-- `trackroster_app`, that aggregate runs over zero visible rows and the
-- `coalesce` defaults take over — so the query does not error, it silently
-- returns the permissive default. A workspace that requires MFA or a 16
-- character minimum would stop having either enforced during recovery, with
-- nothing in the logs to say so. This is the one failure mode in the RLS
-- rollout that is *less* safe rather than more, which is why it is fixed here
-- rather than left to a caller to remember.
--
-- Same shape as `trackroster_authentication_memberships` (0072): a fixed,
-- minimal projection behind a definer function. It returns two scalars about
-- an identity the caller has already proven possession of, and no workspace
-- names, memberships or identifiers.
--
-- `accepting_tenant` mirrors the service's own argument: during invitation
-- acceptance the membership being activated is still `invited`, so that one
-- tenant is admitted alongside the active ones. Passing NULL considers only
-- active memberships, exactly as the application predicate did.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path.
--   * No dynamic SQL; inputs are uuids.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.

CREATE OR REPLACE FUNCTION trackroster_identity_security_policy(
  identity uuid,
  accepting_tenant uuid DEFAULT NULL
)
RETURNS TABLE (
  require_mfa boolean,
  password_min_length integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    coalesce(bool_or(p.require_mfa), false),
    coalesce(max(p.password_min_length), 12)
  FROM tenant_memberships m
  JOIN tenants t ON t.id = m.tenant_id AND t.status = 'active'
  LEFT JOIN tenant_security_policies p ON p.tenant_id = m.tenant_id
  WHERE m.identity_id = identity
    AND (
      m.status = 'active'
      OR (accepting_tenant IS NOT NULL AND m.status = 'invited' AND m.tenant_id = accepting_tenant)
    );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_identity_security_policy(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_identity_security_policy(uuid, uuid) TO trackroster_app';
  END IF;
END $$;
