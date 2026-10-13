# TR-FIX-003 route matrix evidence — 2026-10-13

`docs/backend/ROUTE_RUNTIME_MATRIX.json` is generated from the controller route
inventory and `ROUTE_RUNTIME_DISPOSITION_RULES.json`. It contains all 340 unique
method/path pairs and only redacted fixture metadata:

- 192 routes carry static source/integration evidence.
- 148 routes are marked `runtime-pending`.
- Every pending route maps to exactly one of six disposition rules.
- No credentials, tenant IDs, tokens, or provider payloads are included.

`node scripts/check-api-route-matrix.mjs` passed after generation. A hosted
role/tenant probe is still required before the 148 pending routes can be certified.
