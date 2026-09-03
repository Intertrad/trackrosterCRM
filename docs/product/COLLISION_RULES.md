# Collision Rules

**Status:** Product baseline

The anti-collision engine is the central differentiating capability of TrackRoster.

## 1. Decision outcomes

Every protected action must receive one of:

- `ALLOWED`
- `BLOCKED`
- `MANAGER_APPROVAL_REQUIRED`

The UI must display the reason and, when possible, the next available action.

## 2. Seven decision layers

### Layer 1 — Duplicate detection

Determine whether the record may represent the same prospect / establishment as another
record.

### Layer 2 — Active assignment

Determine who currently owns the prospect, for which campaign, and for what period.

### Layer 3 — Planned action

Determine whether a conflicting call, visit, or follow-up is already planned.

### Layer 4 — Active reservation

Determine whether another user currently holds a reservation.

### Layer 5 — Cooling-off period

Determine whether the prospect was contacted too recently.

### Layer 6 — Multi-organization policy

Determine whether the relevant campaigns / organizations are:

- shared;
- coordinated;
- delayed;
- independent.

### Layer 7 — Manager override

Determine whether an exception is allowed and whether explicit manager approval is
required.

## 3. Reservation rule

If the action is allowed, the system should create the reservation atomically.

A second incompatible attempt must fail while the first active reservation remains
valid.

## 4. Reservation lifetime

The product dossier recommends temporary reservations, including a recommended
telephone reservation duration of approximately 20 minutes.

Exact timeout values remain configurable product decisions.

## 5. Server-side enforcement

The collision decision must run on the server.

Frontend checks may improve UX but are never authoritative.

## 6. Concurrency requirement

The reservation claim must be protected by transactional and/or database concurrency
controls.

Two simultaneous requests must not both succeed for an incompatible reservation.

## 7. Override audit

An override must record:

- requester;
- decision maker;
- prospect;
- blocking rule;
- reason;
- decision;
- timestamps;
- optional expiration / duration where relevant.

## 8. Product policy matrix

The dossier contains an initial proposed relationship matrix between the five launch
structures.

That matrix is explicitly marked as a configuration proposal to be validated with
managers before the pilot. Therefore, application code should model the relationship
as configuration rather than hard-coding the initial matrix.
