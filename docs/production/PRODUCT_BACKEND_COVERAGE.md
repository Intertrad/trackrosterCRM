# Product and Backend Coverage

> **2026-09-22 implementation update:** Native membership authentication and operational actor references, personal account APIs, workspace administration, notification extensions, session audit and authentication throttling have been added. Migrations 0026–0028 were verified on an isolated database; deployment to the existing database remains separate. See [the current backend implementation ledger](../backend/IMPLEMENTATION_STATUS.md). The dated baseline below is retained as historical evidence. Full backend completion and production readiness remain pending.

**Assessment date:** 2026-09-21  
**Release decision:** Production no-go; controlled pilot conditional

Status definitions:

- **Core complete:** the current bounded contract works end-to-end and has meaningful tests;
- **Partial:** a usable foundation exists, but the agreed product requirement is incomplete;
- **Missing:** no production implementation exists.

## MVP requirement traceability

| ID     | Product requirement               | Implementation evidence                                                                                 | Status        | Required next work                                                                                  |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| FR-001 | Named-account authentication      | Identity-backed v2 login, persisted session guard, refresh rotation, logout, current-user API; Argon2id | Core complete | Add privileged MFA, recovery, throttling, and key-rotation operations                               |
| FR-002 | Six product roles                 | Five tenant roles exist; ADR-005 separates platform and JIT support authorization                       | Partial       | Implement platform super admin and controlled support access without tenant impersonation           |
| FR-003 | Tenant isolation                  | Composite tenant foreign keys and repository tenant predicates                                          | Partial       | P0: restricted DB role, RLS, `FORCE RLS`, transaction-local context, adversarial tests              |
| FR-004 | Organizational scope              | Tenant/org/team grants and centralized service authorization                                            | Partial       | Add campaign/territory scope where required; complete HTTP administration                           |
| FR-005 | CSV/XLSX import                   | Synchronous CSV preview and execution                                                                   | Partial       | Add XLSX and durable import workflow                                                                |
| FR-006 | Import validation                 | Normalization, validation, exact duplicate warnings, preview                                            | Partial       | Persist mappings/jobs/rows/issues; fuzzy duplicate review and correction/finalize flow              |
| FR-007 | Prospect management               | Admin establishment APIs and Prospector work queue/detail                                               | Partial       | Add scoped Manager/Director/Observer search and detail contract                                     |
| FR-008 | Contacts                          | Establishment contact CRUD                                                                              | Partial       | Add consent/opposition, preferred channel, language, and richer contact data                        |
| FR-009 | Campaigns                         | Campaign and campaign-prospect APIs                                                                     | Partial       | Add manager-scoped campaign operation, objectives, members, and territories                         |
| FR-010 | Assignments                       | Manual assign/reassign/unassign plus history and audit                                                  | Partial       | P0: permit authorized managers; bulk lot preview/apply; later round-robin                           |
| FR-011 | Anti-collision                    | Reservation, planned-action, cooling-off, assignment, and org policy checks                             | Partial       | Add duplicate and opposition layers; expose/administer policies; complete override result           |
| FR-012 | Reservation                       | Atomic Redis Lua claim/state/release                                                                    | Core complete | Add durable evidence and recovery reconciliation                                                    |
| FR-013 | Concurrent reservation protection | Exactly-one-winner integration tests                                                                    | Core complete | Prove under production-like multi-instance load and Redis failover                                  |
| FR-014 | Rich immutable action history     | Reservation-bound activity insert and activity timeline                                                 | Partial       | P0: outcome/contact/notes/duration/structures/languages/documents/lifecycle fields; DB immutability |
| FR-015 | Follow-ups                        | List/create/reschedule/complete/cancel with category/channel and Today integration                      | Core complete | Add completing actor, cancellation reason, and resulting-activity linkage                           |
| FR-016 | Manager override                  | Scoped immediate approval with reason, snapshot, audit, idempotency                                     | Partial       | Add Prospector request, Manager inbox, approve/reject decision and rejection reason                 |
| FR-017 | Audit trail                       | Transactional audit for grants, campaigns, assignments, regions, overrides, exports                     | Partial       | Add read/search API, complete event coverage, DB-enforced append-only behavior                      |
| FR-018 | Manager dashboard                 | Date/org/team/user/campaign scoped metrics                                                              | Partial       | Add channel/territory, conversion, collision, completeness, reassignment, and target metrics        |
| FR-019 | Search and filtering              | Work-queue campaign/lifecycle/text filters and cursor paging                                            | Partial       | Expand authorized global search and saved views; add measured trigram/search-vector support         |
| FR-020 | Controlled exports                | Scoped audited CSV/XLSX for three types                                                                 | Core complete | Move large exports to durable asynchronous jobs with expiry and download reauthorization            |

## Additional MVP capability findings

| Capability                    | Status        | Evidence and gap                                                                            |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| Tenant/org/team configuration | Partial       | Tables, repositories, and services exist; no controllers                                    |
| Campaign lifecycle            | Partial       | Six stages exist and can be filtered; no mutation/transition API                            |
| Bulk/balanced assignment      | Missing       | No batch preview/apply or assignment strategy engine                                        |
| Prospector Today              | Core complete | Timezone-aware summaries and priority list backed by follow-ups                             |
| Prospector map                | Missing       | Admin-only nearby endpoint; no scoped coordinate feed                                       |
| Do-not-contact/opposition     | Missing       | No schema, API, or collision enforcement                                                    |
| Duplicate review/merge        | Missing       | Exact import checks only; no durable candidate/review/merge model                           |
| Full common timeline          | Partial       | Activity entries only; assignments, follow-ups, overrides, lifecycle and corrections absent |
| Notifications                 | Partial       | In-app follow-up reminder only; no preferences/delivery/escalation history                  |
| Messaging                     | Missing       | No conversations, participants, messages, attachments, or realtime contract                 |
| Saved views                   | Missing       | No persistence/API                                                                          |
| Routes/map stops              | Missing       | No route planning model/API                                                                 |
| Webhooks/integrations         | Missing       | No API clients, outbox dispatcher, webhooks, or integration administration                  |
| Privacy lifecycle             | Missing       | No retention jobs, DSAR, erasure, legal hold, or anonymization workflow                     |

Messaging, advanced routes, attachments, public APIs/webhooks, calendar integrations,
capacity assignment, telephony, AI, billing, SSO, and white labelling remain V1.1/V2 unless
the approved product scope explicitly promotes them into MVP.

## MVP Definition of Done

| Dossier acceptance condition                         | Result                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Incompatible concurrent users cannot both reserve    | Met by current race integration tests                                           |
| Every action creates authored immutable history      | Partial: authored insert exists; contract is thin and DB immutability is absent |
| Manager assigns/reassigns/closes by lot              | Not met                                                                         |
| Prospector sees only authorized work                 | Strong at application layer; territory and RLS defense are absent               |
| Override requires reason and audit                   | Partial: immediate approval only, no request/decision flow                      |
| Import reports duplicates/anomalies before insertion | Partial: exact synchronous CSV checks                                           |
| Follow-ups produce configured tasks/alerts           | Partial: in-app reminder only                                                   |
| Dashboard filters every required dimension           | Not met                                                                         |
| Critical desktop/mobile flows have no loss           | Frontend QA gate; not established here                                          |
| Exports are role-controlled and audited              | Met for current bounded exports                                                 |
| Backup restoration has been tested                   | Not met                                                                         |
| Collision behavior has automated concurrency tests   | Met for reservation and override races                                          |

## P0 production release gates

The following gates block production with real customer/prospect data.

| Gate                          | Current evidence                                                                                                                      | Acceptance criteria                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Canonical schema              | Drizzle chain is healthy; external 58-table SQL conflicts                                                                             | Drizzle/migrations declared authoritative; CI integrity and live drift checks pass                            |
| Database tenant isolation     | Composite FKs are strong; zero RLS policies/roles                                                                                     | Restricted runtime role; full tested RLS and `FORCE RLS`; no pool context leakage                             |
| Identity architecture         | Phase B uses global identities and exact persisted identity/membership/tenant sessions; the Phase A mirror remains                    | Phase C must repoint grants and human actor references before enabling distinct-ID or multi-membership access |
| Authentication hardening      | Argon2id, one-time refresh rotation, absolute session lifetime, state-backed access guard, strict v2 issuer/audience/key ID/algorithm | MFA for privileged users; throttling/lockout; email verification/reset; managed signing-key rotation          |
| HTTP hardening                | Strict DTO validation and request IDs                                                                                                 | Security headers, strict CORS, rate limits, trusted-proxy policy, request/body limits                         |
| DB connections                | Default `Pool({ connectionString })`                                                                                                  | Separate credentials; TLS policy; pool/connect/query/statement/idle timeouts; application name                |
| Consent/opposition            | Missing                                                                                                                               | Durable channel blocks and legal evidence enforced before reservation/action                                  |
| Rich action transaction       | Activity insert exists                                                                                                                | One reliable orchestration for action, lifecycle, next step, audit/event, and reservation release             |
| Reservation durability        | Atomic Redis runtime lock                                                                                                             | Durable claim/reject/release evidence; Redis HA/persistence; expiry reconciliation                            |
| Health/readiness              | Static `status: ok`                                                                                                                   | Separate liveness/readiness; PostgreSQL, Redis, queue and worker dependency checks                            |
| Observability                 | Logs and request IDs                                                                                                                  | Redacted structured logs, metrics, traces, error tracking, queue/outbox dashboards and alerts                 |
| Backups/recovery              | Draft document only                                                                                                                   | Defined RPO/RTO, encrypted backups/PITR, off-account copy, successful restore drill evidence                  |
| Privacy                       | Missing operational enforcement                                                                                                       | Retention by data class, erasure/DSAR/legal hold/anonymization and breach procedure                           |
| API contract                  | Draft prose differs from implementation                                                                                               | Generated versioned OpenAPI; explicit DTOs, scopes, errors, limits and idempotency                            |
| Operational resilience        | Worker retry/backoff exists                                                                                                           | DLQ/redrive, poison-job handling, alert ownership and failure drills                                          |
| Security/performance evidence | Strong functional tests                                                                                                               | RLS attacks, load/soak/failover, latency SLO, dependency/SAST/DAST/secret/container scans                     |
| Deployment discipline         | CI exists; operations docs are drafts                                                                                                 | Staging rehearsal, forward migration plan, rollback/forward-fix runbook and release approvals                 |

## Exact schema risks found in this snapshot

1. Work-queue filtering/order needs a measured partial composite assignment index.
2. Leading-wildcard `ILIKE` search has no trigram or full-text index.
3. Reporting lacks measured time-based activity and terminal-follow-up indexes.
4. Append-only activity, override, and audit records are not immutable at the DB privilege
   layer.
5. `display_name` remains nullable; user creation cannot set it.

## Completed schema hardening

- Migration `0022` replaces the idempotency operation wildcard with a literal-dot
  constraint and adds a database-boundary regression test.
- Migration `0023` proves that every activity, follow-up, and collision override belongs
  to the exact assignment for its campaign prospect. It also adds indexes for existing
  tenant-and-assignment joins.
- Migration `0024` adds global identities, tenant memberships, separate platform roles,
  and bounded support-access requests. It performs an exact legacy backfill and installs
  a one-way compatibility mirror.
- Migration `0025` binds authentication sessions to an exact identity, membership, and
  tenant, enforces an absolute lifetime, adds state-change revocation, revokes all legacy
  sessions for a v2-only cutover, and retains a temporary legacy session-write bridge.
- The Phase B runtime authenticates against identities and validates persisted session,
  identity, membership, and tenant state on every protected request. The compatibility
  path remains limited to one active same-ID membership.

## Completed architecture decisions

- ADR-005 separates global credential identity from tenant membership, keeps platform
  authority outside tenant roles, and requires time-limited audited support grants.
- The associated migration plan stages additive backfill, authentication cutover,
  platform access, restricted database roles, and RLS instead of combining them in one
  irreversible release.

## Implementation sequence

1. Preserve and continuously verify the canonical migration chain.
2. Deploy and verify the compatible Phase B v2 authentication/session cutover.
3. Repoint tenant grants and human operational actor references to memberships, then
   enable explicit tenant selection and distinct-ID/multi-membership access in Phase C.
4. Split migration/auth/API/worker credentials and harden database pools.
5. Add explicit transaction-local context, test RLS under restricted roles, then force RLS separately.
6. Add consent/opposition and complete collision outcomes.
7. Implement the rich action/lifecycle/follow-up/reservation orchestration and full timeline.
8. Allow Manager assignment and implement idempotent bulk assignment.
9. Build durable import/deduplication review and asynchronous export workflows.
10. Complete audit administration, notifications, reports, readiness and observability.
11. Run production-like security, concurrency, load, backup/restore and failure exercises.
