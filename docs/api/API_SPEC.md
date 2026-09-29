# TrackRoster API Specification

**Status:** Product-planning draft  
**Purpose:** Define the initial API surface suggested by the product dossier and the
architecture plan.

For the complete route inventory that is actually implemented, see
[`docs/production/API_INVENTORY.md`](../production/API_INVENTORY.md). This planning document
must not be treated as the runtime contract.

This is not a generated OpenAPI document. The implemented API should later generate or
maintain a formal OpenAPI specification from NestJS.

## 1. Authentication

### POST `/auth/login`

Authenticate an active global identity by normalized email and password. The compatible
Phase B endpoint issues a tenant token pair only when the identity has exactly one active,
same-ID membership in an active tenant.

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

Identities with zero, multiple, or distinct-ID memberships do not receive a session in
Phase B. An explicit tenant-selection challenge is a Phase C contract and must not be
simulated by trusting a tenant ID supplied with the password.

### POST `/auth/refresh`

Rotate the exact active refresh session. Rotation is compare-and-swap: one concurrent use
wins and replay is rejected. Rotation cannot change identity, membership, tenant, session,
or absolute lifetime.

### POST `/auth/logout`

Revoke the exact submitted refresh session. Because protected requests validate persisted
session state, the related access token is rejected after logout.

### GET `/auth/me`

Return the compatibility tenant principal:

```json
{
  "userId": "<membership-id>",
  "tenantId": "<tenant-id>"
}
```

`userId` is temporarily a membership-ID alias while public and operational contracts are
renamed in Phase C.

### Tenant token profile

Only version 2 tenant tokens are accepted. Access and refresh tokens have distinct
audiences and include:

- `sub`: global identity UUID;
- `membershipId`: tenant membership UUID;
- `tenantId`: selected tenant UUID;
- `sid`: persisted authentication-session UUID;
- `jti`: token UUID;
- `ver`: `2`;
- `type`: `access` or `refresh`;
- `iat` and `exp`: issued-at and expiration timestamps.

Verification pins `HS256`, issuer `trackroster-api`, key ID `tenant-hs256-v2`, and audience
`trackroster-tenant-access` or `trackroster-tenant-refresh`. A valid access signature is
not sufficient: the server also verifies the persisted session plus active identity,
membership, and tenant state.

Pre-cutover/version 1 tokens are intentionally rejected and migration `0025` revokes all
pre-cutover sessions. Deployments must force a new login; they must not add a permanent
version 1 fallback.

---

## 2. Imports

### POST `/imports/preview`

Upload or reference an import file and return:

- detected columns;
- field mapping candidates;
- normalized preview;
- duplicate candidates;
- anomalies.

### POST `/imports/:importId/finalize`

Finalize a reviewed import.

The finalize operation should be idempotent.

---

## 3. Prospects

### GET `/prospects`

List prospects visible to the current user.

Suggested filters:

- search;
- status;
- organization;
- campaign;
- manager;
- channel;
- region;
- priority.

### GET `/prospects/:prospectId`

Return prospect / establishment detail.

### GET `/prospects/:prospectId/timeline`

Return chronological immutable activity history visible to the caller.

---

## 4. Assignments

### POST `/assignments`

Create an assignment.

### POST `/assignments/bulk`

Create or update a batch of assignments according to manager authorization.

### POST `/assignments/:assignmentId/reassign`

Perform an explicit reassignment while preserving history.

---

## 5. Reservations

### POST `/reservations/claim`

Request an anti-collision decision and attempt a reservation.

Possible business outcomes:

- allowed / claimed;
- blocked;
- manager approval required;
- conflict due to concurrent claim.

### POST `/reservations/:reservationId/release`

Release a reservation when the workflow completes or explicitly stops.

---

## 6. Actions

### POST `/actions`

Record a prospecting action.

Expected business fields include:

- prospect;
- channel;
- result;
- contact or reason;
- structures / organizations presented;
- summary;
- next action or closure.

Server captures author and timestamp.

---

## 7. Follow-ups

### GET `/follow-ups`

List follow-ups visible to the caller.

### POST `/follow-ups`

Create a follow-up.

### PATCH `/follow-ups/:followUpId/status`

Update follow-up completion state.

---

## 8. Overrides

### POST `/overrides`

Request manager review where policy allows.

### POST `/overrides/:overrideId/decide`

Approve or reject.

Decision requires a reason and creates audit history.

---

## 9. Manager dashboard

### GET `/manager/dashboard`

Return authorized manager metrics.

Suggested filters:

- period;
- organization;
- campaign;
- team;
- manager;
- prospector;
- region;
- channel.

---

## 10. Exports

### POST `/exports`

Create an authorized export request.

Exports must be scoped and auditable.

---

## 11. Error example

```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "An incompatible reservation is already active.",
    "requestId": "req_123"
  }
}
```

## 12. Open questions

The dossier does not define exact request/response JSON schemas, authentication token
format, pagination format, or public API versioning policy.

Those must be finalized during implementation and documented in OpenAPI.
