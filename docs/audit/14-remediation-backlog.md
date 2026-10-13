# Remediation backlog

Implementation requires owner approval.

| Ticket     | Priority | Scope                                                          | Acceptance evidence                                                              |
| ---------- | -------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| TR-FIX-001 | P1       | Narrow tenant transaction scope.                               | Concurrent slow requests stay within pool budget; no shared-client `pg` warning. |
| TR-FIX-002 | P1       | Add collision/reservation concurrency tests and DB invariants. | No double booking or lost decision under repetition.                             |
| TR-FIX-003 | P1       | Runtime-certify all 340 routes.                                | Redacted role/tenant matrix; all 148 unverified routes dispositioned.            |
| TR-FIX-004 | P1       | Hosted RLS and cross-tenant negative probes.                   | Denied cross-tenant reads/writes and safe DB roles proven.                       |
| TR-FIX-005 | P1       | Backup/PITR/restore drill.                                     | Isolated restore with measured RPO/RTO and validation.                           |
| TR-FIX-006 | P1       | Verify topology, replicas, pooler, Redis, DNS, and TLS.        | Versioned deployment evidence and live health probes.                            |
| TR-FIX-007 | P1       | Authenticated browser E2E for every role and critical flow.    | Playwright artifacts for auth, invites, map, messaging, locale, errors.          |
| TR-FIX-008 | P2       | Provider sandbox/contract tests.                               | Mail, storage, maps, webhooks, signatures, replay, idempotency.                  |
| TR-FIX-009 | P2       | Pool/queue/mail/backup dashboards and alerts.                  | Staging fire drills linked to runbooks.                                          |
| TR-FIX-010 | P2       | Search/map/report performance baselines.                       | p50/p95/p99 budgets, load results, query-plan review.                            |
| TR-FIX-011 | P2       | Localization key/page parity checks.                           | CI fails on missing French/English strings.                                      |
| TR-FIX-012 | P2       | Redacted release evidence bundle and audit refresh.            | Versioned checklist links tests, probes, restore, dashboards, residual risks.    |

Recommended order: `TR-FIX-001`, `002`, and `004`; then `005` and `006`; then browser, provider, and performance evidence.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
