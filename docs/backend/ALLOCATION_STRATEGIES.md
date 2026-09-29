# Skill/proximity allocation and suggestions

Apply migration 0045 before using these additions. They extend the existing saved-rule CRUD, simulation and transactional bulk assignment routes. All four strategies (`capacity`, `round_robin`, `skill`, `proximity`) share campaign-wide management authority, active target eligibility, capacity enforcement, idempotency and transactional audit.

## Configuration

Rule create/PATCH now accept `requiredSkills` (up to 50 alphanumeric, hyphen/underscore tags, maximum 64 characters each) and `maxDistanceKm` (0.001–20040, optional/null for no radius restriction). Tags are normalized to lowercase and deduplicated. Rule target entries optionally contain `skills` with the same tag format and a dispatch `location` containing numeric `longitude` (-180–180) and `latitude` (-90–90).

```json
{
  "campaignId": "CAMPAIGN_UUID",
  "name": "Nearby French-speaking B2B team",
  "strategy": "proximity",
  "requiredSkills": ["french", "b2b"],
  "maxDistanceKm": 50,
  "targets": [
    {
      "teamId": "TEAM_UUID",
      "assignedUserId": "MEMBERSHIP_UUID",
      "skills": ["french", "b2b"],
      "location": { "longitude": 2.35, "latitude": 48.86 }
    }
  ]
}
```

Skills are administrator/director-configured routing qualifications, not inferred employee attributes. Dispatch locations are explicit rule configuration, not live GPS. Prospect positions come from the canonical establishment's saved coordinates. Missing positions are never guessed.

A skill rule requires at least one required skill. Every required skill must be present on an eligible target; capacity balancing breaks ties between qualified targets. Optional skill requirements also restrict other strategies, allowing combined skill/proximity rules. A proximity rule requires at least one configured target location. It ranks eligible targets by great-circle distance, then utilization/workload/configured order. Full targets are excluded so a farther eligible target can be selected. Distance is straight-line kilometres, not driving distance or estimated travel time. The radius is inclusive. PATCH with `maxDistanceKm: null` removes the radius restriction.

Preview/simulation adds `missing_coordinates`, `no_skill_match`, and `no_proximity_match` conflict outcomes. Successful proximity decisions include `distanceKm`. The entire bulk apply still rolls back if any prospect cannot be allocated. Rule selection remains explicit; priority orders the saved-rule list, not an automatic rule chain. No scheduled/import-triggered allocation is implied.

## Suggestions

`GET /api/v1/assignment-suggestions?ruleId={id}&campaignProspectId={id}` requires bearer authentication and campaign-wide assignment authority. It uses the selected active rule and current prospect/target/capacity state. The response contains `ruleId`, `strategy`, `requiredSkills`, `prospectId`, `outcome`, the recommended target when available, and ranked `candidates`. Candidates expose team/member IDs, nullable `distanceKm`, `availableTeamCapacity` and nullable `availableMemberCapacity`. Unlimited personal capacity is null.

Suggestions do not write ownership/audit or consume round-robin turns. If no candidate is available, `candidates` is empty and `outcome` explains why. Assignment authority is rechecked inside the same planner transaction; revoked permissions, foreign rules, inactive rules and missing prospects are rejected. Suggestions are advisory; bulk apply re-evaluates everything.

Verification includes skill normalization/all-tag matching, invalid configuration, great-circle reference distances and date-line/antipode cases, nearest-target capacity fallback, missing coordinates, radius exclusion/removal, atomic failure and tenant/permission-isolated suggestions. See the [frontend handoff](FRONTEND_API_HANDOFF.md) for current totals and the [bulk contract](BULK_ASSIGNMENTS.md) for shared behavior.
