# TrackRoster Documentation

This directory contains the technical, product, architectural, and operational
documentation for TrackRoster.

TrackRoster is a multi-tenant prospect coordination platform designed to assign,
coordinate, track, and protect prospecting activities across teams, territories,
campaigns, and organizations.

The documentation in this directory is considered part of the product and must
be updated whenever a significant product or architectural decision changes.

---

## Documentation Structure

### Product

Business requirements and product behavior.

- [Product Scope](./PRODUCT_SCOPE.md)
- [Requirements](./REQUIREMENTS.md)
- [Business Rules](./BUSINESS_RULES.md)
- [User Roles](./product/USER_ROLES.md)
- [User Flows](./product/USER_FLOWS.md)
- [Prospect Lifecycle](./product/PROSPECT_LIFECYCLE.md)
- [Collision Rules](./product/COLLISION_RULES.md)

---

## Architecture

Technical architecture and system design.

- [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
- [Technology Stack](./architecture/TECH_STACK.md)
- [Database Architecture](./architecture/DATABASE_ARCHITECTURE.md)
- [API Architecture](./architecture/API_ARCHITECTURE.md)
- [Security Architecture](./architecture/SECURITY_ARCHITECTURE.md)
- [Worker Architecture](./architecture/WORKER_ARCHITECTURE.md)

---

## Engineering

Development standards shared by all contributors.

- [Engineering Standards](./engineering/ENGINEERING_STANDARDS.md)
- [Naming Conventions](./engineering/NAMING_CONVENTIONS.md)
- [Git Workflow](./engineering/GIT_WORKFLOW.md)
- [Testing Strategy](./engineering/TESTING_STRATEGY.md)
- [Error Handling](./engineering/ERROR_HANDLING.md)
- [Logging & Observability](./engineering/LOGGING_OBSERVABILITY.md)

---

## Architecture Decision Records

Important technical decisions are documented using ADRs.

- ADR-001 — Modular Monolith
- ADR-002 — PostgreSQL and PostGIS
- ADR-003 — Multi-Tenancy
- ADR-004 — Reservation Concurrency
- [ADR-005 — Identity, Tenant Membership, and Support Access](./decisions/ADR-005-identity-tenancy-and-support-access.md)

---

## API

- [API Specification](./api/API_SPEC.md)
- [API Conventions](./api/API_CONVENTIONS.md)
- [Event Catalog](./api/EVENT_CATALOG.md)

---

## Operations

- [Deployment](./operations/DEPLOYMENT.md)
- [Environments](./operations/ENVIRONMENTS.md)
- [Backup & Restore](./operations/BACKUP_RESTORE.md)
- [Incident Response](./operations/INCIDENT_RESPONSE.md)

---

## Production Readiness

- [Production readiness index](./production/README.md)
- [Schema source of truth](./production/SCHEMA_SOURCE_OF_TRUTH.md)
- [Implemented API inventory](./production/API_INVENTORY.md)
- [Product/backend coverage](./production/PRODUCT_BACKEND_COVERAGE.md)
- [Identity and access migration plan](./production/IDENTITY_ACCESS_MIGRATION_PLAN.md)
- [Identity Phase A deployment runbook](./production/IDENTITY_PHASE_A_RUNBOOK.md)
- [Identity Phase B deployment runbook](./production/IDENTITY_PHASE_B_RUNBOOK.md)

---

## Reference Material

The original product design dossier is stored under:

`docs/reference/TrackRoster-Product-Design-Dossier.pdf`

The dossier provides the initial product vision and requirements.

Implementation documentation in this repository should evolve as the product
evolves while preserving the core business principles defined by the dossier.

---

## Documentation Rule

Code explains **how** something works.

Documentation explains:

- why it exists;
- what guarantees it provides;
- what architectural constraints apply;
- what business rules must never be violated.

Major architectural decisions must be recorded as ADRs.
