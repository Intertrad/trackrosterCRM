# TrackRoster observability and alert contract

This is the redacted alert contract for API, worker, mail, queue, and backup
monitoring. It describes what a deployment must wire to its dashboard; it does
not contain credentials, tenant identifiers, message bodies, or provider payloads.

## Signals

Poll `/health/live` for process liveness and `/health/ready` for dependency
readiness. Preserve the response `x-request-id` in the monitor event. The ready
payload exposes PostgreSQL and Redis status, pool totals/idle/waiting/max,
estimated aggregate pool usage, and optional email-delivery terminal failures.

Workers must export queue lag and dead-letter counts from the queue provider.
Backup automation must export the age and result of the last verified archive and
restore rehearsal. These values belong in deployment telemetry, not application
request logs.

## Alert thresholds

| Alert                 | Condition                                               | Hold time       | First action                                                                 |
| --------------------- | ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| API liveness          | `/health/live` is not 2xx                               | 2 failed checks | Inspect API process and deployment health                                    |
| Dependency readiness  | `/health/ready` is not 2xx, or Postgres/Redis is `down` | 2 minutes       | Check dependency connectivity and rollback status                            |
| Pool pressure         | `waiting > 0` or utilization `>= 0.80`                  | 2 minutes       | Inspect slow transactions and request rate; do not raise pool limits blindly |
| Mail terminal failure | `optional.emailDelivery.terminalFailures > 0`           | 1 check         | Inspect provider status and outbox runbook                                   |
| Queue lag             | lag exceeds 60 seconds                                  | 5 minutes       | Inspect worker health and provider latency                                   |
| Dead letters          | dead-letter count increases                             | 1 check         | Inspect the job payload class and retry policy without replaying secrets     |
| Backup age            | no verified archive inside the agreed RPO               | 1 check         | Stop release promotion and run the restore runbook                           |

## Fire drills

In staging, stop or deny the mail provider and verify bounded retries, a terminal
outbox state, readiness degradation, and the mail alert. Saturate a disposable
pool with slow requests and verify the pool-pressure alert without changing the
configured limit. Pause a worker and verify queue-lag/dead-letter alerts. Restore
the latest disposable backup and record restore duration and row-count checks.

Every drill records UTC time, deployment revision, redacted request IDs, alert
receipt, operator, and result. Production credentials and customer data never
belong in the evidence bundle.
