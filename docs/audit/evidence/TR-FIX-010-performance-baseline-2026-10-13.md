# TR-FIX-010 performance baseline harness — 2026-10-13

`scripts/run-performance-baseline.mjs` is the repeatable local/staging probe for
search, map, dashboard, report, or health endpoints. It records p50, p95, p99,
HTTP errors, timeout errors, concurrency, and per-endpoint results. The optional
`PERF_AUTHORIZATION` value is sent as a request header and is never printed or
written to the artifact.

Example:

```text
PERF_BASE_URL=https://staging.example \
PERF_ENDPOINTS='/health/ready,/api/search,/api/reports/overview' \
PERF_REQUESTS=300 PERF_CONCURRENCY=20 PERF_OUTPUT=artifacts/perf.json \
node scripts/run-performance-baseline.mjs
```

The command exits non-zero when p95 or error rate exceeds the configured budget.
The base URL is redacted to origin and path in the JSON output.

## Harness verification

On 2026-10-13, a disposable loopback HTTP server was exercised with 20 requests
at concurrency 4 across two endpoints. The harness completed with zero errors:

```json
{
  "requests": 20,
  "concurrency": 4,
  "errors": 0,
  "errorRatePercent": 0,
  "p50Ms": 1.57,
  "p95Ms": 9.25,
  "p99Ms": 19.79
}
```

This proves the probe and budget enforcement path. A representative authenticated
staging run and query-plan captures for search, map, and report workloads are still
required before TR-FIX-010 can be marked complete.

## Public unauthenticated smoke

On 2026-10-13, the same probe sent 20 read-only requests to the public production
login pages (10 requests per endpoint, concurrency 4):

```text
PERF_BASE_URL='https://www.trackroster.com' \
PERF_ENDPOINTS='/login,/forgot-password' \
PERF_REQUESTS=20 PERF_CONCURRENCY=4 PERF_TIMEOUT_MS=5000 \
node scripts/run-performance-baseline.mjs
```

The run returned zero errors, with aggregate p50 `127.95 ms`, p95 `227.13 ms`,
and p99 `229.07 ms`. This is an unauthenticated edge smoke only; it does not
replace the authenticated staging search/map/report baseline or query-plan review.
