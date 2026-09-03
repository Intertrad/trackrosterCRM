# TrackRoster Product Scope

## 1. Purpose

TrackRoster is a multi-tenant platform for coordinating prospecting activities
across teams, organizations, campaigns, and territories.

Its primary responsibility is to ensure that:

- every prospect has clear ownership;
- prospecting activity is coordinated across teams;
- conflicting contacts are prevented;
- every interaction is recorded;
- managers have real-time operational visibility.

TrackRoster is not intended to be a generic CRM.

Its primary differentiation is coordination and collision prevention between
multiple prospecting teams.

---

# 2. Core Product Principles

TrackRoster follows six non-negotiable principles.

## 2.1 Unique Prospect Identity

A prospect or establishment must have one canonical identity within the tenant.

Duplicate records should be detected before they become active operational
records.

---

## 2.2 Explicit Ownership

Every active campaign assignment must clearly identify:

- the prospect;
- campaign;
- responsible user/team;
- assignment start;
- assignment expiration when applicable.

---

## 2.3 Immutable Action History

Prospecting actions must never overwrite previous actions.

Examples:

- calls;
- visits;
- emails;
- letters;
- meetings;
- follow-ups.

Each action creates a new historical entry.

Derived prospect status may change.

Historical actions must not.

---

## 2.4 Verify Before Acting

Before a prospecting action begins, TrackRoster must determine whether the action
is permitted.

The anti-collision engine evaluates relevant rules before allowing a reservation
or action.

---

## 2.5 Traceable Overrides

Managers may override certain collision rules where permitted.

Every override must record:

- manager;
- reason;
- timestamp;
- affected prospect;
- affected campaign;
- expiration when relevant.

Overrides must appear in the audit log.

---

## 2.6 Least-Privilege Visibility

Users should only have access to data required by their:

- tenant;
- organization;
- role;
- team;
- campaign;
- territory.

---

# 3. MVP Scope

The TrackRoster MVP includes:

- authentication;
- users;
- roles;
- organizations;
- teams;
- prospect import;
- prospect management;
- contacts;
- campaigns;
- assignments;
- action history;
- anti-collision reservations;
- follow-ups;
- notifications;
- manager dashboard;
- audit logs;
- controlled exports.

---

# 4. Outside MVP Scope

The following capabilities are intentionally deferred.

## V1.1

- advanced mapping;
- capacity-based assignment;
- Google/Outlook calendar integration;
- email templates;
- document attachments;
- voice notes;
- scheduled reporting;
- public API/webhooks;
- partial offline PWA.

## V2

- integrated telephony;
- route optimization;
- AI summarization;
- AI coaching;
- automated data enrichment;
- billing;
- white labelling;
- enterprise SSO;
- integration marketplace.
