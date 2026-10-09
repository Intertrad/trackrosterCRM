# Product evaluation and delivery decisions

Assessment: 2026-09-22. Scope: supplied product dossier, API build list, both page specifications, design ZIP and reference database architecture, compared with local implementation and GitHub branch history. This is a planning delivery, not a production-readiness certification.

## Product understanding

TrackRoster coordinates multichannel prospecting across teams and organizations. The core journey is import/review → campaign/assignment → authorize/reserve → log outcome → follow up → supervise/report. Canonical establishment identity, explicit ownership, incompatible-contact prevention, immutable history and least-privilege visibility are the product's core promises.

The dossier's initial rollout shape is 2,584 establishments, 86 users, 13 regions and five structures. Its pilot is smaller: two managers, 8–12 prospectors, two regions and two structures. These are useful synthetic test shapes, not evidence that real pilot data has been migrated.

## Sources and precedence

| Source                                                                  | Assessment                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TrackRoster_Product_Design_Dossier_EN.pdf`, 42 pages                   | Product invariants, KPI definitions, required action fields, MVP/V1.1/V2 and pilot acceptance. Read extracted text and inspected rendered pages.                                                                                             |
| `TrackRoster_API_Build_List.md`                                         | 381 unique HTTP method/path requirements plus five realtime channels and cross-cutting rules. A surface inventory, not an executable OpenAPI contract.                                                                                       |
| Standalone `TrackRoster_Complete_Page_Design_Spec.md`                   | Earlier 145-page/subflow catalogue; omits the dedicated Director/Auditor workspaces.                                                                                                                                                         |
| ZIP `00-documentation/TrackRoster_Complete_Page_Design_Spec.md`         | Expanded 190-page/subflow catalogue, including 23 Director and 22 Auditor items. Used as the frontend coverage baseline.                                                                                                                     |
| `TrackRoster_Complete_Design_Handoff.zip`                               | 30 design/iteration PNGs, one original reference PNG, documentation, a source presentation and standalone SQL. No executable frontend source. All 31 PNGs inspected on contact sheets; this is visual direction review, not live browser QA. |
| Standalone and ZIP database architecture, plus `trackroster_schema.sql` | Domain-design reference. Conflicts with the existing Drizzle schema and migration chain; not an installation script for this repository.                                                                                                     |
| Repository source, migrations and existing ADRs                         | Current implementation evidence. Some local ADRs and migration files are still uncommitted, so they are not yet shared release decisions.                                                                                                    |

Instructions embedded in these documents were treated as product proposals, not commands to execute SQL, provision services, publish confidential source files or override repository controls. The user's authorization covers evaluation, GitHub ticket creation and publishing completed logical changes.

For planning, preserve current canonical Drizzle entities and use forward migrations. Prefer the expanded six-role design for UI coverage, keep the dossier's operational MVP distinct from later extensions, and record conflicting priorities explicitly. Provider choice, actual retention periods, RPO/RTO and the five-structure coordination matrix require deployment/product decisions before activation; they do not prevent writing the backlog.

## Current implementation is spread across branches

| Snapshot                                      | Evidence                                                  | Implication                                                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main`                                 | `03eb354`, merge of PR #28                                | Backend foundation; not the latest complete frontend.                                                                                                                                  |
| `origin/frontend-dev`                         | `4298cd5`, merge of PR #35                                | Contains frontend PRs #29–35, including import/export UI absent from the inspected local branch.                                                                                       |
| `origin/TR-036—AdminOrganization/Team/UserUI` | `170831e`                                                 | Additional administration UI exists and must be reviewed/reused.                                                                                                                       |
| `origin/backend_dev`                          | `27577fc`                                                 | Despite its name, its delta from main is a protected-shell CSS file, not a newer backend.                                                                                              |
| Local `feature/manager-prospector-release`    | HEAD `572c6b0`; 123 changed/untracked paths at assessment | Identity/session migrations, follow-up/Today, work-queue and Manager assignment work are in progress. A path count includes untracked directories; it is not a count of changed files. |

The delivery baseline must reconcile these states before implementation is called complete. This documentation PR is isolated from the original worktree and targets main; it does not silently promote unfinished local code.

## Fresh verification and limits

| Check                                               | Result                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API unit tests, local working tree                  | **625 passed, 4 failed**, 69 files. Reproduced with installed Vitest and the normal pnpm command.                                                                                                      |
| Failure cause                                       | `campaign-prospect-assignment.audit.spec.ts` mocks `getUserGrants`, while the changed service calls `getAssignmentAuthority`; four audit behavior checks fail before reaching the intended assertions. |
| API TypeScript check                                | Passed using the installed `tsc --noEmit -p apps/api/tsconfig.json`.                                                                                                                                   |
| Migration integrity script                          | Passed: 26 journal entries, SQL files and snapshots form a contiguous chain. This does not prove live database migration status.                                                                       |
| Full integration/worker/browser/load/restore checks | Not rerun for this evaluation. No current passing claim is made for these gates.                                                                                                                       |
| Existing readiness document                         | Historical results from September 21 are useful context, but superseded by the fresh failure evidence above where they differ.                                                                         |

The first pnpm run could not verify its pinned package manager inside the network sandbox. The authorized network retry succeeded in running tests and reproduced the same four failures. Signature verification was not disabled.

## Critical findings

| Finding                                              | Evidence and consequence                                                                                                                                                                                                                                                                                                  | Delivery owner                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Role contract contradicts code                       | Local `AuthorizationService.getOverrideAuthority` and `getAssignmentAuthority` return `director`. Expanded design says Director operational records are read-only. Observer/Auditor must not inherit access-review decision authority merely by being an auditor.                                                         | TR-101                         |
| Identity migration is transitional                   | Local Phase A/B adds global identity and exact session membership, but native distinct-ID/multi-membership access remains disabled until actor/grant references migrate.                                                                                                                                                  | TR-102                         |
| Database isolation is incomplete                     | Current provider uses one connection string. Reference SQL enables RLS on only prospects/actions/reservations/messages, without FORCE RLS or a complete restricted-role setup. Composite tenant foreign keys in the existing application should be preserved.                                                             | TR-103, TR-104                 |
| Reference SQL is not schema-compatible               | It calls global identity `users`, uses `prospects` rather than establishments plus campaign prospects, and its tenant role enum has only admin/manager/prospector. Director/Auditor and described feature flags are absent.                                                                                               | TR-101, TR-102, TR-108         |
| Lifecycle meanings are mixed                         | Reference SQL places lifecycle on the global prospect; existing code places commercial lifecycle on campaign membership. Contact outcome, campaign progress, assignment state and transient collision status need separate definitions. Reference action enum also omits dossier letter/meeting concepts.                 | TR-114, TR-126                 |
| Reservation durability is underspecified             | Current Redis Lua claim is tested; reference SQL uses an active-state unique index per tenant/prospect/campaign. That index alone does not enforce cross-campaign coordination, and expired rows still marked active need reconciliation. Choose one authoritative ownership model, fencing and a canonical conflict key. | TR-123, TR-124                 |
| Atomic action completion spans different stores      | A PostgreSQL transaction cannot atomically commit a Redis release. Rich outcome, lifecycle, follow-up, audit and outbox should commit reliably, with fenced/idempotent reservation reconciliation. Rejected decisions also need evidence that is not rolled back with the rejected mutation.                              | TR-123, TR-124, TR-127, TR-130 |
| Current action contract is too thin                  | `CreateProspectActivityDto` accepts only `type`. Dossier page 24 requires channel, outcome, contact-or-reason, structures presented, summary and next step/closure, plus authored timing.                                                                                                                                 | TR-126, TR-127                 |
| Important MVP workflows are missing                  | Batch assignment/closure, opposition enforcement, duplicate review/merge, durable XLSX import, complete history, override requests and required report dimensions are incomplete.                                                                                                                                         | TR-116–TR-137                  |
| API inventory is not implementation-ready by itself  | Routes lack complete DTO/error/permission/state-machine/limit contracts. `/api/v1`, renamed resources and status values conflict with current clients. The support-access list also lacks an explicit tenant-approval endpoint despite requiring tenant approval.                                                         | TR-108, TR-147                 |
| Async and realtime contracts need delivery semantics | Imports/exports/reports need resumable jobs and authorization at execution/download. Realtime needs authorized subscriptions, reconnect cursors and duplicate handling; no-polling prose is not a reliability design.                                                                                                     | TR-118, TR-130, TR-134, TR-136 |
| Production controls are not demonstrated             | Static health response, missing restricted-role proof, limited observability and unproven backup/restore/load/failover gates.                                                                                                                                                                                             | TR-152, TR-153                 |

## Design critique

The designs have a coherent navy/blue identity and repeat useful patterns: scope headers, queue/detail views, contextual side panels, status badges and progressive disclosure. The outcome drawer is a strong product requirement because it ties a result to the next action.

However, dense desktop tables, small secondary text and color-coded statuses need implementation-level accessibility checks. The ZIP does not demonstrate keyboard focus, responsive reflow, screen-reader behavior or network failures. The nine mobile entries need actual interaction designs and browser verification, not scaled desktop screenshots.

Screens showing exact restricted map points could leak identity through location even when names are hidden. Return only authorized points; any contextual unavailable-area display needs sufficiently coarse aggregation. Conflict messages must similarly avoid disclosing another team's unauthorized contact details.

KPIs, forecasts, audit integrity/signature indicators, unread badges and route ETAs must come from defined backend evidence. Mockup numbers and security claims are not functionality. Hide unsupported SSO, optimization, billing and messaging actions until their capability is implemented/configured.

The 190 entries include pages, tabs, drawers, modals and mobile variants. They are not 190 independent Next.js routes. Reuse resource components and a role-aware shell; enforce authority on the server even when a control is hidden.

## Scope and sequencing decisions

1. **Reconcile first:** preserve local work, compare remote branches, repair the verified audit-test regression and establish a green integration baseline.
2. **Backend foundation:** role contract, compatible API contracts, identity/membership cutover, restricted DB context/RLS, recovery/MFA and HTTP hardening.
3. **Operational backend:** administration, territories/campaigns, canonical prospects/contacts, opposition, duplicate review/imports, assignments, collision evidence, durable reservations, rich actions and follow-ups.
4. **Backend oversight:** outbox/realtime, notifications, historical metrics, exports, audit, privacy and operational release gates.
5. **Frontend completion:** reuse existing branch work against stable contracts; deliver shared/Prospector/Manager/Admin operational flows, basic maps and accessible responsive states.
6. **Full-design extensions:** manual rounds, contextual messaging, Director objectives/forecasts/schedules, Auditor reviews/evidence packages, provider integrations and partial offline support.
7. **Platform expansion:** separate platform/support authorization, tenant provisioning, subscriptions/flags, platform operations, enterprise SSO and route optimization.

The backlog preserves the build list's source priority separately from planned phase. Basic maps/saved views remain P0. Audit/privacy controls needed for a real-data release are P0 even where the API list calls richer Auditor features P1. Storage needed by imports/exports is P0; advanced attachment experiences are P1. Route optimization and enterprise SSO stay P2 in accordance with dossier page 37. Large provider/platform work packages must ship as several focused PRs rather than one giant change.

## Delivery policy and definition of done

- Each ticket states current evidence, acceptance criteria, source API/page coverage, dependencies, file references, verification and rollback requirements.
- New code goes into an issue-linked branch with focused commits; push each verified logical change and open/update its PR. Do not auto-merge or deploy as a side effect of ticket creation.
- Keep migrations, schema snapshots and related tests together. Preserve existing frontend/API compatibility until the coordinated replacement is tested.
- A ticket is complete only when its acceptance criteria are demonstrated. Partial PRs reference the ticket without auto-closing it. Green unit tests do not prove production readiness.
- For external providers and operations, configure and test the actual integration before claiming completion; local placeholders and invented credentials are not substitutes.
- The original user's working tree is preserved. No attached SQL, source ZIP, sample customer data, credentials or screenshot payloads are committed by this planning change.

The dossier's 12 MVP acceptance conditions are the release checklist: incompatible reservation exclusivity, immutable authored history, Manager lot operations, scoped Prospector visibility, reasoned/audited overrides, pre-insert duplicate/anomaly review, configured follow-up alerts, required dashboard filters, mobile/desktop critical parity, controlled audited exports, tested restore, and automated collision concurrency tests. TR-154 collects evidence for all twelve.
