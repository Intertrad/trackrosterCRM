# Remediation implementation status

This status separates repository changes from checks that require hosted infrastructure or provider credentials. The implementation is on `dev-v2`; `main` and production were not changed.

| Ticket     | Repository work                                                                                                                                                                  | Status                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| TR-FIX-001 | Existing bounded pools, transaction limits, readiness metrics, and a concurrent pool probe are retained; the probe stays within its configured max and exercises the wait queue. | PARTIAL — hosted load test and endpoint-wide transaction timing required                            |
| TR-FIX-002 | Assignment/collision transaction suites passed twice against the isolated runtime role (3 files, 37 tests per run); existing uniqueness constraints remain enforced.             | PARTIAL — hosted-scale contention run required                                                      |
| TR-FIX-003 | Added `check:api-routes` plus explicit disposition rules for every pending route; each route now names its required fixture or external dependency.                              | IMPLEMENTED — 148 runtime probes remain                                                             |
| TR-FIX-004 | RLS and background-sweep probes passed against the restricted runtime role (2 files, 6 tests); tenant context remains enforced in the isolated database.                         | PARTIAL — hosted cross-tenant probes required                                                       |
| TR-FIX-005 | Existing migration recovery and backup verification scripts retained; a version-matched local backup and isolated restore rehearsal passed on 2026-10-13.                        | PARTIAL — production scheduling, off-account retention, and agreed RPO/RTO remain required          |
| TR-FIX-006 | Existing bounded pool-budget validation retained.                                                                                                                                | BLOCKED — deployment topology, DNS, and TLS are external                                            |
| TR-FIX-007 | Existing unit/integration coverage retained.                                                                                                                                     | BLOCKED — authenticated browser environment required                                                |
| TR-FIX-008 | Worker now accepts canonical `OBJECT_STORAGE_*` settings with legacy aliases; storage unit coverage is green, and local PostgreSQL/Redis infrastructure probes pass.             | BLOCKED — Brevo, object-storage, SSO, maps, and webhook sandbox credentials required                |
| TR-FIX-009 | Readiness now exposes pool utilization and logs waiting clients; CI release-evidence gate added.                                                                                 | IMPLEMENTED — deploy dashboards/alerts required                                                     |
| TR-FIX-010 | Added `check:performance-budgets` with explicit API/web/error/queue budgets and a tenant-scoped GiST index for large map viewport preflights.                                    | IMPLEMENTED — CI integration suite and production build pass; representative load baseline required |
| TR-FIX-011 | Added `check:localization`; it verifies every dictionary entry has English and French values.                                                                                    | IMPLEMENTED                                                                                         |
| TR-FIX-012 | Added `check:release-evidence`; it verifies reports 00–14 and tickets TR-FIX-001..012.                                                                                           | IMPLEMENTED                                                                                         |

## Verification commands

```text
node scripts/check-localization-parity.mjs
node scripts/check-api-route-ledger.mjs
node scripts/check-api-route-dispositions.mjs
node scripts/check-database-pool-concurrency.mjs
node scripts/check-release-evidence.mjs
node scripts/check-performance-budgets.mjs
```

All four commands pass locally. The release verdict remains gated until the hosted and provider-dependent items marked `PARTIAL` or `BLOCKED` have evidence.

The post-index CI run passed all release gates, including migrations, schema verification, lint, formatting, typecheck, unit tests, database/Redis integration tests, and the production build: [run 38381104470](https://github.com/Intertrad/trackrosterCRM/actions/runs/38381104470).
