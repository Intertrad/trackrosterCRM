# ADR-005 — Identity, Tenant Membership, and Support Access

**Status:** Accepted  
**Date:** 2026-09-21  
**Decision owners:** Product and platform engineering

## Context

TrackRoster is intended to operate as a multi-tenant SaaS product with five tenant roles
and a separate platform Super Administrator role.

The current implementation combines credentials and tenant membership in `users`:

- every user belongs to exactly one tenant;
- email is globally unique;
- login finds the user by email before tenant context is known;
- access and refresh tokens contain one tenant ID;
- tenant grants reference the tenant-bound user;
- audit actors must belong to the tenant being audited.

That model works for the current single-tenant development fixture, but it cannot safely
represent one person belonging to multiple customers, a platform administrator, or an
audited support operator. It also creates a circular dependency for row-level security:
login needs a global identity lookup before a tenant-scoped database context exists.

## Decision

TrackRoster will separate a person's global credential identity from their tenant
memberships.

### Global identities

`identities` will own authentication data:

- globally unique normalized email;
- password hash and future external identity-provider subjects;
- identity status and email-verification state;
- MFA enrollment and recovery state;
- credential and security timestamps.

An identity is not itself authorized to access customer data.

### Tenant memberships

`tenant_memberships` will connect an identity to a tenant and will own the tenant persona:

- tenant ID and identity ID;
- tenant-visible display name;
- membership status;
- invitation, activation, suspension, and departure timestamps;
- optional default organization/team preferences.

An identity may have multiple memberships, but at most one membership per tenant.

The existing tenant roles remain tenant authorization grants:

- `client_admin`;
- `director`;
- `manager`;
- `prospector`;
- `observer`.

`user_access_grants` will ultimately reference a tenant membership. Platform roles must
never be added to this tenant-role enum.

### Platform authorization

Platform authorization will use a separate control-plane model.

`platform_access_grants` will support narrowly defined roles such as `super_admin` and
`support_operator`. A platform grant provides no customer-data access by itself.

The platform control plane will use a separate JWT audience and separate API routes from
tenant operations.

### Just-in-time support access

Support access to tenant data must be explicit, temporary, and attributable.

`support_access_grants` will record:

- the real platform identity;
- the target tenant;
- the approved scope, initially read-only;
- reason and external ticket/reference;
- requester and approver;
- activation and expiration timestamps;
- revocation actor, time, and reason.

Platform staff must not impersonate customer users, use a fake platform tenant, or receive
`BYPASSRLS`. Break-glass database access remains a separate operational procedure and is
not an application feature.

### Tenant selection and sessions

Credential verification happens before tenant selection.

- If an identity has one active membership, login may select it automatically.
- If it has multiple active memberships, login returns a short-lived tenant-selection
  token and the allowed memberships.
- `POST /auth/select-tenant` exchanges that token and selected membership for a
  tenant-scoped session.
- Switching tenant creates or rotates into a tenant-scoped session after membership is
  revalidated.

The target above is activated in stages. Phase B supports only one active same-ID
compatibility membership and fails closed for distinct-ID or multi-membership identities.
The tenant-selection challenge and switching endpoints are Phase C work because legacy
grants and operational actor references must first be repointed to membership IDs.

Tenant access tokens will contain and validate:

- `sub`: global identity ID;
- `membershipId`: active tenant membership ID;
- `tenantId`: selected tenant ID;
- `sid`: persisted session ID;
- `jti`, issuer, audience, issued-at, and expiration;
- optional `supportGrantId` only for approved support access.

The access guard must validate the identity, membership, tenant, and session state. Logout,
identity suspension, membership suspension, tenant suspension, password reset, and support
grant revocation must invalidate relevant sessions.

### Audit identity

Audit records will preserve the true actor rather than an impersonated customer account.
They must distinguish:

- tenant membership actor;
- platform identity actor;
- system/worker actor.

Support activity additionally records the support grant. Customer-facing audit views may
redact platform metadata, but the security audit record remains complete and immutable.

### Database authorization boundary

Row-level security will enforce tenant isolation, not product roles. Organization, team,
campaign, and role authorization remain explicit application rules.

The database context trusted by RLS will be transaction-local and include the tenant,
membership or platform identity, session, and optional support grant. Runtime roles will
be non-owner, non-superuser, and `NOBYPASSRLS`.

Authentication lookup, tenant application access, background work, reporting, and schema
migration will use separate database roles and credentials.

## Migration strategy

The migration will be additive and staged:

1. Create global identity, tenant-membership, platform-grant, and support-grant tables.
2. Backfill one identity and one membership from every existing `users` row.
3. Initially preserve existing user UUIDs for both corresponding records so current actor
   and assignment references remain stable during the transition.
4. Add dual-read compatibility and verify counts, uniqueness, and credential hashes.
5. Issue strict version 2 tokens for the same-ID, single-membership compatibility path and
   validate persisted identity, membership, tenant, and session state.
6. Repoint tenant grants and actor references to memberships, enable explicit tenant
   selection and distinct-ID/multi-membership sessions, then rename application concepts
   from user to membership where appropriate.
7. Remove credential columns from the legacy tenant-user structure only after rollback and
   reconciliation windows have passed.
8. Introduce restricted database roles and transaction-scoped context.
9. Enable RLS under restricted credentials, test it, and only then force RLS in a later
   release.

Destructive column removal and `FORCE ROW LEVEL SECURITY` are intentionally separate from
the initial backfill release.

## Required acceptance evidence

- One identity can select either of two authorized tenant memberships.
- A token cannot select or access a tenant without an active membership.
- Platform administrators have zero tenant-data access by default.
- Missing, expired, revoked, or out-of-scope support grants are denied.
- Valid support access is limited to one tenant, time window, and scope.
- Every support operation audits the real platform actor and support grant.
- Suspended identity, tenant, membership, or session is denied immediately.
- The last active tenant client administrator cannot be removed accidentally.
- Tenant database context is cleared after transaction commit and rollback.
- Tenant A cannot read or mutate Tenant B through unfiltered SQL under runtime credentials.

## Consequences

This decision adds identity and session migration work before full RLS can be enabled. It
also avoids embedding platform authority in customer roles, supports future SSO, and gives
TrackRoster a durable model for multi-tenant accounts and accountable support access.

## Rejected alternatives

- **Keep one user permanently bound to one tenant:** prevents normal multi-tenant account
  use and leaves platform/support identity unresolved.
- **Add `super_admin` to tenant roles:** conflates control-plane and customer authority.
- **Create a platform tenant:** does not authorize safe cross-tenant access and encourages
  bypasses.
- **Give support `BYPASSRLS`:** creates unauditable, unrestricted customer-data access.
- **Enable owner-run RLS now:** table owners and superusers bypass RLS and would provide
  misleading test evidence.
