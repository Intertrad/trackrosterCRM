# TrackRoster full-stack security and production audit

**Date:** 2026-10-09  
**Branch:** `director_dev`
**Evidence rule:** Findings below are based on repository inspection and commands
that completed successfully. Provider dashboards, DNS, production secrets, and a
staging browser session were not available, so those areas are explicitly marked
unverified.

## A. Executive summary

TrackRoster has a substantial, tested NestJS/Next.js/BullMQ implementation. The
database exhaustion incident had a verified application cause: API and worker
connection pools were previously sized independently above the provider's shared
session limit, and some tenant request paths issued concurrent work on one
transaction client. The current defaults are bounded (API 8, worker 4), the
tenant reads found in the audit were serialized, and provider mail I/O no longer
holds a database transaction open.

The repository is **not ready for an unconditional production-readiness verdict**.
The remaining blockers are deployment and security-boundary evidence rather than
TypeScript compilation: production RLS mode is validated but not enforced at
startup, the deployment target is not reproducible from Git, CORS/security-header
ownership is undocumented in the application, and provider-backed restore,
mail-alerting, and authenticated browser E2E are unverified.

The first safe correction from this audit adds a response `x-request-id` header
and preserves optional structured error details in the API error envelope. This
keeps existing clients compatible while making failures diagnosable and ready for
a documented frontend contract migration.

## B. System and connection architecture

| Area                 | Verified architecture                                                                                                         | Current evidence                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| API database         | One `pg.Pool` created by `apps/api/src/database/database.provider.ts`, wrapped by Drizzle and a request-aware tenant executor | No second production API pool found        |
| Worker database      | One `pg.Pool` created by `apps/worker/src/database/worker-database.module.ts`; jobs use `withWorkerTenantTransaction`         | `client.release()` is in `finally`         |
| Tenant request scope | `TenantTransactionInterceptor` opens a transaction and sets `trackroster.tenant_id`; guard reads use `withGuardTenantScope`   | RLS context is transaction-local           |
| Queue                | BullMQ/Redis is used by the worker and API queue modules                                                                      | Redis provider is separate from PostgreSQL |
| Email                | `AuthMailService` claims an outbox row briefly, calls Mailpit/Brevo outside the transaction, then marks delivery              | Tokens and message bodies are not logged   |

Default pool capacity is **12 connections per API/worker pair** (8 + 4). Each
pool accepts an explicit value up to 15, so setting both variables to 15, or
running multiple replicas, can still exceed a provider session limit of 15.
This is an operational configuration risk and must be constrained by deployment
configuration rather than solved by simply raising the provider limit.

The remaining production `Promise.all` sites are token signing, independent
readiness checks, and independent Redis queue writes. No remaining production
`Promise.all` was found inside a Drizzle transaction callback during this audit.

## C. Backend and security audit

### Confirmed strengths

- Runtime API and worker pool sizes, idle timeouts, and connection timeouts are
  bounded and environment-validated.
- Worker transaction helpers always release clients, including rollback/error
  paths.
- Tenant transactions use transaction-local settings, so pooled connections do
  not retain a previous tenant context.
- The global API exception filter sanitizes unexpected errors and includes a
  request ID in the JSON response.
- Invitation links use the URL fragment (`/accept-invitation#token=...`) so the
  bearer token is not sent in HTTP request URLs or referrers.
- No production source `new Pool()` exists outside the API and worker providers.

### Open security findings

1. **P0 — RLS mode is declarative only.** `TENANT_RLS_MODE` is parsed by
   `apps/api/src/config/environment.validation.ts`, but no runtime provider
   consumes it. A deployment can set `enforce` while connecting with an owner,
   superuser, or `BYPASSRLS` role. The migrations and tenant context are present,
   but the startup boundary does not prove that the configured connection will
   apply them.
2. **P1 — Pool budget is not aggregate-aware.** API and worker validators each
   permit 15 connections, although the provider limit is shared. Replica count is
   also outside the repository's configuration model.
3. **P1 — HTTP hardening ownership is unverified.** The Nest bootstrap does not
   configure a CORS allowlist, security headers, or trusted-proxy policy. If an
   edge proxy is responsible, that policy is not reproducible or smoke-tested in
   this repository.
4. **P1 — Mail terminal failures are persisted but not alerted.** After retry
   exhaustion, `AuthMailService` records `failedAt` and logs safe metadata, but no
   metric, readiness degradation, or operator notification is emitted.
5. **P2 — Readiness deadlines do not cancel the underlying promise.** A timed-out
   Postgres or Redis probe can finish after the response has already reported
   failure. This is bounded but can waste a socket during an outage.

## D. Frontend, API contract, and workflows

- The web app has role-specific route trees for admin, manager, director,
  observer, prospector, platform, and authentication flows. Route presence does
  not prove live provider behavior; authenticated browser E2E was not available
  for this audit.
- Browser and BFF API helpers normalize status/code/message/requestId, but they
  currently discard optional structured error details. Several screens still
  contain page-local English fallback strings, so localization and support
  diagnostics are inconsistent.
- API validation uses Nest's `ValidationPipe` with whitelist and
  `forbidNonWhitelisted`; authorization remains server-side. No source use of
  `dangerouslySetInnerHTML` or bearer tokens in browser local storage was found.
- The invitation and password recovery flows depend on an externally configured
  `AUTH_PUBLIC_ORIGIN`; production link/DNS behavior cannot be proved from this
  checkout.

## E. Error-handling matrix

| Failure                    | Current behavior                                                       | Assessment                                                             |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Validation                 | 400 with stable status-derived/code or explicit code and message array | Usable; field-level details still need contract work                   |
| Authentication             | 401 sanitized response                                                 | Verified by existing auth tests                                        |
| Authorization/tenant scope | 403/404 according to resource policy                                   | Verified in integration suites previously run; fresh local DB is stale |
| Conflict/idempotency       | 409 or precondition response with request ID                           | Verified by unit/integration coverage                                  |
| Provider/mail outage       | Bounded retry and terminal outbox state                                | No operator alert                                                      |
| Unexpected exception       | 500 sanitized body, server log includes request ID                     | Header correlation was added by this audit                             |
| Network/BFF failure        | Web helpers produce typed `ApiError`                                   | Error details are not yet forwarded                                    |

## F. Verification

Completed for this audit change:

- API error-filter regression test: **1 passed**.
- API unit suite: **101 files, 791 tests passed**.
- API TypeScript check: **passed**.
- API Nest build: **passed**.
- Targeted ESLint and Prettier checks: **passed**.
- Migration integrity and the earlier API/worker pool/mail test evidence remain
  recorded in `docs/operations/PRODUCTION_AUDIT_2026-10-09.md`.

Blocked or not rerun in this checkout:

- Fresh API integration against the local database is blocked by migration drift:
  the running volume's journal stops before the repository migrations and lacks
  columns such as `campaign_prospect_assignments.manager_id`. This is an
  environment-verification blocker, not evidence that production has the same
  schema.
- Authenticated browser E2E, production DNS/provider checks, backup restore, and
  dependency-registry audit were not available.
- Root `pnpm` lint/typecheck wrappers previously hung in this environment; direct
  targeted checks completed successfully.

## G. Prioritized tickets

| ID      | Priority | Work                                                                                                                        | Why it affects the project                                                   |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| AUD-001 | P0       | Make `TENANT_RLS_MODE=enforce` a real startup check; query the connected role and fail closed for owner/SUPERUSER/BYPASSRLS | Without this, tenant isolation can silently depend on application predicates |
| AUD-002 | P0       | Rebuild a disposable integration database from all migrations and add a CI schema-drift check                               | Local drift currently prevents trustworthy end-to-end verification           |
| AUD-003 | P1       | Define an aggregate API+worker/replica pool budget and validate deployment values                                           | Prevents a recurrence of `EMAXCONNSESSION` under scale-out                   |
| AUD-004 | P1       | Add CORS, security-header, and trusted-proxy ownership plus smoke tests                                                     | Prevents browser boundary regressions at the edge/API boundary               |
| AUD-005 | P1       | Forward `details` through web API/BFF helpers and centralize localized error mapping                                        | Enables field errors, stable localization, and faster support diagnosis      |
| AUD-006 | P1       | Alert on terminal mail-outbox failures and expose a safe count in operations health                                         | Prevents silent invitation/password-reset delivery outages                   |
| AUD-007 | P1       | Make the map large-scope fixture deterministic within the CI budget                                                         | Keeps the release gate meaningful and repeatable                             |
| AUD-008 | P2       | Rehearse provider-backed backup restore and authenticated browser E2E                                                       | Required evidence for recovery and real-user readiness                       |

## H. Release verdict

**Verdict: NOT READY for an unconditional production release.** The codebase has
good unit/build coverage and the known pool/client/mail runtime defects have
targeted corrections, but the P0 RLS startup proof and fresh migration-backed
integration run are still required. Do not weaken RLS, authentication, tenant
transactions, or isolation to make the blocked local integration run pass.
