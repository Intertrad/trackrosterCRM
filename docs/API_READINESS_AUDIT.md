# TrackRoster backend API readiness audit

Audit date: 2026-09-24  
Branch audited: `codex/backend-completion`  
Evidence: API source, schema/migrations, integration tests, worker tests, and current restricted-role runs.

> **Addendum, 2026-09-24 — the headline figure depends on which role you run as.**
>
> "53 of 57 integration suites fail" is reproducible, and only under the
> **restricted** role (`trackroster_app`). Measured again after provisioning
> that role: 52 of 57. The failures are integration-test fixtures seeding
> through the application's own connection outside a tenant context — the
> error is `insert into organizations` in `beforeAll`, not product code.
>
> Under the role the repository is actually configured with — `trackroster`,
> the owner, which `.env.example` ships and CI uses — the same suite fails
> **8 of 57**, once one unrelated defect is removed: the auth limiter keys on
> IP, every suite signs in from 127.0.0.1, and at 60 logins a minute they
> exhaust one shared Redis bucket. That alone accounted for ~50 failures and
> 325 skipped tests, and is fixed in `vitest.integration.config.ts`.
>
> Both numbers are real. Read together they say something different from
> either alone: the restricted-role matrix is red because of **test setup**,
> while the product paths underneath it largely pass. Two examples that this
> document lists as uncertified: `reservation.integration.spec.ts` passes
> 25/25 including both concurrency races, and `tenant-rls` passes 2/2 as soon
> as the runtime role exists.
>
> The genuine remaining failures under the default role are 8, in 6 suites:
> `collision-workflows` (2), `prospector-today` (3), `consents`,
> `assignment-batch`, `reservation-lifecycle`. Those deserve individual
> triage; the rest of section A's caution was measuring the harness.

## A. Executive summary

The backend is feature-rich and suitable for continued frontend integration in development or staging. It is **not yet production-certified as a complete multi-tenant system**. The main release blocker is the restricted-role API matrix: broad tenant RLS is present, but 53 of 57 integration suites currently fail during direct fixture/service setup because those paths do not establish a tenant transaction. `FORCE ROW LEVEL SECURITY` is therefore intentionally disabled.

The safest frontend integration scope today is authenticated account/workspace navigation, search, prospect reads, maps, campaign/workspace reads, notifications, messaging, and the core prospecting flows in staging. High-risk writes—reservations, assignments, imports, exports, overrides, membership administration, and scheduled/compliance delivery—remain frontend-ready only where the individual focused suite passes and must not be called production-ready until the full restricted-role matrix is green.

Repository facts:

- 325 controller operations were discovered under `apps/api/src`.
- Roles in the database enum are `client_admin`, `director`, `manager`, `prospector`, and `observer`.
- Platform access separately includes `super_admin`; support access is modeled as a `support_operator` grant with read-only scope.
- Broad tenant RLS migration `0071_tenant_rls_policies.sql` exists and is applied in the disposable local database.
- Restricted role: `trackroster_app`.
- `FORCE ROW LEVEL SECURITY`: disabled.
- Focused authorization and tenant-RLS tests pass; the complete integration matrix is not green.

## B. Actual role model

| Role               | Source                   | Current meaning                                                  |
| ------------------ | ------------------------ | ---------------------------------------------------------------- |
| `client_admin`     | `user_access_grants`     | Tenant administration within one tenant                          |
| `director`         | `user_access_grants`     | Organization-scoped oversight                                    |
| `manager`          | `user_access_grants`     | Team-scoped management                                           |
| `prospector`       | `user_access_grants`     | Assigned prospect work and actions                               |
| `observer`         | `user_access_grants`     | Read-only tenant/organization/team visibility depending on grant |
| `super_admin`      | `platform_access_grants` | Platform-level administration, separate from tenant roles        |
| `support_operator` | `support_access_grants`  | Explicit, read-only support access workflow                      |

Legacy labels such as `tenant_admin` and `auditor` are projections or product terminology; the canonical persisted tenant roles are the enum values above.

## C. API inventory and status rules

The controller inventory contains 325 operations across authentication, account/workspace, prospects, establishments/contacts, campaigns, assignments, reservations, actions, follow-ups, collisions/overrides, imports, exports, dashboards, audit/compliance, search, notifications, messaging, attachments, routes, integrations, platform administration, and health.

Each endpoint must be treated according to this evidence-based classification:

- **Production ready**: focused implementation, authorization, persistence, tenant isolation, and relevant tests pass under the restricted runtime role.
- **Frontend ready / staging**: usable for internal integration, but missing full matrix, live provider, load, or worker certification.
- **Partial**: route exists but a material workflow or test is incomplete.
- **Blocked**: external credentials, provider, storage, or product decision is required.
- **Broken**: current integration evidence shows a failure.
- **Missing/Post-MVP**: not implemented or intentionally outside current MVP.

High-risk operations are not promoted to production-ready solely because a controller or unit test exists.

## D. Prospector readiness

### Frontend-ready/staging capabilities

- Authentication, `GET /me`, memberships, active membership, permissions, sessions.
- Personal work queue / My Day (`/prospector/today`, work queue endpoints).
- Authorized prospect, establishment, address, contact, timeline, search, map, and nearby reads.
- Collision checks, follow-up CRUD, notification inbox/preferences/devices, conversations/messages, and attachment APIs where storage is configured.
- Action creation and timeline reads in focused workflow suites.

### Not production-certified

- Reservation claim/heartbeat/release: requires repeated real PostgreSQL + Redis race certification.
- Assignment-sensitive action completion: requires the full role/scope matrix and finalized-action immutability certification.
- Imports/exports: direct fixture/service paths currently fail under RLS; large-file and failure recovery remain incomplete.
- Scheduled reports, compliance artifacts, and email delivery: worker/provider certification remains incomplete.

### Security requirement

Prospectors must remain limited to assigned or explicitly granted scope and must never reassign, approve overrides, administer tenants, or perform unrestricted exports. Focused authorization tests cover the grant model; the complete route matrix is still pending.

## E. Manager readiness

### Frontend-ready/staging capabilities

- Team/workspace reads, team capacity, workload/dashboard queries, authorized prospect reads.
- Assignment and reassignment APIs in focused suites.
- Follow-up oversight, collision review, override review, reporting and audit reads where scope guards are present.

### Not production-certified

- Bulk assignment and failure recovery.
- Cross-team override approval matrix.
- Authorized export/import matrix.
- Full Manager A versus Manager B isolation run under `trackroster_app`.

Managers are team/organization-scoped according to their access grant and cannot automatically control another manager’s team.

## F. Client Admin readiness

### Frontend-ready/staging capabilities

- Workspace, organization, team, membership, invitation, permission, campaign, territory, import/export, audit, integrations, and webhook route families exist.
- Tenant-scoped authorization and focused cross-tenant tests exist for core authorization.

### Not production-certified

- Full membership lifecycle under restricted RLS.
- Imports, exports, compliance downloads, scheduled reports, and provider-backed integrations.
- Platform administration boundaries; tenant `client_admin` must not be treated as `super_admin`.

## G. Director, observer/auditor, super-admin, support

- **Director**: organization-scoped reads, dashboards, reports, and authorized override capabilities exist; cross-organization mutation/export certification remains pending.
- **Observer**: read-only behavior is represented by the `observer` grant. Mutation rejection and complete read-scope matrix still require certification.
- **Super admin**: platform tenant, platform user, plans/subscriptions, feature flags, jobs, incidents, support access, configuration, audit, and release routes are present in varying completeness. These are not tenant APIs and require a separate platform privilege matrix.
- **Support operator**: support access is modeled, but the workflow is not production-ready until request/approval/revocation and audit behavior are certified end to end.

## H. Role × API matrix

| Domain                     |  Client Admin |      Director |       Manager |    Prospector |      Observer | Super Admin | Current status                           |
| -------------------------- | ------------: | ------------: | ------------: | ------------: | ------------: | ----------: | ---------------------------------------- |
| Authentication/account     |            ✅ |            ✅ |            ✅ |            ✅ |            ✅ |          ✅ | Frontend-ready; full matrix pending      |
| Prospect reads/search/maps |            ✅ |            ✅ |            ✅ |     ✅ scoped |       ✅ read |          🚫 | Frontend-ready/staging                   |
| Assignments                |            ✅ |        scoped |       ✅ team |            ❌ |            ❌ |          🚫 | Partial; failure/recovery tests pending  |
| Reservations/collisions    |            ✅ |        scoped |        scoped |   ✅ assigned |          read |          🚫 | Partial; race certification pending      |
| Actions/timelines          |            ✅ |        scoped |        scoped |   ✅ assigned |          read |          🚫 | Partial; immutability matrix pending     |
| Follow-ups                 |            ✅ |        scoped |        scoped |   ✅ assigned |          read |          🚫 | Frontend-ready; worker reminders pending |
| Overrides                  |            ✅ |  organization |          team |  request only |          read |          🚫 | Partial; cross-scope tests pending       |
| Imports/exports            |            ✅ | policy-scoped | policy-scoped | ❌/restricted | explicit read |          🚫 | Not production-certified                 |
| Notifications/devices      |            ✅ |            ✅ |            ✅ |            ✅ |            ✅ |          🚫 | Frontend-ready                           |
| Messaging/attachments      | tenant-scoped |        scoped |        scoped |        scoped |          read |          🚫 | Storage certification pending            |
| Audit/compliance           |            ✅ |        scoped |        scoped |    restricted |          read |    platform | Partial; artifacts/downloads pending     |
| Platform administration    |            ❌ |            ❌ |            ❌ |            ❌ |            ❌ |          ✅ | Separate platform surface; partial       |

## I. Production-ready frontend handoff

At this audit point, no high-risk multi-tenant write family should be labeled fully production-ready because the complete restricted-role matrix is not green. The following are safe to integrate in staging while certification continues:

### Shared/account

- `GET /me`
- `GET /me/memberships`
- `GET /me/permissions`
- Session and active-membership endpoints
- MFA, password recovery, invitation, and device/preferences endpoints where configured

### Read/query surfaces

- Prospect, establishment, contact, address, timeline, search, map, and nearby reads within authenticated scope
- Prospector today/work-queue reads
- Manager dashboard/team-capacity reads
- Notification inbox, unread count, read, preferences, and devices

### Supporting workflows

- Follow-up list/create/update/complete/cancel in staging
- Conversations, participants, messages, read/mute, and attachment association in staging
- Campaign/workspace/territory reads in staging

Every frontend call must still use the authenticated tenant/membership context; client-supplied tenant IDs are not authority.

## J. Frontend-ready but not production-certified

- Reservation claims and collision flows: Redis/PostgreSQL race tests pending.
- Assignment and bulk assignment: recovery and cross-team matrix pending.
- Actions: finalized-action immutability and correction API tests pending.
- Overrides: cross-team, cross-tenant, self-approval, and expiry certification pending.
- Imports/exports: large-file, malformed-input, recovery, authorization, and object-storage tests pending.
- Scheduled reports/compliance: worker, artifact generation, R2 persistence, and Brevo delivery pending.
- Messaging/attachments: API authorization is present, but production object-storage certification is pending.
- Search/reporting: core reads exist; full scope and query-performance certification remains.

## K. Do not integrate yet

- `FORCE ROW LEVEL SECURITY` dependent production rollout: blocked until all direct service/test paths use tenant transactions.
- Live scheduled-report delivery and compliance artifact download: worker/provider/storage certification incomplete.
- Provider-specific Google/Microsoft OAuth sync and refresh: conditional/provider certification incomplete.
- Outbound webhook delivery as a production guarantee: retry, timeout, HMAC, dead-letter, and worker certification incomplete.
- Offline sync, billing/subscriptions, feature flags, generic platform jobs, incident management, and advanced support workflows: post-MVP or incomplete.

## L. Authentication and tenant findings

- Request-scoped tenant transaction support exists through `TenantTransactionInterceptor`, `withTenantContext()`, and the request-aware database executor.
- Restricted runtime role `trackroster_app` exists and focused tests pass.
- Broad RLS policies cover tenant-owned tables through migration `0071`.
- `FORCE ROW LEVEL SECURITY` is correctly disabled until the full matrix passes.
- The remaining failures are primarily direct raw Drizzle setup in integration fixtures and non-HTTP service paths, especially memberships, imports, reports, actions, assignments, and related domains.

## M. Business-critical readiness

| Area         | Status                 | Blocking evidence                                            |
| ------------ | ---------------------- | ------------------------------------------------------------ |
| Assignments  | Frontend-ready/staging | Bulk failure/recovery and full role matrix                   |
| Reservations | Frontend-ready/staging | Real Redis/PostgreSQL race certification                     |
| Actions      | Frontend-ready/staging | Finalized immutability/correction tests                      |
| Follow-ups   | Frontend-ready/staging | Reminder worker certification                                |
| Overrides    | Partial                | Cross-scope and decision immutability tests                  |
| Imports      | Partial                | RLS fixture paths, large files, failure recovery             |
| Exports      | Partial                | Authorization matrix and signed object-storage certification |
| Dashboards   | Frontend-ready/staging | Query/performance and role matrix                            |
| Audit        | Partial                | Evidence artifact generation and downloads                   |

## N. Worker and external-service dependencies

- Core reads: PostgreSQL; no worker required.
- Reservations/collisions: PostgreSQL + Redis; worker expiry may enhance the API.
- Follow-up reminders: API works independently; delivery is worker-enhanced.
- Scheduled reports/compliance: worker-required; R2/MinIO and Brevo dependencies.
- Attachments/exports: object storage required for production download guarantees.
- OAuth integrations: Google/Microsoft credentials and provider behavior required.
- Webhooks: target HTTP service, signing, retry, timeout, and dead-letter processing required.

## O. Demo/seed readiness

The repository contains development seed and test fixtures for tenant users and grants, but the audit found no single verified, documented demo account matrix for every role. Do not expose credentials from `.env` or test fixtures as production credentials. A dedicated demo-account document should list tenant, organization, team, and role after seed verification.

## P. Exact remaining work IDs

- `SEC-001`: migrate all direct service/CLI/test database paths to `withTenantContext()`.
- `SEC-002`: complete cross-tenant API matrix under `trackroster_app`.
- `SEC-003`: validate platform/global paths separately from tenant RLS.
- `SEC-004`: enable `FORCE ROW LEVEL SECURITY` only after the above pass.
- `TEST-001`: reservation PostgreSQL/Redis race certification.
- `TEST-002`: finalized-action immutability and correction API tests.
- `TEST-003`: override cross-scope/self-approval/expiry tests.
- `TEST-004`: bulk assignment recovery and import failure/large-file tests.
- `TEST-005`: export authorization/data-leak matrix.
- `WORKER-001`: webhook retry/timeout/HMAC/dead-letter certification.
- `WORKER-002`: scheduled report and compliance artifact worker certification.
- `INFRA-001`: MinIO/R2 upload/download/signed URL tests.
- `INFRA-002`: Brevo success/rejection/timeout certification with verified sender.
- `DOC-001`: generated endpoint-level contract inventory and role capability matrix.
- `POST-001`: offline sync, billing, feature flags, platform jobs, incidents, and advanced support workflows.

## Q. Frontend implementation priority

1. Authentication, account, workspace selection, and permissions.
2. Prospector read journey: work queue, prospect, contacts, timeline, search, and notifications.
3. Prospector staging writes: follow-ups, actions, reservations, and messages.
4. Manager dashboard, team workload, assignments, and override review.
5. Client Admin workspace, users, campaigns, imports/exports, and audit in staging.
6. Director/observer read-only surfaces.
7. Super-admin and support surfaces only after their separate platform certification.

## Final answer

Frontend work can start now against the shared authentication, scoped reads, search/maps, dashboards, notifications, messaging, and staging workflow APIs. The backend is not ready to claim complete production certification because the restricted-role full matrix is failing and `FORCE ROW LEVEL SECURITY` is not yet safe to enable. The next engineering milestone is `SEC-001` through `SEC-004`, followed by the risk-based concurrency and failure tests listed above.
