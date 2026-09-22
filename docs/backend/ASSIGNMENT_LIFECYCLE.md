# Canonical assignment lifecycle

Implemented and validated locally. Apply migrations 0043–0044 with the matching API build before integration. Only the isolated test database was migrated during this stage. Protected paths below use `/api/v1` and bearer authentication.

## Endpoints

| Method | Path                                   | Behavior                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/assignments`                         | Scope-filtered list. Optional `campaignId`, `teamId`, `assignedUserId`, `status`, UUID `cursor`; `limit` 1–100 (default 25). All statuses included unless filtered. Response `{items,nextCursor}` in ascending UUID order.                                                     |
| GET    | `/assignments/unassigned`              | Required `campaignId`; optional `teamId`, cursor and limit. Returns active campaign-prospect memberships without any current assignment in a nonterminal campaign. Response `{items,nextCursor}`; each item has `campaignProspectId`, `campaignId`, `establishmentId`, `name`. |
| POST   | `/assignments`                         | Create one assignment through the same capacity/authority transaction as bulk assignment. Returns 201 and the assignment detail.                                                                                                                                               |
| GET    | `/assignments/{assignmentId}`          | Assignment fields, record `etag`, up to 100 scoped ownership records (`history`, `historyTruncated`), latest 50 canonical lifecycle events.                                                                                                                                    |
| PATCH  | `/assignments/{assignmentId}`          | Change open state (`active`/`paused`) and/or priority (`low`, `normal`, `high`, `critical`). At least one field is required.                                                                                                                                                   |
| POST   | `/assignments/{assignmentId}/reassign` | End this ownership as revoked and create an active replacement, retaining priority. Requires a different eligible target and a reason. Returns the replacement record.                                                                                                         |
| POST   | `/assignments/{assignmentId}/complete` | End ownership with completed state and a reason. Does not change the prospect's sales lifecycle stage.                                                                                                                                                                         |
| POST   | `/assignments/{assignmentId}/revoke`   | End ownership with revoked state and a reason.                                                                                                                                                                                                                                 |

Mutations require `Idempotency-Key`. PATCH and lifecycle commands accept optional `If-Match` with the record's `etag`; stale versions return 412. Replays recheck current source and target management permission before returning cached success. Lifecycle commands return 200. Detail/list records expose tenant membership IDs in `assignedUserId`, not identity IDs.

## Payload examples

Create:

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "campaignProspectId": "CAMPAIGN_PROSPECT_UUID",
  "teamId": "TEAM_UUID",
  "assignedUserId": "MEMBERSHIP_UUID"
}
```

Omit `assignedUserId` or pass null for team ownership. Use campaign-prospect IDs, not canonical establishment IDs.

Pause/change priority:

```json
{ "status": "paused", "priority": "high" }
```

Reassign:

```json
{
  "teamId": "NEW_TEAM_UUID",
  "assignedUserId": "NEW_MEMBERSHIP_UUID",
  "reason": "Regional workload balancing"
}
```

Complete/revoke:

```json
{ "reason": "Work finished for this assignment" }
```

Reasons must contain at least three non-whitespace characters and fit within 1,000 characters. Terminal status changes must use the lifecycle commands, not PATCH. Terminal ownership cannot be reopened or edited. An ended assignment frees capacity; if its prospect/campaign remains eligible, a new assignment can be created. The unassigned queue includes these eligible prospects again.

## Ownership, permission and pause semantics

Tenant admins and owning organization directors manage assignments. A manager must have authority over the source team and, for reassignment, the destination team. Configurable assignment permission restrictions apply. New targets must belong to the campaign's owning organization; personal targets require active membership/identity and an exact team prospector grant. Capacity includes current assignments across campaigns. Reassigning within one team excludes the current assignment from capacity calculations.

Read scope uses each historical assignment's own organization/team/owner. Tenant/organization/team observers may read their scope. Prospectors see their individual records and team-queue records, but cannot manage ownership. Historical access is evaluated against current grants. A transferred prospect does not expose its new team's ownership through the former team's detail/history endpoint. Public lifecycle events omit raw before/after snapshots; complete snapshots remain in administrative audit evidence.

The unassigned queue requires campaign-wide assignment authority, or `teamId` matching an explicitly managed team. It is an allocation queue, not a contact-permission decision or a capacity guarantee. Use preview before assignment.

Pause retains ownership, blocks replacement assignment, and continues consuming capacity. It blocks new reservations, renewal and contact execution; contact action start/complete and legacy activity writes recheck state. Database triggers also reject contact execution against paused assignments. Planning a contact action is allowed, but executing it is not. Task/note operations remain available. Existing Redis leases are not force-deleted: the owner can release them through the canonical release endpoint, or expiry clears them. Ending or reassigning ownership invalidates stale action/reservation context through existing ownership checks.

## Persistence and compatibility

Status, priority, end reason and update time are persisted on the existing ownership table. Historical ended records are classified as revoked with `Legacy assignment ended`; the migration does not invent a completion reason or actor. Legacy writers that set `endedAt` automatically receive compatible revoked state. Database checks tie terminal state to end time. A trigger prevents edits to ended history; test fixtures now recreate disposable rows after deleting dependencies instead of reopening ended ownership.

Canonical mutations lock current permission/capacity/ownership state. Reassignment writes the end, replacement and audit in one transaction; competing terminal decisions have one winner. Paused state is checked before contact idempotency replay. Lifecycle changes also appear as `assignment_event` entries on the unified prospect timeline. No reminder cancellation, automatic lease deletion, prospect conversion or contact override is implied by assignment completion.

Verified with the full API/worker regression suites, including scope isolation, state transitions, ETags, capacity preservation, pre-replay and transactional permission changes, concurrent terminal decisions, stale assignment context and paused contact triggers. See [implementation status](IMPLEMENTATION_STATUS.md) for current totals.

Next: remaining skill/proximity allocation strategies and assignment suggestions, followed by complete imports/deduplication and asynchronous exports. Production RLS, credentials and recovery/load readiness remain separate work.
