# Reservation rules, lifecycle and durable evidence

> **Current implementation — 2026-09-30:** Redis remains the live lease authority,
> while PostgreSQL `reservation_records` and `reservation_events` provide durable
> intent, observed outcomes, reconciliation, and expiry evidence. Migration `0084`
> adds the lifecycle constraints and event safeguards. The historical 0041/42-count
> note below is retained for traceability; use the current migration journal and
> [backend audit](./BACKEND_AUDIT_2026-09-30.md) for present counts.

Implemented 2026-09-22. Eleven additional product contracts are implemented. The earlier `/reservations/check` collision workflow remains available. All paths below have `/api/v1` and existing unversioned aliases.

| Method | Endpoint                                  | Behavior                                                                         |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/reservation-rules`                      | Tenant-admin rule list, including deactivated history                            |
| POST   | `/reservation-rules`                      | Create a tenant default or campaign-specific rule                                |
| GET    | `/reservation-rules/{ruleId}`             | Read rule configuration and record ETag                                          |
| PATCH  | `/reservation-rules/{ruleId}`             | Change duration, cooldown, renewal bounds or manager-exception policy            |
| DELETE | `/reservation-rules/{ruleId}`             | Deactivate without deleting history; fall back to the next applicable default    |
| GET    | `/reservations`                           | Current-scope reservation records, reconciled with Redis before status filtering |
| POST   | `/reservations/claim`                     | Check eligibility/collision/consent and atomically acquire the Redis lock pair   |
| GET    | `/reservations/{reservationId}`           | Read reconciled status, lease, captured rule and latest 50 evidence events       |
| POST   | `/reservations/{reservationId}/heartbeat` | Renew within the rule's rolling duration and absolute maximum hold               |
| POST   | `/reservations/{reservationId}/release`   | Release the authenticated owner's exact lease, with a reason                     |
| POST   | `/reservations/{reservationId}/extend`    | Add explicitly requested minutes within the absolute maximum hold                |

All mutations require `Idempotency-Key`. POST creates/claims return 201; heartbeat/release/extend, PATCH and DELETE return 200. Rule responses expose `etag`; PATCH/DELETE accept optional `If-Match`. A stale version returns 412. Use a new idempotency key for each new heartbeat/extension, and reuse a key only to retry the same request. Replaying a successful claim/renewal is not a fresh live-state check; GET detail provides reconciled state.

## Rules

Only tenant administrators may list, read or change rule definitions. Effective configuration is returned with authorized reservation records. Create accepts optional `campaignId`; omit it for a tenant default. Campaign selection is fixed after creation. A campaign ID must belong to the tenant. There can be one active tenant default and one active rule per campaign. Deactivated rules cannot be edited/reactivated; create a replacement.

```json
{
  "campaignId": "<optional campaign UUID>",
  "durationMinutes": 20,
  "cooldownMinutes": 60,
  "maxHoldMinutes": 120,
  "allowHeartbeat": true,
  "allowExtension": true,
  "allowManagerOverride": true
}
```

Duration is 1–240 minutes, cooldown 0–10080 minutes, maximum hold 1–1440 minutes and at least the initial duration. Create defaults are shown above. PATCH accepts the six policy fields, without `campaignId`; null policy fields are rejected.

Resolution order is active campaign rule, active tenant rule, then built-in defaults. Built-ins use 20-minute duration, 120-minute maximum hold, enabled renewal/manager exceptions, and `PROSPECT_COOLING_OFF_MINUTES` for cooldown. Rule creation's omitted cooldown defaults to 60 minutes. There is no organization/territory rule inheritance or action-type compatibility configuration in this stage.

Rules apply to existing campaign-scoped claim APIs and action-start acquisition as well as the canonical claim route. Cooldown is evaluated by the shared business collision evaluator. Existing explicit delayed organization coordination policies retain their own delay; they are not disabled by setting a campaign cooldown to zero. Disabling manager exceptions prevents issuing/consuming a manager exception for a blocking collision; it never converts the collision to an allow decision. New collision evidence captures its reservation-rule snapshot, and request/approval requires a fresh check if that snapshot changed.

Rule changes govern new claims and subsequent renewals. They do not forcibly delete existing leases. Renewal uses the stricter of the current maximum hold and the maximum captured when the record was created. Increasing a policy cannot give an existing lease an unlimited lifetime.

## Claim and renewal

Claim body:

```json
{
  "campaignId": "<campaign UUID>",
  "campaignProspectId": "<campaign membership UUID>",
  "overrideId": "<optional issued exception UUID>"
}
```

Only an eligible current prospector can claim. The canonical path locks tenant authorization and current assignment during its operation, checks consent, then uses the existing collision/coordination evaluator. Live reservations remain non-overridable. Redis Lua checks the exact prospect key, target organization key, every blocking organization key and the legacy tenant-wide key in one operation. Only the exact key and target organization's key are written. The lease has an absolute Redis expiration; a lease whose preparation consumed its validity window is never installed.

The response includes `reservationId`, `claimToken`, `status`, scope/owner fields, `acquiredAt` and `expiresAt`. `claimToken` is the existing reservation UUID, not a bearer authorization credential. Every mutation still requires the authenticated owner. A live owned lease may be returned on a repeated claim. If it predates the registry, it is adopted as `legacy_lease_observed`, without inventing a historic claim event.

Heartbeat requires no body. It proposes expiry at server time plus the current duration, capped at the absolute maximum. It never shortens an existing lease. It may be a no-op if an explicit extension already goes farther; at the maximum hold it returns 409. Extend takes `{ "minutes": 5 }`, an integer from 1–240, and adds it to the current expiry. An extension beyond the maximum returns 409 rather than silently truncating.

Both renewal paths recheck active membership/campaign/prospect/team, current assignment ownership, consent, rule flags, pending action-driven release, current business conflicts and coordination scope. If a blocking business collision requires an exception, the lease's captured exception must still be applicable and unexpired. Release/recheck/request a fresh exception if necessary. Redis renews both lock values/expirations atomically only when the original token, owner and previous expiry match, both owned keys still exist, and no newly blocking scope lock exists. Missing keys are not recreated and expired/replacement tokens cannot renew.

Renewal schedules a cleanup job with the new expiry generation. Old delayed jobs compare the expiry and cannot remove the renewed lease. Redis expiration and API reconciliation remain effective if cleanup-job scheduling fails.

## Release and reads

Release body: `{ "reason": "Finished prospect work" }`, with 3–1000 characters and at least three nonblank characters after trimming. The original owner can release their lease even after reassignment, campaign state changes or consent opposition. This exception only removes that exact owned token; it does not restore prospect access. Another user's lease cannot be released by supplying its ID. Existing action-completion/cancellation release effects also record confirmed release in the registry.

Read visibility follows current operational tenant/organization/team grants and individual assignment scope. Observers and managers may read within those scopes but cannot renew/release another owner. Out-of-scope IDs return 404. An owner who lost scope may still release without reading the prospect's new data.

Reservation lists accept `limit` (1–100, default 25), UUID `cursor`, `campaignId`, and `status` (`pending`, `active`, `released`, `expired`, `lost`, `failed`). At most 100 scoped candidate rows are inspected per request. Redis reconciliation happens before status filtering. A filtered page can be empty with a non-null `nextCursor`; continue until the cursor is null. Rule lists support `limit`, `cursor` and `campaignId`. Rule rows include `isActive`; the client can display their retained active/deactivated history.

## Durability and failure semantics

Redis remains authoritative for live exclusion. PostgreSQL stores a durable intent **before** a new lease is acquired and then confirms the observed outcome. This does not make Redis and PostgreSQL one atomic transaction. The registry projection and append-only evidence distinguish:

| Status     | Meaning                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `pending`  | Claim intent exists; successful installation is not yet confirmed                                    |
| `active`   | The same lease and its paired collision key were confirmed/observed                                  |
| `released` | A successful token-checked release was recorded                                                      |
| `expired`  | The recorded deadline passed and that valid lease pair is absent; see the observation event          |
| `lost`     | The lease disappeared, was replaced or its key pair became inconsistent before its recorded deadline |
| `failed`   | The atomic acquisition explicitly did not acquire the lock                                           |

Evidence includes requested claims/renewals/releases, confirmations and live-state/absence/expiry observations. Events reject database UPDATE. Context IDs are retained snapshots, not ownership authority or foreign keys to mutable prospect/assignment rows; authorization always resolves current scope. Tenant ownership is constrained, and event-to-record references are tenant-safe. No generic public evidence mutation endpoints exist. Privileged retention/deletion remains part of database-role hardening.

Every API process reconciles up to 100 pending/active records every five seconds. Inspected rows rotate so a malformed record does not starve unrelated leases. Set `RESERVATION_RECONCILIATION=off` only for controlled tests; the isolated runner does this and tests invoke reconciliation explicitly. At least one normal API process must be running for background evidence reconciliation. Detail/list reads also reconcile selected records. Pending claims are not guessed to have failed while their original deadline is still open.

If Redis succeeds but database confirmation fails, the API may return an error although the lease changed. Read its detail/current reservation before issuing a new extension or claim. Reconciliation records the observed live state and expiry. If a release result cannot be confirmed and the key disappears early, it is recorded as an unexplained absence, not an invented release success. Expiry evidence records when absence was observed and the previously scheduled deadline; it does not claim to know the exact instant Redis deleted its key. Historic leases are not backfilled. The canonical timeline includes these new `reservation_evidence` events.

## Migration and validation

Migration `0041_reservation_lifecycle.sql` originally introduced the lifecycle tables;
the current chain has since progressed through migration `0084`, which adds the
durable lifecycle constraints and evidence safeguards. See the migration journal
before deployment.

Validation: 647 API unit tests, 465 API integration tests (19 new reservation-lifecycle cases), and 10 worker integration tests passed. API build/typecheck, affected-file lint and all 42 migration integrity entries passed. Coverage includes rule precedence and lifecycle, tenant/scope isolation, cooldown/exception enforcement, atomic key renewal, concurrent maximum-hold checks, stale/replaced/missing keys, consent/reassignment release, uncertain claim/renewal confirmation, changed coordination, expired preparation and idempotent observed-expiry history.

These APIs are ready for frontend integration in a migrated development/test environment. Production email/secrets, restricted database credentials/RLS, recovery/load/failure validation and remaining platform contracts are still separate work. Next backend group: bulk assignments and configurable assignment-rule APIs, followed by import/deduplication/export completion.
