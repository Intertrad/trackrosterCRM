# Bulk assignments and saved allocation rules

Implemented and locally verified on the backend branch. Apply migration `0042_assignment_rules.sql` before using these routes. Only the isolated validation database was migrated during development. Paths below use the `/api/v1` prefix; protected calls need a bearer token.

## Routes

| Method | Path                                  | Contract                                                                                                                                                                               |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/assignments/preview`                | Read-only preview of a selected lot, with proposed targets and per-prospect conflict reasons.                                                                                          |
| POST   | `/assignments/bulk`                   | Assign the whole lot in one transaction, or return 409 without writing any assignments. Requires `Idempotency-Key`. Returns 201.                                                       |
| GET    | `/assignment-rules?campaignId={id}`   | List saved campaign rules, including inactive rules, ordered by priority then ID. `limit` 1–100 (default 25); `offset` default 0; response `{items,nextOffset}`. Items contain `etag`. |
| POST   | `/assignment-rules`                   | Create a capacity or round-robin rule. Requires `Idempotency-Key`. Returns 201. Skill and proximity strategies are not yet implemented.                                                |
| PATCH  | `/assignment-rules/{ruleId}`          | Change name, targets, strategy, priority or active state. Requires `Idempotency-Key`; supports optional `If-Match`. Campaign cannot change.                                            |
| DELETE | `/assignment-rules/{ruleId}`          | Audit and deactivate a rule, retaining its definition and history. Requires `Idempotency-Key`; supports optional `If-Match`.                                                           |
| POST   | `/assignment-rules/{ruleId}/simulate` | Read-only simulation using the current rule and live workloads. Takes `{ "prospectIds": [...] }`. Does not advance round robin.                                                        |

Previews and simulations return 200 and do not require an idempotency key. Mutation retries must use the original key and unchanged payload. Guards check current authority before replay. A permission revocation returns 403 even if the original request succeeded.

## Manual batch

Use the same body for preview and bulk:

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "prospectIds": ["CAMPAIGN_PROSPECT_UUID_1", "CAMPAIGN_PROSPECT_UUID_2"],
  "teamId": "TEAM_UUID",
  "assignedUserId": "MEMBERSHIP_UUID"
}
```

`assignedUserId` is optional/null for a team queue. It identifies a tenant membership, not a global identity. `prospectIds` are campaign-prospect IDs, not establishment/master-prospect IDs. Supply 1–100 distinct UUIDs; case variants count as duplicates. Prospects are processed in UUID order, independent of input order. All must belong to the selected campaign and tenant; a missing/foreign ID returns 404 without partial writes.

Tenant admins and the campaign owner's organization directors can assign. Managers can assign only to their exact managed team. Configurable `assignments.manage` restrictions apply. Read scopes, historical roster membership and campaign participation do not confer assignment authority. Teams must belong to the campaign's owning organization. Personal targets must be active memberships with an active identity and an exact team prospector grant.

## Saved rule

Create a rule:

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "name": "Balanced prospectors",
  "strategy": "round_robin",
  "priority": 100,
  "targets": [
    { "teamId": "TEAM_UUID", "assignedUserId": "MEMBERSHIP_UUID_1" },
    { "teamId": "TEAM_UUID", "assignedUserId": "MEMBERSHIP_UUID_2" }
  ]
}
```

Rules require campaign-wide assignment authority (tenant admin or owning organization director). Managers cannot create, list, simulate or apply campaign-wide rules. Targets must be 1–50 distinct team/membership pairs and are validated on save and rechecked at execution. Names must contain non-whitespace characters. Priority is 0–10000; active state defaults to true. Rules can be reactivated through PATCH after target eligibility is restored. Deactivation remains possible after eligibility is lost.

Apply or preview a rule by replacing the manual target fields with its ID:

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "prospectIds": ["CAMPAIGN_PROSPECT_UUID_1", "CAMPAIGN_PROSPECT_UUID_2"],
  "ruleId": "RULE_UUID"
}
```

Do not mix `ruleId` with a manual target. Inactive rules cannot execute or simulate. Rule selection is explicit: priority orders the management list, not an implicit rule chain. No scheduled or import-triggered allocation is added here.

- **Round robin:** walk targets in their configured order, skipping ineligible/full targets. Persist the next target only after the whole batch succeeds. Previews, failures and idempotent replays do not consume turns. Editing targets or strategy resets the cursor; other edits preserve it.
- **Capacity:** choose the eligible target with the lowest maximum of team utilization and bounded personal utilization. Break ties by personal workload, then configured target order. A member with no capacity setting has no personal limit; team capacity still applies.

Counts include all current assignments across campaigns. Default team capacity is 100; configured personal capacity can be zero. The planner updates shared team and membership counters after each proposed assignment, including when several targets share a team/member. Bulk, geographic and legacy single-assignment writers serialize through team locks; legacy writes now enforce team capacity too.

## Responses and conflicts

Successful preview example:

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "ruleId": null,
  "mode": "preview",
  "canApply": true,
  "assigned": 0,
  "proposed": 1,
  "conflicts": 0,
  "decisions": [
    {
      "prospectId": "CAMPAIGN_PROSPECT_UUID",
      "outcome": "proposed",
      "teamId": "TEAM_UUID",
      "assignedUserId": null
    }
  ]
}
```

A preview decision can instead be `already_assigned`, `inactive_prospect`, `capacity_exhausted`, or `ineligible_target`. Already assigned prospects are never silently reassigned. Completed/archived campaigns return 409. Invalid target definitions return 400. Successful apply changes outcomes to `assigned`, adds each `assignmentId`, and returns the assigned count.

Preview is advisory. Apply re-evaluates permissions, campaign state, eligibility, ownership and capacity under locks. If any prospect conflicts, apply returns the standard 409 envelope with code `ASSIGNMENT_BATCH_CONFLICT`; call preview again for current per-prospect decisions. The error envelope does not expose arbitrary exception metadata. Unique ownership races also return 409. All assignments, per-assignment audit evidence and round-robin cursor changes share one transaction. Audit evidence includes the rule definition/cursor used. A storage failure rolls everything back.

Assignment does not grant permission to contact an opposed prospect or bypass reservation/collision policies. Contact workflows continue enforcing those separately. This route does not bulk-reassign existing owners.

## Verification and remaining scope

The integration suite covers atomic batches, validation, tenant/team/member authority, pre-replay and in-transaction permission revocation, capacity races against manual assignment, unchanged existing ownership, inactive resources, rule CRUD/ETags, round-robin continuity, shared capacities, simulation purity, rule isolation, and rollback after the second audit write fails.

Skill matching, proximity-based rules/suggestions, implicit priority rule chains, import-triggered allocation, canonical assignment list/detail/lifecycle contracts, import/deduplication/export completion, and production readiness remain separate work. Geographic territory allocation remains available through its existing explicit endpoints.
