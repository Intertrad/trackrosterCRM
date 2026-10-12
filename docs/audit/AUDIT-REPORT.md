# TrackRoster audit report

Audit date: 2026-10-12  
Scope: read-only review against docs/audit/CODEX-AUDIT-PROMPT.md. No product code, migrations, CI or git history were modified. No secrets are included.

## Executive summary

1. **ENG-003 (S1):** collision evaluation and reservation acquisition are separate from the database transaction required by the dossier.
2. **ENG-001 (S2):** the collision decision order is split across services.
3. **ENG-002 (S2):** manager override validation does not visibly perform the central consent rejection.
4. **ENG-004 (S2):** lock release is deferred through an asynchronous effect after action completion.
5. **API-001 (S2):** the global tenant interceptor holds a PostgreSQL client for the full HTTP handler.
6. **REQ-001 (S2):** backup restore is not rehearsed.
7. **PRF-001 (S2):** leading-wildcard search is unmeasured and no trigram index was found.
8. **DEV-001 (S2):** direct repository verification is green; the aggregate Turbo test runner still stalls in this environment.
9. **WEB-001 (S2):** frontend API contracts are shared through the types package; downstream contract adoption remains incremental.
10. **UID-001 (S3):** no automated responsive or WCAG gate is defined.

The repository also has strong controls: bounded API/worker pools, forced RLS, global DTO validation, immutable action/audit migrations, scoped exports, and real PostgreSQL concurrency tests.

## Remediation status

The original findings are retained below as the 2026-10-12 baseline. Item 5 is now
closed by existing version-matched backup tooling and the documented disposable
restore rehearsal recorded in `docs/operations/BACKUP_RESTORE.md` (2026-10-02).
The rehearsal restored the custom-format archive into a fresh PostgreSQL database,
reapplied runtime grants, and verified the restored schema. Production scheduling,
off-account encrypted retention, and an approved restore target remain operational
follow-ups because they require deployment credentials and an operator decision.

The direct root verification baseline was rerun on 2026-10-12. ESLint, Prettier,
API/web/worker TypeScript checks, and migration integrity all passed. The aggregate
`turbo run test` command was bounded and stopped after approximately 95 seconds
without producing package results; Redis/PostgreSQL-backed integration tests cannot
be classified as passing when those services are unavailable in the local
environment. This is recorded as a verification limitation rather than a green
full-suite claim.

The shared action contract is now published from `packages/types` and consumed by
the web app. Web TypeScript, focused action contract tests, lint, and formatting
passed; remaining API adoption is tracked with the lifecycle/domain-event work.

## Severity count

| Severity | Count |
| -------- | ----: |
| S1       |     1 |
| S2       |    11 |
| S3       |     5 |
| S4       |     0 |
| Total    |    17 |

## Findings

### Repository & DevEx

### [DEV-001] Restore a green root verification baseline

- **Severity:** S2
- **Role:** Repository & DevEx Auditor; Test & Quality Engineer
- **Requirement:** Phase 0 build/typecheck/lint/test gate
- **Location:** package.json:6-20
- **Evidence:**
  ```text
  pnpm -r exec tsc --noEmit — started, no output, interrupted after ~60s
  pnpm lint — started, no output, interrupted after ~60s
  pnpm test -- --passWithNoTests — started, no output, interrupted after ~60s
  pnpm --filter web build — started, no output, interrupted after ~60s
  ```
- **Updated verification (2026-10-12):** direct ESLint, Prettier, API/web/worker TypeScript checks, and migration-integrity checks passed. The bounded aggregate `turbo run test` run produced no package result within approximately 95 seconds and was stopped; service-backed integration tests remain unverified without Redis/PostgreSQL.
- **Why it matters:** Release status cannot be established from the required root commands.
- **Fix:** Add bounded per-package timeouts and CI artifacts; identify the first blocking package and fail fast with its output.
- **Effort:** M
- **Confidence:** verified

### [DEV-002] Make workspace and naming conventions machine-enforced

- **Severity:** S3
- **Role:** Repository & DevEx Auditor
- **Requirement:** Workspace scripts and documented file/branch conventions are enforced
- **Location:** package.json:17-20; packages/types/package.json:1-12
- **Evidence:**
  ```json
  "typecheck": "turbo run typecheck",
  "test": "turbo run test",
  "build": "turbo run build"
  // packages/types/package.json has no scripts
  ```
- **Why it matters:** Turbo can omit packages with no task script, and the brief's check-file/branch-name controls are absent from inspected configuration.
- **Fix:** Add scripts to intended packages and wire file/branch validators into CI, or document the convention as retired.
- **Effort:** S
- **Confidence:** verified

### [DEV-003] Route operational environment reads through validated configuration

- **Severity:** S3
- **Role:** Repository & DevEx Auditor
- **Requirement:** Environment variables validated at boot
- **Location:** apps/api/src/config/environment.validation.ts:74-108; apps/api/src/communications/communications.module.ts:59-113
- **Evidence:**
  ```ts
  export function validateEnvironment(config: Record<string, unknown>) {
    requireString(config, 'DATABASE_URL');
    validateRedisUrl(config);
    validateJwtSecret(config, 'JWT_ACCESS_SECRET');
    // runtime modules consume operational settings through ConfigService
  }
  ```
- **Remediation (2026-10-12):** runtime API modules now read operational flags, object-storage fallback URLs, compliance signing secrets, and the listening port through `ConfigService`; boot validation covers bounded transaction settings, port range, and optional storage URLs. Test/seed-only `process.env` reads remain intentionally local to those harnesses.
- **Why it matters:** A missing storage, scheduler or effect setting can fail only when used, with localhost defaults in deployment.
- **Fix:** Add these variables to central validated config and inject ConfigService into affected modules.
- **Effort:** M
- **Confidence:** verified

### Product Requirements

### [REQ-001] Exercise a real backup restore before claiming DoD 11

- **Severity:** S2
- **Role:** Product Requirements Auditor; Test & Quality Engineer; Data & Persistence Reviewer
- **Requirement:** MVP DoD 11 — backup and restore are tested
- **Location:** scripts/verify-postgres-backup.mjs:4-12
- **Evidence:**
  ```js
  const client = await resolvePostgresClient('pg_restore', [backup]);
  const output = await capturePostgresClient(client, ['--list', backup]);
  // reports readable: true after pg_restore --list
  ```
- **Why it matters:** A readable archive can still fail during restore because of roles, RLS, extensions or ordering.
- **Fix:** Add a disposable restore rehearsal, schema smoke queries, runtime-role checks and CI execution.
- **Effort:** M
- **Confidence:** verified

### [REQ-002] Publish the missing lifecycle and domain-event contract

- **Severity:** S3
- **Role:** Product Requirements Auditor
- **Requirement:** Lifecycle states and the eight named domain events
- **Location:** apps/api/src/database/schema/campaign-prospects.ts:7-32
- **Evidence:**
  ```text
  rg prospect.assigned|reservation.claimed|reservation.rejected|action.logged|
     followup.due|override.requested|override.decided|import.completed apps packages database
  apps/api/src/collisions/collision-workflow.service.ts:399:
    ... 'override.requested' ...
  ```
- **Remediation (2026-10-12):** the eight required event names are now a shared `DomainEventType` union in `packages/types`, with an API adapter and contract tests that reject unrelated audit actions. Existing audit rows remain backward compatible; emitting each event from its owning workflow is the next adoption step.
- **Why it matters:** Only a subset of the requested vocabulary was found, and membership status is separate from lifecycle stage.
- **Fix status:** Typed event union, API adapter, and contract tests are in place; workflow emission and consumer mapping remain the next adoption step.
- **Effort:** M
- **Confidence:** verified

### [REQ-003] Keep the lifecycle stage write path explicit

- **Severity:** S3
- **Role:** Product Requirements Auditor
- **Requirement:** No lifecycle status can be changed by a generic prospect PATCH
- **Location:** apps/api/src/database/schema/campaign-prospects.ts:7-10; apps/api/src/database/schema/lifecycle-stages.ts:25-32
- **Evidence:**
  ```text
  campaignProspectStatusEnum = ['active', 'excluded']
  lifecycle stage enum = to_contact, contact_made, in_progress,
    follow_up, qualified, converted
  campaign-prospect PATCH updates membership status; action completion owns stage changes.
  ```
- **Remediation (2026-10-12):** the campaign-prospect PATCH DTO declares only membership `status`; global whitelist/forbid-non-whitelisted validation rejects `lifecycleStage`, and the service repository update writes only `status`/`updatedAt`. A focused DTO negative test now protects this boundary.
- **Why it matters:** Inclusion status and lifecycle stage are easy to confuse in clients and reporting.
- **Fix status:** Membership PATCH is explicit and lifecycle transitions remain owned by action/assignment commands; the negative direct-stage test is in place.
- **Effort:** S
- **Confidence:** verified

### Anti-collision Engine

### [ENG-003] Couple collision approval and reservation creation under an authoritative transaction or lock

- **Severity:** S1
- **Role:** Anti-collision Engine Auditor
- **Requirement:** Check and reservation are server-side and in the same transaction
- **Location:** apps/api/src/collisions/collision-decision.service.ts:146-157; apps/api/src/reservations/reservation.service.ts:391-423
- **Evidence:**
  ```ts
  return this.collisionBusinessDecisionService.evaluate({ ... });
  // later, reservation acquisition is a separate Redis/Lua operation
  const acquired = await this.reservationRepository.acquireWithinOrganizationScope(
    reservation, blockingOrganizationIds, ttlSeconds,
  );
  ```
- **Why it matters:** The database transaction boundary does not contain both the decision read and durable reservation creation.
- **Fix:** Make one reservation command own eligibility, decision, durable row and lease acquisition with explicit compensation/outbox semantics.
- **Effort:** L
- **Confidence:** verified

### [ENG-001] Put the collision decision tree in one canonical readable sequence

- **Severity:** S2
- **Role:** Anti-collision Engine Auditor
- **Requirement:** Dossier order: opt-out/block → reservation → upcoming action → recent contact → brand rule
- **Location:** apps/api/src/collisions/collision-decision.service.ts:47-157
- **Evidence:**
  ```ts
  // Priority 1A/1B/1C: exact, legacy and organization reservations
  if (exactReservation) return { decision: 'block', reasonCode: 'ACTIVE_RESERVATION' };
  // only after those checks:
  return this.collisionBusinessDecisionService.evaluate({ ... });
  ```
- **Why it matters:** A maintainer must read multiple services to know the order.
- **Fix:** Introduce one pure decision orchestrator that names all seven layers and calls repositories/adapters in dossier order.
- **Effort:** L
- **Confidence:** verified

### [ENG-002] Reject opt-out before manager override records are created

- **Severity:** S2
- **Role:** Anti-collision Engine Auditor; Security, Tenancy & Compliance Auditor
- **Requirement:** Opt-out is unconditional, including approved overrides
- **Location:** apps/api/src/collisions/manager-override.service.ts:122-177
- **Evidence:**
  ```ts
  const { assignment, establishmentId } =
    await this.reservationService.requireReservationEligibility({ ... });
  const collision = await this.collisionDecisionService.evaluate({
    tenantId: input.tenantId,
    campaignProspectId: input.campaignProspectId,
  });
  ```
- **Why it matters:** This path does not visibly invoke the consent-blocking guard used by reservation lifecycle and collision workflow entrypoints before it evaluates and persists an override.
- **Fix:** Call one shared consent predicate before authority lookup/override persistence and add an approved-override opt-out negative test.
- **Effort:** M
- **Confidence:** verified

### [ENG-004] Make completion, follow-up and lock release one durable workflow

- **Severity:** S2
- **Role:** Anti-collision Engine Auditor; Backend Architecture Reviewer
- **Requirement:** Logging an action releases the lock and creates the follow-up atomically, in order
- **Location:** apps/api/src/actions/action.service.ts:650-706
- **Evidence:**
  ```ts
  if (complete.reservationDisposition === 'release' && row.reservationId)
    await this.releaseEffect(row, campaign!.organizationId, tx);
  // releaseEffect inserts an actionEffects row; external release is deferred
  await tx.insert(actionEffects).values({ type: 'release_reservation', ... });
  ```
- **Why it matters:** A worker outage can leave a Redis lease held after a completed action.
- **Fix:** Use an idempotent outbox/effect state machine with durable confirmation and reconciliation metrics.
- **Effort:** L
- **Confidence:** verified

### Backend Architecture

### [API-001] Narrow the request transaction to database work

- **Severity:** S2
- **Role:** Backend Architecture Reviewer; PostgreSQL Performance Specialist
- **Requirement:** Avoid connection starvation and long-running transactions
- **Location:** apps/api/src/database/tenant-transaction.interceptor.ts:19-57
- **Evidence:**
  ```ts
  const transaction = this.database.transaction(async (tx) => {
    await setTenantContext(tx, tenantId);
    return await runWithTenantExecutor(tx, () => lastValueFrom(next.handle()));
  });
  ```
- **Why it matters:** Every authenticated request holds a pool client while the handler waits on Redis, queues, mail or remote providers.
- **Remediation (2026-10-12):** request transactions now set bounded `statement_timeout` and `idle_in_transaction_session_timeout` values and emit a warning when a tenant transaction exceeds the configured idle threshold. This limits connection starvation while preserving tenant RLS context; splitting the global interceptor into route-specific database scopes remains a larger follow-up because many handlers currently depend on its request executor.
- **Fix:** Open transactions inside multi-write services and pass an executor only across their SQL statements; add pool wait/active gauges.
- **Effort:** L
- **Confidence:** verified

### Data & Persistence

### [DAT-001] Add rollback/rehearsal evidence for the migration chain

- **Severity:** S2
- **Role:** Data & Persistence Reviewer
- **Requirement:** Migration lifecycle includes safe rollback/restore
- **Location:** database/migrations/ (92 SQL migrations); scripts/verify-postgres-backup.mjs:7-12
- **Evidence:**
  ```text
  find database/migrations -type f -name '*down*' -o -name '*rollback*'
  # no down/rollback files found
  verify-postgres-backup.mjs only calls pg_restore --list
  ```
- **Remediation (2026-10-12):** added `docs/operations/MIGRATION_RECOVERY.md` with a forward-only restore/repair procedure and `scripts/check-migration-recovery.mjs`, which runs migration-chain integrity checks, verifies every SQL migration is non-empty, and checks the required RLS/runtime-role recovery controls.
- **Why it matters:** A failed deployment can leave schema ahead of the application without a documented recovery path.
- **Fix:** Document forward-fix policy plus disposable restore rehearsal and previous-release startup checks.
- **Effort:** M
- **Confidence:** verified

### [DAT-002] Index the search access pattern or bound it by a measured alternative

- **Severity:** S2
- **Role:** Data & Persistence Reviewer; Performance & Scale Reviewer
- **Requirement:** Search and duplicate access patterns remain within scale budget
- **Location:** apps/api/src/search/search.module.ts:38-63; apps/api/src/database/schema/establishments.ts:191-207
- **Evidence:**
  ```ts
  const pattern = `%${q}%`;
  or(ilike(establishments.name, pattern), ilike(establishments.city, pattern));
  // indexes include normalized name/city; no pg_trgm index found
  ```
- **Why it matters:** Leading-wildcard ILIKE normally scans many rows and is used for three result classes plus facets.
- **Fix:** Measure EXPLAIN (ANALYZE, BUFFERS) at pilot and 10× data; add the smallest suitable trigram index or bounded prefix/search column.
- **Effort:** M
- **Confidence:** verified

### Frontend Architecture

### [WEB-001] Share API contracts across the workspace

- **Severity:** S2
- **Role:** Frontend Architecture Reviewer
- **Requirement:** One typed API data layer; frontend contracts must not drift from backend DTOs
- **Location:** packages/types/package.json:1-12; apps/web/src/lib/api/*
- **Evidence:**
  ```json
  { "name": "@trackroster/types", "exports": { ".": "./src/index.ts" }, "private": true }
  // shared action contracts are exported from packages/types and imported by web
  ```
- **Why it matters:** Role scope, error envelopes and lifecycle values can diverge between API and pages.
- **Fix status:** Shared action contracts are now exported from packages/types and consumed by web clients; broaden adoption to lifecycle and error contracts as those APIs are finalized.
- **Effort:** L
- **Confidence:** verified

### UI, Design & Accessibility

### [UID-001] Add automated responsive and accessibility gates

- **Severity:** S3
- **Role:** UI, Design System & Accessibility Reviewer
- **Requirement:** DoD 9 — mobile and desktop; WCAG 2.1 AA evidence
- **Location:** apps/web/package.json:4-16
- **Evidence:**
  ```json
  "scripts": {
    "build": "next build",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run"
  }
  ```
- **Remediation (2026-10-12):** added a web contract test covering app and marketing breakpoints, safe-area padding, keyboard focus-visible selectors, and reduced-motion protections. Full browser-level 390px/1440px rendering and axe scans remain a deployment QA follow-up.
- **Why it matters:** No scripted 390px/1440px overflow, focus, contrast or tap-target check protects role dashboards.
- **Fix:** Add browser smoke coverage at 390px and 1440px plus axe checks as a CI gate.
- **Effort:** M
- **Confidence:** verified

### Test & Quality

### [TST-001] Cover every ALLOWED and opt-out decision row with real integration tests

- **Severity:** S2
- **Role:** Test & Quality Engineer
- **Requirement:** Decision table coverage and negative authorization/opt-out coverage
- **Location:** apps/api/test/reservation.integration.spec.ts:680-702
- **Evidence:**
  ```ts
  const [first, second] = await Promise.all([reserve(prospectorAToken), reserve(prospectorBToken)]);
  expect(statusCodes).toEqual([201, 409]);
  ```
- **Why it matters:** Concurrency tests prove the race boundary, but a complete matrix covering opt-out, upcoming action, cooldown, each brand rule and approved override was not found.
- **Fix:** Add a real-Postgres table-driven suite for each decision row, including approved-override + opt-out rejection and idempotent release/replay.
- **Effort:** M
- **Confidence:** unverified

### Performance & Scale

### [PRF-001] Measure the three critical read paths before the pilot

- **Severity:** S2
- **Role:** Performance & Scale Reviewer
- **Requirement:** Anti-collision under one second; measured dashboard/list/map plans
- **Location:** apps/api/src/search/search.module.ts:46-110; apps/api/src/maps/map.service.ts:17-151
- **Evidence:**
  ```text
  No EXPLAIN (ANALYZE, BUFFERS) output or repeatable latency benchmark was found.
  Root build/test commands timed out before a live benchmark.
  Map code bounds/clusters requests, but row counts and browser payloads are not recorded.
  ```
- **Why it matters:** Correct indexes and bounded map queries cannot be confirmed without plans and measurements at pilot and 10× volume.
- **Fix:** Add a seeded benchmark for search, collision, dashboard and map, capture plans/rows/latency, and set regression thresholds.
- **Effort:** M
- **Confidence:** verified

## Positive controls and verified coverage

- API and worker pools are bounded and have connection/idle timeouts (database provider files).
- Tenant RLS is enabled/forced and the runtime role is not owner/BYPASSRLS (migrations 0071/0073 and runtime-role SQL).
- Global validation uses whitelist, forbidNonWhitelisted and transform (apps/api/src/config/http-application.ts:12-14).
- API errors are normalized and request-correlated without returning stacks (apps/api/src/errors/api-exception.filter.ts:37-84).
- Action history/audit immutability is backed by database grants/triggers (migrations 0039 and 0079).
- Reservation concurrency has a database partial unique index and real concurrent integration assertions (reservation-lifecycle.ts:88-90; reservation.integration.spec.ts:680-702 and 1229-1256).
- Search applies assignment/role visibility in the API (apps/api/src/search/search.module.ts:164-190).
- Controlled exports resolve scope before serialization and audit the export (apps/api/src/exports/controlled-export.service.ts:60-160).
- Historical focused checks passed before this audit: API 240 files/1,766 tests, API typecheck, focused web tests (2 files/47 tests), focused web lint/typecheck/format, and API build. Current root gates remain unverified.

## Requirement-to-risk decision table

| Opt-out | Active reservation | Upcoming action | Recent contact | Brand rule | Override               | Expected verdict              | Test evidence                                     |
| ------- | ------------------ | --------------- | -------------- | ---------- | ---------------------- | ----------------------------- | ------------------------------------------------- |
| yes     | any                | any             | any            | any        | absent                 | BLOCKED                       | No complete matrix row found                      |
| yes     | any                | any             | any            | any        | approved               | BLOCKED                       | No complete matrix row found; ENG-002/TST-001     |
| no      | yes                | any             | any            | any        | absent                 | BLOCKED                       | reservation.integration.spec.ts:680-702           |
| no      | no                 | yes             | any            | any        | absent                 | BLOCKED/TO VALIDATE           | Decision-specific row not found                   |
| no      | no                 | no              | yes            | any        | absent                 | BLOCKED                       | Decision-specific row not found                   |
| no      | no                 | no              | no             | Shared     | absent                 | ALLOWED                       | Decision-specific row not found                   |
| no      | no                 | no              | no             | Coord      | absent                 | TO VALIDATE                   | Decision-specific row not found                   |
| no      | no                 | no              | no             | Deferred   | absent                 | BLOCKED until delay           | Decision-specific row not found                   |
| no      | no                 | no              | no             | Indep      | absent                 | ALLOWED                       | Decision-specific row not found                   |
| no      | no                 | no              | no             | any        | valid bounded override | ALLOWED/TO VALIDATE by policy | manager override tests exist; opt-out row missing |

## Next 10 commits

1. ENG-003 — fix(reservations): make decision and lease acquisition one authoritative command — branch fix/reservation-atomic-command
2. ENG-002, ENG-001 — fix(collision): centralize opt-out and decision ordering — branch fix/collision-decision-order
3. ENG-004 — fix(actions): reconcile release effects idempotently — branch fix/action-release-outbox
4. API-001 — refactor(api): narrow tenant transactions to database work — branch refactor/tenant-transaction-scope
5. TST-001 — test(collision): add decision-table and opt-out integration coverage — branch test/collision-decision-matrix
6. REQ-001, DAT-001 — test(backup): rehearse postgres restore in disposable database — branch test/postgres-restore-rehearsal
7. PRF-001, DAT-002 — perf(search): benchmark and index national repository queries — branch perf/search-query-budget
8. WEB-001 — refactor(types): publish shared api contracts — branch refactor/shared-api-contracts
9. DEV-001, DEV-002 — ci(repo): make workspace verification fail fast and complete — branch ci/root-verification-gate
10. UID-001 — test(web): add responsive and accessibility smoke coverage — branch test/web-responsive-a11y

## Release-readiness verdict

**Not yet.** Existing Redis/database uniqueness controls and real concurrency tests are encouraging, but the required check-and-reserve atomicity is not demonstrated across the database and Redis boundary (ENG-003), opt-out is not centrally proven through approved overrides (ENG-002), and current baseline/restore paths are not verified (DEV-001, REQ-001). Close ENG-001 through ENG-004 and run integration/restore/performance gates before the three-week pilot.
