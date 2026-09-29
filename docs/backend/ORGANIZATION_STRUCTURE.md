# Organization relationships and historical team rosters

This stage adds seven routes, available under `/api/v1` and the existing unversioned aliases.

| Method | Endpoint                                       | Behavior                                              |
| ------ | ---------------------------------------------- | ----------------------------------------------------- |
| GET    | `/organization-relationships`                  | List visible active/ended links                       |
| POST   | `/organization-relationships`                  | Create a tenant-local link                            |
| DELETE | `/organization-relationships/{relationshipId}` | End a link, preserving history                        |
| GET    | `/teams/{teamId}/members`                      | List current, scheduled and historical roster periods |
| POST   | `/teams/{teamId}/members`                      | Add a dated membership period                         |
| PATCH  | `/teams/{teamId}/members/{membershipId}`       | Change dates or transition roster role                |
| DELETE | `/teams/{teamId}/members/{membershipId}`       | Revoke/cancel a period, preserving history            |

## Relationships

POST accepts `parentOrganizationId`, `childOrganizationId`, and `relationshipType`: `parent`, `brand`, `partner`, or `coordination`. Both endpoints must belong to the current tenant and be active. Self-links are rejected. Parent/brand links form a combined acyclic graph; each child can have one active parent per relationship type. Partner/coordination links are undirected: endpoint UUIDs are normalized into ascending order, so reversing them does not bypass duplicate detection.

Only tenant administrators create/end relationships. Readers must have existing visibility of both endpoints; filtering happens before pagination. Relationships describe structure only: they do not confer inherited data access, operational permissions or automatic coordination/collision-policy changes.

GET supports `organizationId`, `relationshipType`, `state` (`active` default, `ended`, `all`), UUID `cursor`, and `limit` (1–100, default 25). DELETE sets `endedAt`; a new relationship can subsequently be created without overwriting the old record. An organization cannot be deactivated while an active relationship references it.

## Dated rosters

POST requires `membershipId`; optional `teamRole` is `member` (default) or `manager`. `startsAt` defaults to now and `endsAt` defaults to null. Supplied dates require an ISO timestamp with `Z` or a UTC offset. Periods are half-open `[startsAt, endsAt)`: adjacent periods are valid, overlapping non-revoked periods for the same team/member are rejected. The membership, identity, team and organization must be active and tenant-local when adding/editing participation.

GET supports `membershipId`, `state` (`all` default, `active`, `scheduled`, `ended`, `revoked`), `cursor`, and `limit`. It returns `{items, nextCursor}`; items contain period IDs, roster fields, calculated state and `etag`, without joining private account details.

PATCH/DELETE take an optional `?periodId=<roster period UUID>`. Without it, the API selects an unrevoked current/future period. If multiple periods match, it returns 409; clients must supply the selected period ID. PATCH accepts `teamRole`, `startsAt`, and nullable `endsAt`. An active period's start cannot be rewritten. Changing its role ends the old period and inserts a new one, returning the new period ID; optional `startsAt` schedules that transition within the remaining period. Scheduled periods can be edited in place. Expired or cancelled periods cannot be reopened with PATCH.

DELETE sets `revokedAt` and retains the original period and audit evidence; this also cancels future periods. Historical participation is bounded by the period dates and any earlier revocation time. To leave a team permanently, end each current/future period; cancelling one does not cancel others. Team deactivation is blocked until all current/future unrevoked roster periods are ended or cancelled.

Tenant administrators can manage every roster position and role transition. Explicit directors/managers with effective `teams.manage` permission can add, date-edit and end ordinary member periods within their scope. Creating a manager period, changing any roster role, or editing/ending a manager period requires a tenant administrator. Authority is checked before idempotent replay and again within the write transaction.

## Access and history

Active roster participation grants read access to team metadata and, when the team itself participates, campaign/territory metadata. Scheduled, expired and revoked periods grant no roster-derived access. Eligibility is evaluated live against membership/identity/team/organization status; it does not require a cleanup job. A roster `manager` label does not appoint the configured team manager or create an operational role grant. Assignment, override, export and management authority still require their existing explicit grants.

`GET /me/permissions` includes derived team scopes with `source: "team_membership"`, period `grantId`, `role: null`, `accessLevel: "read"`, and `permissions: ["scope.read"]`. Consumers must distinguish these from explicit role grants. Existing explicit team grants are independent: ending a roster period does not revoke those grants. Migration does not invent historical periods from existing grants.

Writes require `Idempotency-Key`. Create/update responses expose ETag headers; list items expose record ETags for optional `If-Match` on PATCH/DELETE. Clock-derived state is excluded from record versions. Audit events preserve actor and before/after evidence. Roster events use `membership.team_joined`, `membership.team_changed`, and `membership.team_left` on the tenant membership, making them available in membership access history.

## Database and validation

Migration `0035_organization_relationships_team_rosters.sql` adds `organization_relationships` and `team_memberships`, tenant-safe foreign keys, active-link uniqueness checks and a GiST exclusion constraint against overlapping roster periods. It uses the `btree_gist` extension installed by migration 0034. Preserve the manual exclusion constraint: Drizzle snapshots do not model it. Tenant-level mutation serialization and parent resource locks protect concurrent hierarchy/roster changes and deactivation races.

The schema now has 43 tables and 36 migrations. Migration 0035 was applied only to the isolated validation database. Apply the migration chain before running this version against another database; production RLS and restricted runtime credentials remain pending.

Validation: 647 API unit tests, 387 API integration tests (12 new structure cases), and 9 worker integration tests passed. Coverage includes tenant isolation, cycles, reversed duplicates, concurrent overlaps and deactivation, role history, dated/derived access, ETags, audit evidence, database constraints, and permission revocation before replay and during a queued write. API typecheck/build, affected-file lint and the 36-entry migration integrity check passed.

Campaign organization participation is implemented in the [following stage](CAMPAIGN_ORGANIZATIONS.md). Explicitly triggered geographic allocation is implemented in the [allocation stage](GEOGRAPHIC_ALLOCATION.md); inherited hierarchy access rules remain pending.
