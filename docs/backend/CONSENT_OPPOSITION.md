# Prospect consent and opposition

Two endpoints are available under `/api/v1` and the existing unversioned aliases:

| Method | Endpoint                           | Behavior                                               |
| ------ | ---------------------------------- | ------------------------------------------------------ |
| GET    | `/prospects/{prospectId}/consents` | Read evidence history and current channel restrictions |
| POST   | `/prospects/{prospectId}/consents` | Append allowed, blocked or unknown evidence            |

Here `prospectId` is the canonical establishment UUID, not a campaign-prospect UUID. Evidence applies across all campaigns referencing that establishment within the tenant.

## Payload and history

POST accepts:

```json
{
  "channel": "phone",
  "status": "blocked",
  "reason": "Contact requested no further telephone calls",
  "evidence": { "source": "telephone conversation" }
}
```

Channels: `all`, `phone`, `email`, `sms`, `visit`. Statuses: `allowed`, `blocked`, `unknown`. A nonblank reason is required (maximum 2000 characters). Optional evidence is a flat object with at most 20 string values, each at most 2000 characters, with a total serialized maximum of 12000 characters. The server records the authenticated membership, recording timestamp and a monotonic sequence.

Optional `contactId` must belong to this exact tenant and establishment. Optional `effectiveAt` defaults to now; nullable `expiresAt` must follow it. Supplied timestamps require `Z` or a UTC offset. Scheduled and backdated evidence is supported. Append a new record to change status: no history update/delete API exists, and a database trigger rejects UPDATE. Privileged database maintenance can delete rows; database-role hardening remains pending.

POST requires `Idempotency-Key` and returns 201. Audit event `prospect.consent_recorded` is committed with the evidence and records its source membership. GET supports UUID `cursor` and `limit` (1–100, default 25), returning `{items, nextCursor, restrictions}`. Pagination uses evidence UUIDs; chronological interpretation uses effective time and sequence. `restrictions` reports current `blocked` booleans for phone/email/sms/visit. False means no effective block; it is not a declaration of affirmative consent.

## Effective restriction rules

For each contact-or-establishment scope and channel, the latest already-effective record wins, ordered by `effectiveAt` and then insertion sequence. Future records do not apply yet. An expired latest record leaves that scope unknown; an older block is not revived. A new `unknown` event similarly clears that scope's earlier status without asserting permission.

Any current block relevant to an operation wins across scopes: an establishment-level `all` block cannot be bypassed by a contact-level or phone-only allowance. Clear the applicable blocking scope with new evidence. An `allowed` record never creates user authorization or overrides other current blocks.

Existing activity/follow-up APIs do not select a contact, so a contact-specific block conservatively blocks that channel for the whole establishment. Unknown status preserves existing workflow behavior; configurable affirmative-consent requirements and channel-specific lawful-basis policies are not introduced here.

## Access

Tenant administrators and owning-organization directors can append evidence. Team managers and explicitly assigned/team-owned prospectors can append within current operational scope. Scoped readers can read their evidence; tenant/organization observers can read but cannot append. Resource-only campaign access or organization participation alone does not grant access to contact evidence. Both endpoints mask out-of-scope prospects with 404. POST rechecks authority before cached replay and inside the write transaction.

## Workflow enforcement

- New reservations conservatively reject any current block because reservations have no contact channel. Existing Redis reservations are not deleted by evidence recording. Release/read remains available.
- Activity writes map `call` to phone and `message` to sms. Email/visit map directly. Relevant opposition returns 409 with `code: CONTACT_BLOCKED`, including attempts to replay an earlier successful activity.
- Pending follow-up creation and updates enforce their planned channel. A null channel is conservatively blocked by any opposition; letter is affected by an `all` block. The HTTP reschedule guard, whose payload has no channel, also conservatively rejects while any restriction is active. Completion and cancellation remain possible.
- PostgreSQL triggers enforce activity and pending follow-up writes even when the database is reached directly. Parent-establishment locks serialize opposition writes with these contact-operation writes. This protects against a block committed after an optimistic HTTP check.
- The reminder worker checks current restrictions when loading a follow-up and again when inserting notifications. Existing pending follow-ups and previously created notifications are retained; suppressed jobs are not automatically re-enqueued after a block expires or is cleared. Rescheduling through the normal API can schedule another reminder.

Evidence recording itself remains available during opposition. Assignments, ownership, historical activities and follow-ups are retained. Opposition does not automatically remove items from work queues or allocation batches; it prevents contact actions. Collision overrides cannot bypass the contact restriction. The reservation check and Redis acquisition are not one cross-system transaction: a race can leave a reservation present, but database-backed activity/follow-up writes still enforce opposition.

## Database, deployment and validation

Migration `0037_prospect_consents.sql` adds `contact_consents`, tenant-safe foreign keys, contact-to-establishment validation, append-only UPDATE protection, restriction resolution and activity/follow-up enforcement triggers. Preserve the functions/triggers in future migrations: Drizzle snapshots do not model them. Migration 0038 evaluates restrictions using the current clock after lock waits, so newly effective opposition cannot be missed by a statement that began earlier. No history is invented for existing prospects.

There are now 45 schema tables and 39 migrations. Migrations 0037–0038 were applied only to the isolated validation database. Apply the full migration chain before deploying the API and worker; both use the restriction function. Production RLS and restricted credentials remain pending.

Validation: 647 API unit tests, 416 API integration tests (8 new consent cases), 57 worker unit tests and 10 worker integration tests passed. API and worker typechecks/builds, affected-file lint and all 39 migration integrity entries passed. Coverage includes scoped access, tenant/contact binding, append-only audit history, idempotency, pagination, channel/global precedence, scheduled/backdated/expired evidence, cross-campaign blocks, direct database enforcement, cancellation, cached replay, concurrent opposition and reminder suppression.

Action outcomes and unified available-history timelines are implemented in the [actions stage](ACTIONS_TIMELINES.md). Next workflow work includes reservation/collision rules and override request/approval flows. External messaging providers, policy-specific affirmative-consent enforcement and retention/erasure tooling remain separate backend work.
