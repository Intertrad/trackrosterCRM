# TrackRoster — Full codebase audit brief for Codex

> Save this file in the repo at `docs/audit/CODEX-AUDIT-PROMPT.md`, commit it, then run the
> kickoff in §0. Everything below is the instruction set for the agent, not documentation
> for humans.

---

## 0. Kickoff

Paste this into Codex (or run `codex exec` with it):

```
Read docs/audit/CODEX-AUDIT-PROMPT.md and execute it in full, starting at Phase 0.
You are the Chief Auditor. Run every role pass in order. Do not skip a role.
Do not modify any file outside docs/audit/. Produce the four deliverables listed in §4.
Stop and ask me only if a command needs credentials, network access, or a running database.
```

If you want a single pass instead of the whole board, use:

```
Read docs/audit/CODEX-AUDIT-PROMPT.md. Execute Phase 0, then run ONLY the role
"<ROLE NAME>" from §5. Produce its findings in the format of §3.
```

---

## 1. Context the auditor must hold

**Product.** TrackRoster is a multichannel prospecting coordination platform for a group of five
structures (GFTIJ, INTERTRAD, OFTI, SDI, AFTIJ). Slogan: _"Every prospect, at the right time, by
the right team."_ The product reference is the **Product Design Dossier v1.0 (31 Aug 2026)**. The
build is **trackrosterCRM**.

**Scale it must hold.** Pilot: 2,584 establishments, 86 users, 13 regions, 5 structures. The
national repository already imported is in the order of 14,000+ establishments. Design for that,
not for a demo dataset.

**Stack (as declared; verify in Phase 0, do not assume).**

| Layer       | Declared                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Backend     | NestJS + TypeORM + PostgreSQL, CommonJS module system, port 4000                                 |
| Frontend    | Next.js, port 3000                                                                               |
| Monorepo    | pnpm workspaces                                                                                  |
| Tests       | Jest, `@nestjs/testing`, supertest                                                               |
| Enforcement | Husky, lint-staged, commitlint, eslint-plugin-check-file, validate-branch-name                   |
| CI          | GitHub Actions, branch protection on `main`                                                      |
| Workflow    | GitHub Flow, squash-only merges, Conventional Commits, kebab-case branches, numbered PR sequence |

**The six non-negotiable product principles.** Every finding that breaks one of these is severity
**S1**, with no discussion:

1. A single identity per prospect / establishment (no duplicate records for the same site).
2. Explicit ownership — an owner and a deadline per active campaign.
3. One action = one row, never overwritten. History is never rewritten.
4. The anti-collision check runs **before** any reservation or action.
5. A manager override requires a reason and is written to the audit log.
6. Visibility is role-based.

---

## 2. Operating contract — read before touching anything

**You are read-only on product code.** You may create and write files **only** under
`docs/audit/`. You never edit `apps/`, `packages/`, `src/`, migrations, config, or CI. You never
run a migration, never run a destructive command, never `git commit`, `git push`, `git checkout`
or change the branch. If a fix is worth making, you write it as a diff inside
`docs/audit/quick-wins/`, you do not apply it.

**Evidence or it did not happen.** Every finding carries a `path/to/file.ts:LINE` reference and
either a quoted code snippet (≤ 12 lines) or the output of a command you actually ran. A finding
with no evidence is deleted before you report.

**Say "NOT FOUND", never guess.** If a requirement has no implementation you can locate, the
status is `NOT FOUND` with the search commands you tried. If you could not verify a claim because
a command failed or a service was unavailable, tag the finding `UNVERIFIED` and say why. Never
infer behaviour from a filename.

**Smallest viable fix.** Recommend the minimum change that closes the gap. Do not propose a
rewrite, a new framework, a new library, or a folder reorganisation unless the current structure
makes a requirement impossible to meet — and then say exactly which requirement.

**No secrets in the report.** Never print the contents of `.env*`, keys, tokens, connection
strings or seed credentials. Report the variable name and the file, never the value.

**No network installs without asking.** If you need a tool that is not in the repo (`madge`,
`knip`, `dependency-cruiser`, `npm-check-updates`), list it in the report under "tools I could not
run" instead of installing it, unless the operator has already approved network access.

**Working language.** The report is written in English. Code identifiers, UI copy and French
domain terms stay in their original language — do not translate `dérogation`, `assermenté` or any
UI string when quoting it.

---

## 3. Finding format

Every finding, from every role, uses exactly this shape:

````
### [ID] <one-line title in the imperative>

- **Severity:** S1 | S2 | S3 | S4
- **Role:** <which auditor found it>
- **Requirement:** <DoD item / principle / convention it breaks, or "code quality">
- **Location:** `apps/api/src/.../file.ts:142-158`
- **Evidence:**
  ```ts
  <≤ 12 lines, or command output>
````

- **Why it matters:** <one or two sentences, concrete consequence, no theory>
- **Fix:** <the smallest change, named files and symbols>
- **Effort:** S (<1h) | M (half a day) | L (1–3 days) | XL (more)
- **Confidence:** verified | unverified

````

IDs are `<ROLE-PREFIX>-NNN`, e.g. `SEC-004`, `ENG-011`.

**Severity scale.**

- **S1 Blocker** — breaks one of the six non-negotiable principles, loses or corrupts data, lets a
  user act outside their tenant or role, or makes an MVP Definition-of-Done item unachievable.
- **S2 Major** — a requirement is implemented but wrong, incomplete, or unsafe under concurrency
  or load; a security control exists but is bypassable; a required audit entry is missing.
- **S3 Minor** — correct behaviour, poor structure: duplication, leaking layers, missing tests on
  a non-critical path, naming that fights the conventions.
- **S4 Nit** — readability, dead code, comments, cosmetic inconsistency.

Sort every list by severity, then by effort ascending inside a severity (cheapest blockers first).

---

## 4. Deliverables

Write exactly these files. Overwrite them if they exist.

| File | Content |
|---|---|
| `docs/audit/AUDIT-REPORT.md` | The main report: executive summary (≤ 1 page, the 10 things that matter), a severity count table, then every finding grouped by role in the §3 format. |
| `docs/audit/TRACEABILITY.md` | The requirement → code matrix from §5.2. One row per requirement, no row left blank. |
| `docs/audit/FINDINGS.csv` | `id,severity,role,requirement,file,line,title,effort,confidence` — one row per finding, so it can be imported into a tracker. |
| `docs/audit/ARCHITECTURE-NOTES.md` | What the codebase actually is today: module map, dependency direction, data flow for one write path (`POST /actions`) and one read path (`GET /manager/dashboard`), plus a Mermaid diagram of the module graph. Descriptive, not prescriptive. |
| `docs/audit/quick-wins/*.patch` | Optional. Unified diffs for S3/S4 findings with effort `S` that are mechanical and risk-free. Never applied, just written. |

End `AUDIT-REPORT.md` with a **"Next 10 commits"** section: an ordered list of ten atomic,
PR-sized pieces of work that would close the highest-value findings, each with its finding IDs,
a Conventional Commit subject line, and a kebab-case branch name — so the list drops straight into
the existing numbered-PR workflow.

---

## 5. The audit

### Phase 0 — Inventory (do this first, no findings yet)

Establish the ground truth. Run and record:

```bash
# shape of the repo
cat package.json pnpm-workspace.yaml
pnpm -r list --depth -1
git log --oneline -40
git branch -a

# what is actually enforced
cat .husky/* 2>/dev/null
cat commitlint.config.* .lintstagedrc* 2>/dev/null
cat eslint.config.* .eslintrc* 2>/dev/null
ls -la .github/workflows && cat .github/workflows/*

# does it build and pass today
pnpm install --frozen-lockfile
pnpm -r exec tsc --noEmit
pnpm -r lint
pnpm -r test -- --passWithNoTests
pnpm -r build
````

Then produce, in `ARCHITECTURE-NOTES.md`:

- the real workspace package names and paths (use these in every later command — never guess
  `apps/api`);
- the NestJS module list and the import graph between them;
- the TypeORM entity list and the relations between them;
- the Next.js route tree (app router or pages router — state which);
- the full list of HTTP endpoints actually registered (grep for `@Controller`, `@Get`, `@Post`,
  `@Patch`, `@Delete` and build the table);
- which of the Phase 0 commands failed, with the error.

If `pnpm -r test` or `tsc --noEmit` fails, that is finding `DEV-001` at S2 minimum and you keep
going — a broken baseline is itself a result.

---

### Phase 1 — Role passes

Run every role below, in order. Each role reads only what its scope needs, produces findings in
the §3 format, and does not comment outside its scope (the Chief Auditor merges and dedupes at the
end). If the budget is short, the four marked **[CORE]** run first.

---

#### Role 1 — Repository & DevEx Auditor · prefix `DEV`

_You are a staff engineer who sets up monorepos for a living. You care that the rules the team
wrote down are actually enforced by a machine, not by goodwill._

Check:

- Root `package.json` and `pnpm-workspace.yaml` are coherent; every workspace package has the
  scripts the root expects (`lint`, `test`, `build`, `typecheck`) and the root can run them with
  one command.
- `tsconfig` layering: a base config extended by each package, `strict: true`, `noUncheckedIndexedAccess`,
  path aliases that resolve identically in Jest, Next and `tsc`. Report any `any`, `@ts-ignore`,
  `@ts-expect-error` cluster with counts per directory.
- `eslint-plugin-check-file` rules exist **and** match the documented naming convention; prove it
  by naming a file that would be rejected. If the rule set is declared but not wired into
  `lint-staged` or CI, that is S2 — a convention nobody enforces is not a convention.
- Husky hooks actually run (`pre-commit`, `commit-msg`), `validate-branch-name` is wired,
  commitlint config matches Conventional Commits.
- GitHub Actions: does CI run install + typecheck + lint + test + build on PRs to `main`? Is the
  Node and pnpm version pinned and identical to local? Is the lockfile enforced
  (`--frozen-lockfile`)? Is there any job that could pass while tests fail
  (`continue-on-error`, `|| true`)?
- Environment handling: a committed `.env.example` covering every variable the code reads; config
  validated at boot (Nest `ConfigModule` with a schema) rather than `process.env.X!` scattered
  through services. List every direct `process.env` read outside the config module.
- Dead weight: unused dependencies, duplicated dependencies across workspaces with different
  versions, packages in `dependencies` that belong in `devDependencies`.
- Developer onboarding: can a new developer go from clone to running stack using only the README?
  Walk the README literally and report the first step that fails.

---

#### Role 2 — Product Requirements Auditor **[CORE]** · prefix `REQ`

_You are the product owner's proxy. You do not care whether the code is pretty. You care whether
the thing the dossier promised exists, and you will not accept "it's in progress" without a line
number._

Build `docs/audit/TRACEABILITY.md` as a table with these columns:

`Requirement | Source | Status | Implementation (file:line) | Tests (file:line) | Gap`

Status is one of: `DONE` · `PARTIAL` · `NOT FOUND` · `N/A for current sprint`.

**5.2.1 — The 12 MVP Definition-of-Done items.** One row each, no exceptions:

1. No two users can ever hold the same incompatible reservation.
2. Every action is an immutable entry carrying author and timestamp.
3. A manager can assign, reassign and close in batches without leaving the product.
4. A prospector sees only their authorised scope.
5. An override requires a reason and lands in the audit log.
6. Import flags duplicates and anomalies **before** insert.
7. Follow-ups create tasks and alerts.
8. The dashboard filters by company, team, period, campaign and territory.
9. It works on mobile and desktop.
10. Exports are role-controlled and logged.
11. Backup and restore are tested.
12. Anti-collision is covered by automated concurrency tests.

**5.2.2 — The priority endpoints.** For each, state whether it exists, its real path, its guard,
its DTO validation, and its test:

`POST /auth/login` · `POST /imports/preview` · `POST /assignments/bulk` ·
`POST /reservations/claim` · `POST /actions` · `POST /overrides/{id}/decide` ·
`GET /prospects/{id}/timeline` · `GET /manager/dashboard`

**5.2.3 — The domain events.** Emitted anywhere? Consumed? Typed payload? Persisted?

`prospect.assigned` · `reservation.claimed` · `reservation.rejected` · `action.logged` ·
`followup.due` · `override.requested` · `override.decided` · `import.completed`

**5.2.4 — The prospect lifecycle.** Seven states: Unassigned → To contact → In progress → Contact
made → Follow-up → Qualified → Converted. Four exit states: Final refusal, Do not contact
(opt-out / compliance), Invalid contact details, No answer (retry by cadence). Verify that the
status enum matches exactly, that **no status can be set without an explicit action or decision
that produced it**, and that there is no path where a status is written directly by a PATCH on the
prospect.

**5.2.5 — The six roles and their scope.** Super admin (global: clients, settings, billing,
support) · Client admin (global: companies, users, imports, rules, integrations) · Director (read:
global view, targets, exports) · Manager (team: assignments, validation, overrides) · Prospector
(personal: own prospects, actions, follow-ups) · Observer/auditor (read-only on a defined scope).
For each role, list the endpoints it can reach and flag any endpoint with no role restriction.

**5.2.6 — The notification matrix.** Follow-up due · reservation expired without a summary ·
collision / recent contact · override request · no activity for X days · import with anomalies.
For each: does it exist, who receives it, which channel, and — critically — verify that **critical
collision, opt-out and security alerts cannot be disabled** by a user preference.

**5.2.7 — Sprint position.** The 14-week plan runs S0 framing → S1 foundation (auth, tenant, roles,
companies) → S2 repository (prospects, contacts, imports, duplicates) → S3 execution (assignments,
actions, statuses, follow-ups) → S4 anti-collision → S5 oversight → S6 pilot. State which sprint
the code actually corresponds to, with evidence, and list what S1–S3 left unfinished before S4
work started on top of it.

---

#### Role 3 — Anti-collision Engine Auditor **[CORE]** · prefix `ENG`

_You are the engineer who will be blamed when two prospectors call the same company twenty minutes
apart. This engine is the product. Audit it as if money depends on it._

The engine has **7 layers**: duplicate detection (name, address, phone, e-mail, domain, SIRET,
similarity) · active assignment · planned action · instant reservation · cooldown period ·
multi-brand policy · manager override (reason, duration, audit trail).

The decision tree evaluates in this order: **opt-out / block → active reservation → upcoming
action → recent contact → multi-brand rule**, and returns one of **BLOCKED** (with an explicit
reason and the next available option), **TO VALIDATE** (manager decision), **ALLOWED**
(reservation created atomically).

Verify, each as its own finding if it fails:

- **The order is the dossier's order**, in code, in one readable place. If the layers are scattered
  across guards, interceptors and service methods so no single file states the sequence, that is
  S2 — the rule nobody can read is the rule nobody can maintain.
- **Opt-out is unconditional.** Find every code path that can produce `ALLOWED`, and prove that
  none of them can be reached for an opted-out prospect — including with an approved override.
  An override that can lift opt-out is **S1**.
- **The check runs server-side, inside a database transaction**, and the reservation is created
  in the _same_ transaction as the check. A check that returns `ALLOWED` and then creates the
  reservation in a second round trip is a race condition — **S1** — and you must say which
  isolation level or lock (`SELECT … FOR UPDATE`, a unique partial index, an advisory lock) is
  used, or report that none is.
- **Concurrency is provably safe.** Is there a database-level constraint that makes a double
  reservation impossible — a unique partial index on (prospect, active) — or does safety rest only
  on application logic? Application-only safety under `READ COMMITTED` is S1.
- **Idempotency.** The dossier requires reservation, action and lock release to be idempotent.
  Find the idempotency key handling. Releasing a lock twice, replaying `POST /actions`, and
  double-submitting `reservations/claim` must each be harmless. Test it or mark it `UNVERIFIED`.
- **Lock lifecycle.** 20 minutes for a call, a time slot for a visit, automatic expiry, optional
  heartbeat, a mandatory reason to extend. Who expires the lock — a cron, a lazy check on read, a
  Redis TTL? If expiry is lazy, is an expired lock ever treated as active?
- **Logging the action releases the lock and creates the follow-up**, atomically, in that order.
- **The multi-brand matrix.** The dossier's proposed pairs: GFTIJ–SDI Shared · GFTIJ–OFTI Deferred ·
  GFTIJ–INTERTRAD Coord · GFTIJ–AFTIJ Coord · INTERTRAD–OFTI Indep · INTERTRAD–SDI Coord ·
  INTERTRAD–AFTIJ Coord · OFTI–SDI Deferred · OFTI–AFTIJ Indep · SDI–AFTIJ Coord.
  Semantics: Shared = one contact presents several offers; Coord = mandatory validation or
  consultation; Deferred = new contact only after a delay; Indep = campaigns allowed separately.
  Is the matrix **data** (configurable per tenant, editable by the client admin, versioned) or is
  it hardcoded? Hardcoded is S2 — the dossier marks it "to validate with managers", so it will
  change. Also: is the matrix symmetric by construction, and what happens to in-flight
  reservations when a cell changes?
- **Performance budget: the answer must come back in under 1 second.** Find the query plan for the
  check. Count the round trips. If duplicate detection runs a similarity scan over the whole
  establishment table on every check, say so with the query and the missing index
  (`pg_trgm` / GIN).
- **BLOCKED must carry an explicit reason and the next available option.** A boolean `false` with
  no reason is S2 — the prospector cannot act on it and will phone anyway.
- **Override.** Reason mandatory, duration bounded, written to the audit log, scoped to one
  prospect and one requester, expiring on its own. An override with no expiry is S2.

Finish this role with a **decision table**: every combination of (opt-out, active reservation,
upcoming action, recent contact within cooldown, brand pair rule, override present) → expected
verdict → is it covered by a test → test file:line. This table is the single most useful artifact
of the whole audit; do not compress it.

---

#### Role 4 — Backend Architecture Reviewer · prefix `API`

_You are a NestJS specialist reviewing for a team that will add six more modules on top of this
foundation._

- Module boundaries follow the dossier's four domains — Organization (Tenant, Company, Team,
  User) · Market (Campaign, Prospect, Establishment, Contact) · Execution (Assignment,
  Reservation, Action, Follow-up) · Control (Collision rule, Override, Document, Audit log). Does
  the module graph reflect that, or has everything collapsed into a shared module?
- Dependency direction: no cycles between modules, no controller importing a repository, no entity
  importing a service. Produce the module graph and name every cycle.
- Layering discipline: controller → service → repository. Business rules must not live in
  controllers, and the anti-collision rules must not be duplicated in more than one service.
- DTOs: every request body validated with `class-validator`, a global `ValidationPipe` with
  `whitelist: true` and `forbidNonWhitelisted: true`. A single endpoint accepting an unvalidated
  body is S2. Response shapes serialised through DTOs or interceptors, never leaking entities
  (and never leaking a password hash, a tenant id the caller should not see, or an internal note).
- Error model: one exception filter, consistent error envelope, no stack trace in a production
  response, domain errors (`ProspectBlockedError`) distinct from HTTP concerns.
- Transactions: where are they opened, who owns them, is there a request-scoped transaction or a
  `QueryRunner` passed by hand? Flag any multi-write operation that is not in a transaction —
  especially assign-in-bulk, log-action-and-release-lock, and decide-override.
- Async work: are notifications, imports and exports done inline in the request, or queued? A
  14,000-row import inside an HTTP request is S2.
- Logging: structured, correlation id per request, no PII in logs, no `console.log` in `apps/api`.
- Dead or speculative code: modules, services and endpoints with no caller. List them.

---

#### Role 5 — Data & Persistence Reviewer **[CORE]** · prefix `DAT`

_You are the DBA. The schema outlives the code._

- Entity-to-dossier mapping: does every entity in the data model exist, with the relations the
  dossier implies? List extras and omissions.
- **Append-only enforcement for actions and the audit log.** "One action = one row, never
  overwritten" must be enforced by the database — a revoked UPDATE/DELETE grant, a rule, or a
  trigger — not only by the absence of an update method in a service. Application-only
  immutability is S2; if a service exposes `actionRepository.save()` on an existing row, S1.
- Migrations: do they exist for every entity change, do they run clean from an empty database, is
  there a down migration, does `synchronize` appear anywhere outside tests? `synchronize: true`
  against a non-test database is S1.
- Tenant isolation at the data layer: does every tenant-scoped table carry the tenant key, is it
  part of the relevant unique constraints, and is the filter applied centrally (a repository base
  class, a TypeORM subscriber, or Postgres RLS) rather than remembered in each query? A single
  query missing the tenant filter is S1 — list every repository method that builds a query without
  one.
- Indexes for the real access patterns: the duplicate-detection keys (normalised phone, e-mail
  domain, address + postal code, legal identifier/SIRET, name similarity, geolocation), the
  manager dashboard filters (company, team, period, campaign, territory), the follow-up due scan,
  the active-reservation lookup. For each, name the index or report it missing with the query it
  would serve.
- Constraints: foreign keys with the right `ON DELETE`, `NOT NULL` where the domain requires it,
  check constraints on status enums, a unique constraint making a second active reservation on one
  prospect impossible.
- Soft delete vs hard delete: which is used, and does a soft-deleted prospect disappear from the
  duplicate check (it must not).
- Normalised matching keys: are phone, e-mail and address stored normalised in their own columns,
  or normalised on the fly at query time? On-the-fly normalisation defeats the index — S2.
- PostGIS: is it used for the map and proximity assignment, or is distance computed in JavaScript?
- N+1: run the dashboard and the prospect list with TypeORM logging on and count the queries.
  Report the worst offender with its count.

---

#### Role 6 — Security, Tenancy & Compliance Auditor **[CORE]** · prefix `SEC`

_You are the auditor the pilot's legal review will send. Assume an authenticated, curious user
with the lowest role and a browser dev console._

- **Authorisation is enforced server-side on every endpoint**, by role **and** by scope (team,
  company, campaign, territory). A guard that checks the role but not the scope lets a prospector
  of company A read company B's prospects — test it by reasoning through one concrete request and
  report the verdict.
- **IDOR sweep.** For every endpoint taking an id in the path, show where ownership is verified.
  List every endpoint where the object is fetched by id alone.
- **Tenant isolation.** Can any request reach data from another tenant — through a filter
  parameter, a nested relation, a bulk endpoint, an export, a search, or an error message that
  confirms a record exists? This is the one failure that ends the pilot.
- MFA: the dossier specifies a 6-digit e-mail code. Is it implemented, rate-limited, single-use,
  expiring, and not bypassable by hitting the token endpoint directly?
- Session and token handling: where does the JWT live, what is its lifetime, is there a refresh
  flow, can it be revoked, is it in an `httpOnly` cookie or in `localStorage` (the latter is S2
  for a product with this audit surface).
- Password handling: algorithm and cost factor, no hash ever serialised, reset flow does not leak
  account existence.
- **The audit log.** Assignments, exports and overrides must be logged. Verify that each writes an
  entry, that the entry names the actor, the target, the timestamp and the reason where one is
  required, and that nothing in the API can edit or delete an entry. If the log is hash-chained,
  verify the chain recomputes.
- **Opt-out with proof.** Where is an opt-out recorded, what evidence is kept, is it tenant-wide or
  company-wide (the dossier implies the whole group honours it), and is it impossible to bypass —
  re-check this independently of Role 3 and compare conclusions.
- **Exports are role-controlled and logged** (DoD 10). Find the export endpoints and verify both
  halves.
- Rate limiting and brute-force protection on `/auth/*`, throttling on search and export.
- Input surface: SQL injection via raw queries or a `QueryBuilder` with string interpolation,
  path traversal in document upload/download, unrestricted file type or size on import and
  attachments, SSRF in any outbound fetch.
- Headers and transport: helmet, CORS allowlist (not `*`), cookies `Secure`/`SameSite`.
- Dependencies: run `pnpm audit --prod` and report high and critical only, with whether the
  vulnerable path is reachable.
- Data lifecycle and GDPR posture: retention rules, deletion of a person's contact data, European
  hosting assumption visible anywhere in config.

---

#### Role 7 — Frontend Architecture Reviewer · prefix `WEB`

_You are a senior Next.js engineer. The frontend must never be the place where a business rule is
decided._

- Router: app or pages, stated plainly; a coherent route structure for the six roles; route
  grouping and layouts that match the navigation the product defines.
- **No business rule duplicated client-side.** The verdict (BLOCKED / TO VALIDATE / ALLOWED) must
  come from the API. If the frontend recomputes a cooldown, re-implements the brand matrix, or
  decides what a role may see using a local object, that is S1 — the two copies will diverge and
  the client copy is the one an attacker edits. Client-side role checks are allowed **only** for
  hiding UI, never as the enforcement point; verify the server enforces the same thing.
- Server/client component split: is `"use client"` applied deliberately at leaves, or has it crept
  up to the layout? Report the highest `"use client"` in the tree.
- Data layer: one way to call the API, not three. Typed client, errors handled in one place, loading
  and error states that exist for every fetch. Are backend DTOs shared via a workspace package or
  retyped by hand in the frontend? Retyped by hand is S2 — it drifts.
- Caching and revalidation: what is cached, for how long, and is anything cached that must not be
  (a verdict, a lock state, a dashboard a manager refreshes to make a decision).
- The 20-minute reservation timer: is it driven by a server timestamp or by client-side elapsed
  time? Client clocks are wrong — a lock that looks alive to one user and dead to another is S2.
  Is there a heartbeat, and what happens on tab close, sleep, and network loss?
- Forms: the Log-action form must enforce the required fields (channel, outcome, contact person or
  reason, structures presented, summary, next action or closure) client-side **and** be validated
  server-side. Verify both.
- State management: what holds server state, what holds UI state, and is there any global store
  duplicating what the server already owns?
- Optimistic updates: anywhere the UI claims success before the server confirmed — on a reservation
  or an action, that is S2.
- Lists at scale: the establishment list must handle 14,000+ rows. Server-side pagination and
  filtering, or everything fetched and filtered in the browser? The latter is S2.
- Bundle: route-level sizes, anything heavy imported into a shared layout, a map library loaded on
  pages with no map.
- Dead UI: components and pages with no route, duplicated components doing the same job.

---

#### Role 8 — UI, Design System & Accessibility Reviewer · prefix `UID`

_You are the design-system owner. Divergence here is cheap to fix now and expensive in six months._

- Tokens: Navy `#05124A`, Blue `#0F59FA`, Mid blue `#5F92F6`, Pale blue `#A2C0FA`,
  Lime `#A7DC41`, Grey `#D7DCE7`. Typography: Inter Display for titles, Inter for UI.
  Grep for hex literals in the frontend and list every colour used that is not a token, with
  file:line and a count. Same for font-size and spacing literals.
- **Lime is the validation colour.** Flag any use of lime as decoration, as a brand accent, or on
  anything that is not an allowed/validated state.
- Component reuse: one Button, one Badge, one Table, one Modal. List duplicates.
- The key screens against the dossier: **My Day** (to do / follow-ups / meetings / overdue,
  prioritised) · **Establishment record** (owner + campaign, anti-collision status with a Start
  button, last and next action, contacts, documents, timeline — the dossier requires all of it
  **visible without scrolling**; verify at 1440×900 and report) · **Log action** (required and
  optional fields as listed; automatic date, time, author, duration) · **Manager dashboard**
  (assigned, to contact, overdue, collisions avoided, actions per day, team progress).
- Mobile-first: the dossier makes it a principle and DoD 9 requires it. Test at 390 px: horizontal
  overflow, tap targets under 44 px, tables that become unusable, modals taller than the viewport.
- The stated UX budgets: a prospect found in under 10 seconds, a view saved in under 3 clicks, an
  action logged in under a minute. Count the clicks and the required fields for each and say
  whether the budget holds.
- Accessibility at WCAG 2.1 AA: colour contrast for every token pair actually used (check
  lime-on-white and pale-blue-on-white specifically — both are likely failures for text), focus
  visibility, keyboard reachability of the Start / Log action / Approve flows, labels on every
  input, `aria-live` on the verdict and the lock timer, and no state communicated by colour alone —
  BLOCKED must be distinguishable without seeing red.
- Empty, loading, error and offline states for every screen that fetches.
- UI copy: consistent verb for the same action across button, toast and log entry.

---

#### Role 9 — Test & Quality Engineer **[CORE]** · prefix `TST`

_You are the QA lead for a pilot with zero tolerance for collisions._

- Current reality first: number of test files, number of tests, coverage by workspace, and which
  of them actually assert something. Run coverage and report per-module numbers, not one global
  percentage.
- **DoD 12 is explicit: anti-collision must be covered by automated concurrency tests.** Do they
  exist? A concurrency test here means two or more simultaneous claims against one prospect, run
  against a real Postgres, asserting exactly one winner. A test that calls the service twice in
  sequence is not a concurrency test — say so plainly if that is what you find.
- The decision table from Role 3: which rows have a test, which do not. Every untested row that
  can produce `ALLOWED` is S2.
- Test pyramid: unit tests on the engine's pure logic, integration tests on the repositories with
  a real database (testcontainers or a CI service container, not mocked repositories), e2e with
  supertest on the eight priority endpoints.
- Authorisation tests: for each role, at least one test proving it **cannot** reach what it must
  not. Negative tests are the ones that matter here.
- Fixtures and factories: is there a seed that produces the pilot shape (5 structures, several
  teams, a few thousand establishments) so performance and permissions can be tested realistically?
- Test quality smells: mocked repositories that make the test assert the mock, snapshot tests on
  business output, shared mutable state between tests, `skip`/`only` left in, tests depending on
  execution order, tests depending on the real clock (the 20-minute lock must be tested with fake
  timers).
- CI: do tests run on every PR, is a failing test able to block the merge, is coverage reported?
- Backup and restore (DoD 11): is there a documented, tested procedure? If it is not in the repo,
  `NOT FOUND` at S2 — it is on the Definition of Done.

---

#### Role 10 — Performance & Scale Reviewer · prefix `PRF`

_You size for 86 users and 14,000+ establishments, not for the demo._

- The anti-collision check under 1 second: measure it, or state precisely why you cannot and what
  instrumentation is missing.
- The three heaviest read paths: establishment list with filters, manager dashboard, map view.
  For each, the SQL executed, the row count scanned, the indexes used, and whether it paginates.
- The map: how many points reach the browser? Plotting 14,000 markers is S2 — look for clustering,
  server-side aggregation, or viewport-bounded queries.
- Import: 14,000 rows with deduplication — streamed and batched, or loaded into memory and inserted
  one by one? Report the batch size and the transaction strategy.
- Exports: generated in-request or queued; memory profile for the largest plausible export.
- Caching: what Redis is actually used for (the dossier mentions it for locks). Any cache whose
  invalidation is not obvious is a finding.
- A short, honest list of what will break first at 10× the pilot volume.

---

### Phase 2 — Consolidation (Chief Auditor)

1. Merge all findings. Deduplicate: when two roles found the same defect, keep one finding, list
   both roles, keep the highest severity.
2. Resolve contradictions explicitly. If Role 3 says opt-out is safe and Role 6 says it is
   bypassable, re-read the code yourself and state the verdict with evidence. Never ship a report
   that says both.
3. Write the executive summary: the ten things that matter, in plain language, each one sentence,
   each naming its finding ID. A non-engineer must be able to read it.
4. Fill the severity table: count per severity, per role, per workspace.
5. Write the **"Next 10 commits"** section (§4).
6. Finish with a one-paragraph **release-readiness verdict** answering one question: _can this
   codebase run the 3-week pilot (2 managers, 8–12 prospectors, 2 regions, 2 structures) without
   producing a confirmed unauthorised collision?_ Answer yes, no, or not yet — and name the
   findings that decide it.

---

## 6. What a good report is not

- Not a list of style opinions. Prettier handles those; you do not.
- Not a proposal to adopt a new framework, a new ORM, or hexagonal architecture.
- Not 200 S4 nits that bury four S1 blockers.
- Not "consider adding tests". Name the file, the case, and the assertion.
- Not a claim you could not verify. `UNVERIFIED` is a respectable label; a confident wrong finding
  is not.
