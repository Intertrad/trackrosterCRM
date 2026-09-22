# Territory and campaign scopes

This stage adds explicit territory/campaign resource grants, territory administration with PostGIS boundaries, and campaign–territory links. Existing organization/team grants and operational prospect-assignment checks are preserved. Routes are available under `/api/v1` and the existing unversioned prefix.

## Membership scope contracts

Tenant administrators use the existing scope endpoints:

- `GET /memberships/{membershipId}/scopes`
- `POST /memberships/{membershipId}/scopes`
- `PATCH /membership-scopes/{scopeId}`
- `DELETE /membership-scopes/{scopeId}`

Example campaign grant:

```json
{
  "role": "manager",
  "scopeType": "campaign",
  "campaignId": "<campaign UUID>",
  "accessLevel": "manage"
}
```

For a territory, use `scopeType: "territory"` and `territoryId`. Exactly one matching resource ID is required. Organization/team IDs must be omitted. Resource scopes default to `read`; directors/managers can receive any supported access level, while prospectors/auditors can receive only `read`. Tenant-admin authority is always a tenant grant.

| Access level | Campaign                                                | Territory                                   |
| ------------ | ------------------------------------------------------- | ------------------------------------------- |
| `read`       | List/read campaign metadata                             | List/read territory and map geometry        |
| `read_write` | Read and edit metadata/dates                            | Read and edit name/code/geometry            |
| `manage`     | Also change lifecycle status and manage territory links | Also change hierarchy/status and deactivate |

Mutations require an `Idempotency-Key`. Scope list items include an `etag`; `If-Match` is supported on scope replacement/deletion. Resource scope replacements may switch between campaign and territory. Converting between a structural organization/team grant and a resource grant requires removing/adding the appropriate grant. Changes appear in membership access history, detail, `/me`, `/me/memberships` and `/me/permissions`; resource access levels accompany their IDs. Membership listing supports direct `campaignId`/`territoryId` grant filters and includes resource-grant roles.

These are additive grants, not deny rules. A narrow grant does not override a broader tenant/organization grant. Territory parents/children do not inherit grants, and campaign–territory links do not transfer permission in either direction. Active participation can separately supply resource read access, as documented in the participation stage. Full membership role replacement clears resource grants as well as structural grants, with before/after audit evidence.

## Territory contracts

`GET/POST /territories`, `GET/PATCH/DELETE /territories/{territoryId}` and `GET /territories/map` are implemented. Only tenant administrators create territories; scoped managers/directors may edit/manage an existing territory at their granted level. Tenant-wide auditors can read all territories. Other members see only their explicit active territory grants.

Creation accepts `name`, optional unique tenant-local `code`, `parentId`, and GeoJSON `boundary`. Polygon/MultiPolygon input is normalized to a PostGIS MultiPolygon in WGS84 (SRID 4326). Empty, invalid, out-of-range, non-polygon and oversized geometry is rejected. Read responses include GeoJSON boundary and a computed point-on-surface center. `/territories/map` returns a FeatureCollection of visible active territories with boundaries.

PATCH supports metadata, parent, geometry and status; `boundary: null` clears geometry and `parentId: null` detaches a parent. ETags protect conditional updates/deactivation. Hierarchy mutations serialize per tenant to prevent concurrent cycles. Deactivation is blocked while active children or campaign links remain; explicit scoped access ends when a territory becomes inactive. An administrator can reactivate it.

## Campaign contracts and authorization

Campaign list/detail queries filter resources in SQL using tenant-wide grants, matching director/auditor organization grants, or explicit campaign grants. A campaign grant never becomes authority over its organization, teams, assignments, collision overrides, exports or other campaigns.

`PATCH /campaigns/{campaignId}` enforces resource edit/manage authority, including a second authorization check inside the write transaction. The legacy no-key request remains supported; supplying `Idempotency-Key` enables cached response replay. Invalid supplied keys are rejected. Creation remains tenant-admin-only.

`GET/POST /campaigns/{campaignId}/territories` and `DELETE /campaigns/{campaignId}/territories/{territoryId}` manage links. Mutations require campaign manage authority and territory read authority. Lists include only territories the actor can read. Duplicate links conflict; cross-tenant links fail both API checks and composite database foreign keys. Archived campaigns and inactive territories cannot receive new links.

Resource guards check authority before idempotency replay, including the territory side of a campaign link. Scope mutations and resource writes serialize through the tenant row; resource changes are audited transactionally. Foreign or unauthorized resource IDs return 404.

## Deployment and remaining work

Migration `0033_territory_campaign_scopes.sql` creates `territories`, `campaign_territories` and `membership_resource_scopes`. The schema now has 39 tables and 34 migrations. This migration was applied only to the isolated validation database; the developer database was not changed.

This stage covers resource administration scopes. Dated user/team territory responsibilities and campaign participant rosters are now implemented in the [participation stage](PARTICIPATION.md). Territory-based workload allocation is implemented in the [geographic allocation stage](GEOGRAPHIC_ALLOCATION.md). Inherited hierarchy access and explicit deny rules remain separate work. Existing prospect actions still require their team/assignment permissions; a resource grant alone does not authorize prospect operations. RLS and restricted database credentials remain production-readiness work.

Validation: 647 API unit tests, 363 API integration tests and 9 worker integration tests passed. Final account-response changes passed the 21-test resource/account integration subset. API typecheck/build, affected-file lint and migration integrity passed.
