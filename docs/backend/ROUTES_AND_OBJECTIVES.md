# Routes, objectives and completed dashboard summaries

All endpoints use `/api/v1` and bearer authentication. Mutations require `Idempotency-Key`; updates/transitions accept optional `If-Match`. ETags cover stored definitions, not changing reporting totals. Verification applies to the migrated test/development environment, not a production sign-off.

## Field routes

Prospectors create and change their own routes in an explicitly granted active team. Managers read their teams, directors read their organizations, and tenant administrators/observers read their authorized scope. Those broader roles do not edit another prospector's round. Current grants are checked before cached mutation responses and inside the write transaction.

Create with `POST /routes`:

```json
{
  "teamId": "<team UUID>",
  "name": "Morning visits",
  "scheduledAt": "2026-09-24T08:00:00Z",
  "startPoint": { "latitude": 48.8566, "longitude": 2.3522 },
  "endPoint": { "latitude": 48.8566, "longitude": 2.3522 }
}
```

End point is optional/null. Coordinates must be numeric and within geographic bounds. Route dates require an explicit time zone. Lists support `teamId`, `status=draft|active|completed|cancelled`, UUID `cursor` and `limit` (1–100, default 25), returning `items,nextCursor`.

| Method | Path                           | Behavior                                                                |
| ------ | ------------------------------ | ----------------------------------------------------------------------- |
| GET    | `/routes`                      | Scoped route list                                                       |
| POST   | `/routes`                      | Create own draft round                                                  |
| GET    | `/routes/{routeId}`            | Definition, ordered stops, progress and estimated metrics               |
| PATCH  | `/routes/{routeId}`            | Edit draft name/schedule/start/end points                               |
| DELETE | `/routes/{routeId}`            | Cancel a draft, retaining history                                       |
| POST   | `/routes/{routeId}/stops`      | Add `campaignProspectId` and optional `actionId`                        |
| PATCH  | `/route-stops/{stopId}`        | Draft `position`/`eta`, or live `status`/`outcome`                      |
| DELETE | `/route-stops/{stopId}`        | Remove a draft stop and compact positions                               |
| PUT    | `/routes/{routeId}/stop-order` | Supply `stopIds`, containing every current stop exactly once            |
| POST   | `/routes/{routeId}/optimize`   | Refresh eligible coordinates and apply a non-worsening geographic order |
| POST   | `/routes/{routeId}/start`      | Start a nonempty draft; only one active route per owner                 |
| POST   | `/routes/{routeId}/complete`   | Complete an active route after all stops are completed/skipped          |

Stop mutations use the **route ETag**. Routes support at most 100 stops and cannot contain the same campaign prospect twice. Stops require a current, unpaused assignment to the route's team/owner, an active campaign/prospect and persisted coordinates. Linked actions must be the owner's visit action for that exact prospect/current assignment. Starting and arriving recheck eligibility and visit consent. Planning does not acquire a reservation or override collision policy; perform actual contact through the existing action/reservation APIs.

Live execution is sequential. Only the next unfinished stop can arrive, complete or skip. `status=arrived` timestamps arrival. Completion requires prior arrival and a nonblank `outcome`; a linked visit action must already be completed. Skipping requires a reason in `outcome` and remains possible after an assignment or consent change. Closing an already-performed visit remains possible when its action recorded opposition; that closure is bookkeeping and cannot authorize another visit. Completed/skipped stops and finalized routes cannot reopen. Route completion does not create a contact outcome or increment objective visit counts by itself.

Planning changes clear stale ETAs. Distance uses persisted coordinate snapshots, refreshed on optimize/start. Optimization is deterministic nearest-neighbor ordering, retained only when it improves total **great-circle distance**, including the optional end point. It is not a globally optimal road route. `estimatedTravelMinutes` assumes 30 km/h and excludes roads, traffic and time spent at stops. These assumptions are returned with metrics; there is no routing-provider dependency or live GPS tracking.

`GET /dashboard/today` now returns `routeSummary.available=true`, the owner's routes scheduled inside the requested team's local-day boundaries, ordered stops, metrics and next unfinished stop. Cancelled routes are excluded. The response is capped at 100 rounds with an explicit `truncated` flag. Existing DST-aware day calculations define the half-open date window; future-day rounds do not leak into today's summary.

## Objectives and director risk

| Method | Path                        | Behavior                                                                              |
| ------ | --------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/objectives`               | Scoped definitions and live target-versus-actual progress                             |
| POST   | `/objectives`               | Create a target as tenant administrator or explicitly authorized team manager         |
| GET    | `/objectives/{objectiveId}` | Definition, owner, current progress, definition history and daily contributing totals |
| PATCH  | `/objectives/{objectiveId}` | Conditionally edit a future objective                                                 |
| GET    | `/objectives/at-risk`       | Risk-ranked top list with total matches and truncation flag                           |

Directors and observers are read-only within their explicit structural scope. Managers can manage only objectives explicitly scoped to their team; a manager cannot create or edit organization-wide targets. Scope and owner must belong to the tenant; team/campaign must belong to the objective organization. The owner must be active and have an applicable structural grant. Ownership labels responsibility; it does not grant new permissions or restrict metric contributions to only that person.

Example create body:

```json
{
  "organizationId": "<organization UUID>",
  "teamId": "<optional team UUID>",
  "campaignId": "<optional campaign UUID>",
  "ownerId": "<optional membership UUID; defaults to creator>",
  "name": "September converted prospects",
  "metric": "converted_prospects",
  "target": 20,
  "startsAt": "2026-09-01T00:00:00Z",
  "endsAt": "2026-10-01T00:00:00Z"
}
```

Scope/metric/owner are immutable. Before the objective starts, PATCH can update `name`, integer `target` (1–10,000,000), `startsAt` and `endsAt`. The edited start must remain in the future. Started objectives cannot be rewritten or backdated through PATCH. Create can cover an already-started period, but its end must be in the future. Periods must be positive and at most 366 days. Every creation/edit saves a definition-history snapshot and audit record in the same transaction. Detail returns the latest 50 definition revisions.

Supported metrics:

| Metric                 | Actual count                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `completed_actions`    | Distinct completed canonical actions, including tasks/notes           |
| `completed_visits`     | Distinct completed canonical visit actions                            |
| `qualified_prospects`  | Distinct canonical establishments with a qualifying completed outcome |
| `converted_prospects`  | Distinct canonical establishments with a converted completed outcome  |
| `completed_follow_ups` | Distinct completed follow-ups                                         |

Attribution uses each record's historical assignment organization/team, optional campaign scope and completion timestamp. Counts include `startsAt` and exclude `endsAt`; future timestamps beyond report generation are excluded. Custom outcome codes use the semantic definition captured at completion, falling back to built-in outcome codes for older records. Later catalogue changes or append-only corrections do not rewrite original attainment. Prospect metrics deduplicate repeated completions and multiple campaign memberships within the objective period. Route-stop bookkeeping and legacy activity rows do not masquerade as canonical completed actions.

`progressHistory` reconstructs daily UTC contributions from completed records, assigning a distinct prospect to its first qualifying completion in the period, and returns cumulative totals. Days with no contribution are omitted. These are derived contribution history, not previously stored dashboard snapshots.

Risk model `linear_elapsed_time_v1`:

- `expectedToDate = target × elapsed fraction`, clamped to the objective period.
- `achieved` when actual meets/exceeds target; otherwise `not_started` before the start and `missed` at/after the deadline.
- During the period, `at_risk` below 80% of expected pace, `watch` below 100%, otherwise `on_track`.
- `projectedAtEnd = actual / elapsed fraction`, or null before any time has elapsed. This is a transparent pace estimate, not a predictive probability.

Risk results are globally ranked within the authorized filters: missed, at-risk, then watch, with earlier deadlines and IDs breaking ties. Default limit is 25, maximum 100; `total` and `truncated` show whether narrower filters are needed. Risk ranking rejects a cursor because ranks change with time. Ordinary objective lists support stable UUID cursors. Filters: `organizationId`, `teamId`, `campaignId`, `ownerId`.

`GET /dashboard/director` now returns `objectiveRisks.available=true` with up to 100 ranked targets in the same authorized organization/team/campaign scope and overlapping report period. The dashboard `userId` filter selects responsible objective owners. Individual objective progress uses each objective's complete period through the generation time, even when the dashboard reporting window is narrower. Empty results mean no matching at-risk targets, not missing functionality.

## Database and validation

Migrations `0048` and `0049` add routes/stops and objectives/history: 64 schema tables and 50 migrations. They were applied only to the isolated validation database. Apply the committed chain before using these endpoints elsewhere.

Validation: 655 API unit tests, 539 API integration tests and 10 worker integration tests passed, plus API typecheck/build, affected-file lint and migration integrity. Four new unit cases check route ordering and risk boundaries; 13 integration cases cover route ownership, scope, sequencing, consent, linked actions, concurrent transitions, target authorization/history, deduplication and time boundaries. After review, the seven route integration cases passed again with opposition recorded by a linked completed visit. Production load/recovery validation remains separate.
