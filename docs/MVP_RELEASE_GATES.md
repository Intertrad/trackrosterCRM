# TrackRoster MVP release gates

**Prepared:** 2 October 2026
**Scope:** notification MVP implementation and release evidence. Deployment remains out of scope.

## Authority

These gates are derived from the complete working v1.0 Product Design Dossier, especially the indispensable roadmap on p. 37 and the **Definition of Done du MVP** on p. 41. The approved English source supplied for this phase is `/Users/zainsubhani/Downloads/files/TrackRoster_Product_Design_Dossier_EN.pdf`. The prior proposed baseline is superseded.

`PASS` below means the latest remediation report has evidence. `OPEN` means the requirement or its release evidence is still missing. `EXTERNAL` means an owner/provider/decision outside code must be supplied before the gate can be closed.

## Gate table

| Gate                                       | MVP acceptance rule                                                                                                                                                | Current state                                                                                                                                  | Severity               | Evidence needed to close                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 Source and visual acceptance          | Approved dossier path/source is identified and the MVP screens are accepted against it.                                                                            | PASS source supplied / visual sign-off open                                                                                                    | MVP release blocker    | Retain product-owner visual acceptance against the supplied dossier.                                                                  |
| G-02 Accounts, roles and tenant scope      | Six role families authenticate; each can access only its authorized tenant/org/team/campaign/territory data.                                                       | PASS for beta acceptance — six-role API/browser, responsive, second-tenant and worker evidence green; deployment enforcement rehearsal remains | MVP release blocker    | Repeat the matrix during the final deployment rehearsal with `TENANT_RLS_MODE=enforce`; retain the beta evidence below.               |
| G-03 Import quality                        | Excel/CSV preview flags duplicates/anomalies before final insert and preserves tenant-safe identity.                                                               | OPEN                                                                                                                                           | MVP release blocker    | Complete dossier dedupe-key coverage, malformed/recovery tests and admin walkthrough.                                                 |
| G-04 Prospects, lifecycle and assignments  | Prospects/sites/contacts, campaigns, ownership and manager batch assign/reassign/close work without export.                                                        | OPEN                                                                                                                                           | MVP release blocker    | Authenticated manager/prospector walkthrough and assignment audit evidence.                                                           |
| G-05 Immutable action history              | Every action has author/timestamp/context and corrections append history.                                                                                          | PASS with evidence gap                                                                                                                         | MVP non-blocking issue | Runtime-role privilege test and authenticated action-recording walkthrough.                                                           |
| G-06 Anti-collision and reservation safety | Incompatible concurrent reservations cannot both succeed; cooldown, override reason and expiry are enforced.                                                       | PASS automated / durable-intent, restricted-runtime and TR-917 authenticated browser evidence                                                  | MVP release blocker    | Retain TR-916 API/sweep evidence and TR-917 manager approval plus blocked-reservation trace.                                          |
| G-07 Follow-ups and notifications          | Follow-ups create tasks/alerts; p. 28 recipient, priority, in-app/email/push and digest rules are enforced.                                                        | PASS automated / six-role beta API+browser evidence / email outbox verified                                                                    | MVP release blocker    | Retain the attached beta evidence and provider certification. Push remains unverified until a Push-channel subscription is available. |
| G-08 Manager dashboard dimensions          | Dashboard filters by company, team, period, campaign and territory with authorized manager/director scope.                                                         | OPEN                                                                                                                                           | MVP release blocker    | Territory dimension scope tests and authenticated browser evidence.                                                                   |
| G-09 Audit and exports                     | Overrides require reason/audit; exports are role-controlled, scope-limited and logged; real artifacts can be downloaded.                                           | OPEN                                                                                                                                           | MVP release blocker    | Artifact generation/download/expiry/large-file evidence and audit privilege test.                                                     |
| G-10 Responsive operation                  | Critical functions work on mobile and desktop without loss.                                                                                                        | PASS for beta acceptance — all six roles at 390/768/1440 with no horizontal overflow                                                           | MVP release blocker    | Retain the responsive matrix below; rerun only if critical flows change.                                                              |
| G-11 Backup and restore                    | Backup and restoration are tested before the national pilot, including roles/grants, migrations and tenant isolation.                                              | OPEN                                                                                                                                           | MVP release blocker    | Full second-database restore rehearsal, RPO/RTO/retention record and post-restore RLS test.                                           |
| G-12 Critical API/event idempotency        | Auth/import/assignment/reservation/action/dashboard/override endpoints and internal critical events are retry-safe.                                                | PASS for tested paths / coverage ledger open                                                                                                   | MVP non-blocking issue | Add generated contract diff and per-page API coverage to CI; keep existing green suites.                                              |
| G-13 Pilot acceptance                      | Pilot uses the dossier’s success criteria: ≥80% actions recorded, 0 unauthorized collisions, ≥90% essential fields, ≥95% follow-ups on time, dashboard used daily. | OPEN                                                                                                                                           | MVP release blocker    | Run the pilot or an equivalent acceptance rehearsal and retain the measurements.                                                      |
| G-14 Operational observability             | Logs/metrics/traces, queue/provider alerts and incident runbook are ready for production operation.                                                                | OPEN                                                                                                                                           | MVP non-blocking issue | Implement or explicitly risk-accept before production traffic; it is not a p. 37 MVP feature.                                         |

## Corrected MVP blocker list

1. **Product source and visual acceptance:** source is supplied; product-owner visual sign-off remains open.
2. **Six-role authenticated ACL and responsive evidence:** **closed for beta acceptance**. Repeat during the final deployment rehearsal if runtime configuration changes.
3. **Import quality:** complete the dossier duplicate/anomaly checks before final insert.
4. **Notification capability:** the six MVP event producers, recipient resolution, durable outbox, digest path and critical collision inbox path are verified by automated suites and the six-role beta matrix. Push delivery remains unverified because the supplied test subscription is Email-channel.
5. **Dashboard authorization/dimensions:** close territory and manager/director filter evidence.
6. **Export acceptance:** produce and verify role-controlled, logged artifacts and downloads.
7. **Full backup/restore:** restore into a second database and verify grants, migrations, RLS and recovery objectives.
8. **Anti-collision/reservation safety:** closed for beta acceptance by TR-916 durable-intent evidence and TR-917 authenticated manager/prospector browser evidence. Production still requires the final deployment-environment rehearsal.
9. **Pilot Definition of Done:** demonstrate the dossier’s five pilot success measures.

## MVP non-blocking issues

- Runtime-role audit-row immutability evidence.
- Generated API contract diff and per-page live-data coverage ledger.
- Broad scale/load testing for dashboards, search, messaging, notifications and exports, unless the release owner raises a capacity target.
- Centralized logs/metrics/traces and incident/runbook completion, which should precede real production traffic but are not a dossier MVP feature gate.
- Object-storage provider failure tests when core MVP backup/export operation has an approved secure equivalent; attachment storage itself is V1.1.

## Deferred roadmap work

### V1.1

- Advanced mapping and external map-provider features.
- Capacity-based assignment.
- Google/Outlook calendar integration.
- Email/letter authoring templates (transactional notification delivery remains MVP).
- Attachments and voice notes, including R2/MinIO signed-link/large-file/expiry tests.
- Scheduled reports.
- External API and webhooks.
- Partial offline PWA synchronization.

### V2

- Integrated telephony.
- Route optimization.
- AI summaries/coaching.
- Data enrichment.
- Subscription billing.
- White label.
- Enterprise SSO.
- Integration marketplace.

## External inputs required from the product/operations owner

1. Approve the MVP screens against the supplied dossier at `/Users/zainsubhani/Downloads/files/TrackRoster_Product_Design_Dossier_EN.pdf` (or copy that approved source into `docs/product/` for repository traceability).
2. Confirm the MVP pilot scope, participating managers, two pilot regions and 8–12 prospectors.
3. Validate the five-structure coordination matrix, required statuses/fields and reservation/cooldown durations (p. 42).
4. Supply/verify tenant-safe staging configuration for transactional email and push delivery, with controlled destinations and rotation ownership. Brevo is configured and has a successful controlled send; OneSignal app ID/key validation passes, but a Push-channel test subscription is still needed for delivery certification.
5. Approve the backup RPO/RTO, retention period and a scratch restore database.
6. Approve the browser/ACL/responsive test accounts for all six role families.
7. Set the broad-load profile or explicitly accept that it is a non-blocking risk for MVP.

## Notification implementation evidence (TR-907)

The six-event matrix and durable channel implementation are recorded in [`notifications/MVP_NOTIFICATION_MATRIX.md`](./notifications/MVP_NOTIFICATION_MATRIX.md). Focused API and worker tests are green for the event service, follow-up/reservation processors, and delivery processor. Email certification passes at the provider and application-worker levels through Brevo. The OneSignal app-scoped credential check returned HTTP 200, but the supplied OneSignal test subscription is Email type, so Push delivery remains unverified; no push request was sent.

### TR-909 evidence update — 2 October 2026

The controlled beta seed now includes the remaining role fixtures: `director@beta.trackroster.test`, `observer@beta.trackroster.test` (the canonical persisted role for the auditor/read-only persona), and `super-admin@beta.trackroster.test` with an identity-level `super_admin` platform grant plus a tenant membership needed for login. The seed is idempotent and keeps the shared beta password synchronized without logging it.

Authenticated API checks passed for all seven beta accounts: login returned HTTP 200, `GET /api/v1/notifications?limit=1` returned HTTP 200, and `GET /api/v1/auth/me/access-grants` returned the expected role context; the super-admin context reported `platformAdmin: true`. Authenticated browser checks passed for manager, prospector, client-admin, director, observer/auditor and super-admin at `/notifications`; each rendered the Notifications heading, Inbox, priority rules and delivery-preferences content. The observer browser shell rendered the read-only workspace navigation.

The remaining recipient checks were exercised in the beta tenant with disposable event keys. The authenticated API returned exactly one matching recipient row for each of manager, prospector and client-admin, and the email outbox contained one queued email delivery per matching recipient. A manager inbox check showed the daily digest event; a prospector inbox check showed the critical collision event. Existing email provider and worker certification covers the provider result, while the in-app row remains authoritative if delivery fails. The previously green tenant-RLS integration evidence covers cross-tenant read/write denial; the current shell rerun could not reach the disposable runtime ports because of local network sandbox restrictions.

This closes TR-909. Push delivery is intentionally not claimed because the supplied OneSignal subscription is Email-channel, not Push-channel.

## TR-910 evidence update — 2 October 2026

TR-910 is closed for beta acceptance. The authenticated browser matrix passed for
manager, director, prospector, observer/auditor, client administrator and super
administrator at widths 390, 768 and 1440. Every run reached the expected role home,
had no horizontal overflow (`bodyScrollWidth === viewport width`), and exercised a
forbidden pasted URL. Manager, director, prospector and observer redirected to their
role home; administrator-scoped routes remained allowed for client and super admins.

The tenant boundary fixture `TR-910 Tenant B Fixture` was invisible to tenant A:
tenant-A `GET /establishments/:id` and `PATCH /establishments/:id` both returned 404.
The territory dimension fixture `TR910-OFTI` was visible only through the seeded
authorized role scopes. Targeted restricted-runtime checks passed **3 API files / 18
tests** and **1 worker file / 4 tests**, including tenant-RLS, background sweep,
assignment lifecycle and reservation expiry paths. The frontend navigation suite
passes **34/34**, with ESLint, web typecheck and the webpack production build green.

These results close the beta acceptance criteria for G-02 and G-10. They do not claim
the production deployment rehearsal; `TENANT_RLS_MODE=enforce` must still be validated
in the release environment.

## Exact next remediation ticket

### TR-916 — Verify reservation durable intent and background reconciliation

**Why this is next:** TR-910 is closed for beta acceptance. The next correctness item is
proving that reservation intent survives retries, worker restart and lease expiry before
the final deployment rehearsal.

**Acceptance result (2 October 2026):**

The durable intent boundary is implemented in migration `0086_reservation_intent` and
`ReservationLedgerService.prepare()` now commits the intent independently before the
Redis lease call. Confirmation and close operations reuse the request transaction when
one is active, avoiding the campaign guard lock cycle; post-commit pending persistence
uses the independent boundary. Reconciliation discovers intent IDs through a
`SECURITY DEFINER` function, rechecks both Redis lease keys, materializes one durable
record and emits one terminal/active event. The new table is tenant-scoped with RLS,
forced RLS and restricted runtime grants.

Evidence retained:

- `reservation-lifecycle.integration.spec.ts`: **19/19** tests, including intent
  persistence after confirmation failure, retry/idempotency, cooldown and expiry,
  tenant-scoped API reads, immutable evidence and two reconciliation passes with one
  record plus one `live_state_observed` event.
- `background-sweep-discovery.integration.spec.ts`: **3/3** tests, including context-free
  RLS denial for intents, cross-tenant discovery and privileged-function grants.
- API unit tests: **44/44** reservation-service tests.
- Manager overview browser-facing unit test: **9/9**; pending override requests now
  request the server-supported `limit=100` instead of `1000` (HTTP 400).

The web production build was attempted with a 180-second bound but did not complete in
the local environment, so production deployment remains **NO-GO**.

**Next-phase acceptance criteria:**

1. Prove reservation intent is durable before the Redis lease is acquired and remains
   correct across API retries.
2. Restart the worker with pending intent and verify reconciliation completes exactly
   once, without duplicate claim or release.
3. Verify tenant scope, idempotency keys, cooldown/expiry behavior and immutable audit
   records for success, conflict and retry paths.
4. Update G-06 and the root remediation report with the retained API/worker evidence.

Do not implement attachments, SSO, external webhooks, advanced mapping or another V1.1/V2 capability as part of this ticket.

### TR-917 — Manager approval and blocked-reservation browser acceptance

**Acceptance result (2 October 2026):** TR-917 is complete for beta acceptance. The
browser path was exercised with authenticated beta manager and prospector sessions
against the real web proxy and API; no UI-only mock was used.

**API evidence retained:**

- A fresh holder reservation returned **201 Created** and durable reservation data.
- The competing prospector collision check returned **200 OK** with
  `decision=block`, `reasonCode=ACTIVE_RESERVATION`, `overrideable=false`, and a
  collision ID. This is the non-overrideable blocked-reservation path.
- The manager approval path returned **200 OK** after an `If-Match` decision and
  idempotency key. The approved response included the manager decider, override ID,
  and approved status.
- The supported manager list query `GET /override-requests?status=pending&limit=50`
  returned **200 OK**. A stale consumer using `limit=1000` still receives **400**
  because the API contract caps `limit` at 100; the current web manager overview and
  approvals page use supported limits (100 and 50 respectively).

**Authenticated browser evidence retained:**

- Manager `/manager/approvals` rendered the pending request, opened its detail page,
  displayed the policy evaluation and required decision reason, and submitted
  **Approve override**. The resulting page showed `approved`, the success audit-log
  alert, the manager decider, and the recorded reason.
- Prospector `/work-queue/:campaignId/:prospectId` rendered **Contact blocked** for
  the active reservation held by another team member, displayed the lease expiry,
  disabled **Log action**, and offered **Ask a manager to authorise this contact**.
  The page also showed no local reservation, proving the conflicting lease was not
  incorrectly presented as owned by the current user.
- Browser network evidence recorded authenticated 200 responses for the work-queue
  detail, collision decision, reservation lookup, follow-ups and contact data; the
  manager approval mutation recorded **200 OK**.

**Code correctness fix included:** confirmation now uses an independent tenant-scoped
transaction after Redis acquisition, immutable reservation-intent reads no longer use
`FOR UPDATE` under the restricted runtime role, and the runtime bootstrap grants later
migrations the required table/sequence privileges while preserving append-only audit
and collision evidence.

**Remaining release caveat:** beta acceptance is green, but production remains
**NO-GO** until the deployment-environment `TENANT_RLS_MODE=enforce` rehearsal and the
other open MVP gates (visual sign-off, import quality, dashboard dimensions, export
artifacts, full restore, and pilot evidence) are closed. A focused shared-beta
integration rerun still timed out in two long lifecycle cases; the previously retained
disposable suite evidence remains the authoritative green run and must be repeated in
an isolated environment before release.
