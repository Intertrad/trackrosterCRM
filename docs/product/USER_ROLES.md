# TrackRoster User Roles

**Status:** Draft

TrackRoster follows least-privilege access.

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
