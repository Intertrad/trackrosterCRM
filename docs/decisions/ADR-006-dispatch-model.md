# ADR-006: Hybrid assignment dispatch

- **Status:** Accepted for the beta implementation baseline
- **Date:** 2026-10-02
- **Decision ticket:** TR-920
- **Owners:** Product and engineering

## Context

The product brief contains two dispatch cues. Management needs to choose prospects,
territories and objectives for the team, while the prospector's “My day” flow starts a
session and receives available work. Treating either cue as the whole product would
make one of the primary workflows unusable.

## Decision

TrackRoster will use a **hybrid dispatch model**:

1. A manager defines the campaign, territory, category/section and objective, and can
   push an explicit assignment to one prospector or a team using the existing
   assignment and collision APIs.
2. A prospector can start a session inside the manager-authorized scope and pull
   eligible, unassigned prospects. The pull operation creates the same assignment
   record and uses the existing reservation/collision claim path.
3. Explicit manager assignments take precedence. Prospector pull excludes prospects
   that are already assigned, paused, completed or revoked, and it never changes an
   assignment owned by another prospector.
4. Both paths enforce tenant, organization, team and campaign authorization at read
   and write time, and both write the same audit events and notification producers.

This gives management control over scope and exceptions while removing a mandatory
daily manual dispatch step for prospectors.

## Invariants for implementation

- There is one assignment lifecycle and one collision/reservation system. TR-923 and
  TR-924 must not introduce a second ownership table or claim mechanism.
- A pulled prospect is claimed atomically before it is shown in a session. A failed
  claim is skipped and the session may continue with the next eligible prospect.
- Scope is evaluated from live membership, campaign participation, territory/category
  filters and assignment state. Cached lists are display hints only.
- Reassign, pause, complete and revoke remain manager-controlled lifecycle actions;
  pull cannot bypass those transitions.
- Every dispatch records actor, source (`manager_push` or `prospector_pull`), scope,
  objective and reason in the immutable audit trail.

## Consequences

- **TR-923** implements the manager push flow: entity → campaign → territory →
  section → eligible prospects → prospector/team → objective → assign.
- **TR-924** implements the prospector pull flow: campaign/scope selection → session
  creation → atomic allocation from the eligible unassigned pool → session points.
- Both screens can share the existing assignment filters, lifecycle endpoints,
  reservation claim and collision policy.
- The beta must expose the source of each assignment in the audit view so support can
  distinguish a manager push from a session pull.

## Acceptance evidence

- A manager can push a filtered selection and see the resulting assignment in the
  prospector's next session.
- A prospector can pull from the same authorized scope without receiving an already
  assigned or terminal prospect.
- Concurrent manager push and prospector pull produce at most one owner and one audit
  event for a prospect.
- Cross-tenant and out-of-scope attempts return the same authorization-safe response
  as the existing assignment APIs.

## Alternatives rejected

- **Manager-push only:** preserves control but makes the “start my day” flow depend on
  a manager completing daily dispatch.
- **Prospector-pull only:** matches the session mockup but removes the management
  workflow described in the brief and the existing assignment screens.
