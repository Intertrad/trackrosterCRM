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
