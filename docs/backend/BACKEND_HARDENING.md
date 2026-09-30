# Backend hardening record

> **Current audit — 2026-09-30:** Internal typecheck, build, migration-integrity,
> unit, worker, and focused reservation/override gates pass. The exhaustive API
> integration gate must run on a dedicated low-latency database/Redis stack because
> the shared Supabase session pool causes client-cap errors or timeout cascades.
> See [backend audit](./BACKEND_AUDIT_2026-09-30.md).

What was done to the backend in the production-readiness pass, what it proved, and what
is left. The historical measurements below remain evidence; the current development
snapshot is [CURRENT_STATUS.md](../CURRENT_STATUS.md).

- **Period:** 2026-09-24 to 2026-09-25
- **Historical branch:** `codex/backend-completion`
- **Current branch:** `main`
- **Migrations added in that pass:** `0073`…`0080`; later migrations are in the main chain
- **Backlog and estimates:** [TRACKROSTER_REMAINING_WORK.md](../TRACKROSTER_REMAINING_WORK.md)
  is the execution source of truth. This document records what changed and why; that one
  says what to do next.

---

## 1. Where the backend stands

| Gate                       | Result                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| `pnpm format:check`        | PASS                                                                    |
| `pnpm typecheck`           | PASS — 5/5 packages                                                     |
| `pnpm build`               | PASS — 4/4 tasks                                                        |
| `pnpm db:migrations:check` | PASS — 81 entries, one contiguous chain                                 |
| `pnpm lint`                | FAIL — 1 error, in uncommitted `eslint.config.mjs` WIP that is not ours |
| api unit                   | **746 / 746**                                                           |
| worker unit                | **65 / 65**                                                             |
| web                        | **494 / 494**                                                           |
| api integration            | **582 / 583** — one stable defect (TR-916)                              |

Isolation and concurrency suites, run individually: `tenant-rls` 2/2,
`background-sweep-discovery` 3/3, `data-jobs` 17/17, `reservation` 25/25 (concurrency),
`manager-override-concurrency` 1/1, `idempotency-record` 11/11, `consents` 9/9.

The integration suite lands between 579 and 582 of 583 across runs. The one stable failure
is TR-916; the spread is TR-917, a mail throughput defect, not a second blocker. Both are
described in §5.

### Starting point, for comparison

At the beginning of this pass the integration suite was **565 passed / 14 failed**, api
unit **741 / 5**, worker **63 / 2** (never previously measured), and tenant isolation was
not enforced at all.

---

## 2. The isolation proof

The headline change is that PostgreSQL Row-Level Security now actually applies. Measured
against the running database with no tenant context set:

| Query                                | owner (`trackroster`) | application role (`trackroster_app`) |
| ------------------------------------ | --------------------- | ------------------------------------ |
| `select count(*) from organizations` | 231                   | **0**                                |

`FORCE ROW LEVEL SECURITY` is set on **81 of 91** tables — every table carrying a
`tenant_id`. It was previously set on none. The 10 without are the deliberate pre-tenant
surface: `identities`, `tenants`, `platform_access_grants`, the five `auth_*` tables,
`auth_mail_outbox`, and PostGIS `spatial_ref_sys`.

The strongest evidence is an inversion rather than a number:
`tenant-rls.integration.spec.ts` **fails as the owner** — its cross-tenant INSERT succeeds
when policies do not apply — and **passes as the runtime role**. Before this work it failed
both ways, because the application connected as a superuser and every policy was inert.

---

## 3. What was done

### 3.1 Tenant isolation made real (TR-901)

Migration `0073` sets FORCE on all 81 tenant tables, and the application now connects as
`trackroster_app` — a role that is neither the table owner, nor `SUPERUSER`, nor
`BYPASSRLS`, so the policies apply to it without further configuration. FORCE alone changes
nothing observable; the role is what activates enforcement, and FORCE is the other half of
the pair so the policies still apply if the owner is ever de-superusered.

That role has no DDL rights by design, so connections were split three ways: `DATABASE_URL`
(application, restricted), `DATABASE_MIGRATION_URL` and `DATABASE_SEED_URL` (owner). Both
fall back to `DATABASE_URL` so a single-URL setup still works.

**A defect this exposed, which mattered more than the migration.** Nest runs guards _before_
interceptors, so `TenantTransactionInterceptor` had not yet opened the request's
tenant-scoped transaction while a guard was deciding. Every guard that read tenant-scoped
data queried with no tenant context. Under a superuser that was invisible; under the
restricted role those reads return zero rows, a guard reads that as "no authority", and the
API answers 403 to essentially all authenticated traffic. It fails _closed_, so it was never
a disclosure risk — but it was a total functional break that only became visible once RLS
did something. Fixed centrally with `withGuardTenantScope`, applied to the 24 guards that
touch the database, most of them declared inline in their controllers.

### 3.2 Cross-tenant and pre-authentication reads (TR-901)

Four flows ask questions no single tenant context can answer, or ask them before any tenant
is known. Each returned zero rows once policies applied. Following the precedent already set
by migration `0072`, each is answered by a narrow `SECURITY DEFINER` function over a fixed
projection, with `search_path` pinned and `EXECUTE` revoked from `PUBLIC` — rather than by
widening a policy. There are now 8 such functions.

| Migration | Flow                     | Why it cannot be tenant-scoped                                                                                            |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `0074`    | Invitation acceptance    | Unauthenticated; the invitation is identified only by a token hash, and the row it finds is what reveals the tenant       |
| `0075`    | Identity security policy | Aggregates across every workspace an account belongs to, so the strictest one sets its password floor and MFA requirement |
| `0076`    | Workspace switcher list  | Asks which workspaces an account can move to, while the request is scoped to the current one                              |
| `0077`    | Action effects sweep     | A timer-driven sweep over a queue shared by all tenants                                                                   |

**`0075` was the one genuine weakening in the rollout.** The aggregate did not error under
RLS — it ran over zero visible rows and the `coalesce` defaults took over, so a workspace
requiring MFA or a longer password **silently stopped having either enforced during password
recovery**. Everything else in this pass failed closed; this one failed open.

Session `rotate`, `revoke` and `switchWorkspace` also now set the tenant context they
already had the tenant for. `switchWorkspace` restores the source tenant after
`createSession` moves the context to the destination, because the revocation and its audit
row belong to the workspace being left.

### 3.3 Background work (TR-902)

The worker was **not** the problem, contrary to the original ticket — see §6. The real
scope was the API's four timer-driven sweeps. Each opens with a query spanning all tenants,
because the queue it drains is shared, and each runs outside any request:

| Sweep                                | Outcome                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `ActionEffectsService.drain`         | Fixed by `0077`                                                     |
| `ExportJobService.drain`             | Fixed — was 5 of the integration failures                           |
| `ReservationLedgerService.reconcile` | Fixed — **had no test at all**, so it would have stalled in silence |
| `AuthMailService`                    | Needs nothing; `auth_mail_outbox` is outside RLS by design          |

Migration `0078` adds three discovery functions, and `tenant-sweep.ts` writes the pattern
once: privileged discovery returning identifiers only, then one tenant-scoped transaction per
item, attempting every item so one poisoned row cannot starve a shared queue. All discovery
functions are `STABLE` and take no locks — the caller still does its own
`FOR UPDATE SKIP LOCKED` on the row it means to take, under that row's tenant context, so
claim semantics are unchanged and the privileged surface stays as small as a `SELECT`.

The export sweep needed scoping in **four** places, not one: discovery, the claim,
`prepare()` (which re-resolves authority and scope and reads business rows), and the failure
path, which would otherwise have recorded nothing and left jobs stuck in `processing` until
their lease expired. Serialization stays outside any transaction deliberately — it is the
slow part, has no database work, and holding a transaction across a file build would pin a
connection for its duration.

`background-sweep-discovery.integration.spec.ts` now guards the property, and was verified
to fail for the right reason by revoking a grant and watching it go red.

### 3.4 Concurrency and evidence defects (TR-904)

Taking the gate from 14 failures to 2 surfaced five real product defects. Three were fixed:

**A deadlock on idempotent routes.** Creating a territory assignment or campaign member
deadlocked under concurrency, returning 500 where the caller expects 409. These routes are
idempotent, so the handler already holds `FOR KEY SHARE` on the tenant row — from the
idempotency record's foreign key — and then asks for `FOR UPDATE`, the one mode key share
conflicts with. Two concurrent requests each wait for the other; PostgreSQL calls it 40P01
and nothing mapped that to a conflict. Fixed by taking the mutex with `FOR NO KEY UPDATE`,
which is compatible with key share and still exclusive against itself — the mode five other
services already used. Latent rather than new: the guard-phase scope added a round trip that
made it reproduce every time instead of occasionally.

**Evidence tables were immutable only in intent.** Three cases asserted that a collision
event's reason code, an override request's decision reason and audit rows cannot be
rewritten, and nothing enforced any of it — the rewrites went straight through. Migration
`0079` revokes `UPDATE` and `DELETE` on `collision_events` and `audit_events` from the
runtime role (verified first that no call site writes them; `INSERT` stays for the API and
worker), and adds a trigger refusing any update to an override request that is no longer
pending, since that one is legitimately written once at decision time.

**The mid-batch rollback guarantee had never been exercised.** Its synthetic audit failure
never fired: the test proxied `insert` on the request's transaction but handed back the real
executor for `transaction`, so every write through the service's nested savepoint bypassed
the counter and the batch simply succeeded. With the wrapper re-wrapping nested
transactions, the guarantee is verified for the first time — 500, no assignments, no audit
rows, cursor unmoved, retry succeeds.

Four further failures were test defects, not product defects: a missing
`SSO_ENCRYPTION_KEY` (now supplied by the integration config rather than depending on a
developer's `.env`), stale `database.transaction` call counts in `import-execution`, and the
worker's two webhook cases using a placeholder tenant id and a bare `{ query }` double, both
predating the tenant transaction helper.

### 3.5 Consent enforcement (TR-909)

An activity recorded concurrently with a new opposition was **accepted rather than blocked**,
so a prospect who had just withdrawn consent could still be contacted. Reproducible 4 runs
out of 4.

The serialization was never at fault. The guard takes `FOR SHARE` on the establishment
before checking, and the opposition write takes `FOR UPDATE` on the same row, so the activity
does wait. What went wrong is what it evaluated once the wait ended. Measured from inside
the trigger on the failing case:

```
statement start   42.950919
consent effective 42.982199   committed while the writer waited
lock released     42.987203   36ms later
```

`statement_timestamp()` is the start of the top-level statement, so after a 36 ms wait the
guard asked what was blocked 36 ms ago and answered honestly: nothing. The row was visible
throughout — the same snapshot queried with `clock_timestamp()` found it. The predicate
excluded it, not the snapshot.

**This was a regression.** Migration `0038` is titled `consent_live_clock` and its comment
reads "including after a lock wait": it made the function `VOLATILE` on `clock_timestamp()`
for exactly this case. Migration `0060` then extended it to follow merge families and rewrote
it as `STABLE` with `statement_timestamp()`, reinstating the bug its predecessor had named.
Migration `0080` restores the clock and keeps `0060`'s recursion. It also explains why an
earlier attempt to fix this by changing volatility alone could not have worked: visibility
was never the problem.

Because it has regressed once, the spec now asserts both properties directly, so a third
regression fails with a message naming the cause rather than as an intermittent race.

### 3.6 Mail (TR-910)

Two suites read a token from the local mailbox and both were intermittently red.
`password-recovery` dispatched once, searched once and asserted on a length — asserting that
queueing, HTTP delivery and Mailpit's indexing all finished inside one event-loop turn.
`invitations-security` did loop twenty times, but with no pause, which can exhaust every
attempt inside a millisecond. Both now share one polling helper that drains and retries to a
deadline, and reports what it could not find rather than failing an undefined assertion.

Mailpit is also now a service in the main Compose file. It was only declared in
`docker-compose.backend-test.yml`, so a developer's account email depended on a container
from another compose project happening to be running; when it was not, messages were queued
and went nowhere silently.

### 3.7 Export authorization, checked and found correct (TR-903)

A previous audit recorded a P0 against controlled exports. That finding was **wrong** and is
withdrawn. Two controllers answer on `exports` and both authorize: the controlled path
resolves scope before any business read and rejects a caller holding none of `client_admin` /
`director` / `manager`; the data-jobs path adds per-object authorization on every `:exportId`
route plus a tenant-configurable `exports.create` grant. 23 tests cover both, including one
asserting a prospector receives 403 with zero audit events. No code change was needed.

### 3.8 CI, repository and documentation

CI was pointed at the owner and never provisioned `trackroster_app`, so the gate would have
exercised the application with policies inert and proved nothing about tenant isolation. It
now provisions the role **before** migrations run — which matters twice, because
`ALTER DEFAULT PRIVILEGES` only covers tables created after it and the definer-function
grants are guarded on the role already existing. Verified against a database built from
empty: the runtime role ends with `SELECT` on all 91 tables, FORCE on all 81, `EXECUTE` on
all definer functions, and 0 rows visible without tenant context.

The repository was audited and found materially clean: no `TODO`/`FIXME`/`HACK` in tracked
source, every `deprecated` hit in `pnpm-lock.yaml`, and all 110 `legacy` hits a genuine
domain concept rather than dead code. One dead 529-line frontend fixture was removed. Seven
local branches whose commits were provably contained in the integration branch were deleted,
with every commit verified still reachable on the remote; five branches holding 14 unique
commits were left alone pending a decision.

---

## 4. Defects found and fixed, at a glance

Ordered by what they would have cost in production.

| #   | Defect                                                        | Consequence if shipped                                                                  |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Tenant policies inert (app connected as superuser)            | Isolation rested entirely on every query remembering its own `WHERE tenant_id`          |
| 2   | Tenant password/MFA policy silently defaulted to permissive   | A workspace's MFA requirement and password floor stopped being enforced during recovery |
| 3   | Activity could bypass a concurrent opposition                 | An activity recorded against a prospect who had just withdrawn consent                  |
| 4   | Guards queried without tenant context                         | 403 to essentially all authenticated traffic under the restricted role                  |
| 5   | Deadlock on idempotent create routes                          | 500 instead of 409 under concurrency                                                    |
| 6   | Evidence tables editable                                      | Audit and collision evidence could be rewritten                                         |
| 7   | Export/reconciliation sweeps silently stalled                 | Queued exports never processed, reservation evidence never reconciled, no error         |
| 8   | Workspace switcher and invitation acceptance broken under RLS | Users could not switch workspace or accept an invitation                                |
| 9   | CI proved nothing about isolation                             | Regressions in the guarantee would pass the gate                                        |

Items 2, 3 and 6 are the ones worth flagging to a reviewer: they are the cases where the
system was permissive rather than merely broken.

---

## 5. What is left

Full detail, acceptance criteria and estimates are in
[TRACKROSTER_REMAINING_WORK.md](../TRACKROSTER_REMAINING_WORK.md). In short:

**One pilot blocker.**

- **TR-916 — the reservation "durable intent" is not durable.** `prepare()` writes the intent
  inside the request transaction, so a failing `confirm` rolls it back: Redis keeps the lease,
  `reservation_records` has no row, and reconciliation has nothing to promote. The obvious fix
  — committing on its own connection — **was attempted and reverted**, because it hangs the
  claim path: the intent insert waits on the request transaction, which is itself awaiting
  `prepare`, and PostgreSQL cannot see the application-level cycle so it does not error. The
  ticket carries the `pg_blocking_pids` evidence and two designs that can work. **10–16 h.**

**Then, in order:** TR-918 six more services exposed to the same key-share deadlock (6–10 h,
one-word fix each but needs a concurrency test per route first); TR-917 mail delivers one
message per second and one unreachable recipient costs five (4–6 h); TR-914 an RLS catalogue
coverage guard, since `0071`/`0073` are one-shot loops and a new table gets no policy
silently (2–3 h); TR-913 audit immutability for tables beyond the two `0079` covered (2–3 h).

**Larger, not blocking a pilot:** backup and a rehearsed restore (TR-906, 8–12 h — nothing
has ever been restored); import deduplication, currently 1 of the 6 keys the dossier requires
(TR-905, 10–14 h); notification channel matrix (TR-907, 12–16 h); observability, of which
there is effectively none (TR-912, 8–12 h).

**Not ours to fix:** `pnpm lint` fails on one error in uncommitted `eslint.config.mjs` WIP
that declares `__dirname` and never uses it. Its author should decide.

**Readiness:** backend pilot-ready in **10–16 h**; a gate green on every run in **14–22 h**;
production-ready, including backups and observability, in **145–225 h** across all streams.

---

## 6. Three findings about how this was verified

Recorded because the same mistake produced three wrong conclusions, twice in published
audits.

1. **Export authorization (§3.7)** was reported as a P0 because one controller's decorators
   showed only `AuthGuard`. The authorization was in the service, and 23 tests covered it.
2. **The worker** was reported as having "no tenant context anywhere", from grepping for the
   _API's_ function names. It has its own — `withWorkerTenantTransaction` — and has had since
   two earlier commits. The real scope was the API's own sweeps.
3. **The consent bypass** resisted one diagnosis because the hypothesis was about snapshot
   visibility. The row was visible; a timestamp predicate excluded it.

The pattern in all three: absence of a name was read as absence of a mechanism. What
distinguished the correct diagnoses was measuring the running system — reading the Postgres
log, instrumenting a trigger, querying `pg_blocking_pids` — rather than reading code and
inferring. Where a claim in this document rests on a measurement, the measurement is quoted.

---

## 7. Verifying any of this

```bash
# the isolation proof: owner sees rows, the application role sees none
docker exec trackroster-postgres psql -U trackroster -d trackroster \
  -c 'select count(*) from organizations'
docker exec -e PGPASSWORD=trackroster_app trackroster-postgres \
  psql -U trackroster_app -h 127.0.0.1 -d trackroster \
  -c 'select count(*) from organizations'

# FORCE coverage, and the definer functions
docker exec trackroster-postgres psql -U trackroster -d trackroster -c \
  "select count(*) filter (where relforcerowsecurity) as forced, count(*) as tables
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'"

# the gate
pnpm format:check && pnpm typecheck && pnpm build && pnpm db:migrations:check
pnpm --filter api test && pnpm --filter worker test && pnpm --filter web test
pnpm --filter api test:integration
```
