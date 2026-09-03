# TrackRoster System Architecture

**Status:** Proposed implementation architecture  
**Product constraint source:** TrackRoster Product Design Dossier v1.0

## 1. Architecture style

TrackRoster will begin as an **API-first modular monolith**.

The goal is to keep deployment and operations simple while preserving strong internal
module boundaries so the system can evolve without becoming a tightly coupled
application.

## 2. High-level architecture

```text
                    ┌──────────────────────┐
                    │      Next.js Web     │
                    │      apps/web        │
                    │ Responsive / PWA UI  │
                    └──────────┬───────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │      NestJS API      │
                    │      apps/api        │
                    │  Modular Monolith    │
                    └──────┬────────┬──────┘
                           │        │
                 ┌─────────▼─┐   ┌──▼─────────┐
                 │ PostgreSQL │   │   Redis    │
                 │ + PostGIS  │   │ cache/lock │
                 └──────┬─────┘   └────┬──────┘
                        │              │
                        └──────┬───────┘
                               ▼
                    ┌──────────────────────┐
                    │   Background Worker  │
                    │     apps/worker      │
                    │ jobs/notifications   │
                    └──────────┬───────────┘
                               │
                     ┌─────────▼─────────┐
                     │ Object storage /   │
                     │ email / integrations│
                     └────────────────────┘
```

## 3. Application boundaries

### `apps/web`

Responsible for:

- presentation;
- client-side navigation;
- forms;
- optimistic UX where safe;
- visualization of server decisions;
- session-aware API access;
- responsive desktop / mobile interaction.

The frontend must not own authoritative collision, authorization, or tenancy rules.

### `apps/api`

Responsible for:

- authentication;
- authorization;
- tenant isolation;
- product business rules;
- anti-collision decisions;
- transactions;
- validation;
- persistence orchestration;
- synchronous API responses;
- audit generation.

### `apps/worker`

Responsible for asynchronous work such as:

- due follow-up processing;
- notification delivery;
- import processing where moved off-request;
- report generation;
- scheduled digests;
- cleanup / expiration tasks;
- integration jobs.

## 4. NestJS module boundaries

Recommended business modules:

```text
auth
tenants
organizations
users
teams
prospects
contacts
campaigns
assignments
reservations
collision
actions
follow-ups
imports
notifications
reporting
audit
```

Modules should expose narrow application services rather than directly reading each
other's tables everywhere.

## 5. Request flow

Example: claim a prospect reservation.

```text
Browser
  |
  | POST /reservations/claim
  v
Controller
  |
  v
Auth / tenant guards
  |
  v
Reservation application service
  |
  +--> Collision engine
  |      |
  |      +--> assignments
  |      +--> reservations
  |      +--> recent actions
  |      +--> multi-organization policy
  |
  v
Transactional claim
  |
  +--> success -> reservation created
  |
  +--> conflict -> rejected
  |
  v
Audit / event recording
  |
  v
HTTP response
```

## 6. Authoritative business rule principle

**The frontend presents decisions. The backend owns decisions. The database enforces
critical invariants wherever possible.**

Examples:

- authorization is server-side;
- tenant isolation is server-side;
- reservation exclusivity is enforced at the persistence / transaction layer;
- immutable action history is enforced through write patterns and permissions;
- audit generation is server-side.

## 7. Shared packages

Recommended packages:

- `@trackroster/types` — cross-application TypeScript contracts where genuinely shared;
- `@trackroster/validation` — reusable schemas where API and web need identical
  validation semantics;
- `@trackroster/ui` — shared UI primitives;
- `@trackroster/config` — common TypeScript / lint / environment conventions.

Avoid a generic `common`, `helpers`, or `utils` package becoming a dumping ground.

## 8. Data ownership

The NestJS API is the primary owner of transactional business data.

The worker may process background work but must use the same domain rules and tenant
constraints.

## 9. Real-time needs

The product requires real-time or near-real-time user feedback for collision decisions
and selected notifications.

Initial implementation may use:

- synchronous HTTP for reservation decisions;
- WebSocket / Server-Sent Events for selected notifications if required;
- queue-backed workers for asynchronous delivery.

Real-time transport choice does not change the authoritative persistence model.

## 10. Evolution path

The modular monolith may later split selected modules only when operational or scaling
evidence justifies it.

Likely future extraction candidates could include:

- notifications;
- imports;
- reporting;
- integration processing.

The collision / reservation domain should not be split prematurely because it depends
on strong transactional consistency.
