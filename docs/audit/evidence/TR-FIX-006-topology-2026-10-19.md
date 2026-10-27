# TR-FIX-006 deployment topology evidence — 2026-10-19

The read-only topology probe resolves the configured web/API host, verifies the
public TLS certificate, checks the required unauthenticated routes, and reads the
password-recovery capability from `/api/auth/config`. It never logs credentials,
cookies, tokens, or response bodies.

Command used against the canonical production host:

```text
TOPOLOGY_WEB_URL='https://www.trackroster.com' \
TOPOLOGY_API_URL='https://www.trackroster.com' \
TOPOLOGY_TIMEOUT_MS=5000 \
node scripts/check-deployment-topology.mjs
```

Observed results:

- DNS resolved `www.trackroster.com` to `64.29.17.65` and `216.198.79.65`.
- TLS was authorized for `www.trackroster.com`; the certificate is valid from
  2026-10-08 through 2027-01-06.
- `/login`, `/forgot-password`, `/reset-password`, and `/api/health/ready`
  returned `200`.
- `/api/health/ready` reported Postgres and Redis up, email configured and healthy,
  and the job queue healthy.
- `/api/auth/config` returned HTTP `200` with `passwordRecovery: true`.
- `https://trackroster.com` redirects to the canonical `www` host.

TR-FIX-006 is complete for the public topology and password-recovery capability.
The remaining deployment-owner evidence is limited to internal replica/pooler
counts and operational dashboards, which cannot be verified through public routes.
