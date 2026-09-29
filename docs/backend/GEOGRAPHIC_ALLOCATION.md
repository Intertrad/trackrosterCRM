# Automatic geographic allocation

This stage automatically selects team or personal assignment targets from existing campaign–territory links and dated territory responsibilities. It is an explicit batch operation: importing a prospect or changing a boundary does not silently trigger assignments.

| Method | Endpoint                                                | Behavior                                                         |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/campaigns/{campaignId}/geographic-allocation/preview` | Calculate proposals and skip reasons without writing assignments |
| POST   | `/campaigns/{campaignId}/geographic-allocation/apply`   | Recalculate and persist eligible assignments with audit evidence |

Both routes have `/api/v1` and unversioned aliases and return 200. Body: `{ "prospectIds": ["<campaign prospect UUID>"] }`. Supply 1–100 unique campaign-prospect IDs, not establishment IDs. UUIDs are normalized and processed in ascending order; duplicate UUIDs differing only in case are rejected. A missing or foreign prospect makes the entire batch fail with 404 before writes. Apply requires `Idempotency-Key`; preview does not cache results.

## Selection rules

1. Preserve existing active assignments. Excluded campaign prospects and inactive/archived establishments are skipped.
2. Require coordinates. Match them with PostGIS `ST_Covers` against active territory boundaries explicitly linked to this campaign. Boundary edges count as inside. No address guessing, nearest-area fallback or implicit child-territory inclusion occurs.
3. Consider only current, non-revoked territory responsibilities with half-open effective periods. Null boundaries, future/expired responsibilities and unlinked territories cannot allocate work.
4. A team responsibility targets that active team with no individual assignee. A personal responsibility requires an active tenant membership and identity plus an explicit prospector grant for an active team in the campaign owner's organization. Roster membership alone is insufficient. Teams from participating external organizations are excluded, preserving current assignment foreign-key and operational authorization rules.
5. Order candidates by ascending responsibility priority (lower wins), territory UUID, responsibility UUID, then team UUID. Multiple matching territories and multiple prospector team grants therefore resolve deterministically. Personal responsibilities have no hidden preference over team responsibilities: use priority to express it.
6. Select the first candidate with room. Automatic allocation checks team capacity (configured value, or the existing default of 100) and personal membership capacity (null means unlimited). Workload counts all current assignments in the tenant, including other campaigns. Preview tracks proposed usage within the batch; apply counts committed-in-transaction assignments. A full candidate falls back to the next eligible responsibility.

Team capacity checks constrain this automatic allocator. Existing manual assignment paths retain their existing rules; this stage does not turn team capacity into a global database constraint. Personal capacity uses the same membership lock as manual assignment.

## Results

Responses contain `campaignId`, `mode` (`preview` or `apply`), `decisions`, `assigned`, `proposed`, and `skipped`. Each decision includes `prospectId` and `outcome`:

| Outcome                      | Meaning                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `proposed`                   | Preview found an eligible target                                      |
| `assigned`                   | Apply persisted the selected assignment                               |
| `already_assigned`           | Existing ownership was preserved                                      |
| `inactive_prospect`          | Campaign prospect or establishment is inactive                        |
| `missing_coordinates`        | Geographic matching is unavailable                                    |
| `no_eligible_responsibility` | No covering, linked, active and operationally eligible responsibility |
| `capacity_exhausted`         | All eligible candidates are full                                      |

Proposed/assigned decisions also contain `teamId`, nullable `membershipId`, `territoryId`, and `responsibilityId`; applied decisions include `assignmentId`. Preview is advisory and does not reserve capacity. Apply independently resolves current geography, dates, ownership, permissions and capacity. Repeating apply with the same idempotency key returns its original response only while current campaign-wide authority remains valid. A new key performs a new calculation; it still preserves existing assignments.

## Permissions and consistency

Campaign-wide allocation requires a tenant administrator or an explicit director of the campaign's owner organization, with effective configurable `assignments.manage` permission. Managers, resource-only grantees and participating-organization directors cannot use this campaign-wide endpoint. Existing scoped manual assignment APIs remain available under their own permissions.

Authority is checked before idempotent replay and again after obtaining the transaction lock. Completed/archived campaigns and inactive owning organizations reject allocation. Assignment selection does not reserve prospects, grant contact rights or bypass collision, consent or override policies; existing operational checks still apply when someone works the prospect.

A bounded batch runs in one transaction. Expected per-prospect exclusions are returned as skips; unexpected persistence/audit errors roll back the batch. Stable tenant, team and membership lock ordering coordinates allocation with permission updates, responsibility/link changes, membership capacity and manual assignment writers. Campaign/prospect/establishment locks keep the selected resource state stable. Active-assignment uniqueness remains the final database backstop.

Every applied assignment uses the normal assignment table and creates an `assignment.assigned` audit event containing `source: "geographic_allocation"`, the campaign, target, matched territory, responsibility and priority. Preview writes neither assignments nor audit events.

## Validation and remaining scope

Verification: 647 API unit tests, 408 API integration tests (including 11 geographic allocation cases), and 9 worker integration tests passed. API typecheck/build, affected-file lint and all 37 migration integrity entries passed.

The integration suite covers boundary points, missing/outside coordinates, excluded prospects, priority and capacity fallback, preview/apply agreement, current ownership and replay, foreign/invalid batch IDs, dated eligibility, inactive subjects, unlinked territories, competing allocation batches, concurrent manual assignment, terminal campaigns and permission revocation before replay and during a queued mutation.

No migration is needed: this stage uses existing territory, responsibility, assignment and audit tables. The schema remains at 44 tables and 37 migrations. General configurable assignment-rule CRUD, round-robin/skill/proximity strategies, scheduled allocation, cross-organization operational assignments and import-triggered allocation remain separate work. The `/assignment-rules` ledger remains pending. Production load testing remains pending, particularly for large tenant rosters; requests are bounded to 100 prospects and serialize team capacity checks.
