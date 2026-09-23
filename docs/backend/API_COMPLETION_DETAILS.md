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

## Configurable capabilities and explicit restrictions

`GET /permissions` now publishes 33 capabilities, including 24 added domain restrictions. `PUT /roles/{role}/permissions` remains a **full replacement** of that role's configurable list: fetch `configurablePermissions` first and send the complete desired list. Missing capabilities are restricted. Migration 0052 preserves existing configurations by adding the new defaults. These restrictions cover campaigns, territories/regions, organizations/teams, prospects, activities/timelines, follow-ups, consent, routes, objectives, reports/dashboards, imports, notifications, reservations and allocation. Existing assignment, team, export and collision-override restrictions remain in force.

The added domain restrictions apply membership-wide when any of its structural/resource roles has that restriction. Restriction wins across mixed roles; existing service authorization still decides which resources/actions are allowed. Tenant administrators retain their protected authority. Future messaging, billing and integration APIs are not made available by this catalogue.

Explicit deny body example:

```json
{
  "effect": "deny",
  "scopeType": "team",
  "teamId": "<uuid>",
  "reason": "Restricted team information"
}
```

Supported scopes: tenant (no resource ID), organization, team, campaign and territory, with only the matching identifier. Omit `role` and `accessLevel`; denials remove access rather than confer a role. Tenant administrators cannot receive deny rules. Duplicate rules return 409; foreign/missing targets return 404. Denials appear in membership scopes and effective-access responses with `effect: deny`. PATCH/DELETE on `/membership-scopes/{scopeId}` support If-Match and write immutable membership history.

**Deny policy is deliberately conservative:** any deny blocks aggregate and compound business operations, including lists, notifications, exports and writes. Bounded organization/team/campaign/territory detail reads are permitted only if their metadata and summary footprint does not include the denied resource; parent territory and summarized organization/campaign/team relationships are checked to prevent leaking denied descendants in summaries. Such requests return `SCOPE_DENIED` or `SCOPE_DENY_REQUIRES_BOUNDED_RESOURCE` (403), never an apparently complete partial aggregate. Self-service account/authentication and administrator-only access-management paths remain available. This is restrictive denial, not transparent row exclusion from arbitrary reports. Administrators should prefer positive scope grants when users need normal workflows in several independent scopes. Fine-grained exclusion from aggregates remains future work.

## OIDC security settings

`GET/PATCH /settings/security` includes `sso`. PATCH accepts a full connection configuration:

```json
{
  "sso": {
    "provider": "oidc",
    "mode": "configured",
    "issuer": "https://identity.example.test/tenant",
    "clientId": "trackroster",
    "clientSecret": "<write-only secret>",
    "allowedDomains": ["example.test"]
  }
}
```

- `mode` is `configured` or `disabled`; a configured connection needs a secret.
- Omit the secret to preserve it only when issuer and client ID are unchanged. Changing either requires a new secret.
- `sso: null` removes the entire connection, including its secret.
- Provision `SSO_ENCRYPTION_KEY` as 64 hexadecimal characters (32 random bytes). Secrets use tenant-bound AES-256-GCM. Back up the key securely; changing it without re-encrypting stored secrets invalidates them. Local validation uses a disposable key in the isolated test runner.
- Responses and audit records expose `clientSecretConfigured`, never plaintext or ciphertext. If-Match checks the public, redacted representation.
- HTTPS issuer validation rejects credentials, query strings and fragments. Saving configuration performs no network fetch or domain verification. Allowed domains are configuration only until the sign-in flow enforces them.
- **`loginAvailable` remains false.** These endpoints configure an OIDC connection; `/auth/sso/{provider}/start` and `/auth/sso/{provider}/callback` remain pending. No claim of successful provider authentication is made, and password sign-in is not disabled.
