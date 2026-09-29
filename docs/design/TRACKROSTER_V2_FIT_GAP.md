# TrackRoster V2 — frontend fit-gap audit

Measured against the approved walkthrough (`docs/design/TRACKROSTER_V2_SCREENS.md`),
the routes present in `apps/web/src/app`, and the API modules that would have to
serve each screen. Nothing here is inferred from a screen's name.

## What the reference file actually is

`TrackRoster-apercu.html` is 3.4 MB, of which **32 KB is markup**. It is a
JavaScript slideshow over **38 embedded WebP screenshots** in two groups —
_Console d'administration_ (22) and _Application des prospecteurs_ (15). There is
no application HTML or CSS in it.

That matters for planning: this is not a port. The visual design can only be read
from images, so every screen is built from the brief's tokens and the existing
design system, and "match the mockup" is a judgement each time rather than a
diff. The second attached file, `TrackRoster_Presentation_Equipe.html`, is a
SheetJS table export — a spreadsheet dump, not a UI reference.

## The structural finding

**V2 has two experiences. The application has five.**

The walkthrough recognises an administration console and a prospector app. The
running application has five workspace modes — `admin`, `director`, `manager`,
`prospector`, `observer` — each with its own navigation, and a `/manager/*` area
of eleven routes that V2 does not mention at all.

V2 puts what `/manager/*` does today (assignment, campaigns, collisions, reports,
team) inside the administration console. Read literally, adopting V2 retires the
manager and director workspaces.

**This is a product decision, not a styling one, and it is the one thing in this
phase that cannot be settled from the repository.** It decides whether eleven
working, tested routes are restyled in place or removed, and whether a
team-scoped manager keeps a workspace at all. Everything else below can proceed
without it; the `/manager/*` rows cannot.

## Admin console — 22 screens

| V2                               | Route in V2          | Existing page                            | API integration                                                                | Decision                                                                                                                       |
| -------------------------------- | -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| a00 Connexion                    | `/login`             | `(auth)/login`                           | auth, MFA, temp-password                                                       | **RESTYLE**                                                                                                                    |
| a01 Vue d'ensemble               | `/admin`             | `/admin/overview`                        | admin dashboard, audit, memberships                                            | **MODIFY** — V2 adds 14-day activity, collisions avoided, per-prospector list completion, sector coverage, data-quality counts |
| a02 En direct                    | `/admin/direct`      | —                                        | reservations + activities exist; no live-session read                          | **MISSING** — needs a backend read for "who is prospecting now"; 30 s refresh                                                  |
| a03 La base de prospects         | `/admin/prospects`   | —                                        | `GET /prospects` exists; **no BFF route, no page**                             | **MISSING** — the largest gap. 14,649 rows, combinable filters, CSV export                                                     |
| a04 Attribuer des établissements | `/admin/prospects`   | `/manager/assignments`                   | `/assignments/preview` + `/bulk` (works, TR-926)                               | **EXTEND** — logic is done; V2 wants it on the prospect base with duration and override-with-reason                            |
| a05 Vue carte                    | `/admin/prospects`   | `/map`                                   | nearby/geo exists                                                              | **EXTEND** — a map exists; V2 wants it as a view of the filtered base                                                          |
| a06 Fiche établissement          | `/admin/prospects/…` | `/work-queue/[c]/[p]`                    | prospect detail, contacts, consents                                            | **EXTEND** — the prospector's detail exists; V2 wants an admin-side fiche                                                      |
| a07 Historique complet           | `/admin/prospects/…` | part of prospect detail                  | activities, timeline                                                           | **EXTEND**                                                                                                                     |
| a08 Script et e-mail de la fiche | `/admin/prospects/…` | —                                        | **no scripts/templates tables**                                                | **BLOCKED** — see below                                                                                                        |
| a09 Demander un complément       | `/admin/prospects/…` | —                                        | `prospect-enrichment` module exists; no web client                             | **MISSING**                                                                                                                    |
| a10 Équipe                       | `/admin/equipe`      | `/admin/users`                           | memberships, roles, grants                                                     | **MODIFY**                                                                                                                     |
| a11 Créer un accès               | `/admin/equipe`      | `(auth)/invite` + admin users            | invitations exist                                                              | **MODIFY**                                                                                                                     |
| a12 Identifiants à transmettre   | `/admin/equipe`      | —                                        | invitation/temp credential flow exists                                         | **MISSING** (screen only)                                                                                                      |
| a13 Activité                     | `/admin/activite`    | `/actions`, `/manager/reports`           | activities, reports                                                            | **MODIFY**                                                                                                                     |
| a14 Messages                     | `/admin/messages`    | `/messages`                              | messaging                                                                      | **RESTYLE**                                                                                                                    |
| a15 Scripts et e-mails           | `/admin/scripts`     | —                                        | **no backend**                                                                 | **BLOCKED**                                                                                                                    |
| a16 Aperçu d'un modèle           | `/admin/scripts`     | —                                        | **no backend**                                                                 | **BLOCKED**                                                                                                                    |
| a17 Entreprises                  | `/admin/entreprises` | —                                        | organizations API + `/api/organizations` BFF exist; **no client, no page**     | **MISSING** — the five entities                                                                                                |
| a18 Règles anti-collision        | `/admin/parametres`  | `/manager/collisions` (read-only centre) | `organization_coordination_policies`, `reservation_rules` exist; no web client | **MISSING** (settings); collision centre is KEEP                                                                               |
| a19 Objectifs et visibilité      | `/admin/parametres`  | —                                        | `objectives`, `outcome-settings` exist; no web client                          | **MISSING**                                                                                                                    |
| a20 Import de données            | `/admin/import`      | `/admin/imports` + `[importId]`          | full import pipeline                                                           | **KEEP** — richer than V2 shows; restyle only                                                                                  |
| a21 Journal d'audit              | `/admin/journal`     | `/admin/audit`                           | audit                                                                          | **RESTYLE**                                                                                                                    |

## Prospector app — 15 screens

13 of 15 are `kind: phone`. The existing prospector screens are responsive but
were designed desktop-first, so this group is mostly a mobile-first restyle over
working integrations rather than new behaviour.

| V2                                            | Existing page              | Decision                                                      |
| --------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| m00/m01 Préparer sa session, Session terrain  | `/` (Today)                | **EXTEND** — session/objective setup is TR-927, not built     |
| m02 La tournée du jour                        | `/` + `/routes`            | **MODIFY**                                                    |
| m03 Carte de la tournée                       | `/map`, `/routes/[id]`     | **MODIFY**                                                    |
| m04 Horaires de passage                       | `/routes/[routeId]`        | **MODIFY**                                                    |
| m05 Fiche et feu vert                         | `/work-queue/[c]/[p]`      | **KEEP** + restyle — reservation/consent gate already correct |
| m06 Script personnalisé                       | —                          | **BLOCKED**                                                   |
| m07 E-mail personnalisé                       | —                          | **BLOCKED**                                                   |
| m08/m09 Enregistrer le résultat, compte rendu | `/actions`, action panel   | **KEEP** + restyle — configurable outcomes work               |
| m10 Mes relances                              | `/follow-ups`              | **RESTYLE**                                                   |
| m11 Mon historique                            | `/work-queue`, activities  | **MODIFY**                                                    |
| m12 Messages                                  | `/messages`                | **RESTYLE**                                                   |
| p00/p01 Desktop journée, fiche latérale       | `/`, `/work-queue/[c]/[p]` | **RESTYLE**                                                   |

## Blocked: scripts and e-mail templates

Four V2 screens (a08, a15, a16, m06, m07) depend on per-campaign and
per-establishment prospecting scripts and e-mail models. **No such table exists.**
`grep` for a `pgTable` whose name contains `script` or `template` across
`apps/api/src/database/schema` returns nothing; the `messaging` and
`communications` modules carry conversations and sent messages, not authored
models.

The brief states the backend is not being rebuilt in this phase. These screens
therefore cannot be built against anything, and a frontend that stored scripts in
React state would be a demo. They are the previously-recorded TR-928/TR-929 work
and belong in a backend ticket first.

## Not in V2, working today

`/director/overview`, `/manager/approvals` (+ detail), `/manager/assignments/active`,
`/manager/campaigns` (+ detail), `/manager/exports`, `/manager/team`,
`/manager/overview`, `/manager/reports`, `/manager/collisions`, `/search`,
`/profile`, `/admin/campaigns` (TR-925 enrolment), `/work-queue`.

None of these should be deleted on the strength of an absence from a walkthrough.
`/admin/campaigns` in particular is the enrolment step V2's a04 depends on, and
`/search`, `/profile` and the approvals flow are live features. They are **HIDE
candidates at most**, and only once the two-experience question above is answered.

## Sequencing

Ordered by what unblocks the most and what the beta needs.

1. **The référentiel screen (a03) + its BFF route.** Nothing in the admin console
   works without the prospect base, and a04, a05, a06 and a09 are all views of it.
   `GET /prospects` already serves it.
2. **V2 design tokens in the existing design system**, then a21, a14, a20, a00 —
   pure restyles over working integrations, which proves the token work on real
   screens cheaply.
3. **a01 Vue d'ensemble** to the V2 composition.
4. **a17 Entreprises**, **a18/a19 Paramètres** — backend exists, no web client.
5. **a02 En direct** — needs a backend read defined first.
6. **Prospector mobile-first pass** (m02–m12).
7. **Scripts and e-mails** after the backend ticket.

## What I am not doing

Thirty-seven screens, several needing new BFF routes and clients and two needing a
backend that does not exist, is not one change. Starting to restyle the shell
before the two-experience question is settled would mean rebuilding whichever half
turns out to be wrong.
