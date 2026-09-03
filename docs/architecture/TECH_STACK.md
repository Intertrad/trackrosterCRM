---

# `docs/architecture/TECH_STACK.md`

```md
# TrackRoster Technology Stack

**Status:** Accepted for MVP

## Monorepo

Package manager:

`pnpm`

Build orchestration:

`Turborepo`

Primary language:

`TypeScript`

## Frontend

Framework:

`Next.js`

UI:

`React`

Styling:

`Tailwind CSS`

Frontend responsibilities include presentation, forms, navigation, and
visualization of server decisions.

## Backend

Framework:

`NestJS`

Architecture:

`API-first modular monolith`

API style:

`REST`

The backend owns authorization and business rules.

## Background Processing

`apps/worker`

The worker will handle asynchronous tasks such as:

- notifications;
- follow-up processing;
- imports;
- scheduled reports;
- integration jobs.

## Database

Primary database:

`PostgreSQL`

Geospatial support:

`PostGIS`

## Cache / Queue

`Redis`

Possible responsibilities:

- cache;
- queue coordination;
- temporary data;
- selected reservation support.

Redis must not become the only source of critical business history.

## Infrastructure

Initial infrastructure technologies:

- Docker;
- Nginx or equivalent ingress;
- Terraform where appropriate;
- GitHub Actions.

## Observability

Production should provide:

- structured logs;
- centralized error tracking;
- metrics;
- health checks;
- audit logs.

## Engineering Tooling

Repository standards use:

- ESLint;
- Prettier;
- TypeScript;
- Husky;
- lint-staged;
- commitlint;
- GitHub Actions.
```
