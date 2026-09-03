---

# `docs/decisions/ADR-002-postgresql-postgis.md`

```md
# ADR-002 — PostgreSQL and PostGIS

**Status:** Accepted  
**Date:** September 2026

## Context

TrackRoster requires:

- relational data;
- transactional reservations;
- assignments;
- immutable action history;
- reporting;
- territory management;
- proximity and mapping capabilities.

## Decision

PostgreSQL will be the primary transactional database.

PostGIS will provide geospatial capabilities.

## Reasons

PostgreSQL provides:

- ACID transactions;
- relational constraints;
- mature indexing;
- reliable concurrency controls;
- strong reporting support.

PostGIS supports:

- geographic territories;
- regions;
- proximity queries;
- map filtering;
- future routing capabilities.

## Consequences

Database schema and indexes require careful design.

Reservation concurrency must use PostgreSQL transaction and constraint
capabilities correctly.

Geospatial queries require PostGIS knowledge.

## Alternatives

MongoDB was not selected as the primary database because TrackRoster's core
domain is strongly relational and transactional.
```
