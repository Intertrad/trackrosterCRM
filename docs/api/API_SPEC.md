# TrackRoster API Specification

**Status:** MVP draft  
**Purpose:** Define the initial API surface suggested by the product dossier and the
architecture plan.

This is not a generated OpenAPI document. The implemented API should later generate or
maintain a formal OpenAPI specification from NestJS.

## 1. Authentication

### POST `/auth/login`

Authenticate a user and establish application session / token according to the chosen
auth implementation.

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
