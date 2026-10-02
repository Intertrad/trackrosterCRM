# TrackRoster

> **Current backend snapshot — 2026-09-30:** See
> [`docs/backend/BACKEND_AUDIT_2026-09-30.md`](docs/backend/BACKEND_AUDIT_2026-09-30.md)
> for verified test gates, migration/schema counts, fixes, and remaining production
> evidence.

> Documentation status: implementation-aligned overview. See [`docs/README.md`](docs/readme.md) for the documentation index and [`docs/backend/IMPLEMENTATION_STATUS.md`](docs/backend/IMPLEMENTATION_STATUS.md) for verified versus pending work.

> **Each prospect, at the right time, by the right team.**

TrackRoster is a multi-tenant prospecting coordination platform designed to help
organizations assign prospects, prevent conflicting outreach, preserve a shared
history of activity, and give managers real-time visibility across teams, campaigns,
territories, and organizations.

TrackRoster is not intended to be a generic CRM. Its core purpose is to coordinate
prospecting work safely and clearly before, during, and after each commercial action.

---

## Product goals

TrackRoster is designed to provide:

- one canonical identity for each prospect or establishment;
- explicit ownership of active prospecting work;
- server-side anti-collision checks before protected actions;
- temporary prospect reservations for concurrent work;
- immutable prospecting action history;
- follow-up and task coordination;
- traceable manager overrides;
- tenant-aware and role-aware access control;
- manager dashboards and operational reporting;
- controlled imports and exports.

The initial product is being designed for internal deployment first, while preserving
a path toward a future SaaS offering.

---

## Core product principles

The following rules are treated as system invariants:

1. **One prospect, one canonical identity**  
   Duplicate prospect or establishment records should be detected and reviewed.

2. **Explicit ownership**  
   Active prospecting work must have a clear responsible user, team, campaign, and
   scope.

3. **One action = one history entry**  
   Calls, visits, emails, letters, meetings, and follow-ups must append history rather
   than overwrite previous activity.

4. **Verify before acting**  
   Protected prospecting actions must pass the anti-collision decision process before
   contact begins.

5. **Server-side enforcement**  
   The frontend may display decisions, but authoritative business rules are enforced by
   the backend.

6. **Traceable exceptions**  
   Manager overrides require an explicit reason and must be auditable.

7. **Least-privilege access**  
   Users should only see data required for their tenant, organization, team, campaign,
   territory, and role.

---

## Architecture

TrackRoster starts as an **API-first modular monolith**.

```text
                    ┌──────────────────────┐
                    │      Next.js Web     │
                    │      apps/web        │
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
                 │ + PostGIS  │   │ cache/jobs │
                 └──────┬─────┘   └────┬──────┘
                        │              │
                        └──────┬───────┘
                               ▼
                    ┌──────────────────────┐
                    │   Background Worker  │
                    │     apps/worker      │
                    └──────────────────────┘
```

### Architectural rule

> **The frontend presents decisions. The backend owns decisions. The database enforces
> critical invariants wherever possible.**

For example, the web application can display whether a prospect is available,
blocked, or requires manager approval, but the authoritative anti-collision decision
must be made by the NestJS API.

---

## Technology stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- NestJS
- TypeScript
- REST API
- Modular monolith architecture

### Data

- PostgreSQL
- PostGIS
- Redis

### Monorepo

- pnpm
- Turborepo

### Infrastructure

- Docker
- Nginx
- Terraform
- GitHub Actions

The exact production hosting provider and some infrastructure implementation details
will be finalized through architecture decisions as the project evolves.

---

## Repository structure

```text
trackroster/
│
├── apps/
│   ├── web/                         # Next.js frontend
│   ├── api/                         # NestJS backend
│   └── worker/                      # Background jobs
│
├── packages/
│   ├── types/                       # Shared TypeScript types
│   ├── validation/                  # Shared validation
│   ├── ui/                          # Shared UI components
│   └── config/                      # Shared tooling/configuration
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── docs/
│   ├── architecture/
│   ├── engineering/
│   ├── decisions/
│   ├── product/
│   ├── api/
│   ├── operations/
│   └── reference/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── terraform/
│
├── .github/
│   └── workflows/
│
├── CONTRIBUTING.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
└── .gitignore
```

---

## Backend domain modules

The NestJS application is organized by business domain rather than by global
technical folders.

Recommended modules:

```text
apps/api/src/modules/

auth/
tenants/
organizations/
users/
teams/
prospects/
contacts/
campaigns/
assignments/
reservations/
collision/
actions/
follow-ups/
imports/
notifications/
reporting/
audit/
```

This keeps the modular monolith aligned with product boundaries.

---

## Frontend organization

Business-specific frontend logic should live under feature folders.

Example:

```text
apps/web/src/

app/
components/
features/
hooks/
lib/
services/
stores/
types/
```

Example feature:

```text
features/prospects/
├── components/
├── hooks/
├── api/
├── schemas/
└── types/
```

Generic reusable UI belongs in shared components or `packages/ui`.

---

## Documentation

The `docs/` directory is the source of truth for product, architecture, engineering,
and operational decisions.

Start here:

- [Documentation Index](./docs/readme.md)
- [Product Scope](./docs/PRODUCT_SCOPE.md)
- [Requirements](./docs/REQUIREMENTS.md)
- [Business Rules](./docs/BUSINESS_RULES.md)
- [System Architecture](./docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Technology Stack](./docs/architecture/TECH_STACK.md)
- [Database Architecture](./docs/architecture/DATABASE_ARCHITECTURE.md)
- [API Architecture](./docs/architecture/API_ARCHITECTURE.md)
- [Security Architecture](./docs/architecture/SECURITY_ARCHITECTURE.md)
- [Naming Conventions](./docs/engineering/NAMING_CONVENTIONS.md)
- [Engineering Standards](./docs/engineering/ENGINEERING_STANDARDS.md)
- [Git Workflow](./docs/engineering/GIT_WORKFLOW.md)
- [Testing Strategy](./docs/engineering/TESTING_STRATEGY.md)
- [Collision Rules](./docs/product/COLLISION_RULES.md)
- [API Specification](./docs/api/API_SPEC.md)

Major technical choices are documented under:

```text
docs/decisions/
```

---

## Getting started

### Prerequisites

Install:

- Node.js
- pnpm
- Docker
- Docker Compose
- Git

Use the Node.js version defined by the repository once a version file or `engines`
constraint is added.

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd trackroster
```

Install dependencies:

```bash
pnpm install
```

---

## Environment configuration

Each deployable application should provide an example environment file.

Recommended pattern:

```text
apps/web/.env.example
apps/api/.env.example
apps/worker/.env.example
```

Create local environment files from the examples:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

Never commit real secrets.

Typical backend configuration may include:

```text
APP_ENV
DATABASE_URL
REDIS_URL
JWT_SECRET
```

Only document variables that are actually implemented.

---

## Local infrastructure

Start local infrastructure:

```bash
docker compose up -d
```

This should eventually provide the local dependencies required by TrackRoster, such as:

- PostgreSQL / PostGIS;
- Redis;
- supporting development services when added.

Check running containers:

```bash
docker compose ps
```

Stop local infrastructure:

```bash
docker compose down
```

---

## Development

Once the workspace scripts are defined, the preferred monorepo development command is:

```bash
pnpm dev
```

Individual applications should also be runnable independently through workspace
filters.

Typical examples:

```bash
pnpm --filter web dev
pnpm --filter api dev
pnpm --filter worker dev
```

The exact script names in `package.json` are authoritative.

---

## Quality checks

The root workspace should expose standard commands for:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI should run the same commands used locally whenever possible.

---

## Database changes

All database schema changes must be migration-driven.

Rules:

- never modify the production schema manually;
- every schema change requires a migration;
- review destructive migrations carefully;
- use synthetic development seed data;
- never commit real customer or prospect datasets.

See:

- [Database Architecture](./docs/architecture/DATABASE_ARCHITECTURE.md)
- [Data lifecycle and secure imports](./docs/operations/DATA_LIFECYCLE.md)
- [Current development status](./docs/CURRENT_STATUS.md)

---

## Anti-collision system

The anti-collision engine is TrackRoster's central domain capability.

A protected action may result in:

```text
ALLOWED
BLOCKED
MANAGER_APPROVAL_REQUIRED
```

The decision can consider:

1. duplicate identity;
2. active assignment;
3. planned actions;
4. active reservations;
5. recent-contact cooling periods;
6. multi-organization policies;
7. manager override rules.

Reservation claims must be concurrency-safe.

Two incompatible simultaneous claims must never both succeed.

See:

- [Collision Rules](./docs/product/COLLISION_RULES.md)
- [ADR-004 — Reservation Concurrency](./docs/decisions/ADR-004-reservation-concurrency.md)

---

## Multi-tenancy

TrackRoster is designed with tenant isolation from the beginning.

Tenant boundaries must apply to:

- API queries;
- background jobs;
- database access;
- caches;
- exports;
- reports;
- object storage;
- audit operations.

A feature is not complete if it works functionally but can cross tenant boundaries.

See:

- [ADR-003 — Multi-Tenancy](./docs/decisions/ADR-003-multi-tenancy.md)
- [Security Architecture](./docs/architecture/SECURITY_ARCHITECTURE.md)

---

## Testing priorities

The highest-priority automated tests cover:

- reservation concurrency;
- collision decisions;
- tenant isolation;
- authorization;
- immutable action history;
- manager overrides;
- import validation and duplicate detection.

The MVP must include automated concurrency testing proving that two incompatible
reservation claims cannot both succeed.

See:

- [Testing Strategy](./docs/engineering/TESTING_STRATEGY.md)

---

## Engineering conventions

TrackRoster uses the following naming rules:

| Area       | Convention         | Example               |
| ---------- | ------------------ | --------------------- |
| Folders    | `kebab-case`       | `collision-engine/`   |
| Files      | `kebab-case`       | `prospect-service.ts` |
| Variables  | `camelCase`        | `prospectId`          |
| Functions  | `camelCase`        | `claimReservation()`  |
| Classes    | `PascalCase`       | `ReservationService`  |
| Types      | `PascalCase`       | `CollisionDecision`   |
| Constants  | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE`   |
| PostgreSQL | `snake_case`       | `prospect_id`         |
| Events     | `domain.event`     | `reservation.claimed` |

See:

- [Naming Conventions](./docs/engineering/NAMING_CONVENTIONS.md)

---

## Git workflow

Branch format:

```text
<type>/<ticket>-<short-description>
```

Examples:

```text
feature/TR-42-reservation-claim
fix/TR-83-reservation-race-condition
docs/TR-102-api-conventions
```

Commits follow Conventional Commits:

```text
feat(reservations): add atomic prospect claim
fix(collision): prevent concurrent reservation creation
docs(architecture): document tenant isolation
```

See:

- [Contributing](./CONTRIBUTING.md)
- [Git Workflow](./docs/engineering/GIT_WORKFLOW.md)

---

## Pull requests

Pull requests should be:

- focused;
- tested;
- documented;
- reviewed for tenant and authorization impact;
- reviewed for business-rule impact.

Changes affecting collision rules, action history, authorization, tenancy, auditability,
or exports require particular care.

Use the repository pull request template under:

```text
.github/PULL_REQUEST_TEMPLATE.md
```

---

## Security

Core security expectations include:

- server-side authorization;
- tenant isolation;
- least privilege;
- secure secret management;
- TLS in production;
- controlled exports;
- audit logs;
- tested backup and restore;
- no sensitive data in source control.

Security-sensitive behavior must not rely on frontend checks.

---

## Product roadmap

The initial delivery focuses on the operational core:

- accounts, roles, and teams;
- imports;
- prospects and contacts;
- campaigns and assignments;
- action history;
- anti-collision reservations;
- follow-ups and notifications;
- manager dashboard;
- audit and exports.

Later versions may introduce mapping improvements, calendar integrations, public APIs,
offline capabilities, telephony, AI assistance, route optimization, enterprise SSO,
billing, and additional SaaS capabilities.

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Important engineering references:

- [Engineering Standards](./docs/engineering/ENGINEERING_STANDARDS.md)
- [Naming Conventions](./docs/engineering/NAMING_CONVENTIONS.md)
- [Git Workflow](./docs/engineering/GIT_WORKFLOW.md)
- [Testing Strategy](./docs/engineering/TESTING_STRATEGY.md)

---

## Project status

TrackRoster is under active development.

The product documentation defines the intended behavior, while implementation details
will continue to evolve through reviewed code changes and Architecture Decision
Records.

---

## License

No public license is defined in this README.

Add a `LICENSE` file when the project's distribution and ownership policy is formally
decided.
