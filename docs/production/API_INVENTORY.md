# Implemented API Inventory

**Snapshot date:** 2026-09-29
**Implementation:** continuously updated; verify routes against `docs/backend/CONTROLLER_ROUTE_INVENTORY.json`

This file documents the API that actually exists. It is not an aspirational product API.
The planning document at `docs/api/API_SPEC.md` describes desired capabilities and may use
different paths.

The API currently exposes compatibility routes and `/api/v1` aliases. A generated OpenAPI
contract and production approval are still pending. This inventory records implemented
behavior, not the complete product roadmap.

The current development baseline has 335 statically declared controller operations;
see `docs/backend/CONTROLLER_ROUTE_INVENTORY.json` for source-linked entries and
`docs/CURRENT_STATUS.md` for certification limits.

## Recently added platform routes

All routes below require an authenticated identity with an active platform access grant.

| Method | Path                                                   | Purpose                                                             |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| GET    | `/platform/tenants`                                    | List tenants, optionally filtered by status.                        |
| GET    | `/platform/tenants/{tenantId}`                         | View tenant details.                                                |
| GET    | `/platform/tenants/{tenantId}/usage`                   | Return membership, prospect, campaign, and activity counts.         |
| PATCH  | `/platform/tenants/{tenantId}/status`                  | Activate, suspend, or deactivate a tenant and write audit evidence. |
| GET    | `/platform/tenants/{tenantId}/config`                  | Read platform configuration JSON.                                   |
| PATCH  | `/platform/tenants/{tenantId}/config`                  | Replace platform configuration JSON and audit changed keys.         |
| GET    | `/platform/users`                                      | List active platform grants and identities.                         |
| POST   | `/platform/users/{identityId}/grants`                  | Grant a platform role and audit the action.                         |
| POST   | `/platform/users/{identityId}/grants/{grantId}/revoke` | Revoke a platform grant and audit the action.                       |

Tenant configuration and platform grants require migration `0068`. Plans, billing,
feature flags, support access, incident management, and platform job administration are
not documented as implemented because their production contracts are still pending.

## Global behavior

- Authentication: version 2 tenant Bearer access token unless a route is marked public
- Validation: whitelist enabled, unknown fields rejected, transformation enabled
- Error response: flat `{ statusCode, code, message, error, requestId }`
- Identifier validation: UUID pipes are used on most resource routes, with exceptions noted
- Idempotency: `Idempotency-Key` behavior is applied only where explicitly noted

Access labels:

- **Public**: no access token required
- **Authenticated**: `AuthGuard`; the service may enforce a narrower scope
- **Client admin**: `AuthGuard` plus `ClientAdminGuard`
- **Scoped management**: authenticated client administrator, director, or manager according
  to service-level authorization
- **Exact Prospector team**: authenticated user needs the exact Prospector grant and current
  assignment required by the operation

## Authentication and identity

| Method | Path                     | Access        | Contract                                                   |
| ------ | ------------------------ | ------------- | ---------------------------------------------------------- |
| POST   | `/auth/login`            | Public        | Email/password to a single-membership access/refresh pair  |
| POST   | `/auth/refresh`          | Public        | Atomically rotates an active session's refresh token       |
| POST   | `/auth/logout`           | Public        | Revokes the exact submitted refresh session; HTTP 204      |
| GET    | `/auth/me`               | Authenticated | Returns compatibility `{ userId: membershipId, tenantId }` |
| GET    | `/auth/me/access-grants` | Authenticated | Returns email, display name, and scoped tenant grants      |

The Phase B runtime authenticates credentials against the global `identities` table and
then resolves active membership and tenant state. The compatible login path succeeds only
when exactly one active, same-ID legacy membership exists. It deliberately does not issue
a session for a distinct-ID or multi-membership identity. There is no tenant-selection or
tenant-switch endpoint yet; those flows remain disabled until Phase C repoints grants and
human operational references to membership IDs.

Tenant tokens are version 2 only. Access and refresh tokens use separate audiences and
contain `sub` (identity), `membershipId`, `tenantId`, `sid`, `jti`, `ver`, and `type`.
Verification pins the issuer, audience, key ID, and `HS256` algorithm. The access guard
also loads the exact persisted session and verifies that the identity, membership, tenant,
current refresh lifetime, and absolute session lifetime remain active. Version 1 and
pre-cutover tokens are rejected; migration `0025` revokes all pre-cutover sessions and
therefore requires every user to sign in again.

The Phase A `users` mirror and the compatibility `userId` response field remain because
tenant grants and actor relationships still use same-ID legacy user references. Platform
and support tables grant no runtime API authority in this phase.

## Users and access grants

| Method | Path                                    | Access       | Contract                                |
| ------ | --------------------------------------- | ------------ | --------------------------------------- |
| GET    | `/users`                                | Client admin | Lists tenant users                      |
| POST   | `/users`                                | Client admin | Creates a user from email/password      |
| PATCH  | `/users/:userId/status`                 | Client admin | Activates, suspends, or disables a user |
| GET    | `/users/:userId/access-grants`          | Client admin | Lists grants for a user                 |
| POST   | `/users/:userId/access-grants`          | Client admin | Creates a tenant/org/team grant         |
| DELETE | `/users/:userId/access-grants/:grantId` | Client admin | Revokes a grant                         |

`userId` and `grantId` on these controllers are currently raw strings rather than
`ParseUUIDPipe` values. User creation also cannot set `displayName`.

## Campaigns and campaign prospects

| Method | Path                                           | Access       | Contract                              |
| ------ | ---------------------------------------------- | ------------ | ------------------------------------- |
| POST   | `/campaigns`                                   | Client admin | Creates a campaign                    |
| GET    | `/campaigns`                                   | Client admin | Lists campaigns                       |
| GET    | `/campaigns/:campaignId`                       | Client admin | Gets a campaign                       |
| PATCH  | `/campaigns/:campaignId`                       | Client admin | Updates campaign metadata/status      |
| POST   | `/campaigns/:campaignId/prospects`             | Client admin | Adds an establishment to a campaign   |
| GET    | `/campaigns/:campaignId/prospects`             | Client admin | Lists campaign prospects              |
| GET    | `/campaigns/:campaignId/prospects/:prospectId` | Client admin | Gets campaign membership              |
| PATCH  | `/campaigns/:campaignId/prospects/:prospectId` | Client admin | Includes/excludes campaign membership |

There is no API for changing `lifecycle_stage`; it is currently seeded and read by the
work queue.

## Assignments

| Method | Path                                                              | Access       | Idempotent | Contract                           |
| ------ | ----------------------------------------------------------------- | ------------ | ---------- | ---------------------------------- |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/assignment`         | Client admin | Yes        | Assigns team/user                  |
| PUT    | `/campaigns/:campaignId/prospects/:prospectId/assignment`         | Client admin | Yes        | Reassigns while preserving history |
| DELETE | `/campaigns/:campaignId/prospects/:prospectId/assignment`         | Client admin | Yes        | Ends current assignment            |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/assignment`         | Client admin | N/A        | Gets current assignment            |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/assignment-history` | Client admin | N/A        | Gets assignment history            |

Product managers cannot currently use assignment endpoints because the entire controller is
protected by `ClientAdminGuard`. Bulk and round-robin assignment are not implemented.

## Establishments, contacts, and regions

| Method | Path                                                   | Access       | Contract                     |
| ------ | ------------------------------------------------------ | ------------ | ---------------------------- |
| POST   | `/establishments`                                      | Client admin | Creates an establishment     |
| GET    | `/establishments`                                      | Client admin | Lists establishments         |
| GET    | `/establishments/nearby`                               | Client admin | PostGIS radius search        |
| GET    | `/establishments/:establishmentId`                     | Client admin | Gets an establishment        |
| PATCH  | `/establishments/:establishmentId`                     | Client admin | Updates an establishment     |
| POST   | `/establishments/:establishmentId/contacts`            | Client admin | Creates a contact            |
| GET    | `/establishments/:establishmentId/contacts`            | Client admin | Lists contacts               |
| GET    | `/establishments/:establishmentId/contacts/:contactId` | Client admin | Gets a contact               |
| PATCH  | `/establishments/:establishmentId/contacts/:contactId` | Client admin | Updates a contact            |
| POST   | `/regions`                                             | Client admin | Creates a region; idempotent |
| GET    | `/regions`                                             | Client admin | Lists regions                |
| GET    | `/regions/:regionId`                                   | Client admin | Gets a region                |
| GET    | `/regions/:regionId/children`                          | Client admin | Lists child regions          |
| PATCH  | `/regions/:regionId`                                   | Client admin | Updates a region; idempotent |

The nearby endpoint is not a Prospector map feed, and work-queue responses do not expose
coordinates.

## Work queue and Today

| Method | Path                                  | Access                | Contract                                       |
| ------ | ------------------------------------- | --------------------- | ---------------------------------------------- |
| GET    | `/work-queue/options`                 | Exact Prospector team | Returns allowed campaign options               |
| GET    | `/work-queue`                         | Exact Prospector team | Cursor page with campaign/stage/search filters |
| GET    | `/work-queue/:campaignId/:prospectId` | Exact Prospector team | Scoped prospect detail                         |
| GET    | `/prospector/today`                   | Exact Prospector team | Timezone-qualified summary and priorities      |

Lifecycle filters are `to_contact`, `contact_made`, `in_progress`, `follow_up`,
`qualified`, and `converted`.

## Reservations, collision decisions, and overrides

| Method | Path                                                                      | Access                | Contract                                             |
| ------ | ------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/collision-decision`         | Exact Prospector team | Redacted collision decision                          |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/reservation`                | Exact Prospector team | Atomically acquires a Redis reservation              |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/reservation`                | Exact Prospector team | Returns none/owned/reserved state                    |
| DELETE | `/campaigns/:campaignId/prospects/:prospectId/reservation/:reservationId` | Exact Prospector team | Releases owned reservation                           |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/collision-overrides`        | Scoped management     | Immediately creates an approved override; idempotent |

The override endpoint is not a request/inbox/approve-or-reject workflow. Reservation POST
returns more internal identifiers than the sanitized GET response and is not protected by
the shared HTTP idempotency interceptor.

## Activities, timeline, and follow-ups

| Method | Path                                                                             | Access                | Idempotent | Contract                           |
| ------ | -------------------------------------------------------------------------------- | --------------------- | ---------- | ---------------------------------- |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/activities`                        | Exact Prospector team | Yes        | Records call/email/message/visit   |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/timeline`                          | Scoped read           | N/A        | Cursor-paginated activity timeline |
| GET    | `/follow-ups`                                                                    | Exact Prospector team | N/A        | Operational team queue             |
| GET    | `/campaigns/:campaignId/prospects/:prospectId/follow-ups`                        | Scoped read           | N/A        | Prospect follow-up history         |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/follow-ups`                        | Scoped mutation       | Yes        | Creates to-do/follow-up/meeting    |
| PATCH  | `/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule` | Scoped mutation       | Yes        | Changes due date                   |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/complete`   | Scoped mutation       | Yes        | Completes follow-up                |
| POST   | `/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/cancel`     | Scoped mutation       | Yes        | Cancels follow-up                  |

Activity creation currently accepts only the activity type. Outcome, contact, notes,
duration, structures presented, lifecycle transition, and next-action orchestration are not
part of the contract. The timeline contains activities only.

## Notifications

| Method | Path                                  | Access                  | Contract                    |
| ------ | ------------------------------------- | ----------------------- | --------------------------- |
| GET    | `/notifications`                      | Authenticated recipient | Lists own notifications     |
| PATCH  | `/notifications/:notificationId/read` | Authenticated recipient | Marks own notification read |

Only in-app follow-up reminders are currently modeled.

## Imports and exports

| Method | Path               | Access            | Contract                                                               |
| ------ | ------------------ | ----------------- | ---------------------------------------------------------------------- |
| POST   | `/imports/preview` | Client admin      | Synchronous CSV preview, maximum 5 MB/10,000 rows                      |
| POST   | `/imports/execute` | Client admin      | Synchronous CSV execution                                              |
| GET    | `/exports/:type`   | Scoped management | Synchronous CSV/XLSX stream for assignments, activities, or follow-ups |

Imports do not support XLSX, saved mappings, durable jobs, correction, duplicate review, or
reviewed finalization. Exports do not have asynchronous job/status/download lifecycle.

## Reporting and health

| Method | Path                 | Access            | Contract                                    |
| ------ | -------------------- | ----------------- | ------------------------------------------- |
| GET    | `/manager/dashboard` | Scoped management | Bounded date/org/team/user/campaign metrics |
| GET    | `/health`            | Public            | Static `{ status: "ok" }`                   |

Health does not prove PostgreSQL, Redis, BullMQ, or worker readiness.

## Contract defects to resolve

1. Publish generated, versioned OpenAPI and choose a stable API prefix/version policy.
2. Replace raw Drizzle row responses with explicit public response DTOs.
3. Replace plain `Error` in access-grant validation with DTO validation or a 400 exception.
4. Add UUID pipes to user/grant parameters.
5. Set explicit HTTP status codes for follow-up complete/cancel and grant revocation.
6. Apply durable idempotency consistently to retryable writes.
7. Align `docs/api/API_SPEC.md` with the implemented flat error envelope.
8. Add missing HTTP tests for self-access, work-queue options, grant revocation, region reads,
   dependency-aware health, every export type/format, and work-queue query behavior.
