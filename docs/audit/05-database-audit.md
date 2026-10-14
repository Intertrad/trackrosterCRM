# Database and connection audit

API creates one bounded pool (`database.provider.ts`, default max 8, range 1–15); worker creates one pool and releases transaction clients in `finally`; aggregate budget defaults API 8 + worker 4 across one replica each. Environment validation bounds URLs, pool, Redis, JWT, RLS, and budget.

| ID         | Priority | Finding                                                                         | Status         |
| ---------- | -------- | ------------------------------------------------------------------------------- | -------------- |
| TR-AUD-015 | P1       | Request-wide transaction scope can starve the bounded pool under slow handlers. | CONFIRMED RISK |
| TR-AUD-016 | P1       | Hosted replicas and total pool connections are unknown from source.             | NOT_VERIFIED   |
| TR-AUD-017 | P2       | Idle-in-transaction and pool saturation dashboard/alerts are not evidenced.     | NOT_VERIFIED   |
| TR-AUD-018 | P2       | Collision/reservation invariants need concurrent database tests.                | NOT_VERIFIED   |

Migration integrity and recovery checks pass for all 94 migrations. Do not increase connection limits without measuring utilization.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
