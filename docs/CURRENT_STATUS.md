# Current development status

**Snapshot:** 2026-09-29 · **Branch:** `main`

This is the current development baseline for TrackRoster. Detailed contracts and
historical audits remain useful, but dated status claims must be read against this
page and the source code/migrations.

## What is currently available

- The API, web application, worker, database migrations, and operational tooling are
  present in the repository.
- The static controller inventory contains **335 declared HTTP operations**. The
  acceptance ledger contains **381 product-contract operations**: 192 verified, 0
  partial, and 189 awaiting contract verification. A pending ledger item may have
  related implementation; it is not automatically a missing route.
- Tenant RLS policies, request/worker tenant context, the restricted
  `trackroster_app` runtime role, and `FORCE ROW LEVEL SECURITY` migrations are in
  the codebase. Production certification still requires the live restricted-role,
  cross-tenant, worker, load, and recovery evidence described in the hardening docs.
- The synthetic development seed remains the supported local setup:
  `pnpm --filter api db:seed` with local `DEV_ADMIN_PASSWORD` and `DEV_ROLE_PASSWORD`.
- The local development tenant currently contains the imported French prospect base:
  **14,649 establishments and 3,492 contacts** across seven committed import jobs.
  Those records are database data and are intentionally absent from Git.
- The web V2 workspaces and frontend/API handoff are in the repository. Run the web
  build before starting `next start`; `next start` requires a prior production build.

## What is not a production release claim

The local import proves the import workflow and data shape, not production readiness.
Before using real customer data in production, complete the live PostgreSQL/Redis/R2/
Brevo checks, provider key provisioning, backup restore rehearsal, load testing,
cross-tenant API matrix, worker delivery certification, and deployment runbook.

## Source-of-truth order

1. Running source code and committed migrations.
2. This current-status page for the development snapshot.
3. [Backend implementation status](backend/IMPLEMENTATION_STATUS.md) and
   [remaining work](TRACKROSTER_REMAINING_WORK.md) for feature and release gates.
4. Dated audits, ADRs, and design documents as historical evidence.

## Operational references

- [Secure data lifecycle and imports](operations/DATA_LIFECYCLE.md)
- [Prospect data load](operations/PROSPECT_DATA_LOAD.md)
- [Backend hardening](backend/BACKEND_HARDENING.md)
- [Frontend API handoff](backend/FRONTEND_API_HANDOFF.md)
- [API inventory](production/API_INVENTORY.md)
