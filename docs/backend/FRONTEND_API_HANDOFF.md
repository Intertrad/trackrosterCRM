# Frontend API integration handoff

Snapshot: 2026-09-23, after map APIs and campaign lifecycle completion. Base path: `/api/v1`.

## Readiness summary

**Use for frontend integration in a migrated development/test environment:** 192 verified product-contract operations plus 3 verified extensions (two geographic-allocation routes and authenticated export file download). All 192 verified ledger entries were matched to actual controller declarations for this handoff. This is a conservative verified list, not the total number of existing backend routes.

**Production deployment is not yet signed off.** Verification means implemented behavior with test evidence, not a deployed or fully hardened production service. Only the isolated validation database has been migrated through `0056`. Production email delivery/key provisioning, restricted database credentials and tenant RLS, recovery/load/failure validation, and complete API documentation remain open. Password-reset and invitation delivery currently use the selected local Mailpit mailbox; its adapter refuses production mode.

Latest recorded validation: 659 API unit tests, 568 API integration tests and 10 worker integration tests passed. API build/typecheck, affected-file lint and 57 migration integrity entries passed. Counts reflect the latest implementation validation; they do not certify a production deployment.

| Classification                  | Product-contract operations | Frontend guidance                                                           |
| ------------------------------- | --------------------------: | --------------------------------------------------------------------------- |
| Verified                        |                         192 | Integrate the documented supported behavior                                 |
| Partial                         |                           0 | Use only the implemented subset described below                             |
| Pending verification/completion |                         189 | Do not assume the target contract is ready; consult the remaining checklist |
| Verified extensions             |                           3 | Verified additions outside the 381-operation product ledger                 |

## Client conventions

- Prefix the paths below with `/api/v1`; existing unversioned aliases remain available.
- Use the existing same-origin frontend BFF/proxy when integrating browser pages. The API bootstrap does not currently enable cross-origin browser requests; configure CORS explicitly if choosing a separate-origin browser-to-API deployment.
- Protected endpoints require `Authorization: Bearer <accessToken>`. Follow MFA/workspace-selection responses before treating login as complete.
- Supply `Idempotency-Key` on operations that require it. Reuse the key only when retrying the same operation and payload. A fresh collision evaluation requires a new key.
- Use the versioned record `etag` or endpoint-provided `ETag` with `If-Match` where supported. On 412, reload and reconcile before retrying. Actions and override requests return record versions in the body.
- Follow each endpoint’s list shape and cursor contract; do not assume every legacy list has the same envelope.
- Use canonical establishment IDs for `/prospects/{prospectId}/consents` and `/prospects/{prospectId}/timeline`. Action/check payloads use campaign-prospect membership IDs in `campaignProspectId`. They are different identifiers.
- A collision check does not claim ownership. Approval produces an exception; claim through the existing reservation endpoint or pass `overrideId` to action start. Live reservations and consent restrictions still apply.
- Action completion commits database effects together; reminder scheduling and reservation release may finish asynchronously. Detail responses expose delivery state.

## Verified APIs for frontend integration

### Authentication and personal account

Contract reference: [details](AUTHENTICATION.md).

| Method | Endpoint                              | Supported behavior / limits                                                        |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| POST   | `/auth/login`                         | Verified: password, MFA, required enrollment, workspace selection and throttling   |
| POST   | `/auth/refresh`                       | Verified: rotating refresh tokens and throttling                                   |
| POST   | `/auth/logout`                        | Verified: revocation and audit                                                     |
| POST   | `/auth/password/forgot`               | Verified locally: private acknowledgement and encrypted durable email outbox       |
| POST   | `/auth/password/reset`                | Verified: one-time reset, tenant password policy, session revocation; MFA retained |
| POST   | `/auth/mfa/enroll`                    | Verified: password step-up, encrypted secret and expiring enrollment challenge     |
| POST   | `/auth/mfa/verify`                    | Verified: TOTP enrollment/login, bounded attempts, drift and replay checks         |
| POST   | `/auth/mfa/recovery`                  | Verified: single-use recovery codes tied to password-authenticated login           |
| POST   | `/auth/mfa/recovery-codes/regenerate` | Verified: password/TOTP step-up, replacement and session revocation                |
| DELETE | `/auth/mfa`                           | Verified: step-up, workspace policy check and session revocation                   |
| POST   | `/invitations/{token}/accept`         | Verified: one-time acceptance; existing password/MFA preserved                     |
| GET    | `/me`                                 | Verified: identity, membership, public role names, workspace and settings          |
| GET    | `/me/memberships`                     | Verified: available active workspaces and roles                                    |
| POST   | `/me/active-membership`               | Verified: atomic switch and source-session revocation                              |
| GET    | `/me/permissions`                     | Verified for published catalogue: effective scoped capabilities and grants         |
| GET    | `/me/sessions`                        | Verified: cursor-paginated current-workspace sessions without token hashes         |
| DELETE | `/me/sessions/{sessionId}`            | Verified: ownership-checked revocation and audit                                   |
| DELETE | `/me/sessions/others`                 | Verified: other current-workspace sessions only                                    |
| GET    | `/me/preferences`                     | Verified: theme/density/accessibility preferences                                  |
| PATCH  | `/me/preferences`                     | Verified: validated partial updates and conditional writes                         |
| GET    | `/auth/config`                        | Verified: non-secret capabilities; SSO explicitly disabled                         |
| GET    | `/auth/password-reset/{token}/status` | Verified: validity only, without consuming token                                   |
| GET    | `/invitations/{token}`                | Verified: safe workspace information and masked email                              |

### Users, roles and permissions

Contract reference: [details](MEMBERSHIPS_AND_PERMISSIONS.md).

| Method | Endpoint                                    | Supported behavior / limits                                                          |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/tenant`                                   | Verified: current tenant metadata/locale/timezone                                    |
| PATCH  | `/tenant`                                   | Verified: admin-only audited conditional settings update                             |
| GET    | `/roles`                                    | Verified: six public roles; platform role cannot be tenant-granted                   |
| GET    | `/roles/{role}/permissions`                 | Verified for published catalogue: defaults and tenant restrictions                   |
| GET    | `/memberships`                              | Verified: tenant-scoped filtered cursor list                                         |
| POST   | `/memberships`                              | Verified locally: scoped admin invitation, initial grant and email outbox            |
| PATCH  | `/memberships/{membershipId}`               | Verified: audited role/status/capacity changes, concurrency and lifecycle protection |
| POST   | `/memberships/{membershipId}/resend-invite` | Verified locally: replacement token, cooldown, audit and idempotency                 |
| POST   | `/memberships/{membershipId}/suspend`       | Verified: reason, workspace session revocation and audit                             |
| POST   | `/memberships/{membershipId}/reactivate`    | Verified: suspended-only reactivation with reason; fresh login required              |
| GET    | `/memberships/{membershipId}/scopes`        | Verified: tenant/organization/team and explicit territory/campaign resource grants   |
| PATCH  | `/membership-scopes/{scopeId}`              | Verified: conditional replacement within structural or resource grant families       |
| DELETE | `/membership-scopes/{scopeId}`              | Verified for supported grants: continuity/workload checks and audit                  |

### Organizations and teams

Contract reference: [details](ORGANIZATION_STRUCTURE.md).

| Method | Endpoint                                       | Supported behavior / limits                                                                               |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/organizations`                               | Verified: tenant/scope filters, search and cursor pagination                                              |
| POST   | `/organizations`                               | Verified: admin-only create with audit/idempotency                                                        |
| PATCH  | `/organizations/{organizationId}`              | Verified: audited conditional mutable metadata                                                            |
| DELETE | `/organizations/{organizationId}`              | Verified: soft deactivation and active-child checks                                                       |
| GET    | `/organization-relationships`                  | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| POST   | `/organization-relationships`                  | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| DELETE | `/organization-relationships/{relationshipId}` | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| GET    | `/teams`                                       | Verified: scoped filtered cursor pagination                                                               |
| POST   | `/teams`                                       | Verified: tenant-safe team/settings creation and audited manager grants                                   |
| GET    | `/teams/{teamId}`                              | Verified: scoped metadata, manager and capacity                                                           |
| PATCH  | `/teams/{teamId}`                              | Verified: scoped management, conditional updates and audited manager grants                               |
| DELETE | `/teams/{teamId}`                              | Verified: admin deactivation with active-assignment protection                                            |
| GET    | `/teams/{teamId}/members`                      | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| POST   | `/teams/{teamId}/members`                      | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| PATCH  | `/teams/{teamId}/members/{membershipId}`       | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |
| DELETE | `/teams/{teamId}/members/{membershipId}`       | Verified: tenant-scoped, authorized, audited and history-preserving; see organization structure contracts |

### Territories and responsibilities

Contract reference: [details](PARTICIPATION.md).

| Method | Endpoint                                | Supported behavior / limits                                                           |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/territories`                          | Verified: tenant-isolated list filtered by effective resource read authority          |
| POST   | `/territories`                          | Verified: admin creation, tenant-safe parent, validated PostGIS boundary and audit    |
| GET    | `/territories/{territoryId}`            | Verified: resource-scoped metadata, GeoJSON boundary and center                       |
| PATCH  | `/territories/{territoryId}`            | Verified: scoped metadata/manage checks, ETags and cycle prevention                   |
| DELETE | `/territories/{territoryId}`            | Verified: soft deactivation; active children and campaign links protected             |
| GET    | `/territories/map`                      | Verified: visible active GeoJSON features and centers                                 |
| GET    | `/territory-assignments`                | Verified: resource-filtered cursor list, subject/state filters and history            |
| POST   | `/territory-assignments`                | Verified: member/team responsibility, dated read access, overlap protection and audit |
| PATCH  | `/territory-assignments/{assignmentId}` | Verified: conditional priority/date changes; authorization and overlap rechecked      |
| DELETE | `/territory-assignments/{assignmentId}` | Verified: terminal cancellation with retained history and read-access revocation      |

### Campaign scopes and participation

Contract reference: [details](CAMPAIGN_ORGANIZATIONS.md).

| Method | Endpoint                                                 | Supported behavior / limits                                                                                                     |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/campaigns/{campaignId}`                                | Verified: metadata/lifecycle authority and transaction recheck; optional legacy idempotency                                     |
| GET    | `/campaigns/{campaignId}/organizations`                  | Verified: mode-aware access, fixed owner, retained history and transactional authorization; see campaign organization contracts |
| POST   | `/campaigns/{campaignId}/organizations`                  | Verified: mode-aware access, fixed owner, retained history and transactional authorization; see campaign organization contracts |
| PATCH  | `/campaigns/{campaignId}/organizations/{organizationId}` | Verified: mode-aware access, fixed owner, retained history and transactional authorization; see campaign organization contracts |
| DELETE | `/campaigns/{campaignId}/organizations/{organizationId}` | Verified: mode-aware access, fixed owner, retained history and transactional authorization; see campaign organization contracts |
| GET    | `/campaigns/{campaignId}/territories`                    | Verified: both campaign and territory visibility enforced                                                                       |
| POST   | `/campaigns/{campaignId}/territories`                    | Verified: manage/read authority, tenant-safe link, audit and idempotency                                                        |
| DELETE | `/campaigns/{campaignId}/territories/{territoryId}`      | Verified: authority on both resources, audit and idempotency                                                                    |
| GET    | `/campaigns/{campaignId}/members`                        | Verified: visible user/team roster with effective dates and history                                                             |
| POST   | `/campaigns/{campaignId}/members`                        | Verified: member/team participation, dated read access and overlap protection                                                   |
| PATCH  | `/campaign-members/{campaignMemberId}`                   | Verified: role/date changes without administrative privilege escalation                                                         |
| DELETE | `/campaign-members/{campaignMemberId}`                   | Verified: terminal cancellation and live access revocation                                                                      |

### Prospect consent and timelines

Contract reference: [details](CONSENT_OPPOSITION.md).

| Method | Endpoint                           | Supported behavior / limits                                                                                                   |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/prospects/{prospectId}/timeline` | Verified: permission-filtered unified available history; pre-existing unrecorded reservation/expiry history is not fabricated |
| GET    | `/prospects/{prospectId}/consents` | Verified: scoped append-only evidence, channel/global restriction resolution and workflow enforcement                         |
| POST   | `/prospects/{prospectId}/consents` | Verified: scoped append-only evidence, channel/global restriction resolution and workflow enforcement                         |

### Collision checks and override requests

Contract reference: [details](COLLISION_OVERRIDES.md).

| Method | Endpoint                                           | Supported behavior / limits                                                                                                     |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reservations/check`                              | Verified: fresh scoped evaluation, persisted collision evidence, consent guard and idempotency; no claim                        |
| GET    | `/collision-events`                                | Verified: current-scope filtered cursor list of new check-workflow evidence                                                     |
| GET    | `/collision-events/{collisionId}`                  | Verified: immutable evaluation/policy context with conflicting identifiers redacted                                             |
| POST   | `/collision-events/{collisionId}/override-request` | Verified: fresh exact-context own request, one pending request and transactional audit                                          |
| GET    | `/override-requests`                               | Verified: scoped filtered cursor list of pending/final requests                                                                 |
| GET    | `/override-requests/{requestId}`                   | Verified: scoped request, collision context, decision and approval expiry                                                       |
| POST   | `/override-requests/{requestId}/approve`           | Verified: independent scoped approval, current conflict checks and atomic exception/decision/audit; requester claims separately |
| POST   | `/override-requests/{requestId}/reject`            | Verified: immutable reasoned management decision, ETag and idempotency                                                          |
| POST   | `/override-requests/{requestId}/cancel`            | Verified: own pending request cancellation, retained reason and history                                                         |

### Activities and outcomes

Contract reference: [details](ACTIONS_TIMELINES.md).

| Method | Endpoint                          | Supported behavior / limits                                                                               |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/actions`                        | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| POST   | `/actions`                        | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| GET    | `/actions/{actionId}`             | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| PATCH  | `/actions/{actionId}`             | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| POST   | `/actions/{actionId}/start`       | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| POST   | `/actions/{actionId}/complete`    | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| POST   | `/actions/{actionId}/cancel`      | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| GET    | `/actions/{actionId}/events`      | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |
| POST   | `/actions/{actionId}/corrections` | Verified: scoped lifecycle, atomic database completion, durable delivery intents and append-only evidence |

### Notifications

| Method | Endpoint                               | Supported behavior / limits                         |
| ------ | -------------------------------------- | --------------------------------------------------- |
| GET    | `/notifications/unread-count`          | Verified: authenticated recipient count             |
| POST   | `/notifications/{notificationId}/read` | Verified: recipient ownership and idempotency       |
| POST   | `/notifications/read-all`              | Verified: recipient-only atomic read-all and replay |

### Reservation rules and lifecycle

Contract reference: [rules, client flow and uncertain-outcome handling](RESERVATION_LIFECYCLE.md).

| Method | Endpoint                                  | Supported behavior / limits                                                                             |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/reservation-rules`                      | Verified: tenant-admin scoped rule list with retained inactive history                                  |
| POST   | `/reservation-rules`                      | Verified: tenant/campaign rules, bounded policy values, one active rule per scope and audit             |
| GET    | `/reservation-rules/{ruleId}`             | Verified: tenant-admin rule detail and record ETag                                                      |
| PATCH  | `/reservation-rules/{ruleId}`             | Verified: conditional duration/cooldown/renewal/exception-policy update and shared enforcement          |
| DELETE | `/reservation-rules/{ruleId}`             | Verified: audited soft deactivation with deterministic fallback                                         |
| GET    | `/reservations`                           | Verified: scoped registry list, bounded live reconciliation, cursor/status filtering                    |
| POST   | `/reservations/claim`                     | Verified: current eligibility/consent, durable intent and atomic Redis lock pair; confirmation recovery |
| GET    | `/reservations/{reservationId}`           | Verified: current-scope reconciled owner/lease/expiry and latest 50 evidence events                     |
| POST   | `/reservations/{reservationId}/heartbeat` | Verified: owned atomic renewal, current policies/conflicts and absolute hold bound                      |
| POST   | `/reservations/{reservationId}/release`   | Verified: exact owned-token release with reason, including after scope/consent changes                  |
| POST   | `/reservations/{reservationId}/extend`    | Verified: bounded explicit extension, current eligibility, atomic lock pair and durable evidence        |

### Geographic-allocation extensions

See [geographic allocation](GEOGRAPHIC_ALLOCATION.md).

| Method | Endpoint                                                | Supported behavior                                                                     |
| ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| POST   | `/campaigns/{campaignId}/geographic-allocation/preview` | Preview eligible geographic/capacity-based allocations; does not reserve capacity      |
| POST   | `/campaigns/{campaignId}/geographic-allocation/apply`   | Re-evaluate and apply eligible allocations idempotently; preserve existing assignments |

### Bulk assignment and saved rules

Contract reference: [payloads, response examples and limits](BULK_ASSIGNMENTS.md). Apply migration 0042. Rules support capacity, round robin, skill and proximity; explicit rule selection is required. See [strategy configuration](ALLOCATION_STRATEGIES.md).

| Method | Endpoint                              | Supported behavior / limits                                                                                |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POST   | `/assignments/preview`                | Verified: scoped bounded selection, ownership/eligibility conflicts and live capacity preview              |
| POST   | `/assignments/bulk`                   | Verified: all-or-nothing capacity-aware assignment, current authority, idempotency and transactional audit |
| GET    | `/assignment-rules`                   | Verified: campaign-authorized paginated rules ordered by priority and ID                                   |
| PATCH  | `/assignment-rules/{ruleId}`          | Verified: conditional rule/target/strategy/order/active-state updates for supported strategies             |
| DELETE | `/assignment-rules/{ruleId}`          | Verified: audited soft deactivation with current authority                                                 |
| POST   | `/assignment-rules/{ruleId}/simulate` | Verified: live eligibility/ownership/capacity simulation without writes or cursor movement                 |

### Canonical assignment lifecycle

Contract reference: [payloads, states, history and permissions](ASSIGNMENT_LIFECYCLE.md). Apply migrations 0043–0044.

| Method | Endpoint                               | Supported behavior / limits                                                                       |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/assignments`                         | Verified: current-grant scoped history list with campaign/team/user/status filters and pagination |
| GET    | `/assignments/unassigned`              | Verified: assignment-authorized campaign queue without current ownership                          |
| POST   | `/assignments`                         | Verified: canonical single assignment using transactional capacity/authority checks               |
| GET    | `/assignments/{assignmentId}`          | Verified: scoped ownership record, bounded history/events and record ETag                         |
| PATCH  | `/assignments/{assignmentId}`          | Verified: conditional priority and active/paused state changes with contact enforcement           |
| POST   | `/assignments/{assignmentId}/reassign` | Verified: atomic source end/replacement/audit with source and target authority and capacity       |
| POST   | `/assignments/{assignmentId}/complete` | Verified: reasoned terminal completion, immutable ownership history and audit                     |
| POST   | `/assignments/{assignmentId}/revoke`   | Verified: reasoned terminal revocation, immutable ownership history and audit                     |

### Allocation strategy extensions

See [configuration, distance semantics and suggestions](ALLOCATION_STRATEGIES.md).

| Method | Endpoint                  | Supported behavior / limits                                                                            |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | `/assignment-rules`       | Verified: capacity/round-robin/skill/proximity rule configuration with authority, audit and validation |
| GET    | `/assignment-suggestions` | Verified: scoped live capacity/skill/proximity ranked candidates using an explicit active rule         |

### Staged imports and asynchronous exports

Contract reference: [workflow, payloads and operational limits](IMPORT_EXPORT_JOBS.md).

| Method | Endpoint                       | Supported behavior                                                   |
| ------ | ------------------------------ | -------------------------------------------------------------------- |
| GET    | `/imports`                     | List import jobs.                                                    |
| POST   | `/imports`                     | Create import job/upload session.                                    |
| GET    | `/imports/{importId}`          | Read step, mapping and counts.                                       |
| POST   | `/imports/{importId}/file`     | Attach uploaded CSV/XLSX.                                            |
| PUT    | `/imports/{importId}/mapping`  | Save column mapping/normalization.                                   |
| POST   | `/imports/{importId}/validate` | Parse, normalize, deduplicate and validate.                          |
| GET    | `/imports/{importId}/rows`     | Paginate staged rows.                                                |
| GET    | `/imports/{importId}/issues`   | List errors/warnings/duplicates.                                     |
| PATCH  | `/import-issues/{issueId}`     | Save manual resolution.                                              |
| POST   | `/imports/{importId}/commit`   | Atomically import valid/resolved rows.                               |
| POST   | `/imports/{importId}/cancel`   | Cancel unfinished import.                                            |
| GET    | `/imports/{importId}/report`   | Download final processing report.                                    |
| POST   | `/exports/preview`             | Validate scope, fields, estimate rows and show warnings.             |
| GET    | `/exports`                     | List authorized export jobs.                                         |
| POST   | `/exports`                     | Request audited asynchronous CSV/XLSX export.                        |
| GET    | `/exports/{exportId}`          | Poll status/expiry.                                                  |
| POST   | `/exports/{exportId}/cancel`   | Cancel queued export.                                                |
| GET    | `/exports/{exportId}/download` | Issue short-lived authorized download.                               |
| GET    | `/exports/{exportId}/audit`    | Read requester, scope and download evidence.                         |
| GET    | `/exports/{exportId}/file`     | Extension: bearer-authenticated content with expiring download token |

### Configurable outcomes and canonical workflows

Contract reference: [payloads, filters, authorization and limits](OUTCOMES_FOLLOWUPS_DASHBOARDS.md).

| Method | Endpoint                            | Supported behavior                                                                        |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/settings/default-statuses`        | Verified: tenant outcome catalogue and fixed lifecycle stages                             |
| PATCH  | `/settings/default-statuses`        | Verified: audited conditional tenant outcome configuration; fixed lifecycle enum          |
| GET    | `/follow-ups`                       | Verified: scoped lifecycle lists and cursor pagination; legacy team queue retained        |
| GET    | `/follow-ups/{followUpId}`          | Verified: scoped historical detail, source, next action and audit history                 |
| PATCH  | `/follow-ups/{followUpId}`          | Verified: conditional open follow-up edits with reminder scheduling and audit             |
| POST   | `/follow-ups/{followUpId}/complete` | Verified: authorized atomic completion with idempotency and audit                         |
| POST   | `/follow-ups/{followUpId}/cancel`   | Verified: reasoned cancellation, obsolete ownership cleanup and audit                     |
| GET    | `/dashboard/manager`                | Verified: scoped performance, workload, paused exceptions and campaign-linked territories |
| GET    | `/dashboard/admin`                  | Verified: tenant operational readiness, session counts, alerts and data-quality counts    |

### Field rounds, objectives and dashboard completion

Contract reference: [payloads, lifecycle, scope and calculation details](ROUTES_AND_OBJECTIVES.md). Route distance/duration are geographic estimates; objective forecasts use explained elapsed-time pace.

| Method | Endpoint                       | Supported behavior                                                                               |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| GET    | `/dashboard/today`             | Verified: authorized daily priorities and persisted local-day route summary                      |
| GET    | `/routes`                      | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| POST   | `/routes`                      | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| GET    | `/routes/{routeId}`            | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| PATCH  | `/routes/{routeId}`            | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| DELETE | `/routes/{routeId}`            | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| POST   | `/routes/{routeId}/stops`      | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| PATCH  | `/route-stops/{stopId}`        | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| DELETE | `/route-stops/{stopId}`        | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| PUT    | `/routes/{routeId}/stop-order` | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| POST   | `/routes/{routeId}/optimize`   | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| POST   | `/routes/{routeId}/start`      | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| POST   | `/routes/{routeId}/complete`   | Verified: scoped own-round lifecycle, sequential stops and geographic estimates                  |
| GET    | `/dashboard/director`          | Verified: scoped performance, organization comparison and objective-risk calculations            |
| GET    | `/objectives`                  | Verified: scoped targets, immutable started definitions, contribution history and explained risk |
| POST   | `/objectives`                  | Verified: scoped targets, immutable started definitions, contribution history and explained risk |
| GET    | `/objectives/{objectiveId}`    | Verified: scoped targets, immutable started definitions, contribution history and explained risk |
| PATCH  | `/objectives/{objectiveId}`    | Verified: scoped targets, immutable started definitions, contribution history and explained risk |
| GET    | `/objectives/at-risk`          | Verified: scoped targets, immutable started definitions, contribution history and explained risk |

## Newly completed endpoint contracts

See [payloads and limits](API_COMPLETION_DETAILS.md) before integration. Denials intentionally block compound/aggregate operations when their scope cannot be proven safe. OIDC configuration is saved securely; SSO start/callback remain pending and `loginAvailable` is false.

| Method | Endpoint                                     | Supported behavior                                                                                                |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/me`                                        | Verified: HTTPS avatar metadata, profile fields, audit and conditional updates                                    |
| GET    | `/memberships/{membershipId}`                | Verified: identity, capacity, effective access and bounded dated roster history                                   |
| GET    | `/permissions`                               | Verified: 33 implemented-domain capabilities, including 28 configurable restrictions                              |
| PUT    | `/roles/{role}/permissions`                  | Verified: restriction-only replacement, mixed-role deny precedence and protected administrators                   |
| POST   | `/memberships/{membershipId}/scopes`         | Verified: five-scope grants and explicit denials; conservative aggregate/write blocking (see completion contract) |
| GET    | `/memberships/{membershipId}/access-history` | Verified: cursor history from database-protected immutable evidence with digest verification                      |
| GET    | `/organizations/{organizationId}`            | Verified: authorized metadata, scoped teams/work summary and consistent conditional updates                       |
| GET    | `/teams/{teamId}/capacity`                   | Verified: workload, paused/team-owned work, global member capacity and eligibility constraints                    |
| GET    | `/campaigns`                                 | Verified: scoped advanced filters, stable cursor sorting and legacy no-query compatibility                        |
| GET    | `/campaigns/{campaignId}`                    | Verified: campaign metadata and prospect-authorized operational summary                                           |
| GET    | `/notifications`                             | Verified: recipient-scoped severity/read-state filtering and cursor pagination                                    |
| GET    | `/settings/security`                         | Verified: enforced local policies and redacted OIDC configuration; SSO sign-in remains separate                   |
| PATCH  | `/settings/security`                         | Verified: conditional policy updates and encrypted OIDC configuration; no SSO activation                          |

## Maps and campaign lifecycle

See [query parameters, payloads, scope and lifecycle rules](MAPS_AND_CAMPAIGN_LIFECYCLE.md). Map totals use only authorized prospects. Archival preserves history and requires outstanding work to be resolved first.

| Method | Endpoint                         | Supported behavior                                                                                    |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/prospects/map`                 | Verified: prospect-authorized GeoJSON clustering, lifecycle summary and bounded viewport queries      |
| GET    | `/prospects/nearby`              | Verified: authorized geography-radius search, deduplication and stable distance/UUID pagination       |
| GET    | `/map/heatmap`                   | Verified: authorized canonical activity and current-conversion grid aggregates                        |
| GET    | `/map/coverage`                  | Verified: territory/prospect scope intersection, boundary-inclusive contact coverage and counts       |
| POST   | `/campaigns`                     | Verified: authorized draft creation, active organization validation, audit, idempotency and ETag      |
| DELETE | `/campaigns/{campaignId}`        | Verified: conditional audited archival with open-work and concurrent-write protection                 |
| POST   | `/campaigns/{campaignId}/status` | Verified: authorized lifecycle transitions, open-work blockers, audit, replay and conditional updates |

## APIs still left

The [remaining API checklist](REMAINING_APIS.md) lists every partial/pending method, path and required behavior. There are 0 partial and 189 pending-verification product contracts. Pending verification is not the same as nonexistent code: work queues, follow-ups, dashboards and other areas already have legacy implementations that need reconciliation against the canonical product contracts.

Next groups include search/data quality, saved views/messaging/files, reporting/compliance, integrations/webhooks and platform/subscription administration.

## Additional existing routes

[Controller route inventory](CONTROLLER_ROUTE_INVENTORY.json) contains the statically declared method/path/source for existing controllers, including legacy/support routes outside the verified checklist. Presence in that inventory proves a declaration, not registration, full contract compliance or production readiness. Use the verified tables and domain contracts as the frontend handoff boundary until additional routes are reviewed.
