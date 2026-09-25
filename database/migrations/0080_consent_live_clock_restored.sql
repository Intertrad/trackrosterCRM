-- Restore the live clock that 0060 reverted.
--
-- An activity recorded concurrently with a new opposition was accepted instead
-- of blocked, so a prospect who had just withdrawn consent could still be
-- contacted. That is a consent-compliance failure, and it was a regression
-- rather than a gap.
--
-- The serialisation itself has always been correct. `trackroster_guard_contact_operation`
-- takes `FOR SHARE` on the establishment before it checks, and
-- `trackroster_validate_consent` takes `FOR UPDATE` on the same row when an
-- opposition is written, so an activity cannot slip past a concurrent
-- opposition — it waits. What went wrong is what the guard evaluated once the
-- wait was over.
--
-- 0038 ("Resolve scheduled/expired evidence against evaluation time, including
-- after a lock wait") made this function VOLATILE and moved it to
-- `clock_timestamp()` for exactly this reason. 0060 then extended it to follow
-- merge families, and in doing so rewrote it as STABLE with `statement_timestamp()`
-- — reinstating the bug 0038's comment names.
--
-- Why the timestamp is the whole difference, measured from inside the trigger on
-- the failing case:
--
--   statement start   42.950919
--   consent effective 42.982199   <- committed while the writer waited
--   lock released     42.987203   (36ms later)
--
-- `statement_timestamp()` is the start of the *top level* statement, so after a
-- 36ms wait the guard still asked "what was blocked 36ms ago" and answered
-- honestly: nothing. The row was visible — a second query against the same
-- snapshot using `clock_timestamp()` found it — it was the predicate that
-- excluded it. That is also why an earlier attempt to fix this by changing the
-- volatility alone did not work: visibility was never the problem.
--
-- So the whole point of holding a lock is to make a decision *after* the wait,
-- which means the decision has to be made as of now. VOLATILE is not incidental
-- here: it stops the planner inlining the body into the calling query, where it
-- would be evaluated against the caller's snapshot and time again.
--
-- 0060's merge-family recursion is kept; only the clock changes. The cost is
-- that a volatile function cannot be inlined, so the read paths that call it per
-- row (route planning, permissions, the worker's follow-up sweeps) plan it as a
-- function call. That was already the trade-off 0038 accepted, and correctness
-- of an opposition check is worth more than inlining.

CREATE OR REPLACE FUNCTION trackroster_consent_blocked(p_tenant uuid, p_prospect uuid, p_channel text)
RETURNS boolean
LANGUAGE sql
VOLATILE
AS $$
  WITH RECURSIVE family(id) AS (
    SELECT p_prospect
    UNION
    SELECT m.source_id FROM prospect_merges m JOIN family f ON m.target_id = f.id
    WHERE m.tenant_id = p_tenant
  ), latest AS (
    SELECT DISTINCT ON (prospect_id, contact_id, channel) status, expires_at, channel
    FROM contact_consents
    WHERE tenant_id = p_tenant
      AND prospect_id IN (SELECT id FROM family)
      AND effective_at <= clock_timestamp()
    ORDER BY prospect_id, contact_id, channel, effective_at DESC, sequence DESC
  )
  SELECT EXISTS (
    SELECT 1 FROM latest
    WHERE status = 'blocked'
      AND (expires_at IS NULL OR expires_at > clock_timestamp())
      AND (p_channel IS NULL OR channel = 'all' OR channel = p_channel)
  );
$$;
