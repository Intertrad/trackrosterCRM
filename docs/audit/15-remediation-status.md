# Remediation implementation status

This status separates repository changes from checks that require hosted infrastructure or provider credentials. The implementation is on `dev-v2`; `main` and production were not changed.

| Ticket     | Repository work                                                                                                                                                       | Status                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TR-FIX-001 | Existing bounded pools, transaction limits, and readiness pool metrics retained; full request-wide transaction redesign still needs a safe endpoint-by-endpoint plan. | PARTIAL — hosted load test required                      |
| TR-FIX-002 | Existing assignment/collision transaction tests retained.                                                                                                             | PARTIAL — repeated concurrent database run required      |
| TR-FIX-003 | Added `check:api-routes`; rejects malformed or duplicate route inventory and reports verified/unverified counts.                                                      | IMPLEMENTED — 148 runtime probes remain                  |
| TR-FIX-004 | Existing RLS startup guard and policies retained.                                                                                                                     | PARTIAL — hosted cross-tenant probes required            |
| TR-FIX-005 | Existing migration recovery and backup verification scripts retained.                                                                                                 | PARTIAL — real restore/RPO/RTO drill required            |
| TR-FIX-006 | Existing bounded pool-budget validation retained.                                                                                                                     | BLOCKED — deployment topology, DNS, and TLS are external |
| TR-FIX-007 | Existing unit/integration coverage retained.                                                                                                                          | BLOCKED — authenticated browser environment required     |
| TR-FIX-008 | Existing provider adapters and retry paths retained.                                                                                                                  | BLOCKED — provider sandbox credentials required          |
| TR-FIX-009 | Readiness now exposes pool utilization and logs waiting clients; CI release-evidence gate added.                                                                      | IMPLEMENTED — deploy dashboards/alerts required          |
| TR-FIX-010 | Added `check:performance-budgets` with explicit API/web/error/queue budgets.                                                                                          | IMPLEMENTED — representative load baseline required      |
| TR-FIX-011 | Added `check:localization`; it verifies every dictionary entry has English and French values.                                                                         | IMPLEMENTED                                              |
| TR-FIX-012 | Added `check:release-evidence`; it verifies reports 00–14 and tickets TR-FIX-001..012.                                                                                | IMPLEMENTED                                              |

## Verification commands

```text
node scripts/check-localization-parity.mjs
node scripts/check-api-route-ledger.mjs
node scripts/check-release-evidence.mjs
node scripts/check-performance-budgets.mjs
```

All four commands pass locally. The release verdict remains gated until the hosted and provider-dependent items marked `PARTIAL` or `BLOCKED` have evidence.
