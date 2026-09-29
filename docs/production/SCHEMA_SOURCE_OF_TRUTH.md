# Schema Source of Truth

> **Current snapshot — 2026-09-29:** Tenant policies, restricted runtime credentials,
> request/worker tenant context, and the force-RLS migration are present in the current
> migration chain. Live deployment certification remains operational work.

> **2026-09-22 implementation update:** Native membership authentication and operational actor references, personal account APIs, workspace administration, notification extensions, session audit and authentication throttling have been added. Migrations 0026–0028 were verified on an isolated database; deployment to the existing database remains separate. See [the current backend implementation ledger](../backend/IMPLEMENTATION_STATUS.md). The dated baseline below is retained as historical evidence. Full backend completion and production readiness remain pending.

**Decision:** The TrackRoster Drizzle schema and its generated, reviewed migrations are
the authoritative database definition.

The standalone 58-table product architecture SQL is reference material. It must not be
executed against a TrackRoster environment and must not replace the implemented schema.
It describes useful future domains, but it conflicts with the deployed naming, role,
lifecycle, tenant-integrity, and migration model.

## Authoritative artifacts

| Purpose                         | Authoritative location                     |
| ------------------------------- | ------------------------------------------ |
| Desired application schema      | `apps/api/src/database/schema/*.ts`        |
| Forward-only deployment history | `database/migrations/*.sql`                |
| Drizzle migration journal       | `database/migrations/meta/_journal.json`   |
| Drizzle schema snapshots        | `database/migrations/meta/*_snapshot.json` |
| Database configuration          | `apps/api/drizzle.config.ts`               |

The TypeScript schema describes the desired state. The SQL migration chain describes how
an existing environment reaches that state. Both are required and must remain consistent.

## Current state

The migration chain contains 26 entries:

- `0000_enable-postgis.sql`;
- generated and reviewed migrations `0001` through `0025`;
- one matching snapshot per migration;
- contiguous snapshot `prevId` links;
- PostgreSQL dialect and Drizzle metadata version `7` throughout.

The current schema contains 23 tables:

1. `audit_events`
2. `auth_sessions`
3. `campaign_prospect_assignments`
4. `campaign_prospects`
5. `campaigns`
6. `collision_overrides`
7. `establishment_contacts`
8. `establishments`
9. `identities`
10. `idempotency_records`
11. `notifications`
12. `organization_coordination_policies`
13. `organizations`
14. `platform_access_grants`
15. `prospect_activities`
16. `prospect_follow_ups`
17. `regions`
18. `support_access_grants`
19. `teams`
20. `tenant_memberships`
21. `tenants`
22. `user_access_grants`
23. `users`

The final `0025` snapshot contains 30 enums, 264 columns, 89 indexes (including two
spatial GiST indexes), 66 foreign keys, 29 unique constraints, and 58 check constraints.
An isolated `drizzle-kit generate` check reported no schema changes, so the TypeScript
schema and migration metadata are aligned in this snapshot.

Migration `0024` is the additive Phase A of ADR-005. Migration `0025` binds every
authentication session to an exact identity, membership, tenant, and absolute expiration.
It adds state-change revocation triggers, revokes every pre-cutover session, and retains a
bounded bridge for rolling-deployment legacy session writers. The Phase A one-way
`users` mirror remains enabled because tenant grants and operational actor references have
not yet completed the Phase C membership cutover.

The Phase B application path authenticates through `identities` and accepts only active,
same-ID compatibility memberships. Native distinct-ID and multi-membership sessions are
deliberately disabled until Phase C repoints tenant grants and human actor foreign keys to
`tenant_memberships`. Platform and support grants remain empty and dormant until the
separate control-plane authorization and audit cutover.

There are currently zero database roles and zero RLS-enabled tables or policies.

Runtime reservations are currently stored in Redis and therefore are not represented by
a PostgreSQL reservation table.

## Migration integrity gate

Run this before generating, reviewing, or applying migrations:

```bash
pnpm db:migrations:check
```

The gate verifies:

- every migration SQL file has exactly one journal entry;
- every journal entry has a migration SQL file;
- indexes and filename prefixes are contiguous;
- journal tags and indexes agree;
- every entry has a valid snapshot;
- snapshot IDs form one unbroken chain;
- snapshot version and dialect agree with the journal.

This protects repository history. It does not prove that a live database has no drift.
Live-environment drift must also be checked against the migration table and catalog in a
staging environment.

## Required migration workflow

1. Change only the relevant file under `apps/api/src/database/schema`.
2. Run `pnpm --filter api typecheck`.
3. Generate the migration with `pnpm --filter api db:generate`.
4. Review the generated SQL and snapshot before applying anything.
5. Run `pnpm db:migrations:check`.
6. Apply the migration to a disposable or staging database.
7. Run the complete API and worker integration suites.
8. Verify indexes, constraints, RLS policies, and query plans against realistic data.
9. Commit the schema change, SQL migration, snapshot, journal update, and tests together.

Never edit or rename a migration that has been applied to a shared environment. Create a
new forward migration instead.

## Existing strengths to preserve

- Tenant-aware composite foreign keys on operational relationships
- Campaign-specific lifecycle in `campaign_prospects`
- One-active-assignment partial uniqueness
- Assignment-context foreign keys for activities, follow-ups, and collision overrides
- Durable idempotency records
- Exact identity/membership/tenant binding and absolute lifetime for authentication sessions
- Immediate session revocation on identity security, membership-state, and tenant-state changes
- Scoped access grants for client administrators, directors, managers, prospectors, and
  observers
- PostGIS establishment locations and spatial indexes
- Explicit `ON DELETE` and `ON UPDATE` behavior on core relationships

These are stronger than the equivalent relationships in the standalone architecture SQL.

## P0 schema work still required

1. Database roles for migration, application, worker, reporting, and controlled support
   access.
2. RLS plus `FORCE ROW LEVEL SECURITY` on every tenant-owned/PII table.
3. Transaction-local tenant and actor context set by trusted backend code.
4. Cross-tenant RLS tests executed through the restricted application role.
5. Consent/opposition and do-not-contact records enforced before reservation and action.
6. Rich action outcomes and an immutable multi-event prospect timeline.
7. Durable reservation/collision evidence and Redis recovery reconciliation.
8. Import job/file/row/issue persistence and duplicate-review records.
9. Audit immutability through database privileges, not application convention alone.
10. Privacy retention, erasure, legal-hold, and anonymization workflows.

RLS must be introduced only after the runtime connection role and transaction-context
design are proven. Enabling policies while the application connects as a table owner can
create false confidence because owners may bypass RLS.
