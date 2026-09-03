---

# `docs/decisions/ADR-001-modular-monolith.md`

````md
# ADR-001 — Modular Monolith

**Status:** Accepted  
**Date:** September 2026

## Context

TrackRoster includes tightly related business capabilities including:

- authentication;
- multi-tenancy;
- prospects;
- campaigns;
- assignments;
- reservations;
- anti-collision;
- actions;
- follow-ups;
- reporting;
- audit.

The MVP does not require independently deployed microservices.

## Decision

The TrackRoster backend will initially be implemented as a NestJS modular
monolith.

Each business capability will exist as an explicit domain module.

Examples:

```text
auth
tenants
users
prospects
campaigns
assignments
reservations
collision
actions
follow-ups
audit
```
````
