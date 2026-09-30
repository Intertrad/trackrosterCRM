# Backend audit — 2026-09-30

This audit records the backend state that was verified from the TrackRoster working
tree on 2026-09-30. It is the current evidence companion to
[CURRENT_STATUS.md](../CURRENT_STATUS.md); older dated implementation notes remain
historical.

## Verified inventory

| Area                    | Current evidence                                         |
| ----------------------- | -------------------------------------------------------- |
| API controllers         | 63 controller files, 340 direct HTTP decorators          |
| Database schema         | 55 Drizzle tables                                        |
| Migrations              | 85 SQL files and 85 snapshots in one contiguous journal  |
| API unit tests          | 92 files, 757 tests passed                               |
| Worker unit tests       | 14 files, 65 tests passed                                |
| Worker integration      | 3 files passed, 10 tests passed, 4 intentionally skipped |
| Focused API integration | Reservation and manager-override suites: 26/26 passed    |
| API typecheck/build     | Passed                                                   |
| Worker typecheck/build  | Passed                                                   |
| Migration integrity     | Passed: 85 journal entries and snapshots                 |
| Backend lint            | 0 errors, 10 existing `no-explicit-any` warnings         |

## Changes completed in this audit

- Added durable reservation lifecycle evidence and database constraints in migration
  `0084`, while retaining Redis for the live lease path.
- Made the API integration runner serialize files and cap workers at one. The shared
  Supabase session pool otherwise rejects concurrent suites with `EMAXCONNSESSION`.
- Made reservation integration cleanup remove durable PostgreSQL rows as well as
  Redis keys, restoring deterministic first-claim behavior.
- Applied migration `0084` successfully to the configured database.
- Updated the status, schema, production-readiness, testing, and remaining-work
  documentation to point at this snapshot.

## Full integration caveat

An exhaustive API integration run was started with the serialized runner. It no
longer failed from session-pool exhaustion, but the remote Supabase pool caused many
unrelated suites to exceed their existing 10–60 second test timeouts. The run was
stopped after recording those environment-bound failures. This does not replace the
green focused gate above; a complete integration release gate should run against a
dedicated low-latency database (or a local disposable Postgres/Redis stack).

The failures observed in the remote run clustered around membership, campaign,
reservation lifecycle, territory, route, import, collision, and assignment suites.
They are not classified as product defects without reproducing them on the dedicated
integration environment.

## Remaining release gates

- Run the complete API integration suite against a dedicated database and Redis
  instance, with no shared session-pool contention.
- Certify the restricted runtime role with cross-tenant reads and writes, worker
  tenant context, and production RLS policies.
- Exercise provider-backed mail, object storage, geocoding, webhook, backup/restore,
  and observability paths with real staging credentials.
- Run load/concurrency tests and document rollback and recovery evidence.
- Resolve the ten existing lint warnings where their dynamic payloads can be typed
  without weakening API contracts.

## Reproduction commands

```bash
./node_modules/.bin/tsc --noEmit --pretty false       # apps/api
./node_modules/.bin/tsc -p tsconfig.build.json --pretty false # apps/api
./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false # apps/worker
./node_modules/.bin/eslint apps/api/src apps/api/test apps/worker/src
node scripts/check-migration-integrity.mjs
./node_modules/.bin/vitest run --config vitest.config.ts # apps/api
./node_modules/.bin/vitest run                           # apps/worker
./node_modules/.bin/vitest run --config vitest.integration.config.ts test/reservation.integration.spec.ts test/manager-override.integration.spec.ts # apps/api
```
