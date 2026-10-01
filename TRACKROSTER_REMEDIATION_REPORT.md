# TrackRoster remediation report

**Run date:** 2026-10-01  
**Decision:** **Not ready for production deployment.** The P0 code and test gates are
green, but provider provisioning, product approval, notification delivery, recovery,
authenticated six-role E2E, and load evidence are still open.

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

1. **Tenant RLS / restricted runtime — green for the tested paths; role matrix open.**
   API and worker paths run with `trackroster_app`, and cross-tenant reads/writes are
   denied. The six-role authenticated browser matrix has not been executed. The
   environment validator still refuses `TENANT_RLS_MODE=enforce` until every access
   path is certified; do not enable that setting in production based only on this run.
2. **Collision, override, reservation, sweep and tenant-RLS API failures — green in
   the disposable suite.** The final run passed all API files and worker files listed
   above.
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

No authenticated browser run has yet certified manager, director, prospector, auditor,
client-admin and super-admin journeys together with responsive layouts and ACL denial
cases. The existing web tests are component/page tests and do not replace that matrix.

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
4. Schedule the authenticated six-role browser/ACL matrix and the load test profile.

Until those inputs and tests are complete, the correct release status is **NO-GO** even
though the local P0 code/test gates are green.
