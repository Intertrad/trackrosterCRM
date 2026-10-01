# TrackRoster MVP release gates

**Prepared:** 1 October 2026  
**Scope:** notification MVP implementation and release evidence. Deployment remains out of scope.

## Authority

These gates are derived from the complete working v1.0 Product Design Dossier, especially the indispensable roadmap on p. 37 and the **Definition of Done du MVP** on p. 41. The approved English source supplied for this phase is `/Users/zainsubhani/Downloads/files/TrackRoster_Product_Design_Dossier_EN.pdf`. The prior proposed baseline is superseded.

`PASS` below means the latest remediation report has evidence. `OPEN` means the requirement or its release evidence is still missing. `EXTERNAL` means an owner/provider/decision outside code must be supplied before the gate can be closed.

## Gate table

| Gate                                       | MVP acceptance rule                                                                                                                                                | Current state                                                         | Severity               | Evidence needed to close                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 Source and visual acceptance          | Approved dossier path/source is identified and the MVP screens are accepted against it.                                                                            | PASS source supplied / visual sign-off open                           | MVP release blocker    | Retain product-owner visual acceptance against the supplied dossier.                                                                                                                           |
| G-02 Accounts, roles and tenant scope      | Six role families authenticate; each can access only its authorized tenant/org/team/campaign/territory data.                                                       | OPEN                                                                  | MVP release blocker    | Authenticated browser/ACL matrix plus worker-path evidence; then certify `TENANT_RLS_MODE=enforce`.                                                                                            |
| G-03 Import quality                        | Excel/CSV preview flags duplicates/anomalies before final insert and preserves tenant-safe identity.                                                               | OPEN                                                                  | MVP release blocker    | Complete dossier dedupe-key coverage, malformed/recovery tests and admin walkthrough.                                                                                                          |
| G-04 Prospects, lifecycle and assignments  | Prospects/sites/contacts, campaigns, ownership and manager batch assign/reassign/close work without export.                                                        | OPEN                                                                  | MVP release blocker    | Authenticated manager/prospector walkthrough and assignment audit evidence.                                                                                                                    |
| G-05 Immutable action history              | Every action has author/timestamp/context and corrections append history.                                                                                          | PASS with evidence gap                                                | MVP non-blocking issue | Runtime-role privilege test and authenticated action-recording walkthrough.                                                                                                                    |
| G-06 Anti-collision and reservation safety | Incompatible concurrent reservations cannot both succeed; cooldown, override reason and expiry are enforced.                                                       | PASS automated / E2E open                                             | MVP release blocker    | Retain API/worker concurrency results and add blocked/approval UX evidence.                                                                                                                    |
| G-07 Follow-ups and notifications          | Follow-ups create tasks/alerts; p. 28 recipient, priority, in-app/email/push and digest rules are enforced.                                                        | PARTIAL implementation / Brevo certified; push and role evidence open | MVP release blocker    | Resolve the OneSignal credential/app-ID blocker, run push success/retry/final-failure checks, retain authenticated six-role delivery evidence, and demonstrate the live in-app collision path. |
| G-08 Manager dashboard dimensions          | Dashboard filters by company, team, period, campaign and territory with authorized manager/director scope.                                                         | OPEN                                                                  | MVP release blocker    | Territory dimension scope tests and authenticated browser evidence.                                                                                                                            |
| G-09 Audit and exports                     | Overrides require reason/audit; exports are role-controlled, scope-limited and logged; real artifacts can be downloaded.                                           | OPEN                                                                  | MVP release blocker    | Artifact generation/download/expiry/large-file evidence and audit privilege test.                                                                                                              |
| G-10 Responsive operation                  | Critical functions work on mobile and desktop without loss.                                                                                                        | OPEN                                                                  | MVP release blocker    | Authenticated responsive runs for all six roles.                                                                                                                                               |
| G-11 Backup and restore                    | Backup and restoration are tested before the national pilot, including roles/grants, migrations and tenant isolation.                                              | OPEN                                                                  | MVP release blocker    | Full second-database restore rehearsal, RPO/RTO/retention record and post-restore RLS test.                                                                                                    |
| G-12 Critical API/event idempotency        | Auth/import/assignment/reservation/action/dashboard/override endpoints and internal critical events are retry-safe.                                                | PASS for tested paths / coverage ledger open                          | MVP non-blocking issue | Add generated contract diff and per-page API coverage to CI; keep existing green suites.                                                                                                       |
| G-13 Pilot acceptance                      | Pilot uses the dossier’s success criteria: ≥80% actions recorded, 0 unauthorized collisions, ≥90% essential fields, ≥95% follow-ups on time, dashboard used daily. | OPEN                                                                  | MVP release blocker    | Run the pilot or an equivalent acceptance rehearsal and retain the measurements.                                                                                                               |
| G-14 Operational observability             | Logs/metrics/traces, queue/provider alerts and incident runbook are ready for production operation.                                                                | OPEN                                                                  | MVP non-blocking issue | Implement or explicitly risk-accept before production traffic; it is not a p. 37 MVP feature.                                                                                                  |

## Corrected MVP blocker list

1. **Product source and visual acceptance:** source is supplied; product-owner visual sign-off remains open.
2. **Six-role authenticated ACL and responsive evidence:** manager, director, prospector, observer/auditor, client administrator and super administrator need allowed/denied browser proof.
3. **Import quality:** complete the dossier duplicate/anomaly checks before final insert.
4. **Notification capability:** the six MVP event producers and durable outbox are implemented; Brevo has passed account and controlled-send checks, while OneSignal certification and authenticated role evidence remain open.
5. **Dashboard authorization/dimensions:** close territory and manager/director filter evidence.
6. **Export acceptance:** produce and verify role-controlled, logged artifacts and downloads.
7. **Full backup/restore:** restore into a second database and verify grants, migrations, RLS and recovery objectives.
8. **Anti-collision/reservation UI evidence:** automated concurrency is green, but the user-visible blocked/override path still needs authenticated proof.
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
4. Supply/verify tenant-safe staging configuration for transactional email and push delivery, with controlled destinations and rotation ownership. Brevo is configured and has a successful controlled send; OneSignal still needs a valid REST key, app ID, and test subscription.
5. Approve the backup RPO/RTO, retention period and a scratch restore database.
6. Approve the browser/ACL/responsive test accounts for all six role families.
7. Set the broad-load profile or explicitly accept that it is a non-blocking risk for MVP.

## Notification implementation evidence (TR-907)

The six-event matrix and durable channel implementation are recorded in [`notifications/MVP_NOTIFICATION_MATRIX.md`](./notifications/MVP_NOTIFICATION_MATRIX.md). Focused API and worker tests are green for the event service, follow-up/reservation processors, and delivery processor. Provider certification is partial: Brevo account authentication and a controlled staging send passed. OneSignal remains blocked by HTTP 401 and missing app ID/subscription evidence; no push request was sent.

## Exact next remediation ticket

### TR-908 — Certify MVP notification providers and authenticated six-role delivery

**Why this is next:** the dossier places follow-ups and notifications in MVP (p. 37), specifies the six event recipients/channels/priorities on p. 28, and requires task/alert behavior in Definition of Done gate 07 (p. 41). The implementation and daily digest scheduler are now present, but provider certification, live in-app collision evidence and authenticated role evidence remain open.

**Next-phase acceptance criteria:**

1. Correct the OneSignal REST key and supply its app ID plus a controlled test subscription for staging.
2. Run provider success, bounded retry, invalid-device and final-failure tests for both channels.
3. Run authenticated manager, prospector and administrator recipient/tenant-isolation browser evidence, plus the critical-alert preference check.
4. Keep the in-app notification record authoritative when a provider is unavailable and attach the result to G-07.
5. Exercise the daily digest scheduler and retain evidence that collision alerts reach the in-app surface through the supported live-refresh path.

Do not implement attachments, SSO, external webhooks, advanced mapping or another V1.1/V2 capability as part of this ticket.
