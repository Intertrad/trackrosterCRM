# TR-FIX-009 queue health evidence — 2026-10-13

`GET /health/ready` now includes aggregate BullMQ metadata for the API producer
queue: `waiting`, `active`, `delayed`, and `failed` counts. The health method asks
BullMQ for counts only; it never serializes job payloads, tenant identifiers, or
credentials. A failed queue metadata query makes readiness fail closed while the
existing Redis probe remains in place.

The focused API tests passed:

```text
Test Files  3 passed (3)
Tests       6 passed (6)
```

This closes the application-side telemetry gap. Deployment dashboards, alert
receipts, worker queue lag, dead-letter monitoring, and staging fire-drill
evidence remain required before TR-FIX-009 can be marked complete.
