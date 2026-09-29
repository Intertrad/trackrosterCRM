# Campaign organization participation

Four routes are available under `/api/v1` and the existing unversioned aliases:

| Method | Endpoint                                                 | Behavior                                      |
| ------ | -------------------------------------------------------- | --------------------------------------------- |
| GET    | `/campaigns/{campaignId}/organizations`                  | Read owner and participating organizations    |
| POST   | `/campaigns/{campaignId}/organizations`                  | Add an organization with an access mode       |
| PATCH  | `/campaigns/{campaignId}/organizations/{organizationId}` | Change the active participation's access mode |
| DELETE | `/campaigns/{campaignId}/organizations/{organizationId}` | End participation, retaining history          |

## Ownership and access modes

The campaign's existing `organizationId` is the canonical owner. GET returns it separately as `owner: {organizationId, accessMode: "owner"}`. Owner access continues through existing explicit permissions. These endpoints cannot create another owner, transfer ownership, downgrade the owner or remove it. This avoids duplicating the ownership source in a second table.

POST takes `{organizationId, accessMode?}`; mode defaults to `participate`. PATCH requires `{accessMode}`. Mutable modes are:

- `read_only`: eligible organization members receive campaign metadata read access.
- `participate`: the same read access, plus campaign-detail editing for explicit organization-scoped directors. This covers name, description and dates through the existing campaign PATCH route.

Both modes require an active participating organization. Eligible members have an explicit grant in that organization, an explicit grant in one of its active teams, or an active dated roster period in one of its teams. Their tenant membership and identity must be active. Roster dates, grant revocation, team status and participation removal are checked live. Campaign archival removes participation-derived access. Organization hierarchy relationships do not imply participation.

Participation does not grant campaign status changes, roster/link management, organization administration, prospect assignment, reservations, collision overrides or exports. Those operations retain existing authorization. Independent explicit grants remain additive: `read_only` does not deny rights granted elsewhere, and ending participation does not revoke independent campaign access.

`GET /me/permissions` and membership detail expose derived entries with `source: "campaign_organization"`, participation `grantId`, `role: null`, `scopeType: "campaign"`, `organizationId`, `campaignId`, and effective `accessLevel` (`read` or `read_write`). As with existing resource entries, `permissions` contains `scope.read`; `accessLevel` describes campaign-detail editing. A null role never creates an operational role grant.

## Authorization, lifecycle and concurrency

All mutations require explicit `manage` access to the campaign, checked before idempotent replay and again inside the transaction. Participating directors cannot manage their own participation. Parent campaign visibility is required for GET, and SQL authorization filters the rows before pagination. The list exposes organization IDs and participation metadata, without unrelated organization details or account profiles.

New/updated participation requires an active organization in the same tenant. Completed or archived campaigns reject additions and mode changes; authorized managers can still remove participation. Organizations cannot be deactivated while active campaign participation remains. Remove those links first. Concurrent deactivation and participation creation are serialized with resource locks.

Only one active participation can exist per campaign/organization, enforced by a database unique index as well as transaction checks. DELETE sets `endedAt`; rejoining creates a fresh ID. Mode changes retain before/after audit evidence. An absent active participation returns 404 for PATCH/DELETE; replaying a successful DELETE with its original idempotency key returns the original success, subject to current management permission.

Mutations require `Idempotency-Key`. Create/update return an ETag header; list items include `etag`. Supply optional `If-Match` on PATCH/DELETE for stale-write protection. Audit events use `campaign_organization.created`, `.updated`, and `.ended` with actor and before/after records.

## Listing and history

GET accepts `state` (`active` default, `ended`, `all`), UUID `cursor`, and `limit` (1–100, default 25). It returns `{owner, items, nextCursor}`. `owner` is always separate from paginated external participants and does not count toward the limit. A row's active state means it has not been ended; effective access additionally depends on organization, campaign and membership eligibility.

Example:

```json
{
  "owner": { "organizationId": "<owner UUID>", "accessMode": "owner" },
  "items": [
    {
      "id": "<participation UUID>",
      "organizationId": "<participant UUID>",
      "accessMode": "read_only",
      "endedAt": null,
      "etag": "<version>"
    }
  ],
  "nextCursor": null
}
```

## Database and validation

Migration `0036_campaign_organization_participation.sql` adds `campaign_organizations`, tenant-safe composite foreign keys, validated mutable modes, retained timestamps and active-pair uniqueness. Existing campaigns need no owner backfill because ownership stays on `campaigns.organizationId`. The schema has 44 tables and 37 migrations. This migration has been applied only to the isolated validation database; apply the migration chain before running against another database.

Verification: 647 API unit tests, 397 API integration tests (10 new campaign organization cases), and 9 worker integration tests passed. API typecheck/build, affected-file lint and all 37 migration integrity entries passed.

Validation includes tenant isolation, fixed ownership, mode changes, director versus observer access, live team roster/grant eligibility, permission revocation before cached replay and during a queued mutation, ETags, retained history, audits, concurrent duplicate creation, direct database constraints, terminal campaigns and organization deactivation races.

Explicitly triggered geographic allocation is implemented in the [allocation stage](GEOGRAPHIC_ALLOCATION.md). Prospecting workflow completion and the remaining backend ledger are separate work. Production RLS, restricted credentials and recovery/load testing remain pending.
