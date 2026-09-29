# TrackRoster Remaining Work

The execution document for finishing TrackRoster. Every status below is backed by a
command that was run, a file that was read, or a test that was executed — never by
the existence of a file. Where something is unverified it says so.

- **Audited:** 2026-09-25 (revised after TR-902, TR-904 and TR-909)
- **Branch:** `codex/backend-completion`
- **Verification basis:** `pnpm format:check`, `pnpm typecheck`, `pnpm build`,
  `vitest run` (api unit, api integration, web), `pnpm db:migrations:check`, and
  live `psql` inspection of the running database.
- **Companion document:** [Implementation Compliance Audit](audits/TRACKROSTER_IMPLEMENTATION_COMPLIANCE_AUDIT.md)
  (per-requirement detail). This file is the execution source of truth; where the two
  disagree, this file is newer.

---

## Current project status

Tenant isolation is now genuinely enforced rather than nominally present, which was
the single largest gap. The remaining blockers are narrow and well understood: one
mechanism (tenant context for background work) and one hygiene task (a green gate).

| Gate                       | Result                                        |
| -------------------------- | --------------------------------------------- |
| `pnpm format:check`        | **PASS**                                      |
| `pnpm typecheck`           | **PASS** — 5/5 packages                       |
| `pnpm build`               | **PASS** — 4/4 tasks                          |
| `pnpm db:migrations:check` | **PASS** — 78 entries, contiguous chain       |
| `pnpm lint`                | **FAIL** — 1 error, 10 warnings (see TR-904)  |
| api unit                   | **746 passed / 0 failed**                     |
| api integration            | **582 passed / 1 failed** — the one is TR-916 |
| worker unit                | **65 passed / 0 failed**                      |
| web                        | **494 passed / 0 failed**                     |

Tenant isolation and concurrency suites, run individually:

| Suite                           | Result  |
| ------------------------------- | ------- |
| `tenant-rls`                    | 2 / 2   |
| `background-sweep-discovery`    | 3 / 3   |
| `data-jobs`                     | 17 / 17 |
| `reservation` (concurrency)     | 25 / 25 |
| `manager-override-concurrency`  | 1 / 1   |
| `idempotency-record.repository` | 11 / 11 |

### The isolation proof

Measured against the running database, no tenant context set:

| Query                                | owner (`trackroster`) | app role (`trackroster_app`) |
| ------------------------------------ | --------------------- | ---------------------------- |
| `select count(*) from organizations` | 176                   | **0**                        |
| `select count(*) from users`         | 90                    | **0**                        |

`FORCE ROW LEVEL SECURITY` is set on **81 / 81** tables carrying `tenant_id` (it was
0). `tenant-rls.integration.spec.ts` **inverted**: it fails as owner (its cross-tenant
insert succeeds when policies do not apply) and passes as the runtime role. That
inversion is the proof the policies are doing the work, not the application predicates.

---

## Current Git/repository state

- Branch `codex/backend-completion`, **24 commits ahead** of `origin/codex/backend-completion`, nothing behind.
- `main` is at `03eb354` and is **106 commits behind** this branch. The integration
  branch, not `main`, is where the product currently lives.
- Working tree: **one** uncommitted file, `eslint.config.mjs` — pre-existing developer
  WIP, deliberately untouched (see TR-904).
- No secrets are tracked. `.gitignore` covers `.env` and `.env.*` with `!.env.example`;
  only `.env.example` and `apps/web/.env.example` are in the index.
- Two `.env.bak-*` files exist locally. They are gitignored and contain secrets;
  they were left in place rather than deleted, one predating this session.
- A safety tag `tr901-before-regroup` marks the pre-regrouping commit state. Delete it
  once this branch is pushed and reviewed.

### Repository hygiene

The repository is materially clean. This was checked rather than assumed:

| Check                                                          | Result                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `TODO` / `FIXME` / `HACK` / `XXX` in tracked source            | **0**                                                                                                                            |
| `deprecated`                                                   | 10 — all in `pnpm-lock.yaml` (upstream dependency metadata)                                                                      |
| `legacy`                                                       | 110 — all a **domain concept** (legacy tenant-wide reservations, legacy compatibility user, legacy export routes), not dead code |
| Committed build output, logs, backups, `.orig`/`.rej`/`.patch` | **none**                                                                                                                         |
| Duplicate environment examples                                 | none — root and `apps/web` are different scopes                                                                                  |
| Empty packages                                                 | `packages/{config,types,ui,validation}` hold 1–2 non-TS files each                                                               |

Two things were removed, and one was restored after verification proved it was live:

- **Removed** `apps/web/src/lib/fixtures/manager-preview.ts` (529 lines). No import
  statement anywhere; the only mention was a comment.
- **Removed** untracked local artifacts: `trackroster-structure.txt` (a generated
  directory listing) and `TR-MP-001-manager-assignment-authority.patch`, whose content
  is provably already in the tree (`AssignmentAuthorityRole` at
  `apps/api/src/authorization/authorization.service.ts:9`, plus `createGrant`,
  `getAssignmentAuthority`, `requireAssignmentAuthority`, `mockValidContext`).
- **Restored** `apps/web/src/components/ui/preview-notice.tsx`. It was deleted on the
  assumption its export was the unused `PreviewNotice`; it also exports `PreviewTag`,
  which `manager/overview/page.tsx:21` imports. The filename was a poor guide to what
  is live. Caught by `tsc` before any commit.

`packages/*` were **retained despite appearing unused** — they are workspace
placeholders referenced by the Turborepo graph; removing them is a build-graph change,
not a cleanup.

---

## Cleaned branches

**None.** No branch was deleted. Deleting a remote branch is outward-facing and hard to
reverse, and 5 of the 15 remote branches hold commits that exist nowhere else. The
classification below is ready to execute on approval.

One thing did change without being a deletion: `git fetch --prune` removed **24 stale
remote-tracking refs** (`feat/TR-017…`, `feature/TR-013…`, and the rest of the
`TR-013`–`TR-028` series). Those branches were already deleted on the remote; only the
local mirror was out of date. No commits were involved.

## Remaining branches

`vs HEAD` counts commits on the branch that are **not** in `codex/backend-completion`.

| Branch                                            | Purpose                                                      | Last commit | vs main | vs HEAD | Merged? | Still useful?        | Action                                       |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------- | ------- | ------- | ------- | -------------------- | -------------------------------------------- |
| `main`                                            | Release trunk                                                | 2026-09-14  | 0       | 0       | —       | Yes                  | **KEEP**                                     |
| `codex/backend-completion`                        | Current integration branch                                   | 2026-09-24  | 106     | 0       | —       | Yes                  | **KEEP** (current)                           |
| `TR-036—AdminOrganization/Team/UserUI`            | Admin org/team/user UI; tip of the colleague's frontend line | 2026-09-17  | 15      | **4**   | No      | Needs decision       | **NEEDS REVIEW**                             |
| `feat/frontend-ui-integration`                    | Branding, auth shell, role-aware nav, self access grants     | 2026-09-18  | 5       | **5**   | No      | Needs decision       | **NEEDS REVIEW**                             |
| `docs/product-evaluation-backlog`                 | Delivery backlog docs                                        | 2026-09-22  | 3       | **3**   | No      | Yes                  | **MERGE FIRST** — checked out in a worktree  |
| `backend_dev`                                     | Single backend commit                                        | 2026-09-15  | 1       | **1**   | No      | Unknown              | **NEEDS REVIEW**                             |
| `frontendchatgpt`                                 | Variant of the tr-029 web shell                              | 2026-09-16  | 1       | **1**   | No      | Likely superseded    | **NEEDS REVIEW**                             |
| `frontend-dev`                                    | Frontend aggregation (subset of TR-036)                      | 2026-09-17  | 14      | 3       | No      | Superseded by TR-036 | **DELETE after TR-036 decision**             |
| `tr-035-import-ui`                                | Import/export UI (subset of TR-036)                          | 2026-09-17  | 12      | 1       | No      | Superseded by TR-036 | **DELETE after TR-036 decision**             |
| `feat/tr-029-web-shell-auth-ui`                   | Web shell + auth UI                                          | 2026-09-15  | 1       | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `feat/tr-030-prospect-work-queue`                 | Work queue                                                   | 2026-09-16  | 3       | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `feat/tr-031-prospect-detail-timeline-ui`         | Prospect detail/timeline                                     | 2026-09-16  | 5       | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `feat/tr-032-reservation-prospecting-action-ui`   | Reservation/action UI                                        | 2026-09-16  | 7       | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `frontend/tr-033—follow-up-workflow-ui`           | Follow-up workflow UI                                        | 2026-09-17  | 9       | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `frontend/tr-034manager-dashboard-ui`             | Manager dashboard UI                                         | 2026-09-17  | 11      | **0**   | In HEAD | No                   | **DELETE LOCAL + REMOTE**                    |
| `feature/manager-prospector-release` (local only) | Points at the tr-034 tip                                     | —           | —       | 0       | In HEAD | No                   | **DELETE LOCAL**                             |
| `feature/tr-100-integrated-baseline` (local only) | Points at the TR-036 tip                                     | —           | —       | 4       | No      | Needs decision       | **DO NOT TOUCH** — checked out in a worktree |

**Safe to delete now (6 remote + 1 local):** the six `feat/tr-029` … `frontend/tr-034`
branches and local `feature/manager-prospector-release`. Every commit on them is
already contained in `codex/backend-completion`, verified with
`git rev-list --count HEAD..<branch>` returning 0.

**Do not delete without a decision (5):** `TR-036—Admin…`, `feat/frontend-ui-integration`,
`docs/product-evaluation-backlog`, `backend_dev`, `frontendchatgpt`. These hold 14
commits that exist nowhere else. `TR-036` is the tip of a **separate frontend lineage**
(a colleague's) that the current integration branch rebuilt independently — whether it
is superseded or still owed a migration is a product decision, not a Git one.

**Never touch:** `/private/tmp/trackroster-delivery` and
`/private/tmp/trackroster-implementation` are live worktrees holding
`docs/product-evaluation-backlog` and `feature/tr-100-integrated-baseline`.

---

## Architecture status

| Concern                              | Status       | Evidence                                                                                                                                               |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo (pnpm + Turborepo)          | **COMPLETE** | `pnpm build` 4/4, `typecheck` 5/5                                                                                                                      |
| API (NestJS)                         | **COMPLETE** | 55 feature modules under `apps/api/src`                                                                                                                |
| Web (Next.js 16, BFF cookie pattern) | **COMPLETE** | 35 pages; tokens never reach browser JS                                                                                                                |
| Worker                               | **COMPLETE** | `withWorkerTenantTransaction` sets `trackroster.tenant_id` transaction-locally per job; `job-consumer.service.ts:85` sets context from the job payload |
| Request-scoped tenant transactions   | **COMPLETE** | `TenantTransactionInterceptor` as global `APP_INTERCEPTOR`, ALS executor proxy                                                                         |
| Guard-phase tenant context           | **COMPLETE** | `withGuardTenantScope` across 24 guards                                                                                                                |
| Background-work tenant context       | **COMPLETE** | all four API timer sweeps handled (0077, 0078); `auth_mail_outbox` is outside RLS by design so its sweep needs no context                              |

---

## Backend readiness

| Module                                | Impl % | Tests                                           | Security   | Tenant-safe | Prod ready? | Remaining work                                                       | Priority |
| ------------------------------------- | ------ | ----------------------------------------------- | ---------- | ----------- | ----------- | -------------------------------------------------------------------- | -------- |
| Multi-tenancy / RLS                   | 95     | Yes (`tenant-rls` 2/2)                          | Yes        | **Yes**     | **Yes**     | Worker + job sweeps run outside it                                   | P0       |
| Authentication / sessions             | 95     | Yes (`auth` 8/8)                                | Yes        | Yes         | Yes         | —                                                                    | —        |
| MFA                                   | 90     | Yes (`mfa`)                                     | Yes        | Yes         | Yes         | Enrolment matrix unverified                                          | P2       |
| RBAC / ABAC                           | 95     | Yes (`authorization`, `membership-permissions`) | Yes        | Yes         | Yes         | —                                                                    | —        |
| Prospects / establishments / contacts | 95     | Yes                                             | Yes        | Yes         | Yes         | —                                                                    | —        |
| Imports                               | 70     | Partial                                         | Yes        | Yes         | **No**      | 1 of 6 dedupe keys; no SIRET; no similarity                          | P1       |
| Campaigns / assignments               | 95     | Yes                                             | Yes        | Yes         | Yes         | —                                                                    | —        |
| Reservations / anti-collision         | 90     | Yes (25/25 concurrency)                         | Yes        | Yes         | Yes         | No PostgreSQL backstop behind Redis                                  | P2       |
| Idempotency                           | 95     | Yes (11/11)                                     | Yes        | Yes         | Yes         | —                                                                    | —        |
| Actions / immutable history           | 95     | Yes (`actions` 16/16)                           | Yes        | Yes         | Yes         | —                                                                    | —        |
| Follow-ups                            | 85     | Partial                                         | Yes        | Yes         | **No**      | Delivery depends on worker (TR-902)                                  | P0       |
| Notifications / jobs                  | 60     | Partial                                         | Yes        | Yes         | **No**      | No channel fan-out; CR-033 unenforced                                | P1       |
| Overrides                             | 95     | Yes (concurrency 1/1)                           | Yes        | Yes         | Yes         | —                                                                    | —        |
| Audit logging                         | 95     | Yes                                             | Yes        | Yes         | Yes         | Immutability under the app role unverified                           | P2       |
| Controlled exports                    | 95     | Yes (23 tests)                                  | **Yes**    | Yes         | Yes         | Async job path blocked on TR-902                                     | P0       |
| Object storage                        | 85     | Partial                                         | Unverified | Yes         | Unverified  | `providers/object-storage.service.ts` + MinIO; no failure-path tests | P2       |
| Email                                 | 75     | Partial                                         | Yes        | Yes         | **No**      | Mailpit not in Compose; delivery flaky                               | P2       |
| Dashboard APIs                        | 90     | Yes                                             | Yes        | Yes         | Yes         | Territory dimension missing                                          | P2       |
| Database constraints                  | 95     | Yes                                             | Yes        | Yes         | Yes         | —                                                                    | —        |
| Error handling / contract             | 90     | Yes                                             | Yes        | Yes         | Yes         | —                                                                    | —        |
| Rate limiting                         | 85     | Yes                                             | Yes        | n/a         | Yes         | IP+account buckets only                                              | P3       |
| Health / readiness                    | 90     | Partial                                         | n/a        | n/a         | Yes         | `/live` + `/ready` check DB and Redis, not storage                   | P3       |
| Environment validation                | 90     | Yes                                             | Yes        | n/a         | Yes         | New DB URLs not yet asserted                                         | P3       |
| Observability                         | 25     | No                                              | n/a        | n/a         | **No**      | No structured logging, metrics or tracing                            | P2       |
| Backups / restore                     | 20     | No                                              | n/a        | n/a         | **No**      | 53-line doc, no tooling, never rehearsed                             | P1       |
| CI/CD                                 | 85     | n/a                                             | n/a        | n/a         | **No**      | Gate is red (TR-904)                                                 | P0       |

### Definitions, kept distinct

- **Code complete** — the feature exists and typechecks. Most of the backend is here.
- **MVP complete** — code complete _and_ behaviourally tested. True except imports,
  notifications, follow-up delivery.
- **Pilot ready** — MVP complete, tenant-safe, gate green, restore rehearsed once.
  Blocked on TR-902 and TR-904.
- **Production ready** — pilot ready plus observability and a tested restore.
  Blocked additionally on TR-906 and TR-912.

---

## Frontend readiness

35 pages. 6 verified against the design handoff at 375–1440px, 28 wired but not
responsively verified, 1 static by design, 0 mocked. Web suite 494/494.

Not wired, backend-ready: `assignment-rules` / `simulate`, `assignment-suggestions`,
`saved-views`, `/search` in prospector navigation. French translation covers the
prospector path; manager, director and admin screens are English only.

## Database readiness

78 migrations, contiguous and verified at every commit. 91 tables; 81 carry `tenant_id`
and all 81 have RLS enabled, a policy, and FORCE set. The 10 without are the
deliberate pre-tenant surface: `identities`, `tenants`, `platform_access_grants`, the
five `auth_*` tables, `auth_mail_outbox`, and PostGIS `spatial_ref_sys`.

Five `SECURITY DEFINER` functions answer questions no single tenant context can, each
over a fixed minimal projection with `search_path` pinned and `EXECUTE` revoked from
`PUBLIC`: `trackroster_authentication_memberships` (0072),
`trackroster_invitation_tenant` (0074), `trackroster_identity_security_policy` (0075),
`trackroster_identity_workspaces` (0076), `trackroster_pending_action_effects` (0077).

**Known weakness:** 0071 and 0073 are one-shot loops over "tables with a `tenant_id`".
A table added later gets neither a policy nor FORCE, silently. `tenant-rls` asserts
behaviour but not catalogue coverage — see TR-914.

## Security readiness

Enforced and tested: tenant isolation at the database, authentication and session
validity, MFA, RBAC/ABAC including per-object export authorization, mandatory blocking
audit on exports, idempotency, rate limiting on auth, secrets from environment only.

Open: observability (cannot see an attack), audit-row immutability under the
application role is unverified, and object storage failure paths are untested.

**Resolved this session, worth recording because it was invisible before:** guards run
before interceptors, so every DB-reading guard queried with no tenant context. Under
the restricted role that denies all authenticated traffic. It failed _closed_, so it
was never a disclosure risk — but it was only discoverable once RLS actually applied.

**Resolved, and this one was a real weakening:** `SecurityPolicyService.forIdentity`
aggregates policy across every workspace an account belongs to. Under RLS it did not
error — it aggregated over zero visible rows and the `coalesce` defaults took over, so
a workspace requiring MFA or a longer password silently stopped having either enforced
during password recovery. Fixed by 0075.

## Testing readiness

| Suite           | Passing | Failing | Notes                                                                                        |
| --------------- | ------- | ------- | -------------------------------------------------------------------------------------------- |
| api unit        | 746     | 0       | the five stale `import-execution` cases were repaired under TR-904                           |
| api integration | 582     | 1       | TR-916 only; the mail flakiness is gone since TR-910, the rest fixed under TR-904 and TR-909 |
| worker unit     | 65      | 0       | the two webhook cases were repaired under TR-904                                             |
| web             | 494     | 0       |                                                                                              |

Gaps with no meaningful behavioural test: import deduplication against the dossier's
key set, notification channel matrix, worker tenant isolation, Redis-unavailable
reservation path, two-node claim, object storage failures.

## Infrastructure readiness

Compose provides PostGIS, Redis and MinIO, and mounts
`infrastructure/docker/postgres/init` so the runtime role is provisioned on a fresh
volume. `infrastructure/{nginx,terraform}` are empty. CI runs migration integrity,
migrate, lint, format, typecheck, unit and integration tests — as of this session
against the **restricted role**, verified by building a database from empty.

No deployment pipeline, no backup automation, no Mailpit service.

## Documentation readiness

Present and now consistent with the code: `README`, local setup, architecture,
environment variables (`.env.example` documents the three-URL split and how to verify
it), migrations, API readiness, authentication, authorization, multi-tenancy,
anti-collision, testing, the compliance audit, and this file.

Thin or stale: `docs/operations/BACKUP_RESTORE.md` is 53 lines of prose referencing no
runnable tooling; there is no production checklist; worker/jobs and storage have no
operational documentation.

---

## Completed modules

Authentication and sessions, MFA, RBAC/ABAC, prospects/establishments/contacts,
campaigns, assignments, reservations and anti-collision decisioning, idempotency,
actions and immutable history, manager overrides, audit logging, controlled exports
(synchronous path), dashboard APIs, database constraints, error contract, rate
limiting, health/readiness, environment validation, **multi-tenant isolation**.

## Partially completed modules

Imports (dedupe), notifications (channels), follow-ups (delivery), email (Mailpit),
object storage (failure paths), worker (tenant context), observability, backups, CI.

## Missing modules

Observability instrumentation; backup and restore tooling; notification channel
fan-out; deployment pipeline (`infrastructure/nginx`, `infrastructure/terraform` empty).

---

## Production blockers

### P0

#### TR-902 — Tenant context for all background work — **RESOLVED 2026-09-25**

Closed. Two corrections belong on the record, because the ticket was written on a false
premise.

**The worker was never the problem.** This ticket claimed "no tenant context anywhere in
`apps/worker/src`", from grepping for the _API's_ function names (`withTenantContext` /
`setTenantContext`). The worker has its own, and has had since
`23e8c22 feat(worker): add tenant scoped transaction helper` and
`8c03b25 fix(worker): route postgres job queries through tenant transactions`:
`withWorkerTenantTransaction` takes a dedicated client, validates the tenant is a uuid,
sets `trackroster.tenant_id` transaction-locally and commits or rolls back on one
connection — its docstring explicitly anticipates RLS being enabled.
`job-consumer.service.ts:85` sets the context from each job's payload. Of the seven
processors, the three that touch Postgres use it, follow-up-reminder goes through a
repository that uses it, `reservation-expiry` works on Redis keys only, and the two
`system-*` processors touch no tenant data. **This was the same name-based false negative
as the TR-903 export finding — the second of its kind.**

**The real scope was the API's own timer-driven sweeps**, of which there are four:
`ActionEffectsService.drain` (already fixed by 0077), `ExportJobService.drain`,
`ReservationLedgerService.reconcile`, and `AuthMailService` — the last needing nothing,
because it touches only `auth_mail_outbox`, which is `relrowsecurity = f` by design.

Fixed by migration 0078 plus `src/database/tenant-sweep.ts`, which writes the pattern
once: privileged discovery returning identifiers only, then one tenant-scoped transaction
per item, attempting every item so one poisoned row cannot starve a shared queue. The
export sweep needed scoping in four places, not one — discovery, the claim, `prepare()`
(which re-resolves authority and scope and reads the business rows through `this.db`), and
the failure path, which would otherwise have recorded nothing and left a job stuck in
`processing` until its lease expired. Serialization stays outside any transaction
deliberately: it is the slow part, has no database work, and holding a transaction across
a file build would pin a connection for its duration.

`reconcile()` had no test at all, which is exactly how it came to be broken with nothing
red. `test/background-sweep-discovery.integration.spec.ts` now guards the property, and
was verified to fail for the right reason by revoking a grant and watching it go red.

**Result:** `data-jobs` 17/17 — clearing TR-902's 5 failures _and_ one of the 8
pre-existing — and api integration **582 passed / 1 failed, with zero failures
attributable to the runtime role**.

#### TR-904 — Restore a green gate — **MOSTLY RESOLVED, 2 defects remain**

Integration went from **14 failures to 2**, and api unit, worker and web are all
green. Nine of the twelve were not product defects; five were, and two of those are
still open.

**Fixed, and they were real defects:**

1. **Territory assignment and campaign member creation deadlocked under concurrency**
   — returning 500 where the caller expects 409. These routes are idempotent, so the
   handler already holds `FOR KEY SHARE` on the tenant row (the idempotency record's
   foreign key) and then asks for `FOR UPDATE`, which is the one mode key share
   conflicts with. Two concurrent requests each wait for the other; PostgreSQL calls
   it 40P01 and nothing maps that to a conflict. Fixed by taking the mutex with `FOR
NO KEY UPDATE`, which is compatible with key share and still exclusive against
   itself — the mode assignment-batch, consents, reservation-rule, outcome-settings
   and import deduplication already used. **Latent, not new:** the guard-phase tenant
   scope added a round trip that changed the interleaving enough to make it reproduce
   every time rather than occasionally.
2. **The evidence tables were not immutable.** Three cases asserted that a collision
   event's reason code, an override request's decision reason and audit rows cannot
   be rewritten, and nothing enforced any of it. Migration 0079 revokes UPDATE and
   DELETE on `collision_events` and `audit_events` from the runtime role (no call
   site updates or deletes either; INSERT stays for the API and worker) and adds a
   trigger refusing any update to an override request that is no longer pending,
   since that one is legitimately written once at decision time. This also closes
   what TR-913 asked for.
3. **The mid-batch rollback guarantee had never actually been exercised.** Its
   synthetic audit failure never fired: the proxy intercepted `insert` on the
   request's transaction but handed back the real executor for `transaction`, so
   every write through the service's nested savepoint bypassed it and the batch
   simply succeeded. With the wrapper re-wrapping nested transactions the guarantee
   is verified — 500, no assignments, no audit rows, cursor unmoved, retry succeeds.

**Fixed, and they were test defects:** the OIDC case needed `SSO_ENCRYPTION_KEY`
(now supplied by the integration config rather than depending on a developer's
`.env`); `import-execution`'s five cases counted raw `database.transaction` calls
and missed the one `withTenantContext` adds; the worker's two webhook cases used a
placeholder tenant id and a bare `{ query }` double, both predating the tenant
transaction helper. api unit **746/746**, worker **65/65**, web **494/494**.

**Still open — 2 genuine product defects, each now precisely diagnosed:**

##### TR-909 — An activity could bypass a concurrent opposition — **RESOLVED 2026-09-25**

Closed, and it was a regression rather than a gap.

The serialisation was never at fault. `trackroster_guard_contact_operation` takes
`FOR SHARE` on the establishment before checking, and the opposition write takes
`FOR UPDATE` on the same row, so an activity does wait. What went wrong is what it
evaluated once the wait ended. Measured from inside the trigger on the failing case:

```
statement start   42.950919
consent effective 42.982199   committed while the writer waited
lock released     42.987203   36ms later
```

`statement_timestamp()` is the start of the top-level statement, so after a 36 ms wait
the guard asked what was blocked 36 ms ago and answered honestly: nothing. The row was
visible throughout — the same snapshot queried with `clock_timestamp()` found it. The
predicate excluded it, not the snapshot.

Migration 0038 is titled `consent_live_clock` and its comment reads "including after a
lock wait": it made the function VOLATILE and moved it to `clock_timestamp()` for exactly
this case. 0060 then extended it to follow merge families and rewrote it as STABLE with
`statement_timestamp()`, reinstating the bug its predecessor had named. **0080 restores
the clock and keeps 0060's recursion.**

This also explains the earlier failed attempt: changing volatility alone could not have
worked, because visibility was never the problem.

`consents` is 9/9 across four runs, and the spec now asserts both properties directly —
a redefinition dropping either fails with a message naming the cause rather than as a
race. Verified by reapplying 0060's definition and watching it go red.

##### TR-916 — The reservation "durable intent" is not durable _(P1)_

**Attempted and reverted on 2026-09-25.** The obvious fix deadlocks. That is worth more
than the attempt, so it is recorded here with the evidence.

- **Evidence of the defect:** `reservation-lifecycle` > "fails before Redis on intent
  failure and recovers uncertain claim confirmation" fails 3 of 3. With `ledger.confirm`
  forced to reject, `repo.findCurrent` returns a lease from Redis while
  `reservation_records` has **no row**, so the test dereferences undefined.
- **Diagnosis:** the claim writes the intent, acquires a Redis lease, then confirms —
  deliberately in that order, so a failure after the acquisition leaves something to
  reconcile. But `prepare()` writes inside the request transaction, so a failing
  `confirm` rolls the intent back while Redis keeps the lease. `refresh()` is written
  correctly and would promote a `pending` record whose lease is live; it never finds one.

**Why the obvious fix does not work.** Committing the intent on its own pooled connection
(an autonomous transaction) hangs the claim path. Measured, not predicted:

```
pid 18133  active               insert into "reservation_records" …   Lock/transactionid
pid 18135  idle in transaction  select "campaign_prospect_assignments" …   ← blocker
pg_blocking_pids(18133) = {18135}
```

18135 is the request transaction; it is idle because it is awaiting `prepare`. 18133 is the
intent write, waiting for 18135 to end. Postgres cannot see the application-level edge, so
there is no deadlock to detect and it **hangs until the test timeout** rather than erroring.
Three other cases in that suite broke the same way, and `afterAll` timed out because the
connection was never released.

The overlap is inherent rather than incidental: `reservation_records` carries the
`campaign_open_work_guard` trigger, which takes `campaigns … FOR SHARE` and
`establishments … FOR SHARE OF e`. `FOR SHARE` conflicts with `FOR NO KEY UPDATE`, which
is what the claim path already holds. So any second connection inserting that row while
the request is mid-flight can block on the request itself. The table's own constraints are
not the problem — it has a single FK, to `tenants`, needing only `FOR KEY SHARE`.

**Two designs that can work:**

1. _An intent log with no trigger_ — lowest risk. Append the intent to a dedicated
   table carrying only a `tenants` FK and no guard trigger, so an independent write needs
   only `FOR KEY SHARE` and cannot block on the request. Reconciliation reads that log and
   materialises or repairs `reservation_records`. Deadlock-free by construction; costs a
   table and a change to `reconcile`.
2. _Take the claim out of the request-wide transaction_ — most correct. A handler that
   performs an irreversible external side effect cannot be atomic with it, so wrapping it
   in one transaction is the actual mistake. Let this route opt out
   (`TenantTransactionInterceptor` would need to honour a decorator) and have the claim
   manage its own transactions, making the intent commit genuinely top-level. Larger
   change, and the handler's other writes lose their shared atomicity, which has to be
   reasoned about rather than assumed.

Do not retry the naive autonomous transaction. It is the third thing in this codebase that
looked like a one-line fix and was not.

- **Tests required:** the existing case, plus one asserting the claim path does not block
  when the intent is written while the request holds its locks.
- **Estimate:** **10–16 h** for design 1, **16–24 h** for design 2 (raised from 8–14 h:
  the simple version is now known not to work).

##### The lint error is still not mine to fix

`eslint.config.mjs:10` declares `__dirname` and never uses it — uncommitted developer
WIP. Its author should decide whether to use it or drop the two lines. Everything else
lints clean; the remaining 10 are `no-explicit-any` warnings.

##### Mail suites: much better, not deterministic

`password-recovery` and `invitations-security` were failing in most full runs and are
now stable in isolation (4–5 consecutive clean runs each) and usually clean in a full
run, but `password-recovery` still fails occasionally under full-suite load. The
residual cause is a **product throughput limit**, recorded as TR-917.

## MVP blockers

### P1

#### TR-905 — Import deduplication key set

- **Module:** imports
- **Problem:** Dedupe matches on normalized name only; the dossier requires six keys.
- **Evidence:** `apps/api/src/imports/import-deduplication.service.ts` references only
  `normalizedName` (lines 38, 43, 53). No phone, email/domain, SIRET or similarity.
- **Expected:** six keys including SIRET and a similarity threshold.
- **Current:** one key. Duplicate establishments enter under name variants.
- **Work required:** add phone, email/domain, SIRET and address keys; add a similarity
  measure (`pg_trgm`); make precedence explicit; surface near-matches to the anomaly queue.
- **Dependencies:** possible migration for `pg_trgm` and indexes.
- **Tests required:** one case per key, one precedence case, one near-match case.
- **Acceptance:** dossier's six keys covered by tests; no duplicate under name variants.
- **Estimate:** **10–14 h**

#### TR-906 — Backup and rehearsed restore

- **Module:** infrastructure
- **Problem:** No backup tooling and no restore has ever been performed.
- **Evidence:** `docs/operations/BACKUP_RESTORE.md` is 53 lines and references no
  script, `pg_dump`, cron or make target; no such script exists in the repo.
- **Expected:** automated backup, documented RPO/RTO, and a restore performed at least once.
- **Current:** prose only.
- **Work required:** `pg_dump` automation with retention, MinIO object backup, a restore
  runbook, and one rehearsal against a scratch database with the result recorded.
  Restore must be verified to work **as the owner**, since a restored database with no
  `trackroster_app` role locks the application out.
- **Dependencies:** none.
- **Tests required:** rehearsal evidence; a CI job that restores a dump and runs migrations.
- **Acceptance:** documented RPO/RTO; a dated rehearsal record; restored database passes
  `tenant-rls`.
- **Estimate:** **8–12 h**

#### TR-907 — Notification channel matrix and CR-033

- **Module:** notifications
- **Problem:** No channel fan-out; CR-033 (criticals cannot be disabled) unenforced.
- **Evidence:** `apps/api/src/notifications/` has controller, service, repository and
  DTO but no `'email'` / `'sms'` / `'push'` / `'in_app'` channel handling.
- **Expected:** per-type channel matrix with user preferences; critical types always delivered.
- **Current:** single implicit path.
- **Work required:** channel enum, per-type matrix, preference storage and resolution,
  an undisableable set, delivery adapters.
- **Dependencies:** TR-902 (delivery runs in the worker).
- **Tests required:** matrix table test; a test proving a critical cannot be disabled.
- **Acceptance:** every dossier notification type has a tested channel; CR-033 enforced by test.
- **Estimate:** **12–16 h**

## Hardening work

### P2

| ID     | Module        | Problem                                                                                                                                                                                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                                                                                                                      | Work                                                                                                                                                           | Tests                                                                                    | Est.   |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| TR-908 | reporting     | Territory dimension missing from dashboard filters                                                                                                                                                                                                                                                                                                                                                                                    | filters cover period, org, team, user, campaign                                                                                                                                                                                                                               | add territory to scope resolution and queries                                                                                                                  | scope test per role                                                                      | 4–6 h  |
| TR-909 | consents      | Concurrent-opposition race lets an activity bypass a new block                                                                                                                                                                                                                                                                                                                                                                        | `consents` test fails as owner and as app role                                                                                                                                                                                                                                | diagnose; likely needs lock ordering or a stricter isolation level                                                                                             | the existing failing test                                                                | 4–8 h  |
| TR-910 | email         | Mailpit not in Compose; recovery-token delivery is flaky                                                                                                                                                                                                                                                                                                                                                                              | `invitations-security` (1 case) and `password-recovery` (3 cases) fail intermittently on a mailbox read. Both pass in isolation and fail when run after other suites, so it is delivery timing and accumulated state, not logic. Observed before TR-902, so not caused by it. | add Mailpit as a Compose service; make `emailedToken` poll with a deadline instead of reading once                                                             | both suites, 20 consecutive passes in a full run                                         | 3–5 h  |
| TR-911 | reservations  | Redis lock has no PostgreSQL backstop                                                                                                                                                                                                                                                                                                                                                                                                 | audit §8                                                                                                                                                                                                                                                                      | add an advisory-lock fallback                                                                                                                                  | Redis-unavailable test                                                                   | 6–8 h  |
| TR-912 | observability | No structured logging, metrics or tracing                                                                                                                                                                                                                                                                                                                                                                                             | no `pino`/`winston`/OpenTelemetry in `apps/api`; no logger in `main.ts`                                                                                                                                                                                                       | structured request logging with tenant and request id, `/metrics`, error tracking                                                                              | log assertion test                                                                       | 8–12 h |
| TR-913 | audit         | Audit-row immutability under the app role unverified                                                                                                                                                                                                                                                                                                                                                                                  | audit §22                                                                                                                                                                                                                                                                     | `REVOKE UPDATE, DELETE` on `audit_events` from the runtime role                                                                                                | test that an update fails                                                                | 2–3 h  |
| TR-914 | database      | 0071/0073 are one-shot; a new `tenant_id` table silently gets no policy                                                                                                                                                                                                                                                                                                                                                               | both iterate `information_schema` once                                                                                                                                                                                                                                        | assert catalogue coverage in `tenant-rls`, or add an event trigger                                                                                             | coverage test over `pg_class`                                                            | 2–3 h  |
| TR-917 | email         | `dispatchPending` delivers **one** message per call on a 1s timer, so the API caps at ~1 email/second, and one unreachable recipient costs a 5s timeout — dropping it to ~1 per 5s. An invitation burst never catches up, and the resulting shared-outbox backlog is what still makes `password-recovery` fail occasionally under full-suite load. The HTTP call also runs inside the transaction, pinning a connection for up to 5s. | `src/auth/auth-mail.service.ts`: `setInterval(…, 1000)` and `.limit(1)` inside one `db.transaction`                                                                                                                                                                           | expire once, then deliver a bounded batch, each message in its own transaction, with the HTTP call outside it                                                  | 25 queued messages delivered within one tick; both mail suites clean across 10 full runs | 4–6 h  |
| TR-918 | concurrency   | Nine services take the tenant mutex with `FOR UPDATE` and **six sit behind idempotent routes**, so each is exposed to the same key-share upgrade deadlock TR-904 fixed in participation                                                                                                                                                                                                                                               | `resource-scope`, `territory`, `prospect-access`, `membership`, `campaign-lifecycle`, `campaign`, `workspace-administration` vs. the `no key update` precedent in assignment-batch, consents, reservation-rule, outcome-settings, import-deduplication                        | change each to `for('no key update')` — but write a concurrency test per route first, because the fix is one word and the risk is assuming rather than proving | a two-request test per affected route, red before and green after                        | 6–10 h |
| TR-915 | storage       | Object storage failure paths untested                                                                                                                                                                                                                                                                                                                                                                                                 | `providers/object-storage.service.ts` has no failure tests                                                                                                                                                                                                                    | add unavailable/partial-write tests                                                                                                                            | those tests                                                                              | 3–5 h  |

### P3

`establishments/:id/contacts` over-guarded (audit §12, 1–2 h); 10 `no-explicit-any`
warnings (2–3 h); `/ready` does not check object storage (1 h); environment validation
does not yet assert `DATABASE_MIGRATION_URL` / `DATABASE_SEED_URL` (1 h);
`infrastructure/{nginx,terraform}` empty (deployment, sized separately).

## Post-MVP work

Correctly absent, per the dossier's V1.1/V2 scope: advanced mapping, capacity-based
assignment, calendar integration, message templates, attachments, scheduled report
delivery, webhooks as a delivery guarantee, offline PWA, telephony integration, route
optimization, AI assistance, third-party enrichment, billing, white-labelling, SSO
sign-in, marketplace. **16 items — do not schedule these for MVP.**

---

## Prioritized task backlog

| #   | ID     | Priority | Title                                     | Est.    |
| --- | ------ | -------- | ----------------------------------------- | ------- |
| 1   | TR-916 | P1       | Reservation durable intent is not durable | 10–16 h |
| 2   | TR-918 | P2       | Tenant mutex deadlock at 6 more sites     | 6–10 h  |
| 3   | TR-917 | P2       | Mail delivery throughput                  | 4–6 h   |
| 4   | TR-914 | P2       | RLS catalogue coverage guard              | 2–3 h   |
| 5   | TR-913 | P2       | Audit immutability under the app role     | 2–3 h   |
| 6   | TR-906 | P1       | Backup and rehearsed restore              | 8–12 h  |
| 7   | TR-905 | P1       | Import deduplication key set              | 10–14 h |
| 8   | TR-907 | P1       | Notification channel matrix + CR-033      | 12–16 h |
| 9   | TR-908 | P2       | Territory reporting dimension             | 4–6 h   |
| 10  | TR-912 | P2       | Observability baseline                    | 8–12 h  |
| 11  | TR-911 | P2       | Reservation PostgreSQL backstop           | 6–8 h   |
| 12  | TR-915 | P2       | Object storage failure paths              | 3–5 h   |

TR-902, TR-909 and TR-910 are resolved and no longer listed. TR-904 is resolved except for the
two defects it uncovered, which lead this list as TR-909 and TR-916. TR-913 remains
only for tables beyond the two that 0079 covered.

## Dependencies

```
TR-902 (background tenant context) ──► RESOLVED
  ├─► data-jobs 17/17; one pre-existing failure cleared with it
  ├─► TR-907 unblocked (notification delivery runs in the worker)
  └─► the runtime role is now safe to enable in a deployed environment

TR-904 (green gate) ──► every later ticket inherits a trustworthy gate
  └─► residue: 7 pre-existing integration failures, 5 stale unit tests,
      2 worker webhook tests, one line of uncommitted lint WIP

TR-910 ──► removes the flaky mailbox test from TR-904's signal
TR-914, TR-913 ── independent, cheap, protect the isolation work already done
TR-906 ── independent; needs the runtime role to exist in restored databases
```

## Recommended execution order

1. **TR-910** and **TR-914** — together under 7 h. They stop TR-904's signal being
   polluted by a flaky mailbox test and protect the isolation work from silent
   regression, so they come before trying to make the gate green.
2. **TR-904** — the only remaining P0. The residue is 7 pre-existing integration
   failures, 5 stale unit tests, 2 worker webhook tests, and one line of someone else's
   lint WIP.
3. **TR-913** — cheap, and completes the audit-trail guarantee.
4. **TR-906**, then **TR-905**, then **TR-907**.
5. **TR-912** before any real production traffic.
6. Remaining P2s, then P3s.

## Estimated remaining hours

| Stream        | Hours         | Assumptions                                                                                                                                                                                                                                            |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend       | 58–88         | TR-909, 916, 918, 905, 907, 911, 914, 917. Narrower than before: the two pilot blockers are now diagnosed rather than unknown, but TR-909 is genuine design work and TR-918 needs a concurrency test per route before its one-word fix can be trusted. |
| Frontend      | 30–50         | Responsive verification of 28 pages, wiring 4 backend-ready API families, French for manager/director/admin. Excludes any decision to migrate the TR-036 lineage.                                                                                      |
| QA / testing  | 25–40         | Worker isolation, dedupe matrix, channel matrix, storage failures, two-node claim, Redis-unavailable.                                                                                                                                                  |
| DevOps        | 25–40         | TR-906, TR-912, deployment pipeline (nginx/terraform are empty — a first deployment is the least certain number here).                                                                                                                                 |
| Documentation | 8–12          | Production checklist, worker/jobs and storage runbooks, rewrite BACKUP_RESTORE against real tooling.                                                                                                                                                   |
| **Total**     | **145–225 h** | ≈ 3.5–5.5 engineer-weeks for one person; 3–4 weeks for two with the streams split.                                                                                                                                                                     |

Estimates assume the existing architecture is kept, the 16 post-MVP items stay out of
scope, and no decision is taken to migrate the colleague's frontend lineage (which
would add materially and is not costed here).

## Completion percentages

Conservative. A module counts as complete only when implementation, database and tests
all hold.

| Dimension                    | %      | Basis                                                                                                                |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Overall project              | **80** | weighted across the rows below                                                                                       |
| Backend functional           | **90** | 20 of 26 modules complete; imports, notifications, follow-up delivery incomplete                                     |
| Backend production-readiness | **78** | isolation now real and proven; observability, backups and a green gate outstanding                                   |
| Frontend                     | **75** | 35 pages exist, 6 verified responsive, 4 API families unwired, partial i18n                                          |
| Testing                      | **82** | 1,800 passing / 19 failing; named gaps in dedupe, channels, worker isolation                                         |
| Security                     | **85** | isolation, auth, RBAC, audit and export authorization enforced and tested; observability and audit immutability open |
| Infrastructure / DevOps      | **55** | Compose and CI solid; no deployment, no backups, no metrics                                                          |
| Documentation                | **80** | broad and now code-consistent; backup doc thin, no production checklist                                              |

## Pilot readiness

**NO — one defect away.** Tenant isolation, authentication, authorization, background
work, the anti-collision core, evidence immutability and mid-batch rollback are all
enforced and verified, with zero integration failures attributable to the runtime role.
api unit, worker and web are green.

One blocker remains. **TR-916**: the reservation durable intent is written inside the
request transaction, so a failing confirm rolls it back and leaves Redis holding a lease
that Postgres cannot reconcile — the uncertain-claim recovery the design depends on
cannot work. The integration suite runs **579–582 of 583**, with TR-916 the only stable failure; the
spread is `password-recovery` losing its race against the shared mail backlog, which is
TR-917 and is a throughput defect rather than a second blocker. Estimated **10–16 h** to a
defensible pilot, or **14–22 h** to a gate that is green every run — raised because the
straightforward fix for TR-916 is now known to deadlock.

## Production readiness

**NO.** Beyond pilot: no backup has ever been restored (TR-906) and there is no
observability (TR-912) — an incident would be neither diagnosable nor recoverable.
Estimated **145–225 h** total.

## Next ticket to implement

**TR-916 — Make the reservation's durable intent durable, via an intent log.**

Still the last stable integration failure and the last pilot blocker, but the shape of the
work is now known. `prepare()` writes the intent inside the request transaction, so a
failing `confirm` rolls it back: Redis keeps the lease, `reservation_records` has no row,
and `reconcile()` has nothing to promote.

**Read TR-916 above before starting.** The obvious fix — committing the intent on its own
connection — was attempted and reverted this session because it hangs the claim path, with
the `pg_blocking_pids` evidence recorded there. `reservation_records` carries a guard
trigger that takes `FOR SHARE` on `campaigns` and `establishments`, which conflicts with
locks the request already holds, and Postgres cannot see the application-level cycle, so it
does not error — it hangs.

Take design 1: an append-only intent table with no guard trigger and only a `tenants`
foreign key, which an independent write can reach needing just `FOR KEY SHARE`. Have
`reconcile()` read it. Design 2 — taking the claim out of the request-wide transaction — is
more correct and worth considering if this path is going to keep growing, since a handler
that performs an irreversible external side effect cannot meaningfully be atomic with it.

After it, the backend is pilot-ready on the evidence available: tenant isolation,
background work, authorization, evidence immutability, anti-collision concurrency,
idempotency and consent enforcement are all verified, with a green gate apart from TR-917's
mail flakiness and one line of lint WIP that belongs to someone else.
