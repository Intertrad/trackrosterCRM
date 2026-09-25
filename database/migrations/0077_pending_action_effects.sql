-- Discovery for the in-process action effects sweep.
--
-- `ActionEffectsService.drain` is a background sweep: on a timer it picks up
-- undelivered rows from `action_effects` — follow-up scheduling and reservation
-- ledger work queued by completed actions — and processes each one. It runs on
-- a timer, not inside a request, so no interceptor has opened a tenant scope,
-- and its first query deliberately spans every tenant because the queue is
-- shared.
--
-- `action_effects` carries `tenant_id` and received an RLS policy in 0071, so
-- under `trackroster_app` that query returns zero rows. The sweep then does
-- nothing at all, forever, without raising anything: follow-up reminders are
-- never scheduled and reservation ledgers are never refreshed. A silent stall
-- is the worst failure shape available here, which is why discovery is made
-- explicit rather than left to a context the sweep cannot have.
--
-- Only identifiers cross the boundary. The function returns the id and tenant
-- of work that is waiting and nothing about the work itself; the payload is
-- then read, locked and processed under that tenant's own context, so every
-- write the sweep performs is still checked by the ordinary policies.
--
-- Safety properties:
--   * SECURITY DEFINER with a pinned search_path.
--   * No dynamic SQL; the only input is an integer bound.
--   * EXECUTE revoked from PUBLIC and granted solely to the runtime role.
--   * Ordering matches the query it replaces, so the queue stays FIFO.

CREATE OR REPLACE FUNCTION trackroster_pending_action_effects(batch_size integer)
RETURNS TABLE (
  id uuid,
  tenant_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.id, e.tenant_id
  FROM action_effects e
  WHERE e.delivered_at IS NULL
  ORDER BY e.created_at, e.id
  LIMIT greatest(batch_size, 0);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION trackroster_pending_action_effects(integer) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trackroster_pending_action_effects(integer) TO trackroster_app';
  END IF;
END $$;
