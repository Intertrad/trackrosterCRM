# TrackRoster Deployment

**Status:** Initial Draft

This document will evolve when staging and production infrastructure are
selected.

## Initial Deployment Units

TrackRoster contains:

```text
apps/web       Next.js
apps/api       NestJS
apps/worker    background processing
PostgreSQL
Redis
```

## Identity Phase B cutover

Migration `0025` and the v2 authentication runtime require a coordinated maintenance
window. Follow the
[Identity Phase B deployment runbook](../production/IDENTITY_PHASE_B_RUNBOOK.md); do not
perform a rolling deployment across v1 and v2 API instances.

Before the cutover, generate independent high-entropy values for
`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in the deployment secret manager. Stop and
drain the old API fleet, apply and verify the database migration, install the rotated
secrets only on the Phase B fleet, and require every user to sign in again. Never commit,
log, or copy the values into release evidence.

The Phase B verifier pins:

- algorithm `HS256`;
- key ID `tenant-hs256-v2`;
- issuer `trackroster-api`;
- access audience `trackroster-tenant-access`;
- refresh audience `trackroster-tenant-refresh`.

Changing any of those constants is a token-generation cutover and must be deployed as a
coherent fleet with forced session invalidation. Rollback also requires maintenance mode,
session revocation, and signing-secret rotation because the pre-Phase-B access guard did
not consult persisted session state.
