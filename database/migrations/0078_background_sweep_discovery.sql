-- Discovery for the remaining timer-driven sweeps.
--
-- Three sweeps run on a timer inside the API rather than inside a request, so
-- no interceptor has opened a tenant scope for them, and each begins by asking
-- a question that deliberately spans every tenant because the queue or backlog
-- is shared. `export_jobs` and `reservation_records` both carry `tenant_id` and
-- both received RLS policies in 0071, so under `trackroster_app` those opening
-- queries return zero rows and the sweep does nothing — with no error, forever.
--
-- What that costs, concretely: queued exports are never processed and expired
-- download links are never invalidated; reservation evidence is never
-- reconciled against Redis. A silent stall is the worst failure shape
-- available, which is why discovery is made explicit here rather than left to a
-- context these sweeps cannot have.
--
-- Same shape as `trackroster_pending_action_effects` (0077), and deliberately
-- the same restraint:
--
--   * Read-only. All three are STABLE and take no locks. The caller still does
--     its own `FOR UPDATE SKIP LOCKED` on the row it intends to take, under
--     that row's tenant context, so the claim semantics are unchanged and the
--     privileged surface stays as small as a SELECT.
--   * Identifiers only. They return an id and a tenant, never a payload, a
--     request body or a lease. Everything else is read under the owning
--     tenant's context by the ordinary policies.
--   * Candidates, not reservations. Two nodes may see the same row; whichever
--     locks it first takes it and the other skips to the next candidate, which
--     is exactly what the single-row claim guaranteed before.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path.
--   * No dynamic SQL; the only input is an integer bound.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.
--   * Ordering matches the queries they replace, so both sweeps stay FIFO.

CREATE OR REPLACE FUNCTION trackroster_claimable_export_jobs(batch_size integer)
RETURNS TABLE (
  id uuid,
  tenant_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT j.id, j.tenant_id
  FROM export_jobs j
  WHERE j.status = 'queued'
     OR (j.status = 'processing' AND j.lease_until < clock_timestamp())
  ORDER BY j.created_at, j.id
  LIMIT greatest(batch_size, 0);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trackroster_expirable_export_jobs(batch_size integer)
RETURNS TABLE (
  id uuid,
  tenant_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT j.id, j.tenant_id
  FROM export_jobs j
  WHERE j.status = 'completed'
    AND j.expires_at <= clock_timestamp()
  ORDER BY j.expires_at, j.id
  LIMIT greatest(batch_size, 0);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trackroster_reconcilable_reservations(batch_size integer)
RETURNS TABLE (
  id uuid,
  tenant_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.tenant_id
  FROM reservation_records r
  WHERE r.status IN ('pending', 'active')
  ORDER BY r.updated_at, r.id
  LIMIT greatest(batch_size, 0);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_claimable_export_jobs(integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_expirable_export_jobs(integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_reconcilable_reservations(integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_claimable_export_jobs(integer) TO trackroster_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_expirable_export_jobs(integer) TO trackroster_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_reconcilable_reservations(integer) TO trackroster_app';
  END IF;
END $$;
