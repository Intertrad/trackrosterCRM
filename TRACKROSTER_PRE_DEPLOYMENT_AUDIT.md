# TrackRoster pre-deployment product, frontend, backend and release audit

**Audit date:** 2026-10-01  
**Repository:** `/Users/zainsubhani/Intertrad/TrackRoster`  
**Revision inspected:** `5d42026` plus the pre-existing working-tree changes  
**Decision:** **NOT READY FOR DEPLOYMENT**  
**Scope:** audit and evidence collection only. No product behavior was changed and no deployment was attempted during this audit.

## 1. Scope and methodology

The audit covered `apps/web`, `apps/api`, `apps/worker`, `packages/*`, `database/migrations`, Docker/CI configuration, environment templates, and the repository's existing backend/readiness audits. It included source inspection, API/controller inventory, schema and migration checks, unit tests, worker tests, disposable-database integration tests, type checks, and build attempts.

The audit used the repository's own requirements and business rules as secondary evidence because the Product Design Dossier named by the repository is not present in the checkout or the supplied attachment directory. Dossier-dependent conclusions are therefore explicitly marked **BLOCKED** or **UNVERIFIED** rather than inferred as complete.

The working tree already contained extensive uncommitted changes from earlier work. Those changes were preserved. This report is the only artifact added by this audit.

Status vocabulary: **PASS** means the check ran and met its acceptance condition; **PARTIAL** means meaningful implementation exists but a material gap remains; **FAIL** means a check or requirement is demonstrably broken; **UNVERIFIED** means evidence was not available; **BLOCKED** means the environment or missing source of truth prevented the check.

## 2. Executive summary

TrackRoster has a substantial API-first implementation: 82 web page files, 161 web route handlers, 63 API controller files with 340 HTTP decorators, 91 schema tables, and 85 contiguous SQL migrations. API unit tests, worker unit tests, jobs tests, API/worker type checks, and migration-chain validation pass.

The release gate is still red. The web test suite has one failing test, web TypeScript fails on generated route-export errors, the production Next build did not complete, and the full API integration suite failed 20 tests across four files. Restricted runtime/RLS certification, browser/E2E testing, provider-backed storage/email, observability, production backup/restore, and load/concurrency evidence are not complete. The Product Design Dossier is unavailable, so visual and requirements traceability cannot be signed off.

Notifications are connected end to end for the currently implemented follow-up-reminder event, inbox reads, unread counts, read/read-all, and preferences. The backend schema and worker do not yet model the full cross-role event/channel matrix shown in the reference design; collision, approval, reservation, import, and inactivity notification producers were not evidenced.

## 3. Release decision

**NOT READY FOR DEPLOYMENT.** Do not promote, publish, or create a deployment plan from this audit.

The decision is based on these release-blocking conditions:

- Product Design Dossier unavailable; dossier traceability and visual acceptance are blocked.
- `apps/web` has 1 failing test out of 713 and a failing TypeScript check caused by generated route-export errors.
- API integration is not green: 592 passed, 20 failed, 4 files failed out of 612 tests.
- Tenant-RLS and restricted-runtime behavior are not certified in the current integration run.
- No authenticated browser/E2E, responsive, cross-role ACL, or tenant-isolation attack run was completed.
- R2/MinIO object storage and production email provider checks are blocked; the isolated MinIO image could not be pulled.
- Automated production backup and a rehearsed restore path are documented as incomplete in the repository.

## 4. Product Design Dossier traceability

**Status: BLOCKED.** The brief references a Product Design Dossier v1.0, but no dossier PDF was found in the repository or `/Users/zainsubhani/.codex/attachments`. `docs/REQUIREMENTS.md` and `docs/BUSINESS_RULES.md` identify the dossier as their source, so they were used as secondary requirements evidence.

The following requirements were traceable from repository documents, but cannot be called a final dossier sign-off without the missing source:

| Requirement area                                               | Evidence found                                                | Status                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Authentication, six roles, tenant isolation                    | `docs/REQUIREMENTS.md` FR-001–004                             | PARTIAL; integration/ACL certification incomplete             |
| Imports, dedupe, preview                                       | FR-005–006; import modules and tests                          | PARTIAL; provider and full integration gates incomplete       |
| Prospects, campaigns, assignments                              | FR-007–010; API and web clients/pages                         | PARTIAL; browser/live-data verification incomplete            |
| Collision, reservation, override                               | FR-011–016; collision/reservation/override services and tests | FAIL at release gate because full integration is red          |
| Audit, dashboards, search, exports                             | FR-017–020; services/controllers/pages                        | PARTIAL; role matrix and live checks incomplete               |
| Responsive UI, performance, reliability, backup, observability | NFR-001–009                                                   | BLOCKED/UNVERIFIED; no browser/load/provider/restore evidence |

## 5. System architecture

The intended flow is:

`browser → Next.js App Router/BFF → NestJS Fastify API → PostgreSQL/PostGIS` with Redis for short-lived reservations/rate limiting, a separate Nest worker using BullMQ, S3-compatible object storage (R2/MinIO), and Mailpit/Brevo for email.

Inventory from the current tree:

- **Frontend:** Next.js 16.3.4, React 19, 82 `page.tsx` files, 161 App Router API route handlers, MapLibre/PMTiles integration.
- **API:** NestJS 12/Fastify, 63 controller files and 340 HTTP decorators, Drizzle ORM, Argon2/JWT/MFA paths.
- **Persistence:** PostgreSQL 16/PostGIS, 91 schema tables, 85 migration SQL files, migration journal integrity passes.
- **Async:** separate worker application with follow-up reminder, reservation expiry, compliance, scheduled report, webhook, health and retry processors.
- **Shared packages:** jobs is used by the worker/API; `packages/ui`, `packages/types`, and `packages/validation` remain minimal scaffolding rather than a complete shared design system.

The architecture is coherent for a modular monolith, but production certification depends on proving the runtime role, worker tenant context, provider integrations, and failure behavior at the actual deployment boundary.

## 6. Environment and dependency audit

**Status: PARTIAL / BLOCKED.** `.env.example`, `apps/web/.env.example`, Docker Compose, and CI define the major required variables. Local `.env`, `.env.beta`, and `apps/web/.env.local` are untracked and contain values, but this audit did not print or validate secret values.

| Check                                 | Result             | Evidence                                                                                                               |
| ------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Docker default Postgres/Redis/Mailpit | PASS               | Healthy running services observed; no API/worker/web containers running                                                |
| Disposable Postgres/Redis migration   | PASS               | Temporary isolated stack; migrations applied successfully using a no-TLS temp config                                   |
| Disposable MinIO                      | BLOCKED            | `minio/minio:latest` pull denied by registry; storage integration not run                                              |
| Migration chain                       | PASS               | 85 journal entries/files/snapshots contiguous                                                                          |
| PMTiles map check                     | BLOCKED            | direct check reported `NEXT_PUBLIC_PMTILES_URL` absent from command environment; web `.env.local` contains it          |
| Root pnpm lint/format scripts         | BLOCKED            | pnpm shim hung; direct root scans hung/traversed generated `.next-*` output                                            |
| Secret scan                           | PASS with fixtures | No real key/private-key matches; test-only database credentials occur in CI/scripts/tests                              |
| Brevo/R2/SSO                          | BLOCKED            | Existing backend audit records Brevo IP allowlist, R2 credentials, and SSO key as unavailable in its audit environment |

## 7. Authentication and security audit

**Status: PARTIAL.** The API contains password hashing, JWT access/refresh sessions, session rotation, MFA/recovery-code validation, authentication throttling, origin/config validation, and secure BFF token handling. API unit tests and type checks pass. No production browser session, cookie policy test, penetration run, or provider-backed email/MFA delivery was executed.

Security evidence:

- Global request validation and DTO whitelisting are present.
- Authentication rate limiting is Redis-backed and has unit coverage for fail-closed behavior.
- Environment validation rejects missing boot-critical secrets in the API/worker paths.
- No committed production secret was found; committed URLs are test fixtures.
- Provider-backed MFA/email, SSO key provisioning, CSP/security-header verification, dependency vulnerability scanning, and external penetration testing remain unverified.

## 8. RBAC, permission and tenant isolation

**Status: PARTIAL / RELEASE BLOCKED.** The permission catalogue exposes the required roles: `super_admin`, `tenant_admin` (Client Admin), `director`, `manager`, `prospector`, and `auditor` (Observer). Scope types include tenant, organization, team, campaign, and territory, with server-side guards/services and SQL predicates.

| Control                                     | Result                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Role catalogue and permission endpoints     | PASS at source/unit level                                                                                                    |
| Server-side authorization guards            | PARTIAL; broad coverage exists, complete route matrix not certified                                                          |
| Tenant predicates and composite tenant keys | PASS in source review; full runtime proof incomplete                                                                         |
| RLS/restricted runtime role                 | FAIL in current integration evidence; `tenant-rls.integration.spec.ts` had a cross-tenant insert that unexpectedly succeeded |
| Cross-role/cross-tenant attack matrix       | UNVERIFIED; no browser/API attack run across all roles                                                                       |
| Worker tenant context                       | PARTIAL; job payloads carry tenant IDs, but a complete database tenant-context certification is not evidenced                |

The current API integration run failed four files and includes the tenant-RLS failure. This is a P0/P1 release blocker until it is triaged and rerun with the intended restricted runtime role and complete fixture setup.

## 9. Frontend and backend integration audit

**Status: PARTIAL.** Source inspection shows API clients/BFF handlers for authentication, prospects, assignments, actions, reservations, follow-ups, dashboards, messages, notifications, imports, exports, campaigns, territories, and role pages. The existing API readiness audit reports that each previously audited page resolved to a real API client and did not intentionally render fixture data.

That evidence does not prove every visual component is API-connected. The current tree has 82 page files, generated route exports that fail web TypeScript, and no authenticated browser run. The following therefore remain unverified:

- live data rendering and loading/error/empty states for every role page;
- backend authorization response handling at each UI boundary;
- manager/director dashboard filter semantics against live data;
- mobile layouts and message/notification interactions;
- file upload/download against real object storage;
- websocket/live-refresh behavior and multi-tab consistency.

The one web test failure is `apps/web/src/app/(app)/assigned-work.test.tsx`: it expects dialog name `Establishment`, while the rendered dialog is named `Brigade de Bastia`; jsdom also reports unsupported navigation. This blocks a clean frontend gate.

## 10. Data model and persistence

**Status: PARTIAL.** The schema contains 91 tables with tenant composite foreign keys, indexes, checks, timestamp fields, and migration-driven changes. The migration integrity script passes for 85 migrations. The repository documents database triggers for action immutability, consent checks, assignment state, and campaign open-work rules.

Material gaps:

- The full product dossier could not be checked against the schema because it is missing.
- Current integration evidence shows RLS/tenant-context behavior is not green.
- Notifications currently require `followUpId` and `scheduledFor` and use a single enum value (`follow_up_reminder`), which constrains the broader notification design.
- Production schema/catalog parity, migration rehearsal against the actual deployment database, and rollback safety are not evidenced.

## 11. API completeness

**Status: PARTIAL.** The API surface is broad and covers the documented core workflows. Representative backend areas include auth/account/workspaces, prospects/contacts, campaigns, assignments, actions, follow-ups, reservations, collisions/overrides, imports/exports, dashboards, audit/compliance, search, notifications, messaging, attachments, routes, integrations, platform administration, and health.

The release gate is not complete because:

- 20 integration tests failed across collision/override, reservation lifecycle, tenant RLS, and background-sweep suites;
- web TypeScript reports exported non-component symbols in generated route types (`ImportStatusBadge`, `describeCampaignError`, `RouteStatusBadge`, and several header helpers), indicating the web/API route contract is not build-clean;
- no live OpenAPI/contract diff or generated client parity check was run;
- health inventory documentation describes `/health` as static and not proof of PostgreSQL, Redis, BullMQ, or worker readiness;
- provider-backed attachment, export, email, and map paths remain unverified.

## 12. Manager role audit

**Status: PARTIAL.** Manager dashboard, team activity, assignments/wizard, approvals/override detail, campaigns, campaign detail, territories, follow-ups, messages, notifications, and reports are represented in the web tree and backed by API clients/services.

The requested manager reference flows are not release-certified because the API integration suite is red, web typecheck is red, the dashboard/filter behavior has no authenticated browser proof, mobile behavior was not tested, and full manager authorization/tenant isolation was not exercised in an attack matrix. Territory filtering and dimension authorization should be explicitly verified against the manager scope before release.

## 13. Director role audit

**Status: PARTIAL / UNVERIFIED.** Director routes exist for executive overview, campaigns/campaign detail, territories, reports/activity, performance, and exports. Backend permission catalogue and reporting/export services exist.

The director surface has no authenticated browser/E2E certification, no live provider/export validation, and web TypeScript currently fails on route-generated exports. Cross-organization scope boundaries, export masking, and board-report generation must be verified before sign-off.

## 14. Prospector role audit

**Status: PARTIAL.** Prospector work queue, prospect detail, actions, reservations, follow-ups, messages, map, history, profile, and notifications have API clients and unit/component coverage. Notification inbox/read state and profile notification preference paths are connected to backend endpoints.

The end-to-end prospecting journey is not signed off because browser-level collision-before-action, reservation expiry, message mutation, attachment storage, notification delivery, and mobile responsive behavior were not run against a live API. The web suite is not fully green.

## 15. Observer/Auditor role audit

**Status: UNVERIFIED / PARTIAL.** The backend exposes an auditor/observer role mapped to read permissions and the action/history/audit surfaces exist. No complete read-only route matrix, browser session, or attempt to prove that observer actions are denied across all write endpoints was executed.

Required evidence before release: authenticated observer sessions, every navigation item, direct URL access, export denial, message mutation denial, assignment/override denial, and cross-tenant read attempts.

## 16. Super Admin and Client Admin audit

**Status: PARTIAL.** Platform and tenant administration modules cover users, organizations, memberships, access grants, permissions, imports, live/admin pages, and configuration. The permission catalogue distinguishes platform `super_admin` from tenant-scoped `tenant_admin`.

The full privilege-boundary matrix is not certified. Platform-vs-tenant separation, support/operator access, membership revocation, role changes, import/export scope, and audit attribution need isolated role sessions and direct API tests. The current integration failures and RLS failure block release.

## 17. Messaging and notification audit

**Status: PARTIAL.** Messaging has conversation/message/attachment APIs and frontend screens. Message edit/delete behavior has source tests; user requirements specify that sent messages are mutable only before they are read, and the current code includes a mutability policy test. Browser verification was not run.

Notifications currently provide:

- authenticated list/inbox and paged list endpoints;
- unread count;
- mark-one-read and mark-all-read;
- notification preferences and device endpoints in the communications module;
- a web notification page, header bell, polling refresh, filters, and preference link;
- worker follow-up reminder creation with database uniqueness/idempotency;
- server normalization that keeps collision in-app delivery required.

The reference notification design requires a broader prioritized event model for all roles. Current schema/worker evidence only implements `follow_up_reminder`; producers for collision detected, approval requested, reservation expired, import completed, inactivity/no-activity, and similar events were not found. Email/push fan-out, quiet hours/digest delivery, notification preference persistence against every UI toggle, and provider-backed delivery are not certified.

## 18. Audit log and immutability

**Status: PARTIAL.** `audit_events` and audit services are used by assignments, overrides, imports, exports, and security operations. Action history is append-oriented and finalized actions reject mutation in source-level evidence. API unit and worker tests cover idempotent behavior and audit-related paths.

The full immutable-history guarantee is not release-certified under the restricted runtime role. Direct database update/delete denial for audit rows, append-only proof across every sensitive operation, and cross-tenant audit visibility were not completed in the current audit.

## 19. Concurrency, race conditions and idempotency

**Status: FAIL at release gate / PARTIAL implementation.** The codebase has idempotency decorators and unique indexes for reservations, actions, overrides, and follow-up notifications. Worker integration passed retry/idempotency and reservation-expiry scenarios.

The disposable API integration run did not pass the concurrency-sensitive collision/override/reservation suites: 17 collision workflow tests failed, one reservation lifecycle test failed, and the tenant-RLS/background-sweep failures undermine the isolation assumptions. Redis-loss, API crash-after-claim, two-node races, provider retries, and full load/concurrency measurements were not run.

## 20. Worker and background jobs

**Status: PARTIAL.** Worker unit tests pass 14 files/65 tests. Disposable worker integration passes 4 files, 12 tests, with 2 documented skips. Processors include follow-up reminders, reservation expiry, compliance artifacts, scheduled reports, webhook delivery, health checks, and retry probes.

The worker's database tenant-context behavior, R2/email/webhook delivery, queue backpressure, duplicate delivery, dead-letter/replay procedure, and production Redis/BullMQ readiness are not fully certified. MinIO was unavailable, and the API integration suite exposed background-sweep and tenant-context failures.

## 21. File storage, uploads and exports

**Status: BLOCKED / PARTIAL.** S3-compatible presigned upload/download services, import/export workflows, attachment routes, and audit records exist. The isolated MinIO service could not be pulled (`minio/minio:latest` registry access denied), so object storage, tenant key isolation, content limits, expiry, and download authorization were not exercised.

Existing repository documentation records production backup/restore as incomplete. Export authorization and audit behavior have source and focused tests, but real CSV/XLSX/PDF generation, large-file handling, provider storage, and export download delivery are not release-proven.

## 22. Performance and scalability

**Status: UNVERIFIED.** No authenticated browser performance run, API latency benchmark, queue throughput test, database query plan review under realistic data, or concurrent multi-node load test was completed. The requirement that anti-collision decisions normally complete under one second is not evidenced by a measured run. The web production build stalled after entering optimized-build work without completing during the audit window.

Before release, measure p50/p95/p99 for collision checks, reservations, dashboards, searches, messages, notifications, and exports; test queue lag/backpressure; and validate database indexes with representative tenant sizes.

## 23. Monitoring, observability and alerts

**Status: PARTIAL / BLOCKED.** Health-check processors, structured Nest logs, retry classes, and audit events exist. Docker health checks exist for local Postgres/Redis/Mailpit. The documented `/health` endpoint is static and does not prove dependency readiness.

Missing or unverified release evidence includes centralized logs, metrics, traces, error tracking, alert routing, queue-depth alerts, database saturation alerts, failed notification/export alerts, provider outage alarms, and a tested incident/runbook path.

## 24. Testing and QA

Test evidence collected:

| Suite/check                               | Result                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| API unit                                  | PASS — 93 files, 761 tests                                             |
| Worker unit                               | PASS — 14 files, 65 tests                                              |
| Jobs package                              | PASS — 4 tests                                                         |
| API typecheck and build typecheck         | PASS                                                                   |
| Worker typecheck and build                | PASS                                                                   |
| Jobs typecheck/build                      | PASS                                                                   |
| Web Vitest                                | FAIL — 85 files, 713 tests: 712 passed, 1 failed                       |
| Web TypeScript                            | FAIL — generated route export/header helper errors                     |
| API integration on disposable migrated DB | FAIL — 54 files passed, 4 failed; 592 passed, 20 failed, 612 total     |
| Worker integration                        | PASS — 4 files, 12 passed, 2 skipped                                   |
| Migration integrity                       | PASS — 85 contiguous entries                                           |
| Root lint/format                          | BLOCKED — pnpm shim/root generated-output traversal did not complete   |
| Browser/E2E/responsive/accessibility      | BLOCKED — no running web/API app URL or authenticated session supplied |

The failed web test and failed API integration suites must be triaged and rerun. No failures were silently ignored or fixed during this audit.

## 25. Deployment readiness and rollback

**Status: NOT READY.** CI defines dependency installation, migration integrity, migration, lint, format, typecheck, unit tests, API integration, and build stages. Operations documentation contains deployment and identity migration runbooks, but production evidence is incomplete.

The following gates are missing or red:

- green web typecheck, web tests, production build, and root quality checks;
- green restricted-role API integration/concurrency matrix;
- production schema/catalog parity and migration rehearsal;
- automated encrypted backups and a successful isolated restore rehearsal;
- provider credentials and smoke tests for R2/object storage, email, maps, SSO, and webhooks;
- dependency-aware health/readiness and centralized monitoring;
- canary, rollback, migration-forward-fix, and incident evidence;
- authenticated cross-role browser smoke tests on desktop and mobile.

No deployment was performed. No deployment plan is created because the release decision is NOT READY.

## 26. Final release recommendation

**STOP: do not deploy.** The repository is not currently release-ready, even though the core backend and worker have meaningful passing coverage.

Prioritized remediation backlog:

### P0 — security and correctness blockers

1. Resolve the tenant-RLS/restricted-runtime integration failures and prove cross-tenant reads/writes are denied for all six roles and worker paths.
2. Triage the 20 API integration failures in collision/override, reservation lifecycle, background sweep, and tenant-RLS; rerun the full disposable suite until green.
3. Restore a green web quality gate: fix the failing assigned-work dialog test, generated route export/type errors, and production build completion.
4. Supply the Product Design Dossier or an approved replacement requirements baseline and repeat traceability/visual acceptance.

### P1 — production capability blockers

5. Complete notification event producers, role recipients, priority rules, email/push/in-app channels, quiet hours/digest behavior, and critical-alert enforcement.
6. Provision and test R2/MinIO, email, map, SSO, webhook, and attachment providers with tenant-safe keys and failure recovery.
7. Implement and rehearse automated backup/restore, including runtime role/grants and migration compatibility.
8. Add dependency-aware readiness, centralized logs/metrics/traces, queue/provider alerts, and incident runbooks.
9. Run authenticated browser/E2E and responsive/ACL tests for manager, director, prospector, auditor, client admin, and super admin flows.

### P2 — resilience and product completeness

10. Run load/concurrency tests for collision, reservations, idempotency, dashboards, search, messaging, notifications, and exports.
11. Verify dashboard dimension authorization and territory filters for manager/director reporting.
12. Complete attachment/download/export large-file and expired-link tests.
13. Close remaining route/API contract and generated type drift; make root lint/format scripts ignore generated output safely.

### P3 — maintainability

14. Expand shared UI/types/validation packages or document why those layers remain app-local.
15. Add live-data page tests and explicit API coverage maps for every role page/component.

After the P0 and P1 gates are green, repeat this audit from a clean checkout, attach the missing design source, run browser and provider smoke tests, and only then prepare a deployment plan.
