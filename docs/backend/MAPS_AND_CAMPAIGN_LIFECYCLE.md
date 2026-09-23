# Maps and campaign lifecycle

Base path: `/api/v1`. Bearer authentication and existing membership scope apply. A campaign or territory metadata grant alone does not confer prospect access. Explicit deny rules retain their documented conservative aggregate policy.

## Maps

- `GET /prospects/map?bbox=west,south,east,north&zoom=10` returns a GeoJSON FeatureCollection of points and deterministic degree-grid clusters. Zoom is 0–20. Singletons expose establishment ID, name and visible lifecycle stages; clusters expose counts. `summary.prospects` counts distinct establishments; `campaignMemberships` and `byLifecycleStage` count visible campaign memberships, so a prospect in several campaigns is one map point. At most 1000 features are returned, with `truncated` and `totalFeatures`; use a smaller viewport or lower zoom when truncated.
- `GET /prospects/nearby?latitude=48.85&longitude=2.35&radiusMeters=5000&limit=50` returns distinct establishments with geography-based `distanceMeters`, ordered by distance then UUID. Radius is 1–50,000 meters, limit 1–200, and `nextCursor` is the last establishment UUID. Reuse the same origin/filter parameters for subsequent pages. Cursors outside the visible result return 400.
- `GET /map/heatmap?bbox=...&zoom=10&metric=activity` returns grid cells with distinct prospect counts, completed canonical action counts, converted prospect counts and `weight`. Metric is `activity` or `conversion`. Conversion reflects the current visible campaign lifecycle, not historical conversions during the activity window.
- `GET /map/coverage?bbox=...` returns authorized territory polygons and distinct visible prospect counts: assigned, contacted and converted. Coverage is contacted prospects / visible prospects × 100; empty territories return 0. Contacted means a completed canonical call/email/message/visit in the activity window. Boundary points are included. Overlapping territories count independently; coverage is clipped by the requested viewport, while polygon geometry remains the full territory.

All four accept optional `campaignId`, `campaignStatus`, `organizationId`, `teamId`, `territoryId`, `lifecycleStage` and literal `search`. Default campaigns are active/paused; establishments and campaign memberships must be active and geocoded. Filters narrow existing prospect authority. A territory filter also requires territory read access. GeoJSON coordinate order is longitude, latitude. West greater than east means an antimeridian-crossing viewport; south must be less than north.

Heatmap/coverage accept `from` (inclusive) and `to` (exclusive), defaulting to the last 30 days, with a maximum 366-day range. Activity metrics use canonical completed actions; legacy-only activity rows are not double-counted or reinterpreted as canonical completions. These aggregate routes honor `reports.read`; prospect map/nearby honor `prospects.read`.

Requests exceeding 20,000 visible campaign memberships return 413 `MAP_SCOPE_TOO_LARGE`, rather than silently calculating incomplete totals. Coverage is additionally limited to 200 authorized intersecting territories. Existing geometry and geography GiST indexes support viewport/radius predicates; no map schema migration is required.

Map validation: ten PostGIS integration cases cover tenant/ownership isolation, metadata-only grants, deduplication, invalid bounds, dateline viewports, radius pagination, boundary inclusion, action/conversion counts, permission restrictions and the 20,001-row limit. API typecheck and affected-file lint passed.
