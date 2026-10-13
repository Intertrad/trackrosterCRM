# Worker and Redis audit

BullMQ producer has deterministic IDs, bounded retry/backoff, retention, and graceful close. Worker has concurrency 5, tenant context, retry-aware errors, lifecycle logging, and graceful shutdown.

| ID                                                                                                                                                                                        | Priority | Finding                                                                                     | Status       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- | ------------ |
| TR-AUD-019                                                                                                                                                                                | P1       | Hosted Redis topology, persistence, eviction, failover, and worker count are not evidenced. | NOT_VERIFIED |
| TR-AUD-020                                                                                                                                                                                | P2       | Queue lag, retry, dead-letter, and poison-job alerts are not evidenced.                     | NOT_VERIFIED |
| TR-AUD-021                                                                                                                                                                                | P2       | Shutdown and duplicate-delivery rehearsal is missing.                                       | NOT_VERIFIED |
| **Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified. |
