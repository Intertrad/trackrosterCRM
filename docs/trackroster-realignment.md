# TrackRoster — Repository Realignment Audit

Audit of the existing repository against management's corrected requirement and the
`TrackRoster_Presentation_Equipe` mockup. No application code has been changed for this
realignment yet; this document is the basis for deciding what to change.

- **Date:** 2026-09-28
- **Baseline:** branch `codex/backend-completion`, commit `dbd4e51`, working tree clean
  except one pre-existing uncommitted lint change that is not ours.
- **Sources, in the priority the brief sets:** management's corrected requirement, then
  the mockup, then the existing architecture, then historical decisions.
- **Related:** [Backend hardening record](backend/BACKEND_HARDENING.md) ·
  [Remaining work backlog](TRACKROSTER_REMAINING_WORK.md)

---

## 1. Executive summary

**The gap is much narrower than the phrase "petit loupé de compréhension" suggests, and it
is concentrated in the frontend and in two missing backend capabilities — not in the
architecture.**

The workflow management describes — one shared prospect base, several entities, dispatch
of prospecting points, prevention of two teams working the same prospect, a prospector's
day, recorded outcomes, follow-ups, manager visibility — is largely present in the
backend already, and the parts that are present are tested. Specifically:

- Several business entities under one group already exist (`organizations` under a
  tenant), and teams belong to an entity.
- **Anti-collision is already cross-entity.** `reservation-coordination-scope.service.ts`
  computes a set of blocking organizations, and the claim is atomic (Redis Lua over
  multiple keys, with a PostgreSQL record). This is the single hardest thing management
  asked for and it is the thing that already works.
- "Ma journée" has a complete backend module (`prospector-today`), with tests.
- Activities, outcomes, follow-ups, contacts, consent/opposition, campaigns, imports,
  audit and exports all exist as real modules with database tables behind them.

**What genuinely does not exist:**

1. **Scripts and e-mail templates — nothing at all.** No module, no table, no code.
   Management named this explicitly ("intégrer à l'intérieur un script, des emails
   types"). This is a true BUILD.
2. **The prospecting "session"** the mockup is built around — choose campaign + mode +
   available time, and the system allocates points and computes the objective. There is
   an `objectives` module but no session, and no time-budget arithmetic.
3. **The prospect data itself.** The 14,000 prospects were referenced but not provided
   with this brief; only the HTML mockup arrived. Nothing can be demonstrated on real
   data until that file exists.
4. **The manager dispatch screen** and the admin console screens the mockup shows.
5. **A category/"section" taxonomy** (Prospection, Justice et enquêtes, Santé, Asile et
   social, Douanes et ONAF, CRA, Prescripteurs). `establishments` has no category column;
   `tags` / `prospect_tags` exist and may serve.

**One significant business rule is genuinely undecided and must not be invented** — see
§23. Management's text says points are dispatched _by the admin_; the mockup has the
_prospector_ starting a session and the system allocating. These are different products.

**On the deadline.** A beta "for Tuesday" — tomorrow — is not achievable for the
end-to-end flow in §36 of the brief. What is achievable in a day or two is narrower and
is proposed in §26. Saying so now is more useful than discovering it on Tuesday.

---

## 2. Repository architecture

```text
apps/api        NestJS backend — 61 feature modules, 60 controllers, 386 route decorators
apps/web        Next.js 16 frontend — 35 pages, BFF route handlers under src/app/api
apps/worker     Background jobs — 7 processors, tenant-scoped
packages/       config · jobs · types · ui · validation (jobs is real; the others are thin)
database/       81 migrations, PostgreSQL + PostGIS, 91 tables
infrastructure/ docker (postgres init, provisioning the restricted runtime role); nginx and terraform are empty
docs/           product, backend, architecture, operations, audits
```

Monorepo on pnpm + Turborepo. Commands: `pnpm typecheck`, `pnpm lint`, `pnpm build`,
`pnpm test`, `pnpm --filter api test:integration`, `pnpm db:migrations:check`.

**Baseline health**, measured today, unchanged from 2026-09-25: api unit 746/746, worker
65/65, web 494/494, api integration 582/583. Build, typecheck and migrations pass. Lint
reports one error, in an uncommitted change that predates this work and is not ours.

---

## 3–4. Database model and backend modules

91 tables. The ones that matter for the corrected requirement:

| Table                                                                           | Role in the corrected product                                                                                                                                  | Verdict               |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `tenants`                                                                       | The group                                                                                                                                                      | KEEP                  |
| `organizations`                                                                 | **The five entities** (OFTI, GFTIJ, INTERTRAD, SDI, AFTIJ)                                                                                                     | KEEP                  |
| `teams`                                                                         | Teams within an entity                                                                                                                                         | KEEP                  |
| `tenant_memberships`, `users`, `identities`                                     | Accounts and workspace membership                                                                                                                              | KEEP                  |
| `user_access_grants`, `membership_resource_scopes`                              | Role + scope (entity, team)                                                                                                                                    | KEEP                  |
| `establishments`                                                                | **The prospect référentiel** — address, postal code, city, phone, website, lat/long, PostGIS `location`, `region_id`, `external_reference`, `status`, `source` | EXTEND (category)     |
| `regions`                                                                       | Hierarchical territory (`parent_region_id`, `type`) — région / département / commune                                                                           | KEEP                  |
| `establishment_contacts`                                                        | Contact people                                                                                                                                                 | KEEP                  |
| `campaigns`, `campaign_prospects`, `campaign_members`                           | Campaign and its prospect population                                                                                                                           | EXTEND (time budgets) |
| `campaign_prospect_assignments`                                                 | Assignment of a point to a prospector                                                                                                                          | KEEP                  |
| `reservation_records`, `reservation_events`                                     | Reservation evidence and history                                                                                                                               | KEEP                  |
| `actions`, `action_outcomes`, `outcome_settings`                                | Recorded work and its result; **outcomes are tenant-configurable, not a fixed enum**                                                                           | KEEP                  |
| `prospect_activities`                                                           | Activity history, channel-typed (`call, email, message, visit`)                                                                                                | KEEP                  |
| `prospect_follow_ups`                                                           | Relances                                                                                                                                                       | KEEP                  |
| `contact_consents`                                                              | Oppositions, enforced by database trigger                                                                                                                      | KEEP                  |
| `tags`, `prospect_tags`                                                         | Candidate home for the "section" taxonomy                                                                                                                      | EXTEND                |
| `audit_events`                                                                  | Audit trail, append-only (UPDATE/DELETE revoked from the app role)                                                                                             | KEEP                  |
| `conversations`, `messages`, `message_attachments`, `conversation_participants` | Internal messaging                                                                                                                                             | KEEP or HIDE (§21)    |
| —                                                                               | **Scripts / e-mail templates**                                                                                                                                 | **BUILD**             |
| —                                                                               | **Prospecting session** (objective from time)                                                                                                                  | **BUILD**             |

All 81 tables carrying `tenant_id` have Row-Level Security enforced, and the application
connects as a non-privileged role. Verified: with no tenant context the application role
reads 0 rows where the owner reads 231.

---

## 5–6. API and frontend inventory

386 route decorators across 60 controllers. Rather than reproduce all of them, the
inventory that decides this realignment:

| Capability                                         | API                                                               | Frontend route                             | State                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Auth, MFA, recovery, invitations, workspace switch | Yes                                                               | `(auth)/*`, `select-workspace`             | KEEP                                                      |
| Prospect référentiel browse/filter                 | Yes                                                               | `work-queue`, `search`                     | MODIFY — needs the mockup's region/section/status filters |
| Prospect detail + activity                         | Yes                                                               | `work-queue/[campaignId]/[prospectId]`     | MODIFY                                                    |
| My Day                                             | Yes (`prospector-today`)                                          | `(app)/` root page                         | MODIFY to the mockup                                      |
| Route / circuit                                    | Yes (`routes`)                                                    | `routes`, `routes/new`, `routes/[routeId]` | KEEP                                                      |
| Map                                                | Yes (`maps`)                                                      | `(app)/map` with MapLibre                  | EXTEND — real geodata                                     |
| Assignments                                        | Yes (individual, batch, rules, suggestions)                       | `manager/assignments`, `.../active`        | EXTEND — dispatch UI                                      |
| Campaigns                                          | Yes                                                               | `manager/campaigns`, `[campaignId]`        | EXTEND — time budgets                                     |
| Follow-ups                                         | Yes                                                               | `follow-ups`                               | KEEP                                                      |
| Collisions / overrides                             | Yes                                                               | `manager/collisions`, `manager/approvals`  | KEEP                                                      |
| Manager dashboard / reporting                      | Yes                                                               | `manager/overview`, `manager/reports`      | MODIFY to "Pilotage"                                      |
| Teams and access                                   | Yes                                                               | `manager/team`, `admin/users`              | MODIFY to "Équipes & accès"                               |
| Imports                                            | Yes                                                               | `admin/imports`, `[importId]`              | EXTEND — dedupe (TR-905)                                  |
| Audit                                              | Yes                                                               | `admin/audit`                              | KEEP                                                      |
| Exports                                            | Yes (sync + async jobs)                                           | `manager/exports`                          | KEEP or HIDE                                              |
| Messaging                                          | Yes (4 tables, controllers inside `messaging.module.ts`)          | `messages`                                 | HIDE FOR MVP (§21)                                        |
| Consent / opposition                               | Yes, enforced in the database                                     | —                                          | KEEP                                                      |
| **Scripts / e-mail templates**                     | **None**                                                          | **None**                                   | **BUILD**                                                 |
| **Prospecting session**                            | **None**                                                          | **None**                                   | **BUILD**                                                 |
| **Compléments** (information requests)             | Partially — enrichment exists, the request/response loop does not | **None**                                   | **BUILD or map onto messaging**                           |

A caution learned twice in this repository: **controllers and guards are frequently
declared inside module or controller files rather than in files named for them.** Absence
of a file named `x.controller.ts` does not mean `x` is missing. Every "None" above was
checked by grepping the whole source tree and the database catalogue, not by listing
files.

---

## 7. Roles today

Three application roles already exist and map onto management's three without invention:

| Management | Today                                                | Notes                                                                                                                                                      |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin      | `client_admin` (+ platform admin above it)           | Tenant-wide                                                                                                                                                |
| Manager    | `director` (entity scope) and `manager` (team scope) | **Two levels already** — a director supervises entities, a manager supervises teams. This is finer-grained than management asked for and is worth keeping. |
| Prospector | `prospector`                                         | Scoped to own assignments                                                                                                                                  |

Authorization is enforced in the backend (guards + scope services + database policies),
not in the frontend. Export authorization, for example, is role-gated, tenant-configurable
and object-level.

---

## 8–12. Current workflows versus required

**Assignment / dispatch (today):** a manager works from `manager/assignments`, can assign
individually or in batches, can define assignment rules, and receives suggestions.
Collision checks run inside the assignment transaction, re-verified at claim time. This
is close to what management wants; what is missing is the _screen_ the mockup shows —
select entity → campaign → territory → section → eligible prospects → prospector →
objective → assign.

**My Day (today):** `prospector-today` serves the prospector's list; the app root page
renders it. The mockup expects, in addition: points for today, actions done, points
remaining, relances due, a session objective, and a "Préparer ma journée" entry point.
The first four are close to what the module already returns; the session is not.

**Activity recording (today):** actions with tenant-configurable outcome codes, notes,
recorder and timestamp; activities are channel-typed; follow-ups can be created;
everything writes audit evidence, and consent blocks are enforced by a database trigger
that no application path can bypass.

**Enrichment (today):** contacts, tags and typed fields can be added. Audit rows and
collision evidence are physically immutable — `UPDATE` and `DELETE` are revoked from the
application role. Management's rule ("ajouts possibles, pas de suppressions par un
prospecteur") is therefore **partly enforced and partly not**: the audit trail cannot be
rewritten, but there is no explicit canonical-versus-enrichment split on the prospect
record itself. See TR-931.

---

## 13. Anti-collision — the capability that already works

This is worth stating plainly because it is management's central fear and it is handled:

- A claim is atomic: a Redis Lua script checks the exact campaign-prospect key, the
  target entity's establishment lock, and **every blocking entity's** establishment lock
  in one execution.
- Blocking entities are computed per tenant policy
  (`reservation-coordination-scope.service.ts`), so a prospect held by OFTI can block
  GFTIJ where policy says it should.
- Availability is re-verified at claim time, never trusted from the client.
- Cooling-off rules, manager overrides with audit, and collision evidence all exist.
- 25 concurrency tests pass, including simultaneous-claim cases.

The mockup's promise — "Les réservations sont partagées entre OFTI, GFTIJ, INTERTRAD, SDI
et AFTIJ. La disponibilité est revérifiée avant chaque action." — is an accurate
description of what the backend already does.

---

## 14. Security findings

No new findings in this pass. The position established on 2026-09-25 holds: tenant
isolation enforced at the database, authorization backend-authoritative, audit immutable,
idempotency, rate limiting on auth, secrets from environment only. The open items are
operational, not access-control: no backups ever restored, and no observability.

One authorization question the corrected requirement raises and which **is** already
answered correctly: a prospector cannot read an arbitrary prospect by changing an id —
access derives from assignment and scope, checked server-side.

---

## 15. Mock and hardcoded data

Swept on 2026-09-25 and again today: no `TODO`/`FIXME`/`HACK` in tracked source; every
`deprecated` hit is upstream lockfile metadata; all `legacy` hits are a genuine domain
concept. One dead 529-line frontend fixture was removed. **No production-facing screen
was found rendering fabricated business data.** The frontend's own report describes pages
as delivered that are wired to real APIs.

---

## 16. Fit-gap matrix

| Capability                    | Exists                | Quality                           | Decision              | Priority |
| ----------------------------- | --------------------- | --------------------------------- | --------------------- | -------- |
| Authentication, MFA, sessions | Yes                   | Tested                            | KEEP                  | —        |
| Authorization / roles         | Yes                   | Tested                            | KEEP                  | —        |
| Tenant isolation              | Yes                   | Enforced + proven                 | KEEP                  | —        |
| Entities (five companies)     | Yes (`organizations`) | Tested                            | KEEP                  | —        |
| Teams                         | Yes                   | Tested                            | KEEP                  | —        |
| Prospect référentiel          | Yes                   | Tested                            | EXTEND (category)     | P0       |
| CSV import                    | Yes                   | 1 of 6 dedupe keys                | EXTEND                | P0       |
| Campaigns                     | Yes                   | Tested                            | EXTEND (time budgets) | P0       |
| Daily plan / session          | **No**                | —                                 | **BUILD**             | P0       |
| Assignments                   | Yes                   | Tested                            | EXTEND (dispatch UI)  | P0       |
| Anti-collision                | Yes                   | 25 concurrency tests              | KEEP                  | —        |
| My Day API                    | Yes                   | Tested                            | MODIFY                | P0       |
| My Day UI                     | Partly                | Wired                             | MODIFY                | P0       |
| Prospect detail               | Yes                   | Wired                             | MODIFY                | P0       |
| Activity recording            | Yes                   | Tested                            | KEEP                  | —        |
| Prospect enrichment           | Partly                | Append exists; no canonical split | EXTEND                | P1       |
| Follow-ups                    | Yes                   | Tested                            | KEEP                  | —        |
| **Scripts**                   | **No**                | —                                 | **BUILD**             | P0       |
| **E-mail templates**          | **No**                | —                                 | **BUILD**             | P1       |
| Manager dashboard             | Yes                   | Tested                            | MODIFY                | P1       |
| Map                           | Yes (MapLibre)        | Unverified on real data           | EXTEND                | P1       |
| Audit                         | Yes                   | Immutable                         | KEEP                  | —        |
| Realtime                      | No                    | Polling available                 | DEFER                 | P2       |
| Reporting                     | Yes                   | Tested                            | KEEP                  | —        |
| Messaging                     | Yes                   | Tested                            | HIDE for MVP          | P2       |
| Exports                       | Yes                   | Tested                            | KEEP                  | —        |

---

## 17. Beta blockers

What stops management's flow working today, in order:

1. **No prospect data.** The 14,000-record file was not provided with this brief.
2. **No dispatch screen** matching the mockup.
3. **No session / objective-from-time** concept.
4. **No scripts** for the prospector to read while calling.
5. **No category taxonomy** to filter "Gendarmeries / Commissariats / Douanes / CRA".
   **Resolved by TR-921**; the remaining beta work is loading and classifying the
   supplied prospect dataset.
6. **The dispatch model decision** (§23) — resolved by TR-920; implementation now
   follows [ADR-006](decisions/ADR-006-dispatch-model.md).

Note what is _not_ on this list: collision prevention, assignment, activity recording,
follow-ups, audit, authorization, isolation.

---

## 18. Revised backlog

### P0 — beta-critical

- **TR-920 — Decide and document the dispatch model.** **Done.** The beta uses the
  hybrid manager-push + prospector-pull model in
  [ADR-006](decisions/ADR-006-dispatch-model.md). TR-923 and TR-924 implement the two
  entry points over the existing assignment/collision lifecycle.
- **TR-921 — Prospect category (section) taxonomy.** **Done.** A nullable single-valued
  `establishment_category` enum is stored on `establishments`; tags remain free-form
  many-to-many labels. Migration `0081_establishment_category.sql` and the API/web
  filter plumbing cover create, update, import preview, establishment listing,
  prospect-master listing, campaign enrolment and the manager dispatch queue. The
  taxonomy values are `prospection`, `justice_enquetes`, `sante`, `asile_social`,
  `douanes_onaf`, `cra` and `prescripteurs`.
- **TR-922 — Load the 14,000 prospects.** Requires the file. Depends on TR-921 for
  category mapping and on import dedupe being trustworthy (TR-905) so a re-import does
  not duplicate the base.
- **TR-923 — Manager dispatch screen.** Entity → campaign → territory → section →
  eligible → prospector → objective → assign, over the existing assignment and collision
  APIs. Frontend-led; backend already supports it.
- **TR-924 — Prospecting session and objective.** Campaign time budgets (minutes per call
  / per visit), session creation, objective computed from available time, point
  allocation. Backend + frontend. **Depends on TR-920.**
- **TR-925 — Prospecting scripts.** Script per campaign/entity, shown on the prospect
  detail screen. Table + CRUD + display.
- **TR-926 — My Day to the mockup.** Points today / done / remaining / relances, session
  entry point, priority relances.
- **TR-916 — Reservation durable intent.** Carried over; the last failing test and a
  correctness defect in the claim path. Designs documented; the obvious fix deadlocks.

### P1 — production quality

- TR-927 e-mail follow-up drafts (no automatic sending, per the mockup)
- TR-928 France map on real geodata
- TR-931 canonical-versus-enrichment split on the prospect record
- TR-929 "Pilotage" console to the mockup
- TR-930 "Compléments" request/response loop
- TR-905 import deduplication (6 keys), TR-906 backups, TR-912 observability
- TR-917 mail throughput, TR-918 remaining lock-upgrade sites, TR-914, TR-913

### P2 — post-MVP

Realtime push, route optimisation, advanced analytics, messaging (hide for the beta).

---

## 19. Implementation order

```text
TR-920 (hybrid decision) ✅
   ↓
TR-921 (taxonomy) ✅ → TR-922 (data load)
   ↓
TR-924 (if pull model) ──┐
TR-923 (if push model) ──┤ → TR-926 (My Day) → TR-925 (scripts)
   ↓
TR-916 (correctness) → P1
```

TR-921 and TR-922 can start immediately and are useful under either dispatch model. That
is the right place to begin while §23 is being decided.

---

## 20. Risks

- **The dispatch-model decision is on the critical path.** Building both is twice the
  work; building the wrong one is worse.
- **The frontend exists in two diverging lineages.** The integration branch already
  contains manager reports, the prospector Today page, four admin pages and a working map
  — several of which the frontend team's own report lists as not yet done. Until this is
  resolved, effort will be duplicated. Five branches hold 14 commits that exist nowhere
  else; none have been deleted.
- **The dataset is unseen.** Import behaviour at 14,000 rows, address quality and
  geocoding coverage cannot be assessed without it.
- **The deadline.** See below.

## 21. Product noise to hide, not delete

Messaging, exports, advanced search for prospectors, scheduled reports and webhooks are
built and tested but are not part of the corrected MVP. Recommend hiding them from
navigation for the beta rather than removing them.

---

## 22. Recommended architecture decisions

Keep the existing architecture. It already matches the target shape (frontend → BFF →
controller → service → policy → repository → PostgreSQL, with a worker for background
jobs). Introduce no new infrastructure: Redis is already present and used correctly for
the collision claim; polling is sufficient for "near real time" in a beta.

Two decisions worth taking deliberately:

1. **Category as a column on `establishments`, not as a tag**, if the taxonomy is closed
   and every prospect has exactly one. Tags are the right answer only if a prospect can
   carry several. The mockup shows exactly one section per establishment.
2. **Do not create a second assignment or collision system** for the session model. A
   session should allocate through the existing reservation claim, not beside it.

---

## 23. The one decision that must not be invented

Management's message says points are dispatched **by the admin**:
_"un dispatch de points de prospection par admin"_, and the brief's flow has the manager
selecting prospects and assigning them.

The mockup says the opposite. "Ma journée" reads:
_"Votre prochaine session commence ici. Choisissez une campagne et votre mode de
prospection. TrackRoster attribue les points disponibles à votre équipe."_ — the
prospector starts a session and the system allocates.

These are different products with different screens, different APIs and different
failure modes. Both are defensible:

- **Manager-push** gives management control over who works what, which is what "suivre
  nos équipes" implies.
- **Prospector-pull** removes a daily manual step and is what the mockup demonstrates.
- **Both** — manager defines the campaign, territory and objective; the prospector pulls
  their day from that scope — is the recorded beta decision. The detailed invariants
  and acceptance evidence live in [ADR-006](decisions/ADR-006-dispatch-model.md).

TR-923 and TR-924 can now start against that contract. If management later chooses a
single-mode product, it is a product change that must supersede ADR-006 before either
ticket changes implementation direction.

---

## 24. On the Tuesday beta

The end-to-end scenario in the brief — manager selects the Gendarmerie/Police/Douane/CRA
population, filters a territory, assigns to a prospector, collision is prevented, the
prospector sees the day, opens an establishment, sees the script, records the outcome,
adds information, creates a follow-up, and the manager sees progress — **cannot be
delivered by tomorrow.** The missing pieces are a taxonomy, a data load, a dispatch
screen, a session model and a scripts feature, and one of those is blocked on a decision.

What can realistically be shown early in the week, assuming the dataset arrives and the
dispatch model is decided:

1. The real 4,000 priority prospects loaded, categorised and filterable by territory.
2. A manager assigning a selection of them to a prospector, with collision prevention
   demonstrably working across entities.
3. That prospector seeing the assigned points in "Ma journée", opening one, recording an
   outcome, and creating a follow-up.
4. The manager seeing the progress change.

That is the spine of the product, on real data, without scripts, without the session
model, and without the map. It is worth more as a demonstration than a wider but
fabricated one, and it is honest about what remains.

---

## 25. Next ticket

**TR-922 — load and classify the prospect dataset** once the source file is supplied.
TR-921 is complete and the category filter is available to the import, prospect and
assignment paths. The remaining uncertainty is data mapping quality, not schema or
filter plumbing.

### TR-921 evidence

- API unit tests: 19/19 passed in `establishment-category.dto.spec.ts` and
  `establishment.service.spec.ts`.
- Web BFF route tests: 13/13 passed across the prospects, unassigned-assignment and
  campaign bulk-selection routes.
- API and web TypeScript checks passed.
- Migration integrity passed for the 86-entry chain, including migration 0081.
- HTTP integration tests are not runnable in this shell because the configured
  disposable Redis/Postgres services are unavailable (`EPERM` on `127.0.0.1:6379` and
  `ENOTFOUND` for the configured Supabase pooler). They remain required evidence for
  the connected environment.
