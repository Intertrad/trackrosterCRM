# TrackRoster User Flows

**Status:** Draft

## Prospector — My Day

The Prospector opens the My Day screen.

TrackRoster displays prioritized:

- follow-ups;
- appointments;
- overdue work;
- scheduled prospecting actions.

The user selects a prospect.

Before contact begins, TrackRoster performs the anti-collision check.

The user receives:

`ALLOWED`

or

`BLOCKED`

or

`MANAGER_APPROVAL_REQUIRED`.

If allowed, a reservation is created.

The user performs the action and records the result.

The user then creates the next follow-up, meeting, or closes the workflow.

---

## Prospector — Record an Action

The user selects the communication channel.

The user records:

- contact or reason;
- result;
- structures presented;
- summary;
- next action or closure.

The server automatically records the actor and timestamp.

The action becomes part of the immutable prospect timeline.

---

## Manager — Import Prospects

The Manager or Administrator:

1. uploads Excel or CSV;
2. maps columns;
3. reviews normalized values;
4. reviews duplicate candidates;
5. reviews anomalies;
6. previews the import;
7. confirms the final import.

The import produces a processing report.

---

## Manager — Assign Prospects

The Manager selects one or more prospects.

The Manager selects:

- user;
- team;
- territory;
- campaign.

The system verifies authorization and relevant rules.

Assignments are stored without deleting previous assignment history.

---

## Manager — Override

A protected action requires manager approval.

The Manager reviews the prospect, collision reason, existing history, and
campaign context.

The Manager approves or rejects the request and provides a reason.

The decision is stored in the audit history.

---

## Manager — Dashboard

The Manager reviews:

- portfolio workload;
- overdue follow-ups;
- recent activity;
- contacts;
- conversion;
- collisions prevented;
- overrides;
- reassignment activity.

The Manager can filter the data by authorized business dimensions.
