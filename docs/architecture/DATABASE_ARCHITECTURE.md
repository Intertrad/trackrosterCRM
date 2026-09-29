# TrackRoster Database Architecture

**Status:** Implemented tenant/RLS architecture; production certification pending (updated 2026-09-29)

This document describes the implemented database model and clearly separates it from
production controls and their certification state. The schema and migrations are the source
of truth; examples in this document must not be treated as migration instructions.

## Primary Database

TrackRoster uses PostgreSQL as the authoritative transactional data store.

PostGIS provides geospatial functionality.

Redis is used for queues, reservations, throttling, and short-lived coordination. It
is not an authoritative data store. Cloudflare R2 stores generated artifacts and
attachments; PostgreSQL stores their object keys, ownership, expiry, and audit state.

## Implemented controls

- Tenant identifiers are carried through domain tables and repository queries.
- Foreign keys and check constraints protect lifecycle invariants.
- Audit tables retain administrative and operational evidence.
- Migration files under `database/migrations` are applied in order.
- R2 object metadata is persisted after worker generation.
- Runtime API access uses the restricted `trackroster_app` role and request/worker tenant
  context before tenant-owned queries execute.
- Migrations `0071`–`0073` define tenant policies and `FORCE ROW LEVEL SECURITY` for
  tenant-bearing tables.

## Pending production controls

- Live restricted-role and cross-tenant regression certification must be repeated for
  every deployment environment.
- API/worker runtime credentials must remain separate from migration and seed credentials.
- A production backup, restore, and failover certification is still required.
- Retention and deletion automation requires final policy approval.

## Core Domains

### Organization

```text
tenants
organizations
teams
users
```
