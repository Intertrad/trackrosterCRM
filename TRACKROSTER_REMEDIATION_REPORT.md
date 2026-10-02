# TrackRoster remediation report

**Run date:** 2026-10-02
**Decision:** **Not ready for production deployment.** TR-910 beta acceptance is green,
and TR-918 reservation integration evidence is now green in an isolated stack, but
provider provisioning, product approval, recovery, pilot and load evidence remain
open.

This report records the remediation work completed in this run. The approved dossier
was subsequently supplied at `/Users/zainsubhani/Downloads/files/TrackRoster_Product_Design_Dossier_EN.pdf`;
the requirements matrix and notification matrix now use that source of truth.

## Evidence that is green

| Gate                         | Evidence                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restricted API integration   | `node scripts/backend-test.mjs integration`: **58 files, 613 tests passed**                                                                               |
| Worker integration           | **4 files, 12 passed, 2 skipped intentionally**; follow-up reminder idempotency and reservation expiry exercised                                          |
| Tenant isolation             | Cross-tenant read/write test passed under `trackroster_app`; catalog guard passed with **no tenant table missing a policy or `FORCE ROW LEVEL SECURITY`** |
| Collision and reservations   | Collision workflow and reservation lifecycle targeted suites passed; transaction completion now awaits the committed result                               |
| Map and territory hard cases | Oversized map fixture **11/11 passed**; concurrent territory hierarchy suite **12/12 passed** with serialization conflicts returned as 409                |
| Web unit/integration tests   | **85 files, 713 tests passed**                                                                                                                            |
| Type safety                  | API and web TypeScript checks passed                                                                                                                      |
| Web quality gate             | Root ESLint passed; root Prettier check passed; Next.js webpack production build generated all routes successfully                                        |
| Backup archive check         | Disposable PostgreSQL 16 database produced a 496,470-byte custom dump; verifier read **988 entries** with a compatible PostgreSQL 18 client               |

## Changes made

- Fixed collision workflow transaction handling so callers receive the committed row,
  rather than a transaction promise or pre-commit state.
- Bounded map queries before expensive grouping and made the oversized fixture disable
  only its known O(n²) duplicate trigger during setup, restoring it in `finally`.
- Mapped PostgreSQL serialization/deadlock errors in territory hierarchy writes to a
  deterministic 409 conflict response.
- Added readiness dependency reporting for PostgreSQL, Redis, object storage, email,
  maps and SSO. PostgreSQL and Redis remain the readiness-critical dependencies;
  optional providers are reported as configured/unconfigured.
- Added `scripts/backup-postgres.mjs` and
  `scripts/verify-postgres-backup.mjs`. The backup refuses the restricted runtime role,
  writes a SHA-256 sidecar, and records the runtime-role migration. The verifier is
  read-only and now passes the archive as the `pg_restore` input (the original
  implementation incorrectly used `--file`, which truncated the archive).
- Added a live catalog assertion to the tenant RLS integration test so a future table
  with `tenant_id` cannot silently ship without a policy and forced RLS.
- Added generated-output ignores for `.next-*` directories to the root Git,
  Prettier and ESLint configuration, then restored green root lint/format gates.
- Replaced the proposed baseline with [REQUIREMENTS_TRACEABILITY_MATRIX.md](docs/REQUIREMENTS_TRACEABILITY_MATRIX.md)
  after the approved Product Design Dossier was supplied; only product-owner visual
  acceptance remains open.

## P0 status

1. **Tenant RLS / restricted runtime — API and desktop role evidence green; release
   certification remains open.** API and worker paths run with `trackroster_app`, and
   cross-tenant reads/writes are denied. The beta six-role API matrix passed the
   authenticated identity, grants and notification checks; role-scoped dashboard,
   assignment and export responses matched the expected 200/403 policy, and an
   observer completion mutation returned 403. The desktop browser matrix passed
   login for manager, director, prospector, observer/auditor, client-admin and
   super-admin. A frontend workspace route guard was added and the forbidden pasted
   URL checks now redirect to each role's home. The responsive matrix at 390, 768 and
   1440 pixels has no horizontal overflow; a second populated tenant fixture returned
   404 for cross-tenant GET and PATCH; and targeted worker/API authorization paths are
   green. The final deployment rehearsal with `TENANT_RLS_MODE=enforce` remains open.
   The environment validator still refuses `TENANT_RLS_MODE=enforce` until every
   access path is certified; do not enable that setting in production based only on
   this run.
2. **Collision, override, reservation, sweep and tenant-RLS API failures — green in
   the disposable suite.** TR-918 reran the reservation lifecycle at **19/19** and
   background discovery at **3/3** against a fresh Postgres/Redis pair.
3. **Web quality gate — green.** Assigned-work test, generated route/type errors,
   root lint/format, TypeScript and production build all pass.
4. **Product requirements/visual acceptance — partially open.** The actual dossier is
   supplied and traceability is complete; product-owner visual acceptance against the
   supplied screens remains open.

## P1 status

### Notifications

The six dossier-approved MVP event producers, tenant-scoped recipient resolution,
deduplicated in-app persistence, email/push outboxes, bounded delivery handling,
critical collision preference enforcement, reservation-expiry notifications,
inactivity-digest processor and scheduler, and import-anomaly notification path are
implemented and covered by focused tests. Provider certification and authenticated
role delivery evidence remain open. Assignment/generic system/messaging events are
intentionally outside TR-907.

### Providers

Readiness now exposes provider state, but this environment has no production keys. The
disposable Compose MinIO image could not be pulled (`minio/minio` returned a registry
access error, and `quay.io/minio/minio` returned 401), so object-storage upload,
download, expiry and failure recovery remain unverified. Brevo, map hosting, SSO,
webhook destinations and tenant-safe key rotation also require environment credentials
and controlled destinations.

### Backup and recovery

PostgreSQL archive creation and non-destructive archive readability passed. A full
restore into a second database, runtime-role/grant replay, migration compatibility,
tenant-RLS verification and object-storage backup/restore are still required before
production. See [BACKUP_RESTORE.md](docs/operations/BACKUP_RESTORE.md).

### Readiness and operations

Dependency-aware `/health/ready` reporting is implemented. Centralized structured
logs, metrics/traces, queue/provider alerting, retention, and a rehearsed incident
runbook are not complete enough for a production claim.

### Authenticated E2E

The beta authenticated browser matrix now certifies manager, director, prospector,
observer/auditor, client-admin and super-admin journeys at 390, 768 and 1440 pixels.
It includes allowed role homes, forbidden pasted URLs, route-guard redirects and no
horizontal overflow. The second-tenant establishment denial and targeted worker/API
authorization suites are green. The final deployment rehearsal remains separate.

### TR-910 evidence update — 2 October 2026

The missing client-side workspace guard is implemented in
`apps/web/src/lib/auth/navigation.ts` and enforced by `AppShell`. New unit coverage
passes **34/34** tests, ESLint passes for the changed files, and web type generation
plus `tsc --noEmit` passes. The beta browser rerun confirmed:

| Role                 | Login home           | Forbidden URL exercised | Result                         |
| -------------------- | -------------------- | ----------------------- | ------------------------------ |
| Manager              | `/manager/overview`  | `/director/overview`    | Redirected to manager home     |
| Director             | `/director/overview` | `/admin/overview`       | Redirected to director home    |
| Prospector           | `/`                  | `/manager/overview`     | Redirected to Today            |
| Observer/auditor     | `/observer/overview` | `/manager/assignments`  | Redirected to observer home    |
| Client administrator | `/admin/overview`    | `/director/overview`    | Allowed by administrator scope |
| Super administrator  | `/admin/overview`    | `/manager/overview`     | Allowed by administrator scope |

This closes TR-910 for beta acceptance. G-02 and G-10 are green for the beta release
evidence; the remaining work is the deployment-environment rehearsal with
`TENANT_RLS_MODE=enforce`.

## P2 status

- Collision, reservation and territory concurrency cases are covered; a systematic
  load/concurrency run for dashboards, search, messaging, notifications and exports is
  still open.
- Dashboard dimension authorization and territory-filter evidence per manager/director
  scope is not yet a signed six-role acceptance result.
- Attachment and export DTOs enforce size/tenant prefixes and signed-link TTLs, but
  large-file, expired-link and provider-outage tests need a live S3-compatible store.
- Root route/type drift and generated-output lint/format handling are improved and
  green. A generated contract diff check still needs to be part of CI.

## P3 status

The repository already has shared frontend API/client types and a screen mapping/API map,
but the mapping is not proof that every component is live-data tested. A per-role,
per-page API coverage ledger and explicit shared validation package boundary remain
maintenance work.

## Required release decisions and external inputs

1. Approve the MVP visual acceptance against the supplied dossier.
2. Supply tenant-safe email and push credentials or a controlled
   staging equivalent.
3. Approve RPO/RTO, backup retention and a scratch restore target.
4. Schedule the final deployment rehearsal with `TENANT_RLS_MODE=enforce` and the load
   test profile.

## TR-916 — durable reservation intent and background reconciliation

TR-916 is complete for beta acceptance. Migration `0086_reservation_intent` adds an
append-only, tenant-scoped intent table with forced RLS and a restricted-runtime
discovery function. `ReservationLedgerService.prepare()` commits the intent before
Redis acquisition; confirmation and close use the request transaction when one is
active, while uncertain post-commit persistence uses an independent transaction.
Reconciliation validates the exact and organization Redis keys, materializes one
durable record and is idempotent across repeated worker passes.

Retained evidence:

- `reservation-lifecycle.integration.spec.ts`: **19/19** tests, including retry,
  confirmation failure, restart-style reconciliation, exactly-once materialization and
  event evidence, tenant-scoped reads, cooldown and expiry behavior.
- `background-sweep-discovery.integration.spec.ts`: **3/3** restricted-runtime tests,
  including RLS denial for context-free intent reads and privileged cross-tenant
  discovery.
- Reservation service unit tests: **44/44**.
- Manager overview test: **9/9**; the pending override query now uses `limit=100`,
  eliminating the server-side HTTP 400 caused by `limit=1000`.

The local web production build was attempted with a 180-second timeout and did not
finish, so this ticket does not change the release decision: production remains
**NO-GO** pending the outstanding dossier gates, deployment-environment rehearsal and
provider/backup evidence.

The TR-917 acceptance result is recorded below.

## TR-917 — manager approval and blocked-reservation browser acceptance

TR-917 is complete for beta acceptance. The check used authenticated beta manager and
prospector sessions against the running web proxy and API.

The API evidence is:

- A fresh competing-team reservation returned **201 Created**.
- The other prospector's collision check returned **200 OK** with
  `decision=block`, `reasonCode=ACTIVE_RESERVATION`, `overrideable=false`, and a
  collision ID.
- The manager list query with the supported `limit=50` returned **200 OK**. Approval
  with `If-Match` and an idempotency key returned **200 OK** and an approved override.
- The previously observed `limit=1000` query still returns **400** by contract; the
  current web consumers use `limit=100` for the overview and `limit=50` for approvals.

The browser evidence is:

- Manager `/manager/approvals` rendered the pending request and detail policy view.
  Entering a decision reason and selecting **Approve override** produced **200 OK**;
  the detail page then showed `approved`, the success audit-log alert, manager decider,
  and the persisted reason.
- Prospector `/work-queue/:campaignId/:prospectId` rendered **Contact blocked** for
  the active reservation held by another team member, showed the current lease expiry,
  disabled **Log action**, and offered **Ask a manager to authorise this contact**.
  It also showed no local reservation, so the conflicting lease was not presented as
  owned by the current user.

The code fix behind this acceptance keeps post-Redis confirmation on an independent
tenant-scoped transaction when no request executor is active, while reusing the active
executor for legacy claims that materialize the row in the same transaction. It also
removes `FOR UPDATE` from immutable intent reads for the restricted runtime role and
scopes later-migration default grants to `trackroster` while retaining append-only
evidence-table privileges.

Production remains **NO-GO**. Beta acceptance is green for G-06, but the deployment
environment still needs `TENANT_RLS_MODE=enforce` rehearsal and the open MVP gates for
visual sign-off, import quality, dashboard dimensions, export artifacts, full restore,
and pilot evidence. A focused shared-beta integration rerun timed out in two long
lifecycle tests because the shared database had an idle transaction holding the
reservation row lock. TR-918 reproduced and fixed the application deadlock in an
isolated stack; the shared timeout is retained as an environment-contention finding
rather than release evidence.

## TR-918 — isolated reservation integration rerun and contract cleanup

TR-918 is complete for beta acceptance. The isolated stack used a fresh PostgreSQL
database, restricted `trackroster_app` role, Redis instance and Mailpit service. The
runtime bootstrap now reapplies `EXECUTE` grants for all five background discovery
functions when the role is created before migrations, without granting them to PUBLIC.

Evidence retained:

- `reservation-lifecycle.integration.spec.ts`: **19/19** passed after fixing the
  legacy-claim self-deadlock. `confirm()` reuses the active tenant executor when the
  claim already materialized the row, and uses an independent transaction for
  background or post-lease paths.
- `background-sweep-discovery.integration.spec.ts`: **3/3** passed, including
  cross-tenant discovery, context-free RLS denial and privileged-function grants.
- Reservation service unit tests: **44/44** passed.
- API TypeScript check (`tsc --noEmit`): passed; Prettier and `git diff --check` passed.
- No executable web consumer sends `limit=1000`. The supported manager consumers use
  `limit=100` and `limit=50`; HTTP 400 for `limit=1000` is the intentional API cap.

The exact next remediation step is the final deployment-environment rehearsal with
`TENANT_RLS_MODE=enforce`, followed by the remaining open MVP gates (visual sign-off,
import quality, dashboard dimensions, export artifacts, full restore and pilot
evidence). Production remains **NO-GO** until those gates have retained evidence.
