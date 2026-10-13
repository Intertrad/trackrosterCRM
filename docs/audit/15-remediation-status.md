# Remediation implementation status

This status separates repository changes from checks that require hosted infrastructure or provider credentials. The implementation is on `dev-v2`; `main` and production were not changed.

| Ticket     | Repository work                                                                                                                                                                                                                             | Status                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| TR-FIX-001 | Existing bounded pools, transaction limits, readiness metrics, and the isolated concurrent probe are retained; 20 concurrent requests stayed within a pool of 4 and emitted no shared-client `pg` warning.                                  | PARTIAL — hosted load test and endpoint-wide transaction timing required                    |
| TR-FIX-002 | The clean disposable-stack integration run passed API 58 files / 613 tests and worker 4 files / 12 tests; focused collision, reservation, and assignment suites passed 54 tests on each of three repetitions.                               | PARTIAL — hosted-scale contention run required                                              |
| TR-FIX-003 | Added `check:api-routes`, explicit disposition rules, and a checked-in redacted matrix for all 340 routes; each pending route names its required fixture or external dependency.                                                            | PARTIAL — 148 runtime probes remain                                                         |
| TR-FIX-004 | RLS and background-sweep coverage passed 6 tests on each of three repetitions under the restricted runtime role; tenant context remains enforced in the isolated database.                                                                  | PARTIAL — hosted cross-tenant probes required                                               |
| TR-FIX-005 | Existing migration recovery and backup verification scripts retained; two version-matched local backup/restore rehearsals passed with 1,034 archive entries, 95 restored tables, and the latest measured restore duration of 2.348 seconds. | PARTIAL — production scheduling, off-account retention, and agreed RPO/RTO remain required  |
| TR-FIX-006 | Added a read-only deployment topology probe for DNS, TLS, required public routes, and the password-recovery capability flag. Public DNS/TLS passed; the production host still serves the pre-fix build.                                     | PARTIAL — approved deployment, API origin, and hosted post-deploy probe remain required     |
| TR-FIX-007 | Existing unit/integration coverage retained.                                                                                                                                                                                                | BLOCKED — authenticated browser environment required                                        |
| TR-FIX-008 | Worker now accepts canonical `OBJECT_STORAGE_*` settings with legacy aliases; unit coverage plus the repeatable local S3/Mailpit contract probe are green.                                                                                  | PARTIAL — hosted Brevo, object-storage, SSO, maps, and webhook sandbox credentials required |
| TR-FIX-009 | Readiness exposes pool utilization, waiting clients, BullMQ queue counts, and terminal mail failures; request IDs, a redacted alert contract, and fire-drill runbook are checked in.                                                        | PARTIAL — deploy dashboards, alert receipts, and staging fire drills required               |
| TR-FIX-010 | Added `check:performance-budgets` plus `performance:baseline`, a redacted p50/p95/p99 HTTP probe with concurrency, timeout, error-rate, and per-endpoint output; the harness smoke test passed.                                             | PARTIAL — authenticated staging baseline and query-plan review required                     |
| TR-FIX-011 | Added `check:localization`; it verifies every dictionary entry has English and French values.                                                                                                                                               | IMPLEMENTED                                                                                 |
| TR-FIX-012 | Added `check:release-evidence`; it verifies reports 00–14 and tickets TR-FIX-001..012.                                                                                                                                                      | IMPLEMENTED                                                                                 |

## Verification commands

```text
node scripts/check-localization-parity.mjs
node scripts/check-api-route-ledger.mjs
node scripts/check-api-route-dispositions.mjs
node scripts/check-api-route-matrix.mjs
node scripts/check-database-pool-concurrency.mjs
node scripts/check-release-evidence.mjs
node scripts/check-performance-budgets.mjs
# Requires explicit disposable-stack PROVIDER_* variables:
node scripts/check-local-provider-contracts.mjs
```

The listed local verification commands pass when run against the disposable stack with its explicit database URL. The release verdict remains gated until the hosted and provider-dependent items marked `PARTIAL` or `BLOCKED` have evidence.

The clean disposable-stack integration run passed API 58 files / 613 tests and worker 4 files / 12 tests (two provider tests remain intentionally skipped without hosted credentials). Repeated local integration runs must reset `docker-compose.backend-test.yml` first so fixture state cannot leak between runs. Detailed pool, RLS, integration, backup, restore, and password-recovery deployment evidence is in [TR-FIX-001-002-004-005-2026-10-13.md](evidence/TR-FIX-001-002-004-005-2026-10-13.md). The latest GitHub Actions run passed migrations, schema verification, lint, formatting, typecheck, unit tests, database/Redis integration tests, and the production build: [run 38391141107](https://github.com/Intertrad/trackrosterCRM/actions/runs/38391141107).

The performance harness verification is in [TR-FIX-010-performance-baseline-2026-10-13.md](evidence/TR-FIX-010-performance-baseline-2026-10-13.md).

The local provider contract probe is documented by `check:provider-contracts`; it requires explicit disposable-stack endpoint and credential variables and never logs their values.

The route matrix is checked by `check:api-route-matrix` and stored in [ROUTE_RUNTIME_MATRIX.json](../backend/ROUTE_RUNTIME_MATRIX.json); it is a fixture plan, not a claim that the pending routes ran in production.

The repeated contention evidence is in [TR-FIX-002-contention-2026-10-13.md](evidence/TR-FIX-002-contention-2026-10-13.md).

The observability contract evidence is in [TR-FIX-009-observability-contract-2026-10-13.md](evidence/TR-FIX-009-observability-contract-2026-10-13.md).

The repeated RLS evidence is in [TR-FIX-004-rls-2026-10-13.md](evidence/TR-FIX-004-rls-2026-10-13.md).

The repeated backup/restore evidence is in [TR-FIX-005-backup-2026-10-13.md](evidence/TR-FIX-005-backup-2026-10-13.md).

The DNS/TLS and production forgot-password evidence is in
[TR-FIX-006-topology-2026-10-13.md](evidence/TR-FIX-006-topology-2026-10-13.md).
