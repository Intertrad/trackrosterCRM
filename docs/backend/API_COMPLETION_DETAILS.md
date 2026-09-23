# API completion contracts

Base path `/api/v1`. Existing authentication, tenant scope, idempotency and conditional-update conventions apply.

## Profile, membership, campaigns and notifications

- `PATCH /me` accepts `avatar: { url, altText }` or `avatar: null` to clear it. URLs must use HTTPS without embedded credentials; maximum 2048 characters, alt text maximum 120. This stores external image metadata without fetching it. Upload/storage remains the separate attachments feature.
- `GET /memberships/{id}` includes `rosterHistory.items` (newest 100 dated periods, including revoked/expired/future periods), plus `truncated`. Each row includes team name, organization and current `effective` state. Complete team history remains available through the paginated team-roster API.
- `GET /organizations/{id}` includes authorized team and current assignment counts, paused work, distinct assigned campaigns and members. Counts honor the actor's organization/team scope and individual prospect ownership.
- `GET /teams/{id}/capacity` adds `acceptingAssignments`, paused/team-owned counts and member capacity detail. Member capacity is global across teams; paused work consumes capacity; inactive identities/memberships are ineligible. Members are bounded at 1000 with a truncation flag. Campaign and territory eligibility is evaluated in allocation preview, not inferred from spare capacity.
- `GET /campaigns` supports `organizationId`, `territoryId`, `status`, literal `search`, `startsAfter` (inclusive), `startsBefore` (exclusive), `sort=name|createdAt`, `limit` (1–100), and `cursor`. Filtered requests return `{items,nextCursor}`. No-query requests retain the legacy array. Cursors must belong to the same authorized filter set; ordering is ascending with an ID tie-breaker.
- `GET /campaigns/{id}` adds a summary of visible prospects by lifecycle stage, current/paused assignments, pending/overdue follow-ups, completed actions and linked territories. Metadata access alone does not reveal prospect counts beyond prospect read authority.
- `GET /notifications` supports severity `info|warning|error|critical` and `readState=read|unread|all`, alongside existing pagination and `unreadOnly`. Existing reminders default to `info`. All results remain recipient-scoped.

## Membership access evidence

Migration 0051 backfills access events and installs a database trigger that snapshots new membership/access-grant audit events into `membership_access_evidence`. The history endpoint reads these snapshots and reports SHA-256 digest verification. Direct INSERT, UPDATE, DELETE and TRUNCATE are rejected. Audit-source retention and membership removal do not erase evidence. Whole-tenant deletion is the explicit retention boundary. Database owners/superusers can disable triggers; restricted production database credentials remain a deployment prerequisite. This is tamper prevention against ordinary DML, not an externally anchored cryptographic log.
