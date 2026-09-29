# TrackRoster User Roles

**Status:** Draft

TrackRoster follows least-privilege access.

Identity and role boundaries are governed by
[ADR-005](../decisions/ADR-005-identity-tenancy-and-support-access.md): a global identity
may hold tenant memberships, tenant roles remain scoped to those memberships, and platform
roles are a separate control-plane authority.

A role does not automatically provide access to all tenant data. Effective
access may also depend on organization, team, campaign, and territory.

## Super Administrator

Platform-level administration.

Responsibilities include:

- tenant management;
- global configuration;
- platform support;
- future SaaS administration.

This role must be highly restricted.

A Super Administrator has no tenant-data access by default. Customer-data support requires
a separate, time-limited, reason-bound, fully audited support grant. Platform staff must
not impersonate a customer membership.

## Client Administrator

Tenant-wide administrative role.

Responsibilities include:

- organizations;
- users;
- teams;
- imports;
- configuration;
- integrations.

## Director

Provides high-level business visibility.

Typical access includes:

- objectives;
- performance;
- reporting;
- authorized exports.

This role should normally be primarily read-oriented.

## Manager

Responsible for operational team management.

Responsibilities include:

- assignments;
- reassignment;
- workload management;
- manager overrides;
- team monitoring;
- reporting;
- quality review.

## Prospector

Responsible for executing prospecting activity.

Typical access includes:

- assigned prospects;
- actions;
- follow-ups;
- schedule;
- authorized prospect history.

A Prospector must not automatically see the entire tenant portfolio.

## Observer / Auditor

Read-only access to a specifically authorized scope.

This role may be used for:

- auditing;
- compliance;
- management observation;
- quality review.

## Authorization Rule

Effective access should be evaluated using:

`tenant + role + organization + team + campaign + territory`

Authorization must always be enforced by the backend.

Platform authorization is evaluated separately and must never be inferred from a tenant
role. Row-level security enforces the tenant boundary; application authorization continues
to enforce organization, team, campaign, territory, and product-role scope.
