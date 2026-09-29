# ADR-003 — Multi-Tenancy

**Status:** Accepted  
**Date:** September 2026

## Context

TrackRoster begins with an internal group deployment but is intended to support
future SaaS commercialization.

Tenant isolation must therefore be part of the architecture from the beginning.

## Decision

TrackRoster will explicitly model tenants.

Tenant context must be established before tenant-owned operations execute.

## Rules

Tenant-owned data must always be scoped.

Examples include:

```text
prospects
campaigns
assignments
reservations
actions
follow-ups
users
reports
exports
```

Global credential identity, tenant membership, platform authorization, and support access
are defined separately by
[ADR-005](./ADR-005-identity-tenancy-and-support-access.md). The word `users` in the
examples above refers to tenant membership/persona data, not global credentials.
