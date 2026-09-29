# Maps and campaign lifecycle

Base path: `/api/v1`. Bearer authentication and existing membership scope apply. A campaign or territory metadata grant alone does not confer prospect access. Explicit deny rules retain their documented conservative aggregate policy.

## Maps

- `GET /prospects/map?bbox=west,south,east,north&zoom=10` returns a GeoJSON FeatureCollection of points and deterministic degree-grid clusters. Zoom is 0–20. Singletons expose establishment ID, name and visible lifecycle stages; clusters expose counts. `summary.prospects` counts distinct establishments; `campaignMemberships` and `byLifecycleStage` count visible campaign memberships, so a prospect in several campaigns is one map point. At most 1000 features are returned, with `truncated` and `totalFeatures`; use a smaller viewport or lower zoom when truncated.
- `GET /prospects/nearby?latitude=48.85&longitude=2.35&radiusMeters=5000&limit=50` returns distinct establishments with geography-based `distanceMeters`, ordered by distance then UUID. Radius is 1–50,000 meters, limit 1–200, and `nextCursor` is the last establishment UUID. Reuse the same origin/filter parameters for subsequent pages. Cursors outside the visible result return 400.
- `GET /map/heatmap?bbox=...&zoom=10&metric=activity` returns grid cells with distinct prospect counts, completed canonical action counts, converted prospect counts and `weight`. Metric is `activity` or `conversion`. Conversion reflects the current visible campaign lifecycle, not historical conversions during the activity window.
- `GET /map/coverage?bbox=...` returns authorized territory polygons and distinct visible prospect counts: assigned, contacted and converted. Coverage is contacted prospects / visible prospects × 100; empty territories return 0. Contacted means a completed canonical call/email/message/visit in the activity window. Boundary points are included. Overlapping territories count independently; coverage is clipped by the requested viewport, while polygon geometry remains the full territory.
- `GET /map/collisions?bbox=west,south,east,north&lookbackHours=24` returns at most 100 active/pending reservations per authorized establishment in the viewport. It exposes only the establishment point/name, reservation timestamps, generic `warning` severity, and an opaque reservation id. Reservation owners, campaign details, and assignment details are never returned. The lookback defaults to 24 hours and is capped at 168 hours; results are filtered through tenant and prospect-read scope authorization.

All four accept optional `campaignId`, `campaignStatus`, `organizationId`, `teamId`, `territoryId`, `lifecycleStage` and literal `search`. Default campaigns are active/paused; establishments and campaign memberships must be active and geocoded. Filters narrow existing prospect authority. A territory filter also requires territory read access. GeoJSON coordinate order is longitude, latitude. West greater than east means an antimeridian-crossing viewport; south must be less than north.

Heatmap/coverage accept `from` (inclusive) and `to` (exclusive), defaulting to the last 30 days, with a maximum 366-day range. Activity metrics use canonical completed actions; legacy-only activity rows are not double-counted or reinterpreted as canonical completions. These aggregate routes honor `reports.read`; prospect map, nearby, and collision watch honor `prospects.read`.

Requests exceeding 20,000 visible campaign memberships return 413 `MAP_SCOPE_TOO_LARGE`, rather than silently calculating incomplete totals. Coverage is additionally limited to 200 authorized intersecting territories. Existing geometry and geography GiST indexes support viewport/radius predicates; no map schema migration is required.

Map validation: ten PostGIS integration cases cover tenant/ownership isolation, metadata-only grants, deduplication, invalid bounds, dateline viewports, radius pagination, boundary inclusion, action/conversion counts, permission restrictions and the 20,001-row limit. API typecheck and affected-file lint passed.

## Campaign lifecycle

`POST /campaigns` creates a draft for a tenant administrator. Body:

```json
{
  "organizationId": "<uuid>",
  "name": "Autumn outreach",
  "description": "Optional",
  "startsAt": "2026-10-01T00:00:00Z",
  "endsAt": "2026-11-01T00:00:00Z"
}
```

Returns 201 with the same enriched campaign representation as GET and an ETag. Names are trimmed and must not be blank. The organization must be active and belong to the current tenant. Start/end dates are optional; end cannot precede start. Dates are descriptive scheduling fields and do not automatically activate a campaign. Description is at most 10,000 characters.

`POST /campaigns/{campaignId}/status` accepts `{ "status": "active|paused|completed|archived", "reason": "optional explanation" }` and returns 200 with the updated representation and ETag. It requires campaign **manage** authority: tenant administrator, owning-organization director, or an explicit manage-level campaign grant. A team manager or participant without that authority cannot change campaign status.

| Current state | Allowed next states         |
| ------------- | --------------------------- |
| draft         | active, archived            |
| active        | paused, completed, archived |
| paused        | active, completed, archived |
| completed     | archived                    |
| archived      | none                        |

Repeating the current status is a no-op with no duplicate audit event. Archived campaign fields are read-only. Re-activation of a paused campaign requires its organization to remain active. Read/write campaign grants may edit metadata but cannot change status.

`DELETE /campaigns/{campaignId}` archives the campaign and returns 204. It never deletes campaign, prospect, assignment, action or audit history. Repeated archival is a no-op. Reload GET if a subsequent conditional operation is needed; the empty 204 response carries no resource version.

- Supply `Idempotency-Key` for status and archive (required). Creation and the existing PATCH accept it but keep it optional for legacy clients. A reused key with different input returns 409.
- Use `If-Match` from GET/create/update/status for conditional writes; a stale version returns 412. Missing If-Match remains accepted for compatibility.
- Completion and archival return 409 `CAMPAIGN_HAS_OPEN_WORK` until all current assignments (including paused), planned/started actions, pending follow-ups, live reservations and pending override requests are resolved. The API does not silently cancel work. Counts are not disclosed through this error to metadata-only managers.
- Existing `PATCH /campaigns/{campaignId}` uses the same lifecycle service, permissions and terminal rules, so it cannot bypass the new status endpoint.
- Authority, membership activity, role restrictions and explicit denies are rechecked within the serialized write transaction, as well as before idempotent replay.
- Database triggers serialize open-work writes against terminal transitions and reject new open work in completed/archived campaigns. Expired reservations and completed/cancelled historical records do not block closure. Database conflict code `TR001` is translated to safe HTTP 409 `CAMPAIGN_CLOSED` where surfaced.
- Changes create `campaign.created`, `campaign.updated` or `campaign.status_changed` audit events, including previous/new status and optional reason. Deployment requires migrations 0055–0056; they were applied only to the isolated validation database.
