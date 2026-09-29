# Admin screen coverage

The supplied `TrackRoster-apercu (1).html` describes 22 administrator states. The
web application now exposes each state as a reachable route. The routes below
reuse the same guarded page components where the presentation is a different
entry point into an existing workflow; this keeps authorization, loading states,
mutations, and error handling on the API-backed implementation rather than
duplicating it in a static mock screen.

| Reference state              | Route                                         | Backend-backed workflow                                             |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Connexion                    | `/login`                                      | Authentication, MFA challenge, and session bootstrap                |
| Vue d’ensemble               | `/admin/overview`                             | Admin and manager dashboard APIs                                    |
| En direct                    | `/admin/direct`                               | Started actions, active reservations, routes, and live refresh      |
| La base de prospects         | `/admin/prospects`                            | Scoped prospect list, filtering, selection, and assignment preview  |
| Attribuer des établissements | `/admin/prospects/assign`                     | Bulk assignment preview and commit APIs                             |
| Vue carte                    | `/admin/prospects/map`                        | Authorized viewport map and nearby/map APIs                         |
| Fiche établissement          | `/admin/prospects/:prospectId`                | Prospect detail, addresses, contacts, consent, and campaign context |
| Historique complet           | `/admin/prospects/:prospectId/history`        | Prospect timeline and activity history                              |
| Script et e-mail             | `/admin/prospects/:prospectId/script`         | Detail workspace and script/email actions                           |
| Demander un complément       | `/admin/prospects/:prospectId/complement`     | Detail workspace and follow-up/message actions                      |
| Équipe                       | `/admin/equipe`                               | Membership list, roles, scopes, and access mutations                |
| Créer un accès               | `/admin/equipe/nouveau-membre`                | Invitation drawer and membership creation API                       |
| Identifiants à transmettre   | `/admin/equipe/identifiants`                  | Invitation status and resend-invite API                             |
| Activité                     | `/admin/activite`                             | Action history, filters, and action detail APIs                     |
| Messages                     | `/admin/messages`                             | Conversations, participants, messages, read/mute, and attachments   |
| Scripts et e-mails           | `/admin/scripts`                              | Script/template CRUD and preview data                               |
| Aperçu d’un modèle           | `/admin/scripts/preview`                      | Script/template preview and edit flow                               |
| Entreprises                  | `/admin/entreprises`                          | Organization list, detail, create, edit, and deactivate APIs        |
| Règles anti-collision        | `/admin/parametres?section=reservation-rules` | Reservation and collision settings                                  |
| Objectifs et visibilité      | `/admin/parametres?section=objectives`        | Objectives and visibility configuration                             |
| Import de données            | `/admin/import`                               | Import upload, mapping, validation, issue, and commit APIs          |
| Journal d’audit              | `/admin/journal`                              | Audit event list, detail, and compliance APIs                       |

All aliases still render `AdminGuard` through their target page. They therefore
inherit the active tenant, permission checks, request-scoped API calls, and
server error handling. No reference screen is backed by hard-coded production
data; development-only message fixtures remain isolated to the non-production
messaging fallback documented in the messaging client.
