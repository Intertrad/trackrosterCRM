# TrackRoster project workflow QA report

**Run date:** 7 October 2026  
**Commit tested:** `40543bb` (`fix: simplify message actions`)  
**Frontend host:** `trackroster-crm1.vercel.app`  
**API host:** `trackrostercrm.onrender.com`  
**Method:** report-only smoke, build, type, unit, and readiness checks. No application source was changed.

## Executive result

The deployment is reachable and the core build is healthy, but the project cannot be certified as fully working in production from this run. The critical reason is test scope: no authenticated accounts for the seven supported access types were available, so all tenant data, role permissions, writes, and cross-role workflows remain unverified. In addition, the production readiness endpoint reports object storage, maps, and SSO as unconfigured, and the unauthenticated production workspace shell stays on an indefinite loading state instead of consistently redirecting to sign-in.

## Summary table

| Area                                     | Result                             | Evidence from this run                                                                                                                                                                 | Missing or not working                                                                                              | Priority                                                     |
| ---------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Render service health                    | **PASS**                           | `GET /health` returned HTTP 200 and `{"status":"ok"}`                                                                                                                                  | None observed                                                                                                       | —                                                            |
| Render dependency readiness              | **PARTIAL**                        | `GET /health/ready` returned 200; Postgres and Redis are up; email is configured                                                                                                       | Object storage, maps, and SSO are `unconfigured`                                                                    | P0 for storage-dependent workflows; P2 for optional maps/SSO |
| Vercel login page                        | **PASS**                           | HTTP 200; rendered French login form; no browser console errors                                                                                                                        | No credential submission was possible                                                                               | —                                                            |
| Password recovery page                   | **PASS**                           | HTTP 200; rendered reset form                                                                                                                                                          | Actual email delivery was not exercised                                                                             | P1                                                           |
| Invitation and MFA entry routes          | **UNVERIFIED**                     | Routes return HTTP 200 in the route smoke check                                                                                                                                        | Requires a real invitation/account and MFA challenge                                                                | P1                                                           |
| Root unauthenticated route               | **FAIL**                           | After more than 20 seconds the page still displayed `Loading your workspace…`; console showed 401 responses from auth access-grant calls                                               | Missing terminal unauthenticated state or redirect                                                                  | P1                                                           |
| Protected route behavior                 | **PARTIAL**                        | `/admin/organizations` redirected to `/login`; `/messages`, `/manager/overview`, and `/profile` remained on the loading shell                                                          | Inconsistent 401 handling across route families                                                                     | P1                                                           |
| API authentication boundary              | **PASS**                           | `/api/auth/me` returned HTTP 401 without a session                                                                                                                                     | Role behavior after authentication still unverified                                                                 | —                                                            |
| Web production build                     | **PASS**                           | Next.js production build completed; 83 static pages and all listed dynamic routes generated                                                                                            | None in build                                                                                                       | —                                                            |
| API production build                     | **PASS**                           | Nest build completed with exit code 0                                                                                                                                                  | None in build                                                                                                       | —                                                            |
| Web typecheck                            | **PASS**                           | `tsc --noEmit -p apps/web/tsconfig.json` completed with exit code 0                                                                                                                    | None in typecheck                                                                                                   | —                                                            |
| API typecheck                            | **PASS**                           | `tsc --noEmit -p apps/api/tsconfig.json` completed with exit code 0                                                                                                                    | None in typecheck                                                                                                   | —                                                            |
| ESLint                                   | **PASS**                           | Repository ESLint completed with exit code 0                                                                                                                                           | None in lint                                                                                                        | —                                                            |
| Migration chain                          | **PASS**                           | 89 migration files and journal/snapshots form a contiguous chain                                                                                                                       | None in static integrity check                                                                                      | —                                                            |
| Web unit/component suite                 | **PASS**                           | 93 files, 749 tests passed from `apps/web`                                                                                                                                             | Canvas warnings and one jsdom navigation warning are test-environment noise                                         | —                                                            |
| API unit suite                           | **PASS**                           | 97 files, 777 tests passed when integration specs were excluded                                                                                                                        | Expected mocked error logs appeared in idempotency/reservation tests                                                | —                                                            |
| Full integration suite                   | **BLOCKED**                        | Attempted full Vitest run; local integration setup could not connect to `127.0.0.1:6379` (`EPERM`), causing integration files to skip/fail initialization and worker processes to exit | Dedicated Postgres/Redis test services and a stable integration environment are required                            | P0                                                           |
| Role matrix                              | **BLOCKED**                        | No production test accounts were supplied                                                                                                                                              | Cannot verify `client_admin`, `director`, `manager`, `prospector`, `observer`, `super_admin`, or `support_operator` | P0                                                           |
| Company edit/save/concurrency            | **UNVERIFIED**                     | No authenticated browser session was available                                                                                                                                         | Cannot reproduce or certify the reported `RESOURCE_VERSION_CONFLICT` behavior                                       | P0                                                           |
| Prospect edit/save/concurrency           | **UNVERIFIED**                     | No authenticated browser session was available                                                                                                                                         | Same missing authenticated coverage                                                                                 | P0                                                           |
| Rules and settings save flow             | **UNVERIFIED**                     | Route exists in the built route inventory                                                                                                                                              | Requires client-admin credentials and persistent data verification                                                  | P0                                                           |
| Messaging send/read/mute/participants    | **UNVERIFIED**                     | Routes are present and unit code is covered                                                                                                                                            | Requires two authenticated users; delivery, participant identity, and persistence are not verified                  | P0                                                           |
| Messaging reactions/attachments          | **BLOCKED**                        | Readiness says object storage is unconfigured                                                                                                                                          | Attachments/downloads cannot be production-certified; reactions need two-user persistence testing                   | P1                                                           |
| Reservations/collision/override          | **FRONTEND-READY / NOT CERTIFIED** | Focused unit and concurrency tests exist in the repository                                                                                                                             | Real production Redis/Postgres race and cross-role authorization still need a dedicated run                         | P0                                                           |
| Assignments/reassignment/bulk assignment | **FRONTEND-READY / NOT CERTIFIED** | Route families and focused tests exist                                                                                                                                                 | Bulk failure recovery and manager-scope matrix are pending                                                          | P0                                                           |
| Imports/exports                          | **PARTIAL**                        | API route families and focused tests exist                                                                                                                                             | Large-file, malformed-input, recovery, export authorization, and object-storage tests are pending                   | P0                                                           |
| Follow-ups/notifications                 | **PARTIAL**                        | API and worker processors exist; API unit tests pass                                                                                                                                   | Worker delivery/channel fan-out certification is incomplete                                                         | P0                                                           |
| Scheduled reports/compliance artifacts   | **BLOCKED**                        | Worker processors exist in source                                                                                                                                                      | Requires worker, object storage, and email-provider certification                                                   | P1                                                           |
| Maps/geospatial                          | **BLOCKED**                        | Readiness reports maps `unconfigured`                                                                                                                                                  | Map tiles/geocoding/nearby workflows cannot be production-certified                                                 | P1                                                           |
| OAuth/SSO integrations                   | **BLOCKED**                        | Readiness reports SSO `unconfigured`                                                                                                                                                   | Provider credentials and callback/refresh tests are missing                                                         | P2                                                           |
| Backup/restore                           | **MISSING**                        | Existing audit documents explicitly mark backup/restore as missing                                                                                                                     | No verified backup script, restore rehearsal, retention policy, or CI evidence                                      | P0                                                           |

## Role and workflow coverage

The repository inventory contains **215 frontend screens**, **340 API route entries**, **68 API modules**, **89 SQL migrations**, and **10 worker processors**. The table below shows what was actually certified by this run.

| Role             | Login/session | Reads/navigation |     Writes | Scope/security | Production status                           |
| ---------------- | ------------: | ---------------: | ---------: | -------------: | ------------------------------------------- |
| Client admin     |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: account required**               |
| Director         |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: account required**               |
| Manager          |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: account required**               |
| Prospector       |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: account required**               |
| Observer         |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: account required**               |
| Super admin      |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: platform account required**      |
| Support operator |    Not tested |       Not tested | Not tested |     Not tested | **Blocked: support grant/account required** |

## Confirmed missing or incomplete items

These items are not inferred from a failed click; they are supported by the current readiness/audit documentation and the live readiness response:

1. Production object storage is not configured. Attachment upload, signed downloads, export files, and compliance artifacts are therefore not production-certified.
2. Maps and SSO are not configured in the deployed environment.
3. The full restricted-role integration matrix has not been run to a green result. The local full run is blocked by unavailable Redis access (`EPERM 127.0.0.1:6379`).
4. Worker-backed delivery remains uncertified for follow-up reminders, scheduled reports, compliance artifacts, and provider-backed notifications.
5. Imports/exports still need large-file, malformed-input, recovery, authorization, and storage tests.
6. Backup/restore is explicitly missing: there is no verified restore rehearsal, retention policy, or CI evidence.
7. The production unauthenticated shell has inconsistent behavior: some protected routes redirect to login while others remain on `Loading your workspace…` after the auth access-grant request returns 401.
8. The reported company/prospect optimistic-concurrency conflict cannot be certified or ruled out in this run because it requires two authenticated sessions editing the same record.

## What passed and should be retained

- Render `/health` and `/health/ready` are responding.
- Postgres and Redis are reported up by the live readiness endpoint.
- Next.js and Nest production builds pass.
- Web and API TypeScript checks pass.
- ESLint passes.
- Migration integrity passes for all 89 migrations.
- Web unit/component tests pass: 749/749.
- API unit tests pass when integration specs are excluded: 777/777.
- Login and password-recovery screens render successfully in production.

## Required next test run

To turn the blocked rows into a complete workflow certification, use a staging or production-safe test tenant with one account for each role, two managers, two prospectors, and two browser sessions. Then run the supplied coverage flow in this order:

1. Sign in and verify `/api/auth/me`, active membership, permissions, session expiry, MFA, logout, and workspace switching for every role.
2. Run read-scope checks for overview, companies, prospects, contacts, maps, campaigns, assignments, messages, notifications, audit, reports, and settings.
3. Run write checks for company/prospect edits, rules/settings save, reservations, collision decisions, overrides, actions, follow-ups, assignments, imports, exports, and messages.
4. Repeat company and prospect edits in two sessions and confirm that a successful save updates the list/detail view without a stale-version prompt; deliberately create a real conflict once to verify the recovery UX.
5. Verify attachment upload/download, report generation, email delivery, worker retries, map/geocoding, and SSO only after their providers are configured.
6. Record the HTTP response, visible result, audit event, and persisted value for each row, then rerun the failed rows after deployment.

## Test commands and results

| Check                    | Command                                                                                   | Result                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| API typecheck            | `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json`                              | PASS                                                                          |
| Web typecheck            | `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`                              | PASS                                                                          |
| API build                | `./node_modules/.bin/nest build`                                                          | PASS                                                                          |
| Web build                | `./node_modules/.bin/next build --webpack`                                                | PASS                                                                          |
| Lint                     | `./node_modules/.bin/eslint .`                                                            | PASS                                                                          |
| Migration integrity      | `node scripts/check-migration-integrity.mjs`                                              | PASS — 89-entry chain                                                         |
| Web tests                | `cd apps/web && ./node_modules/.bin/vitest run`                                           | PASS — 93 files / 749 tests                                                   |
| API unit tests           | `cd apps/api && ./node_modules/.bin/vitest run --exclude 'test/**/*.integration.spec.ts'` | PASS — 97 files / 777 tests                                                   |
| Full integration attempt | Full Vitest run                                                                           | BLOCKED — local Redis connection denied; worker processes exited              |
| Formatter                | `./node_modules/.bin/prettier . --check`                                                  | FAIL on generated `docs/qa` markdown only; application source was not changed |

## Release decision

**Do not claim 100% production workflow coverage yet.** The deploy and static/test foundations are healthy, but the role matrix, authenticated CRUD workflows, concurrency behavior, provider-backed paths, storage, worker delivery, and backup/restore still need evidence. The first release gate is to provision the role test accounts and a dedicated integration environment, then rerun the blocked P0 rows above.
