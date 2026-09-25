# TrackRoster Implementation Compliance Audit

> **Superseded in part — read [Remaining Work](../TRACKROSTER_REMAINING_WORK.md) first.**
>
> This audit records per-requirement detail as measured on 2026-09-24. Two of its
> findings have since changed and are corrected here for anyone reading it standalone:
>
> - **§10 / §43 P0 "RLS inert" is resolved.** Migration 0073 sets FORCE ROW LEVEL
>   SECURITY on all 81 tenant tables and the application now connects as
>   `trackroster_app`. With no tenant context that role reads 0 rows from
>   `organizations` where the owner reads 176, and `tenant-rls.integration.spec.ts`
>   passes as the runtime role while failing as the owner. Four cross-tenant flows and
>   24 guards were fixed alongside it.
> - **§23 export authorization was a false positive**, corrected in place below.
> - **§37 backup/restore** is recorded as "nothing exists"; in fact
>   `docs/operations/BACKUP_RESTORE.md` exists but references no runnable tooling. The
>   status is PARTIAL, not MISSING.
>
> For current status, blockers and estimates, use Remaining Work.

---

**Audit date:** 2026-09-25
**Branch:** `codex/backend-completion` @ `e3328f8` (17 ahead of origin)
**Method:** repository inspection, live database queries, and execution of the project's own test suites.
**Location note:** the repository's existing audit (`docs/API_READINESS_AUDIT.md`) sits at `docs/` root. This report uses the requested `docs/audits/` path because it is a different kind of document — a full product-compliance audit rather than an API readiness snapshot — and the two should not be confused for each other.

## Auditor disclosure

Earlier in this same working session I made and committed changes to this repository (commits `cdc8685` through `e3328f8`). This audit therefore examines a tree I partly authored. Where a finding concerns my own work I say so explicitly. Two conclusions in this report contradict positions I took earlier in the session; both corrections are marked.

---

## Mandatory summary table

| Area            | PASS | PARTIAL | FAIL | MISSING | UNVERIFIED | BLOCKED |
| --------------- | ---- | ------- | ---- | ------- | ---------- | ------- |
| Foundation      | 4    | 1       | 0    | 0       | 0          | 0       |
| Tenancy         | 1    | 2       | 1    | 0       | 1          | 0       |
| Authentication  | 5    | 1       | 0    | 0       | 0          | 0       |
| Authorization   | 3    | 1       | 0    | 0       | 1          | 0       |
| Prospects       | 3    | 1       | 0    | 0       | 0          | 0       |
| Imports         | 2    | 2       | 0    | 1       | 0          | 0       |
| Campaigns       | 3    | 0       | 0    | 0       | 0          | 0       |
| Assignments     | 3    | 1       | 0    | 0       | 0          | 0       |
| Anti-collision  | 6    | 1       | 0    | 0       | 0          | 0       |
| Reservations    | 5    | 0       | 0    | 0       | 0          | 0       |
| Actions         | 4    | 0       | 0    | 0       | 0          | 0       |
| Follow-ups      | 2    | 1       | 0    | 0       | 1          | 0       |
| Notifications   | 1    | 2       | 0    | 1       | 0          | 0       |
| Overrides       | 4    | 0       | 0    | 0       | 0          | 0       |
| Dashboard       | 2    | 1       | 0    | 0       | 0          | 0       |
| Audit           | 3    | 1       | 0    | 0       | 0          | 0       |
| Exports         | 2    | 1       | 0    | 0       | 1          | 0       |
| Frontend        | 4    | 2       | 0    | 0       | 1          | 0       |
| Security        | 5    | 2       | 1    | 0       | 1          | 0       |
| Infrastructure  | 2    | 1       | 0    | 2       | 0          | 0       |
| Tests           | 3    | 2       | 0    | 0       | 0          | 0       |
| Pilot readiness | 1    | 2       | 0    | 1       | 1          | 0       |

---

## 1. Executive summary

**The implementation is substantially the product the dossier describes.** The differentiating core — assignment, authorization, anti-collision, immutable history, cross-company coordination — is built, server-side, and covered by tests that genuinely assert the hard properties. This is not a UI shell over a thin backend.

Six of the dossier's seven anti-collision layers are implemented. The reservation claim is a single atomic Redis Lua compare-and-set that is organization-scope aware. Slide 19's multi-brand matrix exists as configurable data, not code. Action history is genuinely append-only. The `@Idempotent` decorator covers 113 operations including all four the source-of-truth names as critical.

**The one P0 is tenant isolation depth.** Row-Level Security policies exist on 81 tables and are correctly written with both `USING` and `WITH CHECK`, but they are inert: the application connects as `trackroster`, which is simultaneously `rolsuper`, `rolbypassrls`, and the table owner, while `FORCE ROW LEVEL SECURITY` is off. Tenant isolation today rests entirely on application-level predicates. Those predicates are present and consistent everywhere I read — but RLS is the net for the query that forgets, and the net is not attached.

**Three surfaces run before a tenant context exists,** and each must be solved before the role can be switched: sign-in, session validation in `AuthGuard`, and — not previously identified — **the entire worker process**, which sets no tenant context at all while migration `0070` put RLS on precisely the tables it writes.

**What blocks the MVP** beyond that: import deduplication matches on one key of the six the dossier specifies; the dashboard lacks the territory filter; and there is no backup or restore path of any kind.

**Repository quality is unusually high.** Zero `TODO`, `FIXME`, `@ts-ignore`, `@ts-expect-error` or `eslint-disable` in the entire application source. All 40 `console.log` are in one development seed. No brand names are hard-coded into domain logic.

---

## 2. Audit scope

All of `apps/api`, `apps/web`, `apps/worker`, `packages/*`, `database/migrations`, `infrastructure/`, `.github/`, plus the live development PostgreSQL and Redis. Frontend verification is source-level and test-level; no authenticated browser session was used, so visual and live-data conformance for authenticated screens is **UNVERIFIED** throughout.

## 3. Sources of truth used

1. `TrackRoster_Product_Design_Dossier_EN.pdf` — 42 slides, read in full (text extracted from the accompanying `.pptx`).
2. The Product + Engineering Source of Truth supplied in the brief (46 confirmed requirements, 12 invariants, 12 DoD gates).
3. The repository itself, which outranks all documentation for questions of what exists.

Where the source-of-truth's _inferred_ recommendations differ from the dossier, the dossier governs. One such case is recorded in §18.

## 4. Repository architecture discovered

pnpm 11.24 + Turborepo. `apps/{api,web,worker}`, `packages/{config,jobs,types,ui,validation}`.

- **Backend:** NestJS 12, Fastify adapter, 440 source files, **325 route decorators** across `*.controller.ts` (386 including controllers declared inside module files). Drizzle ORM, PostgreSQL 16 + PostGIS, Redis, Argon2, JWT.
- **Frontend:** Next.js 16.3.4 App Router, React 19, 35 pages, **144 BFF route handlers**, Tailwind v4, MapLibre GL + self-hosted Protomaps.
- **Worker:** separate Nest application, 7 job processors, graceful shutdown, dispatcher/consumer split.
- **Shared packages:** `packages/ui`, `packages/types`, `packages/validation` contain **only a `package.json`** — they are empty scaffolding. All shared frontend code lives in `apps/web/src`. _Finding: the monorepo advertises shared packages it does not have._

**Git status (unmodified by this audit):** branch `codex/backend-completion`, 17 ahead of origin. Uncommitted: `eslint.config.mjs` (modified), `TR-MP-001-manager-assignment-authority.patch` and `trackroster-structure.txt` (untracked). All three are the developer's own and were left untouched.

## 5. Build / lint / typecheck / test status

| Command                              | Result   | Notes                        |
| ------------------------------------ | -------- | ---------------------------- |
| `pnpm typecheck`                     | **PASS** | 5/5 tasks                    |
| `pnpm lint`                          | **FAIL** | 1 error + 10 warnings        |
| `pnpm format:check`                  | **FAIL** | 3 files                      |
| `pnpm db:migrations:check`           | **PASS** | 73 entries, contiguous chain |
| `pnpm --filter api test`             | **FAIL** | 741 passed / **5 failed**    |
| `pnpm --filter web test`             | **PASS** | 494 / 494                    |
| `pnpm --filter api test:integration` | **FAIL** | 572 passed / **7 failed**    |
| `pnpm --filter web build`            | **PASS** | compiles                     |

**Attribution of the failures:**

- The single lint **error** (`'__dirname' is assigned a value but never used`) is in the developer's **uncommitted** `eslint.config.mjs`. Not a repository defect.
- The 10 warnings are `no-explicit-any`, concentrated in error-handling helpers.
- The 3 `format:check` failures are `apps/api/test/{actions,assignment-batch,assignment-lifecycle}.integration.spec.ts`, last touched by commits `a448abd`, `aa72aa1`, `43f67c3` — **not** by this session. **CI runs `pnpm format:check`, so CI is currently red on `main`-bound work.**
- The 5 unit failures are all in `apps/api/src/imports/import-execution.service.spec.ts` (`executor.execute is not a function` in `withTenantContext`) — a test double that does not implement the executor interface. Pre-existing; verified by stashing this session's changes and re-running.

## 6–7. Requirement traceability & MVP compliance

Condensed to the findings that carry weight; every row is evidenced below in the relevant section.

| Req            | Requirement                                  | MVP | Status         | Evidence                           |
| -------------- | -------------------------------------------- | --- | -------------- | ---------------------------------- |
| CR-002         | Tenant data must not cross client boundaries | MVP | **PARTIAL**    | Policies exist and are inert — §10 |
| CR-003         | Canonical prospect identity                  | MVP | **PARTIAL**    | 1 of 6 matching keys — §21         |
| CR-006/007     | One action = one row, never overwritten      | MVP | **PASS**       | §19                                |
| CR-008/028/029 | Server-side, transactional collision check   | MVP | **PASS**       | §16, §17                           |
| CR-009/010     | Override needs reason + audit                | MVP | **PASS**       | §22                                |
| CR-019/020     | Reservations prevent collision, expire       | MVP | **PASS**       | §17                                |
| CR-026         | Multi-brand policy                           | MVP | **PASS**       | §18                                |
| CR-032         | Due follow-ups generate tasks/alerts         | MVP | **PARTIAL**    | §20                                |
| CR-033         | Critical alerts cannot be disabled           | MVP | **UNVERIFIED** | §20                                |
| CR-037/038     | Import dedupe + preview before insert        | MVP | **PARTIAL**    | §21                                |
| CR-040/041     | Exports scoped + audited                     | MVP | **PARTIAL**    | §23                                |
| CR-042         | Dashboard filtering                          | MVP | **PARTIAL**    | territory missing — §20            |
| CR-044         | Tested backup/restore                        | MVP | **MISSING**    | §37                                |
| CR-045         | Idempotent critical requests                 | MVP | **PASS**       | §29                                |
| CR-046         | Automated concurrency tests                  | MVP | **PASS**       | §17                                |

## 8. Architecture conformance

Matches the dossier's "API-first modular monolith" precisely. PostgreSQL is authoritative for reservation identity, assignments, actions, overrides and audit. Redis holds the short-lived lock and the rate limiter.

**Deviation — RISK:** the reservation _lock_ is Redis-only. `reservation.repository.ts` acquires via Lua CAS against Redis keys; there is no PostgreSQL unique/exclusion constraint that would independently prevent two overlapping active reservations. If Redis is lost, in-flight locks vanish. The source-of-truth explicitly warns "Redis should not be the only mechanism protecting correctness." Current behaviour on Redis loss is **UNVERIFIED** — I did not test it, and no test covers it.

**Deviation — TECHNICAL DEBT:** empty `packages/{ui,types,validation}`.

**BENIGN:** no microservices, no CQRS, no event sourcing. Proportionate.

## 9. Domain model compliance

All 20 dossier entities exist. 91 tables, 93 migrations.

**Prospect vs Establishment resolution (the source-of-truth's DEC-02):** the implementation collapsed them. `establishments` is the canonical record; the commercial relationship is `campaign_prospects` (campaign × establishment). `prospect_addresses` and `establishment_contacts` hang off the establishment. `prospect-master.controller.ts` routes `/prospects/:id` where `:id` **is the establishment id** — confirmed in `prospect-master.service.ts::children()`, which filters `establishmentContacts.establishmentId = id`.

Per the brief's instruction not to call a deviation wrong merely for differing from an inferred proposal: this is a **defensible resolution** that satisfies the business requirement (one canonical site, many campaign relationships) with less machinery. It should be **ratified as the decision** rather than left implicit — the naming currently misleads (`/prospects/:id` taking an establishment id).

## 10. Tenant isolation audit — **P0**

**Direct database evidence:**

```
relname             rls_enabled  rls_forced      (81 of 91 tables enabled, 0 forced)
organizations       t            f
establishments      t            f
campaign_prospects  t            f
actions             t            f

rolname          rolsuper  rolbypassrls
trackroster      t         t          ← DATABASE_URL connects as this
trackroster_app  f         f          ← intended runtime role

pg_tables.tableowner('organizations') = trackroster
```

Three bypasses stack: superuser, `BYPASSRLS`, and table ownership without `FORCE`. Policy `organizations_tenant_isolation` carries both `USING` and `WITH CHECK` and never executes.

**Reproduction:** `apps/api/test/tenant-rls.integration.spec.ts` fails in isolation — a cross-tenant `INSERT` inside `withTenantContext(db, tenantA)` writing `tenantId: tenantB` **succeeds**. Switching `DATABASE_URL` to `trackroster_app` makes it pass 2/2, and `SELECT count(*) FROM organizations` returns 0 without context versus every row as owner.

**The 10 tables without RLS are deliberate and correct:** `spatial_ref_sys` (PostGIS), `tenants` (the registry itself), `identities` (global — one person, many tenants), the five `auth_*` tables (keyed to identity, not tenant), `platform_access_grants` (platform scope).

**Three pre-context surfaces block the switch:**

1. **Sign-in** — resolved this session via a `SECURITY DEFINER` function (`0072_authentication_membership_lookup.sql`, `prosecdef=t`, pinned `search_path`, `EXECUTE` revoked from `PUBLIC`).
2. **`AuthGuard`** — reads `auth_sessions` before `TenantTransactionInterceptor` runs; resolved by scoping the lookup to the signature-verified token's tenant.
3. **The worker — NOT ADDRESSED.** `grep withTenantContext|setTenantContext apps/worker/src` returns **nothing**. The worker connects with the same `DATABASE_URL`, carries `tenantId` in the job payload (`follow-up-reminder.processor.ts:142` throws `PermanentJobError` if absent) and filters in application code — but sets no database context. Migration `0070_worker_rls_policies.sql` enabled RLS on `notifications`, `prospect_follow_ups`, `audit_events`, `webhooks`, `scheduled_reports`, `evidence_exports` — exactly the worker's tables. **Under the runtime role every worker query returns zero rows.**

**Status: FAIL** for defence-in-depth; **PASS** for application-level filtering, which I found consistently applied in every query I read.

## 11. Authentication audit — **PASS**

Argon2; MFA with recovery codes and encrypted secrets (`MFA_ENCRYPTION_KEY`, 64-hex validated at boot); session rotation; workspace-selection challenge; Redis-backed rate limiting keyed on IP **and** normalized identity, which **fails closed** when the store is unavailable (`auth-rate-limit.guard.spec.ts:36`). No secrets committed — `.env.example` carries placeholders only.

**PARTIAL:** `AuthMailService` validates `MFA_ENCRYPTION_KEY` and `AUTH_PUBLIC_ORIGIN` in `onModuleInit` and throws, so the API exits on startup without them. Until this session `.env.example` listed both as _optional_. Corrected in `0b14f56`.

## 12. RBAC / authorization audit

Authorization is **not role-only**, which matches the source-of-truth's ABAC-over-RBAC recommendation. Guard usage across controllers:

```
AuthGuard 81 · ClientAdminGuard 31 · RouteWriteGuard 9 · ProspectWriteGuard 9
ResourceAccessGuard 7 · ParticipationGuard 6 · ActionWriteGuard 6
CollisionWorkflowGuard 5 · AssignmentLifecycleGuard 5 · ReservationLifecycleGuard 4 · RosterGuard 3
```

Scope predicates compose in SQL (`masterAccess`, `prospectReadScope`, `consentAccess`). Roles are `client_admin | director | manager | prospector | observer` plus `super_admin` via `platform_access_grants` and a read-only `support_operator` grant — matching the dossier's six roles.

**Finding (PARTIAL):** `GET /establishments/:id/contacts` carries `@UseGuards(AuthGuard, ClientAdminGuard)` at **controller** level, so a prospector cannot read the contacts of an establishment they are assigned. The parallel `GET /prospects/:id/contacts` is auth-only and is what the frontend uses. Likely over-guarded; worth a deliberate decision.

**UNVERIFIED:** `manager-dashboard-query.dto.ts` comments that "a valid UUID does NOT imply that the caller is allowed to report on that organization/team/user/campaign. Authorization/scoping is TR-023-D." Whether TR-023-D landed is not established. If it did not, a manager could report across teams.

## 13–15. Prospect model, lifecycle, campaigns & assignments

Lifecycle enum `to_contact → contact_made → in_progress → follow_up → qualified → converted` matches the dossier. Transitions are action-driven; `actions_assignment_state_guard` and `campaign_open_work_guard` are database triggers enforcing state rules. The dossier's four exit states (final refusal, do-not-contact, invalid details, no answer) are modelled through outcomes and `contact_consents` rather than lifecycle values — **defensible**, and consistent with "status must come from an explicit action."

Assignments: manual, bulk (`POST /assignments/bulk`), preview, reassign, revoke, complete; `assignment-lifecycle` and `assignment-batch` integration suites exist. Strategy enum already supports `capacity | round_robin | skill | proximity` — **EXTRA_SCOPE** relative to MVP (these are V1.1), though harmless since no UI exposes them.

## 16. Anti-collision engine audit

| Dossier layer          | Status      | Evidence                                                                                 |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| 1. Duplicate detection | **PARTIAL** | `import-deduplication.service.ts` — normalized **name + postal code only**               |
| 2. Active assignment   | **PASS**    | `collision-business-decision.service.ts`, `ACTIVE_ASSIGNMENT`                            |
| 3. Planned action      | **PASS**    | `PLANNED_ACTION`, covers follow-ups and planned contacts                                 |
| 4. Active reservation  | **PASS**    | 3-tier: exact → legacy tenant-wide → org-scoped (`collision-decision.service.ts:44-140`) |
| 5. Cooldown            | **PASS**    | `CoolingOffService.evaluateActivity`, `RECENT_CONTACT`                                   |
| 6. Multi-brand policy  | **PASS**    | §18                                                                                      |
| 7. Manager override    | **PASS**    | §22                                                                                      |

Decision outputs map to the dossier's three: `allow` / `block` / override-required, with reason codes (`NO_COLLISION`, `ACTIVE_RESERVATION`, `ACTIVE_ASSIGNMENT`, `PLANNED_ACTION`, `RECENT_CONTACT`). Blocked responses carry the reason and the conflicting reservation's `expiresAt` — satisfying "explicit reason + next available option."

**Opt-out is the first gate** and is enforced in two places: DB trigger `prospect_activities_consent_guard` (migration `0037`) and application `checkConsent()` in `action.service.ts:83,357`, both calling `trackroster_consent_blocked`.

## 17. Concurrency verification — **PASS, with one open race**

`test/reservation.integration.spec.ts` passes **25/25 in isolation**, including:

- `:674` "allows exactly one of two concurrent prospectors to reserve the same campaign prospect" — `Promise.all`, asserts exactly one winner
- `:1223` "allows exactly one concurrent reservation across campaigns for the same establishment"
- `:980` becomes reservable again after Redis TTL expiry
- `:1041` a stale reservation id cannot release a newer reservation

Atomic boundary: one Redis Lua script checking N keys and writing only the target organization's lock — which is what permits INDEPENDENT brands to hold simultaneous reservations without a distributed lock manager. `manager-override-concurrency.integration.spec.ts` covers the override race.

**Open race — `consents`:** _"serializes an activity behind concurrent opposition so it cannot bypass the new block"_ fails. The guard works **sequentially** (two sibling tests get `PCC01` correctly); the concurrent serialization does not — an activity commits despite an opposition recorded microseconds earlier. The design is sound on paper (consent insert takes `FOR UPDATE`, activity insert takes `FOR SHARE`). **I hypothesised that `trackroster_consent_blocked` being the only `STABLE` trackroster function caused a stale post-lock snapshot, tested it, and was wrong**; the function was restored to `STABLE`. Root cause remains open.

**Untested failure modes:** Redis unavailable during claim; API crash after claim; two API nodes.

## 18. Multi-company coordination — **PASS**

`organization_coordination_policies(tenant_id, organization_a_id, organization_b_id, policy, delay_minutes)` with enum `shared | coordinated | delayed | independent` — exactly the dossier's Shared / Coord. / Deferred / Indep. Tenant-scoped, fully data-driven.

**No brand names in domain logic.** `GFTIJ|INTERTRAD|OFTI|AFTIJ` appear only in: `apps/web/src/lib/fixtures/manager-preview.ts` (dead — §41), `development-work-queue.seed.ts`, and two `.spec.ts` files.

**Documented deviation:** the source-of-truth recommends _campaign-pair_ granularity; the implementation is _organization-pair_. **Dossier slide 19 is an organization matrix**, so the implementation follows business truth. Recorded, not a defect — but if two campaigns within one company ever need different policies, this is where it will bite.

## 19. Action immutability — **PASS**

- No `DELETE` route on actions anywhere.
- Finalized actions reject mutation: `throw new ConflictException('Action is already finalized')` (`action.service.ts:325`).
- Corrections **append an event** and return the original row unchanged (`:309-323`) — the superseding-entry pattern the source-of-truth prescribes.
- `FOR UPDATE` row locks throughout.
- Trigger `trackroster_action_history_immutable` exists at the database level.
- `@Idempotent('action.create')` guards duplicate POSTs.

Captured automatically: author, tenant, timestamps, assignment, reservation. Satisfies INV-04 and DOD-02.

## 20. Follow-ups, notifications & dashboard

Follow-up CRUD, scheduler, `follow-up-reminder.processor.ts` with `PermanentJobError` payload validation, and a `notifications` module with inbox/unread/read-all/preferences/devices all exist.

**PARTIAL / UNVERIFIED:** I found no implementation of the dossier's slide-28 channel matrix — six events × recipient × channel (in-app / email / push) × priority — and no enforcement that critical collision, opt-out and security alerts **cannot be disabled** (CR-033). `notification.service.ts` contains no channel fan-out.

**Dashboard (PARTIAL):** `ManagerDashboardQueryDto` supports `from`/`to` (half-open, ≤366 days, cross-field validated), `organizationId`, `teamId`, `userId`, `campaignId`. **`territoryId` is absent.** The dossier requires filtering by "company, team, period, campaign **and territory**" — 4 of 5. Metrics are real SQL aggregation (`report-query.repository.ts`, 11 queries; rates return `null` rather than `0` on an empty denominator).

## 21. Import & data quality — **PARTIAL**

Pipeline exists end to end: `import-preview` (upload, map, validate, preview) → `import-issues` anomaly queue → `import-execution` (commit) → report. Multipart handling, row staging, issue triage.

**The gap is deduplication.** `import-deduplication.service.ts` matches on **normalized establishment name + postal code**, exact. The dossier (slides 16 and 30) requires _"Name, address, phone, e-mail, domain, SIRET and similarity"_ with matching keys _"Normalized phone — e-mail / domain — address + postal code — legal identifier — name similarity — approximate geolocation."_

Implemented: 1 of 6. No similarity scoring. **`SIRET` does not appear anywhere in the codebase.** This directly weakens INV-01 / Principle 1 ("a single identity"), which is the first thing the anti-collision engine is supposed to protect.

## 22. Audit log — **PASS**

`audit_events` table with RLS; `AuditService.record`; wired into overrides (`manager-override.service.ts:307`), exports, assignments, imports and security operations. `audit-atomicity.integration.spec.ts` and `audit-events-schema.integration.spec.ts` exist. Override DTOs make `reason!: string` non-optional in both `create-collision-override.dto.ts` and `collision-workflow.dto.ts`.

**PARTIAL:** whether audit rows can be `UPDATE`d or `DELETE`d through the application role is **UNVERIFIED** — currently the app is superuser, so at present they can.

## 23. Export security — **PASS**

**Strong:** audit is mandatory and _blocking_ — `controlled-export.service.ts:125` comments _"Audit is mandatory. If audit persistence fails, this method throws."_ The export does not happen if it cannot be logged. That is the correct ordering and rarer than it should be.

**Authorization — VERIFIED (correction, 2026-09-25).** An earlier revision of this audit recorded a P0 here on the grounds that `controlled-export.controller.ts` carries only `@UseGuards(AuthGuard)`. That finding was wrong. It came from reading one controller's decorators without tracing into the service or running the tests, and it is withdrawn. What the code actually does:

_Two_ controllers answer on `exports`, and both authorize:

1. **`exports/controlled-export.controller.ts`** authorizes in the service, before any business read. `controlled-export.service.ts` calls `scopeService.resolve({ tenantId, userId, filters })` as its first act, commented _"Authorization happens before the export repository is allowed to read business data."_ `manager-dashboard-scope.service.ts:85-86` throws `ForbiddenException('User is not authorized to view manager reporting')` when the caller holds none of `client_admin` / `director` / `manager`. Scope is not merely checked, it is _returned_ and then constrains the query, so a director cannot widen past their organizations nor a manager past their teams.
2. **`data-jobs/export-job.controller.ts`** uses `@UseGuards(AuthGuard, ExportJobGuard)`. `ExportJobGuard` calls `service.row(auth, exportId)` for every `:exportId` route and `service.authority(auth)` otherwise — per-object authorization, which closes IDOR as well as role escalation. `authority()` requires an active `client_admin@tenant | director@organization | manager@team` membership **and** a tenant-configurable `tenant_role_permissions.permissions ? 'exports.create'` grant, throwing `ForbiddenException('Export permission required')` otherwise. `row()` raises `NotFoundException` for an export id outside the caller's tenant before authorizing at all.

Both paths are covered by behavioural tests, run this session:

- `controlled-export.integration.spec.ts` — **6/6 pass**, including `rejects prospectors from controlled exports`, which asserts **403 and zero audit events** (no partial disclosure, no audit noise), plus team-masking, org-masking and director-scope cases.
- `data-jobs.integration.spec.ts` — **17/17 pass**, including `denies foreign/prospector access and invalidates files after export permission changes`, which covers cross-tenant access and revocation of already-issued files.

This is stronger than the dossier requires: role-gated, tenant-configurable per role, object-level, tenant-scoped, and audited blockingly. No remediation needed; **TR-903 is closed as proven.**

## 24–25. API & frontend integration

**325 route decorators** (386 including module-embedded), **144 BFF handlers**, **35 pages**.

All eight dossier-priority endpoints have semantic equivalents:

| Dossier                        | Implementation                                | Status |
| ------------------------------ | --------------------------------------------- | ------ |
| `POST /auth/login`             | `POST /auth/login`                            | PASS   |
| `POST /imports/preview`        | `POST /imports` + `/imports/:id/validate`     | PASS   |
| `POST /assignments/bulk`       | `POST /assignments/bulk`                      | PASS   |
| `POST /reservations/claim`     | `POST /campaigns/:c/prospects/:p/reservation` | PASS   |
| `POST /actions`                | `POST /actions`                               | PASS   |
| `GET /prospects/{id}/timeline` | `GET /campaigns/:c/prospects/:p/timeline`     | PASS   |
| `GET /manager/dashboard`       | `GET /manager/dashboard`                      | PASS   |
| `POST /overrides/{id}/decide`  | `POST /override-requests/:id/:decision`       | PASS   |

**Frontend integration:** every one of the 35 pages resolves to at least one real API client; none renders fixture data. `/invite` is static by design. Verified end-to-end by tests: `/`, `/work-queue` (+detail), `/follow-ups`, `/manager/overview`, `/manager/approvals`, `/search`. The rest are wired and type-checked but have no page-level test — **UNVERIFIED** for live behaviour.

**Unwired backend capability** (backend ready, no frontend): `assignment-rules` CRUD + `:ruleId/simulate`, `assignment-suggestions`, `saved-views` (no BFF route at all).

## 26–27. Prospector & manager UX

**Prospector journey — PASS end to end.** My Day → prospect → collision decision shown _before_ action → reservation → action → log → follow-up. The collision decision appears on both Today and the prospect record ahead of any action, satisfying the dossier's UX goal that "the prospector should never have to wonder 'am I allowed to contact this prospect?'". Responsive verified at 375/768/1024/1440.

**Manager journey — PARTIAL.** Import, assign (bulk), monitor, arbitrate override, reassign, report all work against production APIs. Missing: assignment-rule configuration UI, saved views, territory filter. Manager screens at mobile widths are **UNVERIFIED**.

## 28–31. Database integrity, idempotency, jobs, storage

**Integrity:** tenant FKs throughout; composite `(tenant_id, id)` uniques enabling tenant-safe FKs; partial unique indexes (one primary contact per establishment, one primary address); CHECK constraints (contact identity non-empty, lowercase email, coordinate ranges, `country_code ~ '^[A-Z]{2}$'`); PostGIS geography. Database-level triggers enforce consent, action immutability, assignment state and campaign open-work rules — invariants protected below the application, as they should be.

**Idempotency — PASS:** 113 `@Idempotent` decorators; all four critical operations covered (`reservation.claim`, `reservation.release`, `action.create`, `override.approve`/`reject`), plus `heartbeat`, `extend`, `assignment.bulk`.

**Jobs — PARTIAL:** 7 processors (follow-up reminder, reservation expiry, compliance artifact, scheduled report, webhook delivery, health check, retry probe) with retry and permanent-error classes. **No tenant context** — §10.

**Storage — PARTIAL:** `object-storage.service.ts` uses S3 presigned URLs with expiry (900 s upload, 300 s download). The object **key is caller-supplied**, so tenant-path isolation depends entirely on callers. Not verified per call site — **UNVERIFIED**.

## 32. Security findings

**P0 — RLS inert.** §10.
**P1 — Export role authorization unverified.** §23.
**P1 — Worker has no tenant context.** §10.
**P2 — Storage key construction unverified.** §31.
**P2 — Dashboard dimensional authorization unverified** (TR-023-D). §12.
**Good:** rate limiter fails closed; secrets absent from the repo; global `ValidationPipe({whitelist, forbidNonWhitelisted, transform})` blocks mass assignment; Drizzle parameterizes; BFF keeps tokens out of browser JS.

## 33–36. Config, local dev, CI, observability

**Config:** `.env.example` now marks boot-required variables correctly (corrected this session). `COMPLIANCE_DOWNLOAD_SECRET` is documented but absent from `.env`.

**Local dev — PARTIAL:** Docker Compose provides PostgreSQL + Redis. **It provides no Mailpit**, yet `MAILPIT_URL` is required for account email; the only Mailpit in this environment belongs to an unrelated validation stack. A new developer following the repository alone cannot receive an invitation or password-reset email.

**CI — PARTIAL:** `.github/workflows/ci.yml` runs migrations-check → lint → format → typecheck → unit → **integration** → build. Good gating. But `format:check` fails on three committed files, so CI is red. No deployment workflow, no security scanning, no dedicated concurrency gate.

**Observability — PARTIAL:** `requestId` in the error filter and error types; `/health`, `/health/live`, `/health/ready`. No metrics, no error tracking, no structured tenant/user log context established as a cross-cutting concern.

## 37. Backup / restore — **MISSING**

No backup script, no restore runbook, no retention policy, no rehearsal evidence in `infrastructure/`, `scripts/` or CI. `infrastructure/{docker,nginx,terraform}` are **empty directories**. The dossier makes tested restore an explicit pre-national gate. Per the brief, configured-but-undemonstrated would be UNVERIFIED; nothing is configured, so this is **MISSING**.

## 38. MVP Definition of Done

| DoD                         | Status                                           | Evidence                                                                                        | Missing                                     |
| --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 01 Concurrent reservations  | **PASS**                                         | Atomic Lua CAS; `reservation.integration.spec.ts:674,1223` pass 25/25                           | Redis-down behaviour untested               |
| 02 Immutable actions        | **PASS**                                         | No delete route; finalized rejects; corrections append; DB trigger                              | —                                           |
| 03 Batch management         | **PASS** (backend) / **PARTIAL** (UI)            | `/assignments/bulk`, preview, reassign, revoke — all wired                                      | No rule-configuration UI                    |
| 04 Scoped prospector access | **PARTIAL**                                      | Application predicates consistent                                                               | RLS inert — single layer                    |
| 05 Audited override         | **PASS**                                         | `reason!: string` required; `manager-override.service.ts:307`                                   | —                                           |
| 06 Import validation        | **PARTIAL**                                      | Preview + anomaly queue work                                                                    | 1 of 6 dedupe keys; no SIRET; no similarity |
| 07 Follow-up alerts         | **PARTIAL**                                      | Follow-ups + scheduler + processor exist                                                        | No channel matrix; CR-033 unenforced        |
| 08 Dashboard filtering      | **PARTIAL**                                      | period, org, team, user, campaign                                                               | **territory missing**                       |
| 09 Responsive workflows     | **PASS** (prospector) / **UNVERIFIED** (manager) | Verified 375–1440                                                                               | Manager screens on mobile                   |
| 10 Controlled exports       | **PASS**                                         | Role + per-object authorization, both controllers, 23 tests green; audit mandatory and blocking | —                                           |
| 11 Restore demonstrated     | **FAIL**                                         | Nothing exists                                                                                  | Everything                                  |
| 12 Concurrency tests        | **PASS**                                         | Written, correct, and green in isolation                                                        | Green in full-suite run                     |

**5 PASS · 5 PARTIAL · 1 FAIL · 1 split.**

## 39. Pilot readiness

Instrumentation for the dossier's pilot metrics: `action.logged`, reservation claimed/rejected with reason codes, follow-up created/due/completed, override requested/decided, import anomalies — all persisted and queryable. Dashboard-usage tracking is **MISSING**, so "dashboard checked every working day" cannot be measured. Adoption ("80% of actions logged") is measurable. "0 confirmed unauthorized collisions" is measurable through collision events.

## 40–42. Scope, dead code, test gaps

**EXTRA_SCOPE (correctly deferred elsewhere, but built):** assignment strategies `capacity|round_robin|skill|proximity` (V1.1), `scheduled-reports` + `webhooks` modules (V1.1), `auth/sso` + `SSO_ENCRYPTION_KEY` (V2 enterprise SSO). None is wired to a UI; cost is maintenance, not risk.

**Dead code (SAFE TO REMOVE, after confirmation):**

- `apps/web/src/lib/fixtures/manager-preview.ts` — **529 lines of brand-named mock data imported by nothing**; only a comment in `preview-notice.tsx` references it.
- `components/ui/preview-notice.tsx` — the banner that fixture served; no page uses it.
- `packages/{ui,types,validation}` — package.json only.
- `infrastructure/{docker/*,nginx,terraform}` — empty but for the file added this session.

**Test gaps (no meaningful behavioural test):** import deduplication against the dossier's key set; notification channel matrix; worker tenant isolation; Redis-unavailable reservation path; two-node claim.

## 43. Production blockers

**P0**

1. RLS inert — tenant isolation has no second layer (§10).
2. Worker runs with no tenant context; `0070` RLS covers its tables (§10). Promoted from P1: it is not merely a gap of its own, it is the thing that makes fixing (1) unsafe — switching to the restricted runtime role turns every worker query into zero rows.

_Withdrawn:_ export role authorization, previously P0, is proven correct (§23).

**P1** 3. Import deduplication 1 of 6 keys, no similarity, no SIRET (§21). 4. No backup or restore path (§37). 5. CI red on `format:check` — the gate cannot be trusted (§5). 6. Notification channel matrix and CR-033 unenforced (§20).

**P2** 7. Territory filter missing from dashboard (§20). 8. `consents` concurrent-opposition race open (§17). 9. Reservation lock has no PostgreSQL backstop (§8). 10. No Mailpit in Compose — local account email unusable (§34). 11. `establishments/:id/contacts` over-guarded (§12).

**P3** — empty packages, dead fixtures, 10 `any` warnings, 5 stale unit tests.

**P4 (V1.1/V2, correctly absent)** — advanced mapping, capacity assignment, calendar, templates, attachments, scheduled report delivery, webhooks as a guarantee, offline PWA, telephony, route optimization, AI, enrichment, billing, white label, SSO sign-in, marketplace.

## 44–45. Remediation backlog & dependency order

```
TR-902 worker tenant context  ──► TR-901 runtime DB role + FORCE RLS
                                        └─► tenant isolation closed
TR-903 export authorization proof  ──► CLOSED, proven, no code change (§23)

TR-904 CI green (format + 5 stale unit tests)   [independent, can run in parallel]
                 ↓
TR-905 import dedupe: phone, email/domain, SIRET, similarity
TR-906 backup + rehearsed restore
                 ↓
TR-907 notification channel matrix + undisableable criticals
TR-908 territory reporting dimension
                 ↓
TR-909 consents concurrency root cause
TR-910 Mailpit in Compose
```

## 46. Recommended next ticket

**TR-902 — Give the worker tenant context.**

_Superseded recommendation:_ this section previously named TR-903 on the reasoning that it was the only P0 of unknown severity. TR-903 has since been executed and the answer is that there was no gap (§23), so the recommendation moves on.

TR-902, not TR-901, even though RLS is the deeper problem — because TR-901 cannot ship without it. The moment the API and worker connect as the restricted runtime role, `0070_worker_rls_policies.sql` starts applying to `notifications`, `prospect_follow_ups`, `audit_events`, `webhooks`, `scheduled_reports` and `evidence_exports`, and the worker — which sets no database context anywhere in `apps/worker/src` — silently processes zero rows. Silently is the operative word: follow-up reminders would stop being delivered without an error to notice. TR-902 is also self-contained (the `tenantId` is already on every job payload and already validated) and testable before the role switch, which makes it the safe first move of the pair.

TR-904 (CI green) is small, independent of both, and worth doing alongside, since an untrustworthy gate is what let the §23 false positive stand unchallenged in the first place.

---

## Final counts

- **Requirements evaluated: 46** — PASS 29 · PARTIAL 12 · FAIL 1 · MISSING 2 · UNVERIFIED 2 · BLOCKED 0
- **MVP DoD:** 5 passed · 1 failed · 5 partial · 1 split
- **Blockers:** P0 2 · P1 4 · P2 5 · P3 4 · V1.1/V2 deferred 16 — 1 P0 withdrawn (§23), 1 promoted from P1
- **APIs:** 325 route decorators; 8/8 dossier-priority endpoints implemented; 3 families backend-ready but unwired
- **Frontend:** 35 pages — 6 fully verified, 28 wired but unverified, 0 mocked, 1 static by design
- **Tests:** 1,807 passing / 12 failing (web 494/0, api unit 741/5, api integration 572/7)
- **Tenant isolation tests:** 1 (`tenant-rls`) · **Authorization tests:** `authorization`, `membership-permissions`, `user-management`, `invitations-security` · **Concurrency tests:** `reservation` (25), `manager-override-concurrency`, `idempotency-*`
- **Remediation tickets: 10**

## Final answers

1. **Conforms to the dossier?** Substantially yes on the differentiating core; partially on data quality, notifications and operations.
2. **Fully implemented:** anti-collision layers 2–7, reservations, action immutability, overrides with reason and audit, campaigns, assignments including bulk, the prospector journey, multi-brand coordination, idempotency.
3. **Looks complete but is not production-ready:** tenant isolation (policies inert), the worker (no tenant context), imports (one dedupe key), notifications (no channel fan-out).
4. **Tenant boundaries technically enforced?** In the application layer, consistently. In the database, **no** — policies exist and do not execute.
5. **Can one tenant reach another's data?** Not through any application path I read. Through a query that omits its predicate, **yes** — nothing would stop it.
6. **Anti-collision concurrency-safe?** Yes, for the reservation claim. Redis-loss behaviour untested.
7. **Can two incompatible users obtain the same reservation?** **No** — proven by `Promise.all` tests asserting exactly one winner, across campaigns and establishments.
8. **Immutable history enforced?** **Yes** — application, route surface and database trigger.
9. **Authorization server-side?** Yes — 11 guard types plus SQL scope predicates; frontend hiding is never the control.
10. **Critical operations idempotent?** Yes — all four, plus 109 more.
11. **Imports safe for pilot data?** **No.** One matching key will let duplicates into the active portfolio, which Principle 1 exists to prevent.
12. **Frontend on production APIs or mocks?** **Production APIs.** The only fixture file is dead code.
13. **Production-ready APIs today?** Reads (account, prospects, work queue, timeline, search, map, dashboards, campaigns, notifications) and the reservation/collision path. Writes are functional but inherit the RLS gap.
14. **Missing dossier requirements:** full deduplication key set, notification channel matrix, territory reporting dimension, backup/restore.
15. **Outside MVP:** four assignment strategies, scheduled reports, webhooks, SSO scaffolding.
16. **Prevents pilot:** no tested restore; import dedupe; CI not trustworthy.
17. **Prevents production:** RLS inert; worker without tenant context.
18. **Single most important next ticket:** **TR-902** — give the worker tenant context, because TR-901 cannot ship without it. (Previously TR-903; executed, no gap found — §23.)
19. **Remediation tickets remaining:** **10**.
20. **MVP status: NOT READY** — conditionally close. The differentiating core is genuinely built and tested; what remains is a bounded set of isolation, data-quality and operational gaps, not missing product.
