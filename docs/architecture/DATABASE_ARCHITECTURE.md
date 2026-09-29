# TrackRoster Database Architecture

**Status:** Partially implemented; production certification pending (updated 2026-09-23)

This document describes the implemented database model and clearly separates it from
production controls that are not yet enabled. The schema and migrations are the source
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

## Pending production controls

- Database row-level security policies are not yet enforced for runtime credentials.
- API and worker credentials are not yet separated from migration credentials.
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
