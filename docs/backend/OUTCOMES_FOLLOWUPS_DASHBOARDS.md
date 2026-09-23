# Outcomes, follow-ups and dashboards

All paths use `/api/v1` and bearer authentication. This document records the supported contract, not production deployment certification.

## Configurable action outcomes

`GET /settings/default-statuses` returns tenant `outcomes`, fixed `lifecycleStages`, `updatedAt` and `etag`. Every authenticated workspace member can read the catalogue. `PATCH` requires a tenant administrator, `Idempotency-Key`, and optional `If-Match` from the current configuration. Its body replaces the entire outcomes array (1–100 definitions).

Each definition contains `code` (lowercase letters/digits/underscores, starts with a letter, maximum 40), `label` (nonblank, maximum 100), `behavior`, `enabled`, and a nonempty unique `actionTypes` array. Example custom definition:

```json
{
  "code": "review_finished",
  "label": "Review finished",
  "behavior": "completed",
  "enabled": true,
  "actionTypes": ["task"]
}
```

Behaviors: `no_answer`, `contacted`, `interested`, `not_interested`, `qualified`, `converted`, `do_not_contact`, `completed`. Action types: `call`, `email`, `message`, `visit`, `task`, `note`. Task/note definitions must use `completed`; contact definitions cannot. Every action type must retain an enabled option, and every contact type must retain enabled opposition. Built-in codes cannot be reassigned different semantics.

Completion accepts configured codes, validates current availability inside the transaction, and snapshots the definition in action event evidence. Custom opposition codes create the same consent block as built-in opposition and cannot schedule another contact. Configuration changes cannot rewrite historical outcomes. Corrections append evidence only; they do not replay business effects. Explicit lifecycle changes remain separate completion inputs; lifecycle enum customization is not supported.

Migration 0047 adds tenant outcome settings. Validation includes custom codes, history, removal, opposition, tenant isolation, administrator restrictions, stale ETags and permission checks before cached replay.

## Canonical follow-ups

- `GET /follow-ups`: scoped lists with `status=pending|due|missed|completed|cancelled|all`, optional `teamId`, `campaignId`, UUID `cursor`, and `limit` (1–100, default 50). Canonical responses contain `items,nextCursor`. `missed` is derived from pending deadlines before now; `due` means pending deadlines in the next 24 hours. No new persisted status is invented. `overdue=true|false` remains available.
- Compatibility: requests with `teamId` and no `status`, `cursor` or `campaignId` retain the existing prospector pending-queue response, including campaign/establishment names. Use `status=pending` explicitly for canonical pagination with a team filter.
- `GET /follow-ups/{id}`: persisted source/next-action details, linked source action when available, `etag`, and the most recent 50 canonical audit events. Own historical follow-ups remain readable; source assignment roles constrain visibility. Older unrecorded changes are not fabricated.
- `PATCH /follow-ups/{id}`: change future `dueAt`, category (`todo|follow_up|meeting`) or channel (`call|email|message|visit|letter`, nullable). At least one change is required. Reminder scheduling must succeed before committing a deadline change; stale scheduled jobs are harmless because the worker reloads the current deadline/status.
- `POST /follow-ups/{id}/complete`: complete a pending follow-up under an active assignment. This closes the task; it does not create contact activity or bypass consent to contact someone.
- `POST /follow-ups/{id}/cancel`: requires a nonblank `reason` (maximum 2,000 characters); cancellation can clean up obsolete or paused assignment follow-ups.

All three mutations require `Idempotency-Key` and accept optional `If-Match`. Foreign or unauthorized IDs return 404. Terminal rows cannot be changed with a new key. Current authorization is checked before cached replay and again under transaction locks. Administrators/directors/managers act only in their structural scope; prospectors act on their own or eligible team-owned follow-ups. Observers read only. Canonical mutations are audited atomically and appear in the unified prospect timeline. Legacy campaign-scoped follow-up endpoints remain available.

## Canonical dashboards

`GET /dashboard/today?teamId={id}&timeZone=Europe/Paris` exposes the existing authorized prospector day boundaries, priorities and todo/follow-up/meeting/overdue counts. Time zones are IANA identifiers with DST-aware day boundaries. `routeSummary.available=false` explicitly identifies the route-planning dependency; this portion of the original contract remains pending.

`GET /dashboard/manager` exposes the existing manager report plus current team workload, paused assignment exceptions, campaign-linked territory counts and canonical action outcomes. Query fields: optional `organizationId`, `teamId`, `userId`, `campaignId`, paired ISO `from`/`to`. Omitted dates default to the last 30 days; maximum range is 366 days. Existing report authorization validates filters before aggregating. Territory counts describe campaign links, not geometric coverage; a prospect can count in multiple linked territories.

`GET /dashboard/director` requires tenant administration or an explicit director organization scope. It adds organization comparison for current/paused assignments within the authorized scope. `objectiveRisks.available=false` identifies the missing campaign-objective target model. This dashboard remains partial until targets and risk calculations are implemented.

`GET /dashboard/admin` requires tenant administration. It returns current active member/organization/team/campaign counts, sessions created in the last 30 days (a session count, not unique-user adoption), missing prospect coordinates/phone counts, failed export jobs and imports awaiting commit. Operational counts do not certify production readiness.

Management workload, territory and organization comparison sections are capped at 500 groups with explicit `truncated` flags. Activity/outcome totals apply the reporting date range; assignment workload is a current snapshot. Independent reporting queries can observe changes during generation; these are operational dashboards, not a financial snapshot. Existing `/prospector/today` and `/manager/dashboard` endpoints remain compatible. Platform administration dashboards are a separate pending contract.

Validation: 651 API unit tests, 526 API integration tests and 10 worker integration tests passed; API typecheck/build, affected-file lint and 48-entry migration integrity passed. Eleven new integration cases cover outcome semantics/history, follow-up races/reminder failures/ownership and dashboard role/tenant filters.
