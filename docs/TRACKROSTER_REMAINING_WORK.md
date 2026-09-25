# TrackRoster Remaining Work

The execution document for finishing TrackRoster. Every status below is backed by a
command that was run, a file that was read, or a test that was executed — never by
the existence of a file. Where something is unverified it says so.

- **Audited:** 2026-09-25
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

| Gate                       | Result                                       |
| -------------------------- | -------------------------------------------- |
| `pnpm format:check`        | **PASS**                                     |
| `pnpm typecheck`           | **PASS** — 5/5 packages                      |
| `pnpm build`               | **PASS** — 4/4 tasks                         |
| `pnpm db:migrations:check` | **PASS** — 78 entries, contiguous chain      |
| `pnpm lint`                | **FAIL** — 1 error, 10 warnings (see TR-904) |
| api unit                   | **741 passed / 5 failed**                    |
| api integration            | **565 passed / 14 failed**                   |
| web                        | **494 passed / 0 failed**                    |

Tenant isolation and concurrency suites, run individually:

| Suite                           | Result  |
| ------------------------------- | ------- |
| `tenant-rls`                    | 2 / 2   |
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

| Concern                              | Status       | Evidence                                                                       |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------ |
| Monorepo (pnpm + Turborepo)          | **COMPLETE** | `pnpm build` 4/4, `typecheck` 5/5                                              |
| API (NestJS)                         | **COMPLETE** | 55 feature modules under `apps/api/src`                                        |
| Web (Next.js 16, BFF cookie pattern) | **COMPLETE** | 35 pages; tokens never reach browser JS                                        |
| Worker                               | **PARTIAL**  | 46 files; no tenant context anywhere (TR-902)                                  |
| Request-scoped tenant transactions   | **COMPLETE** | `TenantTransactionInterceptor` as global `APP_INTERCEPTOR`, ALS executor proxy |
| Guard-phase tenant context           | **COMPLETE** | `withGuardTenantScope` across 24 guards                                        |
| Background-work tenant context       | **PARTIAL**  | action-effects sweep fixed (0077); export/import sweeps not (TR-902)           |

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

| Suite           | Passing | Failing | Notes                                                       |
| --------------- | ------- | ------- | ----------------------------------------------------------- |
| api unit        | 741     | 5       | all 5 in `import-execution.service.spec.ts`, stale (TR-904) |
| api integration | 565     | 14      | 8 pre-existing, 5 TR-902, 1 flaky (TR-910)                  |
| web             | 494     | 0       |                                                             |

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

#### TR-902 — Tenant context for all background work

- **Module:** worker, data-jobs, follow-ups, notifications
- **Problem:** Work that runs outside an HTTP request has no tenant context, so under
  the runtime role its queries return zero rows and it does nothing — silently.
- **Evidence:** `grep -rln 'withTenantContext|setTenantContext' apps/worker/src` →
  **no matches** across 46 files. `0070_worker_rls_policies.sql` put RLS on exactly the
  worker's tables (`notifications`, `prospect_follow_ups`, `audit_events`, `webhooks`,
  `scheduled_reports`, `evidence_exports`). 5 `data-jobs` integration tests fail for
  this reason; `ExportJobService.drain` selects queued jobs across all tenants with no
  filter, at `apps/api/src/data-jobs/export-job.service.ts:312-327`.
- **Expected:** every job processes under its own tenant's context; discovery of
  cross-tenant work is explicit and narrow.
- **Current:** discovery returns nothing; sweeps stall. Follow-up reminders are never
  delivered and no error is raised.
- **Work required:** apply the pattern already proven by `0077` /
  `ActionEffectsService.drain` — a `SECURITY DEFINER` discovery function returning
  identifiers only, then `withTenantContext` per item — to `ExportJobService.drain`,
  `ImportJobService`, the follow-up reminder processor, and the worker's processors.
  Prefer one shared helper over five copies.
- **Dependencies:** none. Blocks TR-904 reaching green and blocks any deployed use of
  the runtime role.
- **Tests required:** worker tenant-isolation test (does not exist); the 5 `data-jobs`
  cases must pass; a two-tenant queue test proving no cross-tenant processing.
- **Acceptance:** `grep` shows tenant context in every worker processor; `data-jobs`
  14/14; a job queued by tenant A is never processed in tenant B's context.
- **Estimate:** **10–16 h**

#### TR-904 — Restore a green gate

- **Module:** CI, lint, tests
- **Problem:** `pnpm lint` fails and 8 integration tests fail, so CI cannot pass and
  the gate cannot be trusted to catch regressions.
- **Evidence:** `pnpm lint` → `eslint.config.mjs:10:7 error '__dirname' is assigned a
value but never used`, plus 10 `no-explicit-any` warnings. 8 integration failures
  reproduce as owner **and** as the runtime role, so they predate the RLS work:
  `assignment-batch` (mid-batch evidence rollback), `collision-workflows` ×2,
  `consents` (concurrent opposition), `data-jobs` (interrupted processing),
  `membership-permissions` (OIDC secret encryption — needs `SSO_ENCRYPTION_KEY`),
  `participation` (concurrent overlap ranges), `reservation-lifecycle` (pre-Redis
  intent failure). 5 unit failures in `import-execution.service.spec.ts` are stale
  tests, not product defects.
- **Expected:** `pnpm check` and CI green.
- **Current:** 1 lint error, 8 + 5 test failures.
- **Work required:** the lint error is uncommitted developer WIP in `eslint.config.mjs`
  — **its author should decide** whether `__dirname` is wanted (use it) or not (remove
  the two lines); do not guess. Then triage the 8, several of which look like genuine
  concurrency/atomicity defects rather than test bugs. Provision
  `SSO_ENCRYPTION_KEY` in CI for the OIDC case.
- **Dependencies:** TR-902 for the 5 `data-jobs` cases.
- **Tests required:** the failing tests themselves.
- **Acceptance:** `pnpm lint` clean; api integration 579/579; api unit 746/746.
- **Estimate:** **12–20 h** (wide, because the 8 are not yet diagnosed)

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

| ID     | Module        | Problem                                                                 | Evidence                                                                   | Work                                                                              | Tests                                 | Est.   |
| ------ | ------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| TR-908 | reporting     | Territory dimension missing from dashboard filters                      | filters cover period, org, team, user, campaign                            | add territory to scope resolution and queries                                     | scope test per role                   | 4–6 h  |
| TR-909 | consents      | Concurrent-opposition race lets an activity bypass a new block          | `consents` test fails as owner and as app role                             | diagnose; likely needs lock ordering or a stricter isolation level                | the existing failing test             | 4–8 h  |
| TR-910 | email         | Mailpit not in Compose; recovery-token delivery is flaky                | `invitations-security` password-policy case fails ~3 in 10 on mailbox read | add Mailpit as a Compose service; make `emailedToken` poll with a deadline        | the flaky test, 20 consecutive passes | 2–4 h  |
| TR-911 | reservations  | Redis lock has no PostgreSQL backstop                                   | audit §8                                                                   | add an advisory-lock fallback                                                     | Redis-unavailable test                | 6–8 h  |
| TR-912 | observability | No structured logging, metrics or tracing                               | no `pino`/`winston`/OpenTelemetry in `apps/api`; no logger in `main.ts`    | structured request logging with tenant and request id, `/metrics`, error tracking | log assertion test                    | 8–12 h |
| TR-913 | audit         | Audit-row immutability under the app role unverified                    | audit §22                                                                  | `REVOKE UPDATE, DELETE` on `audit_events` from the runtime role                   | test that an update fails             | 2–3 h  |
| TR-914 | database      | 0071/0073 are one-shot; a new `tenant_id` table silently gets no policy | both iterate `information_schema` once                                     | assert catalogue coverage in `tenant-rls`, or add an event trigger                | coverage test over `pg_class`         | 2–3 h  |
| TR-915 | storage       | Object storage failure paths untested                                   | `providers/object-storage.service.ts` has no failure tests                 | add unavailable/partial-write tests                                               | those tests                           | 3–5 h  |

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

| #   | ID     | Priority | Title                                  | Est.    |
| --- | ------ | -------- | -------------------------------------- | ------- |
| 1   | TR-902 | P0       | Tenant context for all background work | 10–16 h |
| 2   | TR-904 | P0       | Restore a green gate                   | 12–20 h |
| 3   | TR-905 | P1       | Import deduplication key set           | 10–14 h |
| 4   | TR-906 | P1       | Backup and rehearsed restore           | 8–12 h  |
| 5   | TR-907 | P1       | Notification channel matrix + CR-033   | 12–16 h |
| 6   | TR-910 | P2       | Mailpit in Compose                     | 2–4 h   |
| 7   | TR-914 | P2       | RLS catalogue coverage guard           | 2–3 h   |
| 8   | TR-913 | P2       | Audit immutability under the app role  | 2–3 h   |
| 9   | TR-908 | P2       | Territory reporting dimension          | 4–6 h   |
| 10  | TR-909 | P2       | Consents concurrency race              | 4–8 h   |
| 11  | TR-912 | P2       | Observability baseline                 | 8–12 h  |
| 12  | TR-911 | P2       | Reservation PostgreSQL backstop        | 6–8 h   |
| 13  | TR-915 | P2       | Object storage failure paths           | 3–5 h   |

## Dependencies

```
TR-902 (background tenant context)
  ├─► 5 of the data-jobs failures clear
  ├─► TR-907 (notification delivery runs in the worker)
  └─► deployed use of the runtime role becomes safe
        │
TR-904 (green gate) ──┤ partly depends on TR-902
                      └─► every later ticket inherits a trustworthy gate

TR-910 ──► removes the flaky mailbox test from TR-904's signal
TR-914, TR-913 ── independent, cheap, protect the isolation work already done
TR-906 ── independent; needs the runtime role to exist in restored databases
```

## Recommended execution order

1. **TR-902** — the only remaining P0 mechanism, and it unblocks the most.
2. **TR-910** and **TR-914** — together under 7 h, and they stop TR-904's signal being
   polluted by a flaky test and protect the isolation work from silent regression.
3. **TR-904** — with TR-902 and TR-910 done, the residue is the 8 pre-existing failures
   and one line of someone else's lint WIP.
4. **TR-913** — cheap, and completes the audit-trail guarantee.
5. **TR-906**, then **TR-905**, then **TR-907**.
6. **TR-912** before any real production traffic.
7. Remaining P2s, then P3s.

## Estimated remaining hours

| Stream        | Hours         | Assumptions                                                                                                                                                                               |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend       | 60–90         | TR-902, 904, 905, 907, 909, 911, 913, 914. Wide because TR-904's 8 failures are undiagnosed — if they are test bugs it is the low end, if they are genuine concurrency defects, the high. |
| Frontend      | 30–50         | Responsive verification of 28 pages, wiring 4 backend-ready API families, French for manager/director/admin. Excludes any decision to migrate the TR-036 lineage.                         |
| QA / testing  | 25–40         | Worker isolation, dedupe matrix, channel matrix, storage failures, two-node claim, Redis-unavailable.                                                                                     |
| DevOps        | 25–40         | TR-906, TR-912, deployment pipeline (nginx/terraform are empty — a first deployment is the least certain number here).                                                                    |
| Documentation | 8–12          | Production checklist, worker/jobs and storage runbooks, rewrite BACKUP_RESTORE against real tooling.                                                                                      |
| **Total**     | **150–230 h** | ≈ 4–6 engineer-weeks for one person; 3–4 weeks for two with the streams split.                                                                                                            |

Estimates assume the existing architecture is kept, the 16 post-MVP items stay out of
scope, and no decision is taken to migrate the colleague's frontend lineage (which
would add materially and is not costed here).

## Completion percentages

Conservative. A module counts as complete only when implementation, database and tests
all hold.

| Dimension                    | %      | Basis                                                                                                                |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Overall project              | **78** | weighted across the rows below                                                                                       |
| Backend functional           | **88** | 20 of 26 modules complete; imports, notifications, follow-up delivery incomplete                                     |
| Backend production-readiness | **72** | isolation now real and proven; observability, backups and a green gate outstanding                                   |
| Frontend                     | **75** | 35 pages exist, 6 verified responsive, 4 API families unwired, partial i18n                                          |
| Testing                      | **80** | 1,800 passing / 19 failing; named gaps in dedupe, channels, worker isolation                                         |
| Security                     | **85** | isolation, auth, RBAC, audit and export authorization enforced and tested; observability and audit immutability open |
| Infrastructure / DevOps      | **55** | Compose and CI solid; no deployment, no backups, no metrics                                                          |
| Documentation                | **80** | broad and now code-consistent; backup doc thin, no production checklist                                              |

## Pilot readiness

**NO — but close.** Tenant isolation, authentication, authorization and the
anti-collision core are enforced and tested. Two things block a pilot: background work
does nothing under the runtime role (TR-902), so follow-up reminders and async exports
would silently never be delivered; and the gate is red (TR-904), so regressions would
not be caught. Estimated **22–36 h** to a defensible pilot.

## Production readiness

**NO.** Beyond pilot: no backup has ever been restored (TR-906) and there is no
observability (TR-912) — an incident would be neither diagnosable nor recoverable.
Estimated **150–230 h** total.

## Next ticket to implement

**TR-902 — Tenant context for all background work.**

It is the only remaining P0 mechanism; it is what makes enabling the runtime role in a
deployed environment safe; it clears 5 of the 14 integration failures; it unblocks
TR-907; and the pattern is already proven in this codebase by `0077` and
`ActionEffectsService.drain`, so it is implementation rather than design. Its failure
mode is also the worst available — silent, with no error — which is the strongest
argument for doing it before anything cosmetic.
