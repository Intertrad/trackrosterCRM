-- Make the evidence tables actually immutable.
--
-- Three integration cases assert that recorded evidence cannot be rewritten:
-- a collision event's reason code, an override request's decision reason, and
-- audit rows generally. All three were asserting a guarantee nothing enforced —
-- they passed a rewrite straight through and failed on the missing rejection,
-- which is the weakest possible place to discover that an audit trail is
-- editable.
--
-- Two different shapes of immutability, because the tables differ:
--
--   `collision_events` and `audit_events` are append-only outright. The
--   application never updates or deletes either — verified against every
--   `update(...)`/`delete(...)` call site — so the privilege itself is removed
--   from the runtime role. INSERT stays, because both the API and the worker
--   write them. This is the stronger form: it cannot be bypassed by application
--   code at all, and it is enforced by the grant rather than by a trigger
--   someone can forget to fire.
--
--   `override_requests` is legitimately written once, when a request is decided:
--   the decision sets status, decider, reason, timestamp and override id in a
--   single statement. Its immutability is therefore conditional — pending rows
--   may be updated, decided ones may not — which a grant cannot express, so a
--   trigger carries it. The decision path transitions pending to decided exactly
--   once and is unaffected.
--
-- The owner keeps full privileges, so migrations, backups and restores are
-- unaffected; this constrains the role the application actually connects as.

REVOKE UPDATE, DELETE ON collision_events FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON collision_events FROM trackroster_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON audit_events FROM trackroster_app';
  END IF;
END $$;
--> statement-breakpoint
/*
 * Later tables inherit their grants from ALTER DEFAULT PRIVILEGES, which grants
 * UPDATE and DELETE. That is right for ordinary tables and wrong for these two,
 * so the revoke has to be re-applied if either is ever rebuilt. Keeping it in
 * one function means a future migration can call it rather than restating it.
 */
CREATE OR REPLACE FUNCTION trackroster_enforce_append_only_grants()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON collision_events FROM trackroster_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON audit_events FROM trackroster_app';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trackroster_guard_decided_override_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  /*
   * A decided request is a record of a decision, so nothing about it may move
   * afterwards — not the reason, not the decider, not the status. Pending rows
   * are still freely updatable, which is what the decision path itself needs.
   */
  IF OLD.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION
      'Override request % was already decided as % and cannot be modified',
      OLD.id, OLD.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS override_request_decided_immutable ON override_requests;
--> statement-breakpoint
CREATE TRIGGER override_request_decided_immutable
  BEFORE UPDATE ON override_requests
  FOR EACH ROW
  EXECUTE FUNCTION trackroster_guard_decided_override_request();
