# Identity and Access Migration Plan

> **2026-09-22 implementation update:** Native membership authentication and operational actor references, personal account APIs, workspace administration, notification extensions, session audit and authentication throttling have been added. Migrations 0026–0028 were verified on an isolated database; deployment to the existing database remains separate. See [the current backend implementation ledger](../backend/IMPLEMENTATION_STATUS.md). The dated baseline below is retained as historical evidence. Full backend completion and production readiness remain pending.

This plan implements
[ADR-005](../decisions/ADR-005-identity-tenancy-and-support-access.md) without mixing a
credential cutover, database-role cutover, and forced RLS into one irreversible release.

## Current-to-target mapping

| Current concept              | Target concept                    | Migration rule                                               |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `users` credentials          | `identities`                      | Copy email, password hash, and identity status               |
| `users` tenant persona       | `tenant_memberships`              | Preserve tenant, display name, and membership status         |
| `user_access_grants.user_id` | Membership grant reference        | Preserve UUID during initial backfill, rename later          |
| JWT `sub`                    | Identity ID                       | Add membership, tenant, session, issuer, and audience claims |
| `auth_sessions.user_id`      | Identity plus selected membership | Backfill exact context; retain nullable same-ID bridge only  |
| Tenant Super Administrator   | Platform access grant             | Never add to the tenant role enum                            |
| Support impersonation        | JIT support access grant          | Record true actor, reason, approval, expiry, and scope       |

## Release phases

### Phase A — additive identity schema

- Add `identities` and `tenant_memberships`.
- Add platform and JIT support grant tables.
- Add required unique keys, tenant-aware foreign keys, and state checks.
- Do not remove or rename current columns.
- Backfill in the migration or a restartable controlled job.
- Keep `users` authoritative through a transitional one-way database trigger that mirrors
  inserts, updates, and deletes into the same-ID identity and membership shadows.
- Treat the trigger's legacy hard-delete mirroring as transitional cleanup compatibility,
  not as the production account-retention policy; no user-delete API may rely on it.
- Keep platform and support capabilities dormant; Phase A creates no platform or support
  grants and enables no corresponding API or token audience.

Deployment and verification must follow the
[Identity Phase A deployment runbook](./IDENTITY_PHASE_A_RUNBOOK.md).

Preflight must prove:

- no duplicate normalized emails;
- every current user references an existing tenant;
- current user IDs are unique and valid UUIDs;
- every user access grant references its user's tenant;
- every current session references a current user.

### Phase B — compatible authentication

- Authenticate against `identities`.
- Resolve active memberships only after credential verification.
- Limit login to exactly one active same-ID compatibility membership.
- Persist and validate exact identity, membership, tenant, session, current-expiry, and
  absolute-expiry context.
- Issue version 2 tokens only, with distinct access/refresh audiences and pinned issuer,
  key ID, algorithm, session ID, and token ID.
- Validate persisted active identity, membership, tenant, and session state for every
  protected request; do not trust token state alone.
- Revoke existing sessions at cutover and require every user to sign in again. Version 1
  token fallback is intentionally not provided.
- Revoke active sessions when identity security state, membership state, or tenant state
  becomes inactive.
- Keep the transitional legacy-user mirror and bounded legacy session-write bridge during
  the rollback window.
- Reject identities with multiple active memberships and distinct-ID memberships. Tenant
  selection is intentionally deferred to Phase C because current grants and operational
  actor references still use legacy same-ID users.

Deployment and verification must follow the
[Identity Phase B deployment runbook](./IDENTITY_PHASE_B_RUNBOOK.md).

### Phase C — tenant authorization cutover

- Resolve all tenant roles through membership IDs.
- Repoint assignments, follow-ups, activities, notifications, overrides, idempotency, and
  audit actor references to memberships where they represent a human tenant actor.
- Keep global identity references only where global identity is semantically required.
- Add a short-lived tenant-selection challenge and explicit tenant-selection/switching
  endpoints only after all authorization and actor lookups accept membership IDs.
- Enable and test distinct-ID and multi-membership sessions; never infer a tenant from a
  globally unique email.
- Prevent removal or suspension of the last active client administrator.

### Phase D — platform and support control plane

- Add separate platform authentication audience and guards.
- Add Super Administrator management APIs that do not expose tenant data by default.
- Add request/approve/revoke APIs for time-limited support access.
- Enforce read-only support scope first.
- Audit the real platform actor and support grant on every support operation.

### Phase E — database runtime boundary and RLS

- Split migration, authentication, application, worker, reporting, and test-fixture
  credentials.
- Run all tenant work inside explicit transaction-scoped database context.
- Test using non-owner, `NOBYPASSRLS` credentials.
- Enable RLS and validate behavior before forcing it.
- Force RLS in a separate release after production-like rehearsal.

### Phase F — legacy removal

- Stop dual writes and compare identity/membership reconciliation reports.
- Remove credential data from the legacy tenant-user table.
- Rename legacy user concepts to membership concepts.
- Remove compatibility paths only after the rollback window expires.

## Rollback strategy

Phases A through C remain additive until the new token and membership paths are proven.
Phase B has no online version 1 fallback: a rollback must enter maintenance mode, revoke
all sessions, deploy one coherent application version, and require another login. The
`0025` schema is retained because it is compatible with the legacy writer bridge. Data
written after dual-write begins must be reconciled before rollback.

Column removal, table renaming, and forced RLS use forward-fix runbooks and must not occur
in the same release as the initial data backfill.

## Mandatory test matrix

1. A single active same-ID membership login remains successful.
2. Multiple active memberships and distinct-ID memberships fail closed until Phase C.
3. Version 1, wrong-version, wrong-type, wrong-issuer, wrong-audience, wrong-key-ID, and
   wrong-algorithm tokens are denied.
4. Inactive identity, membership, tenant, or session is denied immediately.
5. A tenant token cannot name another membership, tenant, or session.
6. Refresh rotation has exactly one winner; replay and logout invalidate the persisted
   session for both refresh and access checks.
7. Session rotation cannot change identity, membership, tenant, or absolute lifetime.
8. Phase C multi-membership login requires explicit tenant selection.
9. Platform tokens are rejected by tenant endpoints.
10. Tenant tokens are rejected by platform endpoints.
11. Support access is denied by default and after expiration/revocation.
12. Support scope cannot be widened by token claims.
13. Audit records retain the true actor and support authorization.
14. Backfill counts and credential hashes reconcile exactly.
15. RLS context does not leak through pooled connections after commit, rollback, or error.
