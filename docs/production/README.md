# Production Readiness

> **2026-09-22 implementation update:** Native membership authentication and operational actor references, personal account APIs, workspace administration, notification extensions, session audit and authentication throttling have been added. Migrations 0026–0028 were verified on an isolated database; deployment to the existing database remains separate. See [the current backend implementation ledger](../backend/IMPLEMENTATION_STATUS.md). The dated baseline below is retained as historical evidence. Full backend completion and production readiness remain pending.

This directory records the evidence required to decide whether TrackRoster can be
released with real customer and prospect data.

It separates three questions that must not be confused:

1. **Is the implemented code internally consistent?**
2. **Does it cover the agreed product capability?**
3. **Has it satisfied the security and operational gates for production?**

Passing unit tests answers only the first question.

## Current decision

As of 2026-09-21:

- synthetic-data demonstration: **ready**;
- controlled internal pilot: **conditional**;
- production launch with real data: **no-go**;
- external multi-tenant SaaS launch: **no-go**.

The main reason is not UI completeness. Database-enforced tenant isolation,
authentication hardening, dependency-aware readiness, observability, recovery evidence,
privacy workflows, and several MVP business flows remain incomplete.

## Verified implementation baseline

The baseline was verified from the repository snapshot created at
`2026-09-21 11:41:52` local project time.

| Evidence               | Result                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| Drizzle schema tables  | 23 (including four additive identity-and-access tables)                    |
| Migration SQL files    | 26 (`0000` through `0025`)                                                 |
| Migration snapshots    | 26, one contiguous chain                                                   |
| Nest controllers       | 25                                                                         |
| HTTP operations        | 62                                                                         |
| API unit test files    | 69                                                                         |
| API unit tests         | 624 passed                                                                 |
| Web unit test files    | 27                                                                         |
| Web unit tests         | 236 passed                                                                 |
| Worker unit test files | 9                                                                          |
| Worker unit tests      | 57 passed                                                                  |
| Shared jobs tests      | 4 passed                                                                   |
| Identity Phase A       | Applied and reconciled; 10 focused database integration tests passed       |
| Identity Phase B       | Compatible identity-backed v2 session cutover prepared in migration `0025` |
| Typecheck              | API, web, worker, and jobs passed                                          |
| Lint                   | Passed                                                                     |
| Production builds      | API, web, worker, and jobs passed                                          |
| Formatting gate        | **Failed:** 63 existing/generated files need Prettier formatting           |
| Integration tests      | Phase A full API suite passed; Phase B full rerun remains required         |

Expected error logs emitted by negative-path idempotency and queue tests do not represent
test failures.

The API, web, worker, and shared-job unit totals include the Phase B code. Migration
execution, database integration, reconciliation, and forced-relogin verification are
still required in a production-like environment by the Phase B runbook before release
approval.

## Documents

- [Schema source of truth](./SCHEMA_SOURCE_OF_TRUTH.md)
- [Implemented API inventory](./API_INVENTORY.md)
- [Product/backend coverage and release gates](./PRODUCT_BACKEND_COVERAGE.md)
- [Identity and access migration plan](./IDENTITY_ACCESS_MIGRATION_PLAN.md)
- [Identity Phase A deployment runbook](./IDENTITY_PHASE_A_RUNBOOK.md)
- [Identity Phase B deployment runbook](./IDENTITY_PHASE_B_RUNBOOK.md)
- [Identity, tenant membership, and support-access decision](../decisions/ADR-005-identity-tenancy-and-support-access.md)

## Release rule

TrackRoster may move from one release level to the next only when every required gate has:

- an implemented control;
- an automated test;
- operational evidence from a production-like environment;
- a named owner;
- no unresolved P0 defect.

# Production readiness

TrackRoster has a broad, tested backend surface, but a verified route is not the same
as production certification. Production launch requires live PostgreSQL/Redis/R2/Brevo
integration tests, restricted database roles, row-level security validation, backup
restore testing, load testing, provider key provisioning, and monitoring.

Use [API_INVENTORY.md](API_INVENTORY.md) for frontend integration status and
[PRODUCT_BACKEND_COVERAGE.md](PRODUCT_BACKEND_COVERAGE.md) for domain coverage.
