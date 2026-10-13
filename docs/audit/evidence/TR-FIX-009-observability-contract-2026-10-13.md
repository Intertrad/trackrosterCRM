# TR-FIX-009 observability contract evidence — 2026-10-13

Repository evidence is present in:

- `apps/api/src/health/readiness.controller.ts` for bounded Postgres/Redis
  readiness, pool utilization, waiting clients, and terminal mail failures.
- `apps/api/src/errors/api-exception.filter.ts` for sanitized errors and
  `x-request-id` propagation.
- `docs/operations/OBSERVABILITY_ALERTS.md` for thresholds and fire drills.
- `apps/api/src/health/readiness.controller.spec.ts` for healthy, degraded-mail,
  dependency-failure, and timeout behavior.

The local readiness unit suite and integration suite passed on 2026-10-13. A
deployment dashboard, alert receipt, and staging fire-drill artifact are still
required before this ticket can be marked complete.
