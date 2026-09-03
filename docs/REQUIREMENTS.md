# TrackRoster Requirements

**Status:** Draft  
**Source:** TrackRoster Product Design Dossier v1.0  
**Last Updated:** September 2026

## 1. Purpose

This document defines the functional and non-functional requirements for the
TrackRoster platform.

TrackRoster coordinates prospecting activities across teams, campaigns,
territories, and organizations while preventing unauthorized contact collisions.

---

## 2. Functional Requirements

### FR-001 — Authentication

The system must provide named user accounts and secure authentication.

### FR-002 — Role-Based Access

The system must support:

- Super Administrator
- Client Administrator
- Director
- Manager
- Prospector
- Observer / Auditor

### FR-003 — Tenant Isolation

Users must only access data belonging to their authorized tenant.

### FR-004 — Organizational Scope

Access may additionally be restricted by:

- organization;
- team;
- campaign;
- territory;
- role.

### FR-005 — Prospect Import

Administrators must be able to import prospects using Excel or CSV files.

### FR-006 — Import Validation

The import process must:

1. map columns;
2. normalize data;
3. detect anomalies;
4. detect potential duplicates;
5. provide a preview before final import.

### FR-007 — Prospect Management

Authorized users must be able to search and view prospect and establishment data.

### FR-008 — Contacts

Prospects may contain one or more contacts including name, role, telephone,
email, and related information.

### FR-009 — Campaigns

Authorized users must be able to create and manage prospecting campaigns.

### FR-010 — Assignments

Managers must be able to assign and reassign prospects to users and teams.

### FR-011 — Anti-Collision Check

Before a protected prospecting action begins, the server must return one of:

- ALLOWED
- BLOCKED
- MANAGER_APPROVAL_REQUIRED

### FR-012 — Reservation

When contact is allowed, the server must create a temporary reservation.

### FR-013 — Concurrent Reservation Protection

Two incompatible users must not simultaneously obtain a reservation for the
same protected prospect context.

### FR-014 — Action Logging

Every prospecting action must create a new history entry.

Actions include:

- telephone calls;
- visits;
- email;
- postal communication;
- meetings;
- follow-ups.

### FR-015 — Follow-Ups

Users must be able to schedule a future action after an interaction.

### FR-016 — Manager Override

Where policy permits, managers may approve or reject restricted actions.

An override must include a reason.

### FR-017 — Audit Trail

Sensitive operations must create audit entries.

### FR-018 — Manager Dashboard

Managers must be able to view workload, activity, overdue actions, results,
collisions, and team performance.

### FR-019 — Search and Filtering

Users must be able to search and filter prospects using authorized business
criteria.

### FR-020 — Export

Authorized users may export data within their permitted scope.

Exports must be auditable.

---

## 3. Non-Functional Requirements

### NFR-001 — Security

Authorization and anti-collision decisions must be enforced server-side.

### NFR-002 — Multi-Tenancy

Data belonging to one tenant must never be exposed to another tenant.

### NFR-003 — Concurrency

Reservation operations must be transactionally safe.

### NFR-004 — Auditability

Sensitive operations must be attributable to a user and timestamp.

### NFR-005 — Responsive UI

Critical workflows must work on desktop and mobile.

### NFR-006 — Performance

The anti-collision decision should normally complete in less than one second.

### NFR-007 — Reliability

Critical reservation and action operations must support protection against
duplicate requests.

### NFR-008 — Backup

Production data must have automated backups and a tested restore procedure.

### NFR-009 — Observability

Production services must provide centralized logs, metrics, and error tracking.

---

## 4. Requirement Changes

A pull request that changes a product requirement must update this document in
the same PR.
