---

# `docs/architecture/API_ARCHITECTURE.md`

````md
# TrackRoster API Architecture

**Status:** Draft

## API Responsibility

The NestJS API is the authoritative boundary for:

- authentication;
- authorization;
- tenant isolation;
- validation;
- business rules;
- anti-collision;
- transactions;
- audit generation.

## API Style

TrackRoster initially uses REST.

Examples:

```http
GET /prospects
GET /prospects/:prospectId

POST /assignments
POST /assignments/bulk

POST /reservations/claim

POST /actions

GET /prospects/:prospectId/timeline

GET /manager/dashboard

POST /overrides/:overrideId/decide
```
````
