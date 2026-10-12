# TrackRoster Deployment

**Status:** Initial Draft

This document will evolve when staging and production infrastructure are
selected.

## Production preflight

Run `NODE_ENV=production pnpm check:production-config` in the deployment
environment before starting the web or API process. The preflight validates
that `trackroster.com`/`www.trackroster.com` are used over HTTPS, the API URL,
database and Redis endpoints are secure, CORS contains explicit HTTPS origins,
JWT/MFA secrets are present, Brevo mail delivery is configured, and local-only
development settings are absent. It prints configuration errors only; it never
prints secret values.

The deployment owner must also verify the DNS records for the chosen canonical
web host, the TLS certificate, the API origin's certificate and health route,
Brevo sender-domain authentication, object-storage bucket permissions, Redis
TLS reachability, database backups, and the provider's rollback target. Record
the DNS/TLS/provider evidence with the release; a passing local preflight does
not prove that the external services are reachable.

## Runtime provider and alert checks

The worker's Brevo, push, and geocoding calls have a five-second timeout so a
provider outage cannot occupy a worker slot indefinitely. Webhook and OAuth
calls use the same bounded-request rule. Production monitoring should alert on
`/health/ready` failures, `dependencies.redis=down`, `dependencies.postgres=down`,
non-zero `optional.emailDelivery.terminalFailures`, queue backlog/lag, and
dead-letter counts. Keep the response body free of credentials and message
payloads when exporting it to monitoring.

At release time, capture one successful `/health/live` response and one
`/health/ready` response with their request IDs, then perform a controlled mail
provider failure and confirm that the outbox retry/dead-letter alert fires.

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
