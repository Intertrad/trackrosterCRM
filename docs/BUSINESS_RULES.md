# TrackRoster Business Rules

**Status:** Product invariant baseline  
**Primary source:** TrackRoster Product Design Dossier v1.0

These rules are system invariants. Every UI, API endpoint, worker, database migration,
integration, and background process must respect them.

---

## BR-001 — Canonical prospect identity

A prospect / establishment must have one canonical identity inside a tenant when the
available evidence identifies it as the same entity.

Duplicate detection may use:

- legal identifier;
- normalized phone number;
- email;
- domain;
- normalized address;
- postal code;
- normalized name;
- geographic proximity.

Potential duplicates may require human review before activation.

---

## BR-002 — Explicit ownership

Active prospecting responsibility must be explicit.

An assignment must identify at minimum:

- tenant;
- prospect;
- campaign;
- responsible user and/or team;
- assignment status;
- effective period when applicable.

---

## BR-003 — One action creates one history entry

Calls, visits, emails, letters, meetings, follow-ups, and other prospecting actions
must create new history records.

Historical actions must not be silently overwritten.

---

## BR-004 — Status is derived from explicit business activity

A prospect lifecycle status must change because of an explicit action or business
decision.

A status must not change silently without an attributable reason.

---

## BR-005 — Verify before acting

A protected action must pass the anti-collision decision flow before contact begins.

Possible outcomes:

- `ALLOWED`
- `BLOCKED`
- `MANAGER_APPROVAL_REQUIRED`

---

## BR-006 — Reservation exclusivity

Two incompatible operations must not simultaneously own an active reservation for the
same protected prospect context.

This rule is enforced on the server and at the persistence / concurrency layer.

---

## BR-007 — Reservation expiration

Reservations are temporary.

A browser crash, network loss, or abandoned session must not permanently block a
prospect.

---

## BR-008 — Collision layers

The anti-collision decision may consider:

1. duplicates;
2. active assignment;
3. planned actions;
4. active reservation;
5. recent contact / cooling-off period;
6. multi-organization policy;
7. manager override rules.

---

## BR-009 — Multi-organization policy

Coordination relationships can use policy categories such as:

- `SHARED`
- `COORDINATED`
- `DELAYED`
- `INDEPENDENT`

The exact matrix is configurable and must be validated with business managers before
the pilot.

---

## BR-010 — Manager override

When an override is permitted, it requires:

- an authorized manager;
- an explicit reason;
- a timestamp;
- the affected prospect;
- the affected campaign / organization context;
- an audit entry.

---

## BR-011 — Least-privilege visibility

A user may only access data required for the user's authorized:

- tenant;
- organization;
- role;
- team;
- campaign;
- territory.

---

## BR-012 — Tenant isolation

No tenant data may leak to another tenant through:

- API responses;
- exports;
- database queries;
- cache keys;
- background jobs;
- search indexes;
- object storage;
- logs;
- reports.

---

## BR-013 — Follow-up ownership

A follow-up must identify:

- the prospect;
- responsible user;
- due date;
- status;
- originating action when applicable.

---

## BR-014 — Sensitive operations are auditable

At minimum, the following must be auditable:

- assignment;
- reassignment;
- override request and decision;
- export;
- access / role change;
- important configuration change.

---

## BR-015 — Controlled exports

Exports must respect the requesting user's authorization scope.

An export must never be treated as a bypass around normal authorization.

---

## BR-016 — Critical alerts cannot be fully disabled

Users may configure notification channels where appropriate, but product-critical
collision, opposition, and security alerts must remain enforceable.

---

## BR-017 — Import anomalies are reviewed before activation

The import process must expose anomalies and duplicate candidates before data becomes
active operational prospecting data.

---

## BR-018 — Reassignment preserves history

Reassignment changes current responsibility but must not erase prior assignment or
action history.
