# Collision evidence and override approval workflows

Implemented 2026-09-22. This stage adds nine contracts and connects planned contact actions to the existing collision evaluator. It builds on existing Redis reservations, coordination policies, cooling-off rules and short-lived manager exceptions.

| Method | Endpoint                                           | Behavior                                                                                              |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST   | `/reservations/check`                              | Evaluate the authenticated prospector's current context without claiming; persist a detected conflict |
| GET    | `/collision-events`                                | List visible detected conflicts with bounded cursor pagination                                        |
| GET    | `/collision-events/{collisionId}`                  | Read decision, safe conflict timing and policy version                                                |
| POST   | `/collision-events/{collisionId}/override-request` | Request an exception for the caller's fresh, overrideable collision                                   |
| GET    | `/override-requests`                               | List visible pending/decided requests                                                                 |
| GET    | `/override-requests/{requestId}`                   | Read request, collision context and issued approval expiry                                            |
| POST   | `/override-requests/{requestId}/approve`           | Atomically record approval, issue the exact-context exception and audit the decision                  |
| POST   | `/override-requests/{requestId}/reject`            | Record one final manager rejection with a reason                                                      |
| POST   | `/override-requests/{requestId}/cancel`            | Cancel the caller's own pending request with a reason                                                 |

Routes use `/api/v1` and existing unversioned aliases. All POST requests require `Idempotency-Key`. Check and decision commands return 200; request creation returns 201. Request responses include a record `etag`; decisions accept optional `If-Match` and reject stale versions with 412.

## Using the workflow

1. Call `POST /reservations/check` with `{ "campaignId": "UUID", "campaignProspectId": "UUID" }` as the assigned prospector. The second identifier is the campaign-prospect membership, not the canonical establishment ID. A new idempotency key requests a fresh evaluation; reusing a key returns its prior result after current authorization/consent checks. Never treat a cached check as ownership of a live reservation.
2. An allow result has `collisionId: null`. A warning or block creates immutable evidence and returns its ID, reason, decision, timing and `overrideable` flag. Evidence is valid for requesting/approving an exception for ten minutes, but remains readable afterward.
3. For an overrideable conflict, submit `{ "reason": "Customer requested another contact" }` to its override-request endpoint. The reason is trimmed and must contain 10–1000 characters. Only the detecting prospector can request it. At most one pending request exists per tenant/prospect/requester, including across different checks and concurrent submissions. Cancel an obsolete request before requesting another.
4. A different authorized manager, owning-organization director or tenant administrator approves or rejects with the same reason shape. Self-approval and self-rejection are disallowed even for users with both prospector and manager grants. Approval rechecks the current assignment, requester eligibility, consent, coordination-policy snapshot and exact live conflict. A changed, expired or no-longer-blocking conflict returns 409 and issues no approval.
5. Approval creates an `overrideId` valid for ten minutes. The requester passes it to the existing `POST /campaigns/{campaignId}/prospects/{prospectId}/reservation` or `POST /actions/{actionId}/start`. These paths check live reservation ownership and current business conflicts again. The exception is tied to the exact prospector, assignment and conflict; it cannot be shared with another user or used against a changed conflict.

The approval transaction commits the request decision, exception and audit together in PostgreSQL. It does **not** claim a Redis reservation on behalf of the requester. Another actor may acquire the live lock before the requester claims; that live lock remains authoritative. Approval responses expose this distinction through `approval: { id, expiresAt }` rather than claiming a reservation was acquired.

## Collision behavior and evidence

The evaluator checks live reservations first, then scheduled follow-ups/planned contact actions, recent contact and conflicting assignments under existing organization coordination policies. Newly supported planned actions are open calls, emails, messages and visits owned by current assignments in active campaigns/prospect memberships. Tasks, notes, finalized actions and actions from ended assignments do not create planned-contact collisions. The caller's own action on the same campaign prospect does not block its own start. A different campaign's planned contact is evaluated using the same organization policy as a follow-up. Changing the planned action's due date/version changes its exception fingerprint.

Live reservations cannot be overridden. Advisory assignment warnings need no exception. Consent/opposition remains a separate, non-overridable restriction; the generic reservation workflow conservatively checks all channels. Rejection/cancellation can close requests even when contact is blocked. The requester may cancel an owned pending request after losing prospect visibility, without regaining access to that prospect's current data. Administrators with target scope can reject an unassigned request using retained assignment context; approval still requires the original current assignment.

Collision events preserve the server's full evaluation and target-related coordination configuration, evaluator version and default cooling-off duration internally. Coordination policies are compared again before request/approval; changed configuration requires a fresh check. Public responses redact the conflicting campaign, assignment, action, activity, reservation and owner identifiers. Seeing a target campaign does not grant access to another campaign's records. The event's own target IDs remain available within the caller's current operational scope.

Evidence is captured by the new `/reservations/check` workflow. Existing legacy collision-check/claim APIs continue to work and do not retroactively generate these collision-event records. Their existing reservation request/result audit remains available. No historical Redis expiry or previously unrecorded collisions are invented. Request/decision audit events appear in the canonical prospect timeline with target-safe metadata.

## Access, lists and concurrency

Visibility follows current explicit tenant/owning-organization/team operational grants, including individually assigned prospect ownership. Resource-only grants and organization participation do not grant exception authority. Observers may read within their scope but cannot request or decide. Configurable `collisions.override` permission is enforced before idempotent replay and again during the decision. Out-of-scope IDs return 404. Cancellation is restricted to the original requester.

Lists accept `limit` (1–100, default 25), UUID `cursor`, `campaignId` and `reasonCode`. Override-request lists also accept `status` (`pending`, `approved`, `rejected`, `cancelled`). Scope and filters apply before pagination; IDs provide stable page ordering while timestamps describe chronology. An expired evidence window does not automatically rewrite request status: pending expired requests can be rejected/cancelled and followed by a fresh check.

Mutations serialize through the existing tenant authorization lock, then membership and assignment locks in consistent order. A partial unique index protects the one-pending-request invariant. The decision and audit share one SQL transaction: an audit failure rolls back an issued exception and leaves the request pending. Collision events reject UPDATE. Requests permit only a pending-to-final transition; their original reason/context and finalized decision cannot be rewritten through UPDATE. No generic create/edit/delete evidence APIs are exposed. Privileged database deletion/retention and production database-role hardening remain separate work.

## Migration and verification

Migration `0040_collision_requests.sql` adds `collision_events` and `override_requests`, tenant-safe composite foreign keys, queue/reference indexes, the pending-request unique index and manually maintained evidence/transition triggers. Preserve these triggers in future migrations. The schema now contains 51 tables and 41 migrations. This migration was applied only to the isolated backend validation database; apply it before deploying this API version.

Verification: 647 API unit tests, 446 API integration tests (17 new workflow cases), and 10 worker integration tests passed. API typecheck/build, affected-file lint and all 41 migration integrity entries passed. Integration cases cover authorization, safe pagination, conflict redaction, idempotency, concurrent requests/decisions, SQL rollback, immutable evidence, conditional decisions, policy/assignment changes, active locks, consent, planned actions, exception consumption, permission revocation and closing requests after unassignment.

Reservation rules, canonical lifecycle routes, heartbeat/extension and observed expiry history are now implemented; see [reservation lifecycle](RESERVATION_LIFECYCLE.md). Remaining work includes compliance/reporting contracts. Legacy immediate manager exceptions remain available; the new request workflow supplies the independent review and decision lifecycle described above. Notification/realtime delivery for request decisions is not included in this stage.
