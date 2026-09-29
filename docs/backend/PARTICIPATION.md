# Territory responsibilities and campaign rosters

This stage implements dated territory assignments and campaign participation for individual tenant memberships or teams. It builds on [territory/campaign resource scopes](TERRITORY_CAMPAIGN_SCOPES.md). The endpoints have `/api/v1` and unversioned aliases.

| Method | Endpoint                                | Behavior                                     |
| ------ | --------------------------------------- | -------------------------------------------- |
| GET    | `/territory-assignments`                | List visible responsibilities and history    |
| POST   | `/territory-assignments`                | Assign one member or team to a territory     |
| PATCH  | `/territory-assignments/{assignmentId}` | Change priority or effective dates           |
| DELETE | `/territory-assignments/{assignmentId}` | End/cancel responsibility, retaining the row |
| GET    | `/campaigns/{campaignId}/members`       | List participants and history                |
| POST   | `/campaigns/{campaignId}/members`       | Add one member or team                       |
| PATCH  | `/campaign-members/{campaignMemberId}`  | Change campaign role or effective dates      |
| DELETE | `/campaign-members/{campaignMemberId}`  | End/cancel participation, retaining the row  |

## Payloads and history

Exactly one of `membershipId` and `teamId` is required when creating a record. The subject must be active and in the current tenant; a member's identity and a team's organization must also be active. Territory creation requires `territoryId` in the body; campaign IDs come from the route. The subject and resource cannot be retargeted by PATCH: end the old record and create a new one.

Optional `startsAt` defaults to now; `endsAt` defaults to null (unbounded). Supplied timestamps must include a UTC offset or `Z`. Periods use `[startsAt, endsAt)`, with the start included and end excluded. Adjacent periods are valid. Overlapping non-revoked periods for the same resource and same member/team are rejected, both by the API and PostgreSQL exclusion constraints. Direct member participation and team participation are distinct sources and can coexist.

Territory `priority` defaults to 100 and accepts integers from 0 to 100000. Lower values take precedence in the [geographic allocation stage](GEOGRAPHIC_ALLOCATION.md). Responsibility changes alone do not trigger allocation. Campaign `campaignRole` is `member` (default), `coordinator`, or `observer`. These labels describe participation and never grant management authority.

DELETE sets `revokedAt` instead of deleting history. Scheduled periods can therefore be cancelled without creating invalid date ranges. Revoked records cannot be edited/reopened; expired periods also require a new record to resume participation. Repeated DELETE is harmless when authority and any supplied precondition still hold.

Lists return `{items, nextCursor}` and support `cursor`, `limit` (1–100, default 25), `membershipId`, `teamId`, and `state` (`all`, `active`, `scheduled`, `ended`, `revoked`). Territory lists additionally accept `territoryId`. Visibility is filtered in SQL before pagination. Readers see roster IDs, periods and participation fields for visible resources; account email/profile data is not joined into these lists. `state` describes the stored period; actual read access additionally requires active subject and resource eligibility.

Mutations require `Idempotency-Key`. List items include an `etag` over the stored record; use it with `If-Match` on PATCH/DELETE. Create/update responses also have an ETag header. Lifecycle state calculated from the clock is excluded from the per-item version token. Changes record transactional audit events with actor and before/after evidence.

## Access behavior

Active direct participation grants read access to the corresponding resource metadata. Active team participation grants the same access to current team-scoped grant holders or active dated team-roster members while the team and organization remain active. See [historical team rosters](ORGANIZATION_STRUCTURE.md). Team-grant revocation is checked live; no copied per-user permission can linger. Future, expired and revoked participation does not grant access. Inactive territories and archived campaigns do not grant participant-derived read access.

Participation never authorizes resource editing, roster management, prospect assignment, collision overrides or exports. Creating/updating/ending participation requires explicit manage authority on the parent resource. That authority is checked before idempotent replay and again inside the write transaction. Tenant-wide grants and explicit resource grants retain their existing authority.

`GET /me/permissions` and membership detail include derived read scopes with `source: "territory_assignment"` or `source: "campaign_member"`, the source record's `grantId`, `accessLevel: "read"`, and `role: null`. The null role is intentional: participation is not a new tenant role. Consumers must distinguish these entries from explicit role grants. `/me` and `/me/memberships` continue to describe explicit roles; participation is managed through its own endpoints.

Territories cannot be deactivated while active/future non-revoked responsibilities remain. End those records first. Completed/archived campaigns cannot accept new participation or participation edits; administrators can still end records. Historical team membership is implemented in the organization structure stage; explicitly triggered geographic allocation is implemented in the [allocation stage](GEOGRAPHIC_ALLOCATION.md).

## Database and deployment

Migration `0034_territory_assignments_campaign_members.sql` adds two tables, tenant-safe subject/resource foreign keys, a tenant/team unique key and four GiST exclusion constraints. The migration enables PostgreSQL's `btree_gist` extension. Exclusion constraints are maintained in migration SQL because the Drizzle snapshot does not model them; preserve them in future migration work.

At the end of this stage the schema had 41 tables and 35 migrations. The migration was applied only to the disposable validation database. Apply the full chain with a migration-capable database role before running this version against another database. Production RLS/restricted runtime credentials remain pending.

Verification: 647 API unit tests, 375 API integration tests (including 12 participation cases), and 9 worker integration tests passed. API typecheck/build, affected-file lint and the 35-entry migration integrity check passed.
