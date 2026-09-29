# Memberships and permissions

The membership administration APIs are tenant-admin-only and available beneath `/api/v1` and the existing unversioned prefix. Foreign-tenant identifiers return no resource. Invitation creation and acceptance are documented in [authentication](AUTHENTICATION.md).

## Membership lifecycle

`GET /memberships` supports cursor/limit pagination and role, status, organization, team and search filters. Detail includes identity, lifecycle, capacity, active workload and effective scoped permissions.

`PATCH /memberships/{id}` updates display name, capacity, status or role. Role/status changes require a reason. **Supplying a role replaces all current grants** with that role and its supplied scope. Use scope endpoints to edit individual grants instead. Optional `If-Match` protects against stale changes; mutation endpoints support the existing idempotency contract.

Capacity is `null` for unlimited, zero for no new assignments, or an integer up to 100000. It cannot be lowered below active workload. Assignment transactions lock the membership and recheck eligibility and capacity, preventing concurrent requests from exceeding the limit.

Suspension revokes workspace sessions and retains assigned work. Reactivation accepts only suspended memberships and requires a fresh login. Invitations must be accepted before activation. Departed memberships cannot be reactivated. Last-admin protection is serialized; departure and scope changes also protect outstanding work and configured team management relationships.

## Scope and permission contracts

`GET/POST /memberships/{id}/scopes` and `PATCH/DELETE /membership-scopes/{id}` manage positive tenant, organization and team grants. List items include their own `etag` for conditional mutation. Scope replacement requires a complete supported role/scope payload. Explicit territory/campaign resource grants are now supported; see [resource scope contracts](TERRITORY_CAMPAIGN_SCOPES.md). Explicit deny rules and historical team rosters remain pending.

`GET /roles` exposes super_admin, tenant_admin, director, manager, prospector and auditor. Platform authority cannot be granted through these tenant APIs. Legacy client_admin/observer names map to tenant_admin/auditor.

`GET /permissions`, `GET /roles/{role}/permissions`, and `GET /me/permissions` describe the published catalogue and effective scoped grants. `PUT /roles/{role}/permissions` accepts `{ "permissions": ["assignments.manage", "exports.create"] }` as the complete configurable allowlist for that role. Fixed permissions remain unchanged.

The four configurable capabilities are `assignments.manage`, `collisions.override`, `exports.create` and `teams.manage`. Configuration can restrict existing director/manager authority; it cannot expand baseline role or resource scope. Tenant-admin and platform authority cannot be rewritten. Other domain-specific capabilities remain future work.

HTTP authentication checks configured permissions before idempotency replay. Existing domain authorization continues to enforce scope and ownership. Trusted internal service callers do not automatically pass through this HTTP capability guard.

## Access history and deployment

`GET /memberships/{id}/access-history` returns descending cursor-paginated membership and legacy grant events. Membership changes, role configuration affecting current members and legacy user-status changes record audit evidence. No API edits or deletes these events. Database-level audit immutability and restricted runtime credentials remain production-readiness work.

Migration `0032_membership_permissions.sql` adds membership capacity settings and tenant role configurations. It has been applied only to the disposable validation database. Apply the complete migration chain before deploying these APIs to another environment.
