# TR-FIX-006 deployment topology evidence — 2026-10-13

The read-only topology probe was added as `check:deployment-topology`. It resolves
the configured web/API host, verifies the public TLS certificate, checks required
unauthenticated routes, and reads only the boolean password-recovery capability
from `/api/auth/config`. It never logs credentials, cookies, tokens, or response
bodies.

Command used against the public web host:

```text
TOPOLOGY_WEB_URL='https://www.trackroster.com' \
TOPOLOGY_API_URL='https://www.trackroster.com' \
TOPOLOGY_TIMEOUT_MS=3000 \
node scripts/check-deployment-topology.mjs
```

Observed results:

- DNS resolved `www.trackroster.com` to `216.198.79.1` and `64.29.17.1`.
- TLS was authorized for `www.trackroster.com`; the certificate was valid from
  2026-10-08 through 2027-01-06.
- `/login` and `/forgot-password` returned `200`.
- `/reset-password` returned `404`.
- `/api/auth/config` returned HTTP `200` with `passwordRecovery: false`.

This proves public DNS and TLS are healthy while the hosted application is serving
an older build than `dev-v2`. The reset page and capability fix are present in
`dev-v2` (`48cda85` and `6d5d8e4`), so production still needs the approved build
deployment. No production code, credentials, or infrastructure were changed.
The ticket remains partial until the deployment owner supplies the deployment
topology, API origin, and a post-deploy probe with `/reset-password` returning
`200` and `passwordRecovery: true`.
