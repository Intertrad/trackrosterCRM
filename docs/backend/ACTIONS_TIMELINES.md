# Activities, outcomes and unified prospect timelines

This stage implements the nine action contracts and a canonical-prospect timeline. Existing campaign activity/timeline and follow-up APIs remain available.

| Method | Endpoint                           | Behavior                                                                                   |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/actions`                         | Scoped action queue with filters and cursor pagination                                     |
| POST   | `/actions`                         | Plan call/email/message/visit/task/note                                                    |
| GET    | `/actions/{actionId}`              | Read action, original outcome, version and delivery state                                  |
| PATCH  | `/actions/{actionId}`              | Edit subject, planning notes or due date while open                                        |
| POST   | `/actions/{actionId}/start`        | Start with current assignment and contact reservation checks                               |
| POST   | `/actions/{actionId}/complete`     | Commit outcome and related database changes atomically                                     |
| POST   | `/actions/{actionId}/cancel`       | Finalize an open action with a reason                                                      |
| GET    | `/actions/{actionId}/events`       | Read append-only action event history                                                      |
| POST   | `/actions/{actionId}/corrections`  | Append a reasoned correction to finalized history                                          |
| GET    | `/prospects/{prospectId}/timeline` | Merge authorized action, assignment, activity, consent, follow-up and reservation evidence |

Routes have `/api/v1` and unversioned aliases. Mutations require `Idempotency-Key`. Creates return 201; lifecycle commands return 200. Action responses/list items expose a record `etag`; optionally send it in `If-Match` for update/start/complete/cancel/correction. Detail has additional outcome/delivery data, but its `etag` versions the action record itself. Corrections append events and do not change that record version.

## Planning and access

POST requires `campaignId`, `campaignProspectId` (campaign membership UUID), `type` and nonblank `subject`. Optional fields: `notes`, `dueAt`, `assigneeMembershipId` (defaults to caller). An active assignment is required; the selected assignee must be an active prospector with an explicit grant for its team and match any individually assigned owner. Assignment targets and type are fixed after creation; cancel and create a new action to change them. Terminal campaigns and excluded prospects reject new plans.

Tenant administrators, owning-organization directors and current team managers can plan for an eligible prospector. Prospectors plan their own work. These explicit operational scopes also govern updates, cancellation and corrections. Start/complete requires the action assignee and current operational eligibility. A resource-only campaign grant or organization participation never grants action authority. Observers can read within their explicit scope but cannot mutate.

Visibility follows current assignment scope. Out-of-scope action IDs return 404. Scoped filters are applied before pagination. GET `/actions` supports `campaignId`, `assigneeMembershipId`, `status`, UUID `cursor` and `limit` (1–100, default 25). Events use the same bounded UUID cursor/limit fields; event timestamps describe their chronology.

PATCH accepts only `subject`, nullable `notes` and nullable `dueAt` for planned/started actions. Timestamp inputs require a UTC offset or `Z`. Finalized actions cannot be rewritten.

## Start and completion

Lifecycle: `planned → started → completed`, or `planned/started → cancelled`. Start/complete requires an active campaign/prospect and establishment. Reassignment invalidates the action's captured assignment; create a new action against the replacement. Cancellation remains possible through current authorized management scope.

Contact action start reuses the caller's matching live reservation or acquires one through existing collision/coordination rules. Optional `overrideId` is checked by the existing reservation service. A lease already queued for release cannot be reused. Task/note actions do not acquire contact reservations. Contact completion verifies the exact reservation ID, owner and assignment again; an expired/replaced reservation requires cancellation and a new action. Opposition is checked before cached replay and inside the transaction, with the existing database activity trigger as a final enforcement boundary.

Completion payload example:

```json
{
  "outcomeCode": "interested",
  "notes": "Requested a proposal next week",
  "lifecycleStage": "follow_up",
  "contactUpdate": { "contactId": "<contact UUID>", "email": "contact@example.test" },
  "nextFollowUp": { "dueAt": "2026-10-01T09:00:00Z", "channel": "email" },
  "reservationDisposition": "release"
}
```

Contact outcomes: `no_answer`, `contacted`, `interested`, `not_interested`, `qualified`, `converted`, `do_not_contact`. Task/note completion uses `completed`. Outcome codes describe the result; prospect stage changes occur only when explicitly supplied. Accepted stages: `to_contact`, `contact_made`, `in_progress`, `follow_up`, `qualified`, `converted`.

Optional contact updates support name/email/phone and require that contact to belong to the same canonical prospect. Optional next follow-up must be in the future, assigned to the action assignee, and uses an optional call/email/message/visit/letter channel. Existing consent triggers apply. `do_not_contact` also appends all-channel opposition evidence and cannot include a next follow-up.

One PostgreSQL transaction commits the original outcome, action completion, legacy contact activity (for existing reports/cooling-off), explicit stage change, contact edits, optional follow-up, event/audit evidence and delivery intents. Any failure rolls back all those database writes. Concurrent completion produces one original outcome. Reservation disposition is `release` by default or `keep`; cancellation also requests release of its captured lease.

## Durable external delivery

Redis reservation release and BullMQ scheduling cannot participate in the PostgreSQL transaction. `action_effects` durably records those requests with the completion. The API delivery service polls every five seconds, locks pending rows with `SKIP LOCKED`, and marks successful effects delivered. Failed effects remain pending for retry; other selected effects can still be delivered. Reminder scheduling uses existing deterministic job IDs, and reservation release targets only the captured reservation token using the correct legacy/organization lock path. Retries cannot release a replacement token.

GET action detail exposes effect IDs/types and nullable `deliveredAt`; completion does not claim external delivery has finished. At least one API process must remain running for delivery. `ACTION_EFFECTS_POLLING=off` disables automatic polling; the isolated test runner uses this and drains explicitly. Keep normal polling enabled in deployment. Reservation acquisition itself is Redis-based: if SQL start persistence fails after acquisition, the lease can remain until retry/release/expiry; a retry can reuse that owned lease.

## Corrections and history

Cancel requires `reason`. Corrections require `reason` and `notes`, with optional corrected `outcomeCode`. They are allowed only for completed/cancelled actions and append an event. They do not rewrite the original outcome or retroactively mutate prospect status, contacts, consent or follow-ups. Readers must show original evidence and corrections together. Action events and original outcomes reject database UPDATE; privileged deletion remains a database-role/retention concern. Every action mutation also records an audit event with its actor and relevant before/after data.

The canonical timeline takes an establishment UUID, `limit` (1–100) and an opaque `cursor`. Ordering is newest first with a timestamp/kind/ID cursor that retains database timestamp precision. It combines:

- Action lifecycle, edits, outcomes, status/contact changes and correction events.
- Existing recorded activities and assignment start/end evidence.
- Follow-up creation/completion/cancellation records and consent evidence.
- Existing prospect-change audits.
- New reservation HTTP acquire/release request and result events, plus action-driven reservation context and queued/processed release records.

Each campaign's history is permission-filtered before union/pagination: seeing a prospect in one campaign does not expose another campaign's private events. Tenant administrators/observers can also read an existing prospect with no campaign history. Reservations before this stage have no invented historical events. Existing follow-up rows expose their stored lifecycle timestamps/current fields; this does not invent previously unrecorded reschedule history.

Reservation HTTP history writes an attempt before calling Redis, then records success/failure. A result-persistence failure is recorded as `outcome_unknown` when possible; a process/database failure may leave only the attempt. These events do not falsely assert that PostgreSQL and Redis committed together. Redis TTL expiry history and full collision policy-decision evidence remain part of the reservation/collision stage.

## Database and verification

Migration `0039_actions_outcomes_timeline.sql` adds `actions`, `action_outcomes`, `action_events`, and `action_effects`, tenant-safe assignment/prospect/actor references, one original outcome per action, and append-only UPDATE triggers. Preserve manually maintained triggers in future migrations. The schema has 49 tables and 40 migrations. Migration 0039 was applied only to the isolated validation database; deploy it before this API version.

The new integration cases cover lifecycle transitions, scope/assignee checks, atomic multi-resource completion, rollback, consent and do-not-contact outcomes, concurrent/idempotent completion, correction immutability, retryable delivery, reservation reuse/release/expiry, reassignment, scoped multi-source timeline pagination and pre-replay permission revocation.

Verification: 647 API unit tests, 429 API integration tests (13 action/timeline cases) and 10 worker integration tests passed. API typecheck/build, affected-file lint and all 40 migration integrity entries passed.

Collision evidence and override request/approval workflows are now implemented; see [collision contracts](COLLISION_OVERRIDES.md). Reservation rules, heartbeat/extension and observed expiry history are now implemented; see [reservation lifecycle](RESERVATION_LIFECYCLE.md). Canonical follow-up/dashboard contract reconciliation and configurable outcomes remain separate ledger items.
