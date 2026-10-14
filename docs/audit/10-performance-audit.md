# Performance audit

| ID         | Priority | Finding                                                                               | Status         |
| ---------- | -------- | ------------------------------------------------------------------------------------- | -------------- |
| TR-AUD-026 | P1       | Full-request transactions consume bounded pool capacity while waiting on non-DB work. | CONFIRMED RISK |
| TR-AUD-027 | P1       | Search, map, dashboard, and report latency/error baselines are missing.               | NOT_VERIFIED   |
| TR-AUD-028 | P2       | Large-tenant query plans and indexes are not captured.                                | NOT_VERIFIED   |
| TR-AUD-029 | P2       | Authenticated web performance budgets and Core Web Vitals are not measured.           | NOT_VERIFIED   |

Measure p50/p95/p99 latency, errors, pool utilization, queue lag, and query plans before raising limits.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
