# TrackRoster Naming Conventions

**Status:** Proposed team standard

Consistency is more important than personal preference.

## 1. General naming rules

Names should be:

- descriptive;
- domain-oriented;
- predictable;
- written in English;
- free of unnecessary abbreviations.

Prefer:

```ts
reservationExpiration;
prospectAssignment;
collisionDecision;
```

Avoid:

```ts
resExp;
pa;
cd;
```

## 2. Repository folders

Use `kebab-case`.

```text
collision-engine/
prospect-import/
audit-log/
email-notifications/
```

Avoid:

```text
CollisionEngine/
collision_engine/
collisionEngine/
```

## 3. Generic file names

Use `kebab-case`.

```text
prospect-service.ts
reservation-policy.ts
collision-engine.ts
tenant-context.ts
```

## 4. TypeScript variables

Use `camelCase`.

```ts
const prospectId = ...
const tenantId = ...
const activeReservation = ...
const collisionResult = ...
```

## 5. Functions

Use `camelCase` and normally begin with a verb.

```ts
getProspect();
createAssignment();
claimReservation();
checkCollision();
releaseReservation();
scheduleFollowUp();
recordAction();
```

Avoid vague names such as `handle`, `process`, or `manage` unless the abstraction already
makes the action unambiguous.

## 6. Boolean names

Boolean names should read like yes/no questions.

Preferred prefixes:

- `is`
- `has`
- `can`
- `should`
- `was`

Examples:

```ts
isActive;
isExpired;
hasReservation;
canOverride;
shouldNotify;
wasImported;
```

## 7. Classes

Use `PascalCase`.

```ts
ProspectService;
ReservationService;
CollisionEngine;
AssignmentRepository;
TenantGuard;
```

## 8. Types and interfaces

Use `PascalCase`.

```ts
Prospect;
Reservation;
CollisionDecision;
CreateAssignmentInput;
```

Do not prefix interfaces with `I`.

Avoid:

```ts
IProspect;
IReservation;
```

## 9. Constants

Use `UPPER_SNAKE_CASE` for application-level constants.

```ts
const DEFAULT_RESERVATION_TTL_MINUTES = 20;
const DEFAULT_PAGE_SIZE = 25;
```

Do not use uppercase for every local `const`.

## 10. Enums

Use `PascalCase` for enum names and members, with stable serialized values.

```ts
enum ReservationStatus {
  Active = 'active',
  Expired = 'expired',
  Released = 'released',
}
```

## 11. NestJS files

Use NestJS suffix conventions:

```text
prospect.controller.ts
prospect.service.ts
prospect.module.ts
prospect.repository.ts
create-prospect.dto.ts
tenant.guard.ts
audit.interceptor.ts
http-exception.filter.ts
jwt.strategy.ts
```

## 12. NestJS domain folder layout

```text
prospects/
├── prospect.controller.ts
├── prospect.service.ts
├── prospect.repository.ts
├── prospect.module.ts
├── dto/
├── entities/
└── tests/
```

## 13. Next.js route folders

Follow Next.js route conventions.

Feature folders outside `app/` use `kebab-case`.

## 14. React component files

Use `kebab-case` file names and `PascalCase` component names.

```text
prospect-card.tsx
collision-warning.tsx
manager-dashboard.tsx
```

```tsx
export function ProspectCard() {}
```

## 15. React hooks

Hook names use `use` + `Pascal/camel` concept:

```ts
useProspect();
useReservation();
useManagerDashboard();
```

Hook files:

```text
use-prospect.ts
use-reservation.ts
```

## 16. Database

PostgreSQL names use `snake_case`.

Tables:

```text
tenants
organizations
users
teams
prospects
prospect_contacts
campaigns
assignments
reservations
prospect_actions
follow_ups
audit_logs
```

Columns:

```text
tenant_id
prospect_id
created_at
updated_at
expires_at
assigned_user_id
```

TypeScript may map these to:

```ts
tenantId;
prospectId;
createdAt;
```

## 17. REST endpoints

Use:

- lowercase;
- plural resources;
- `kebab-case` only when multiple words are required.

Examples:

```http
GET /prospects
GET /prospects/:prospectId
POST /assignments
POST /assignments/bulk
POST /reservations/claim
GET /manager/dashboard
```

## 18. Event names

Use `domain.event`.

```text
prospect.assigned
reservation.claimed
reservation.rejected
action.logged
followup.due
override.requested
override.decided
import.completed
```

## 19. Environment variables

Use `UPPER_SNAKE_CASE`.

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
OBJECT_STORAGE_BUCKET
APP_ENV
```

## 20. Git branches

Format:

```text
<type>/<ticket>-<short-description>
```

Examples:

```text
feature/TR-42-reservation-claim
fix/TR-83-reservation-race-condition
refactor/TR-91-collision-engine
docs/TR-102-api-conventions
test/TR-110-reservation-concurrency
chore/TR-115-upgrade-nextjs
```

Allowed branch prefixes:

```text
feature/
fix/
hotfix/
refactor/
docs/
test/
chore/
```
