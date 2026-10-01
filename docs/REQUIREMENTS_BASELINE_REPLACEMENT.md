# TrackRoster Product Requirements Baseline (Superseded)

**Status:** Superseded on 1 October 2026.  
**Replacement:** [REQUIREMENTS_TRACEABILITY_MATRIX.md](./REQUIREMENTS_TRACEABILITY_MATRIX.md) and [MVP_RELEASE_GATES.md](./MVP_RELEASE_GATES.md).  
**Reason:** the approved dossier-derived matrix is now the release authority for this remediation phase. The requested dossier path remains to be reconciled with the complete v1.0 source reviewed from Downloads.

> The original proposed content below is retained as historical audit context. It must not be used as a release sign-off baseline.

This document is the working requirements baseline used by the pre-deployment audit.
It consolidates the functional requirements in [`REQUIREMENTS.md`](./REQUIREMENTS.md),
the invariants in [`BUSINESS_RULES.md`](./BUSINESS_RULES.md), and the role-specific
screens supplied as release references. It is intentionally marked **proposed**:
the original Product Design Dossier was not present in the repository, so a product
owner must approve this replacement before a production release can be declared
visually and functionally accepted.

## Roles and authorized surfaces

The six supported role families are **Super Administrator**, **Client Administrator**,
**Director**, **Manager**, **Prospector**, and **Observer/Auditor**. Authorization is
always scoped by tenant first, then by organization, team, campaign, and territory
where the grant requires it. A role label in the UI never grants access by itself.

| Role                 | Required surfaces                                                                          | Required write boundaries                     |
| -------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Super Administrator  | tenant administration, security, platform support                                          | platform and tenant controls only             |
| Client Administrator | organization, memberships, imports, settings, audit                                        | tenant configuration and user lifecycle       |
| Director             | executive dashboard, reports, campaign performance, territories, team performance, exports | authorized organization/reporting perimeter   |
| Manager              | team dashboard/activity, assignments, approvals, campaigns, territories                    | assigned teams and manager approval decisions |
| Prospector           | My Day, prospects, map, follow-ups, actions/history, performance, messages                 | own assignment and conversation perimeter     |
| Observer/Auditor     | read-only audit/report surfaces granted by scope                                           | no operational mutation                       |

## Capability acceptance criteria

1. Every page loads its data through the authenticated API client; no operational
   table, dashboard KPI, chart, notification, message, or export may depend on a
   hard-coded fixture in a production build.
2. Every API read and write enforces tenant isolation and the caller's durable role
   and resource scope. Cross-tenant reads return an empty/masked result and writes
   are rejected.
3. Collision checks, reservations, override decisions, assignments, exports, and
   role changes are transactional, idempotent where retried, and auditable.
4. Notifications support in-app delivery, role-aware recipients, severity/priority,
   user channel preferences, critical-alert enforcement, quiet hours, and digest
   behavior. Provider delivery is best effort and must not weaken the in-app record.
5. Messaging supports direct and team conversations, linked prospects, attachments,
   read state, and the rule that a sent message can be edited/deleted only until it
   has been read by a recipient.
6. Desktop and mobile message layouts preserve the supplied reference hierarchy:
   list filters, conversation header, linked prospect context, participants, files,
   composer, and bottom navigation on mobile.
7. Manager and director dashboards expose only authorized dimensions and territory
   filters. Empty, loading, and provider/API error states have a retry path.
8. Exports and signed attachment links are scope-limited, expiry-bound, logged, and
   safe for large files.

## Traceability map

| Requirement area               | Canonical implementation/tests                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and role access | `apps/api/src/auth`, `apps/api/src/permissions`, web role navigation tests                                                              |
| Tenant isolation and RLS       | `database/migrations/0070_worker_rls_policies.sql`, `0073_force_row_level_security.sql`, `apps/api/test/tenant-rls.integration.spec.ts` |
| Collision and overrides        | `apps/api/src/collisions`, `apps/api/test/collision-workflows.integration.spec.ts`                                                      |
| Reservation lifecycle          | `apps/api/src/reservations`, reservation lifecycle integration tests                                                                    |
| Assignments and territories    | `apps/api/src/assignments`, `apps/api/src/territories`, manager web pages                                                               |
| Notifications                  | `apps/api/src/notifications`, `apps/api/src/communications`, worker reminder integration tests                                          |
| Messaging and attachments      | `apps/api/src/messaging`, `apps/api/src/communications`, web message tests                                                              |
| Dashboards and reports         | `apps/api/src/reporting`, director/manager web pages                                                                                    |
| Exports and audit              | `apps/api/src/exports`, `apps/api/src/audit`, director export page                                                                      |
| Responsive acceptance          | supplied desktop/mobile references and web responsive tests                                                                             |

## Approval record

Product owner approval is still required for this replacement baseline. Until it is
recorded, the release gate must report the dossier/visual-acceptance item as
**pending approval**, even when automated API and web tests pass.
