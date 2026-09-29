-- Tenant resolution for invitation acceptance, which has no tenant context yet.
--
-- Accepting an invitation is unauthenticated: `InvitationTokenController` is
-- guarded only by the rate limiter, because the whole point is that the caller
-- does not have an account in the workspace yet. The invitation is identified
-- solely by the hash of a high-entropy token, and the row it finds is what
-- reveals which tenant the caller is joining.
--
-- `membership_invitations` and `tenant_memberships` both carry `tenant_id` and
-- both received RLS policies in 0071, so once the API connects as
-- `trackroster_app` that lookup returns zero rows and every invitation is
-- reported as invalid or expired. It fails closed, but it fails.
--
-- The alternatives were worse. Widening the policies to admit a context-free
-- read would trade the tenant boundary for one lookup, and dropping RLS from
-- `membership_invitations` would let a query that forgets its predicate read
-- another workspace's pending invitations. Instead this mirrors
-- `trackroster_authentication_memberships` (0072): a fixed, minimal projection
-- behind a definer function, so the rest of the flow can run under the normal
-- policies with a context it has legitimately discovered.
--
-- Deliberately narrow: it returns a tenant id and nothing else, only to a
-- caller that already presents the token hash, so it discloses strictly less
-- than the invitation preview the same caller is entitled to. Validity is not
-- checked here — expiry and consumption stay in the application's own
-- predicate, so an expired token still takes exactly the path it took before.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path, so a caller cannot shadow
--     the referenced table with its own.
--   * No dynamic SQL; the only input is text that is compared, never executed.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.

CREATE OR REPLACE FUNCTION trackroster_invitation_tenant(token_hash_input text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT i.tenant_id
  FROM membership_invitations i
  WHERE i.token_hash = token_hash_input
  LIMIT 1;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_invitation_tenant(text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_invitation_tenant(text) TO trackroster_app';
  END IF;
END $$;
