# TrackRoster API Build List

Base URL: `/api/v1`

This is the backend surface required by the TrackRoster product specification, six-role permission model and database architecture.

## 1. API rules

- Build one resource-based API, not a separate duplicated API for each role.
- Roles: `super_admin`, `tenant_admin`, `director`, `manager`, `prospector`, `auditor`.
- Resolve `tenant_id`, membership and effective scope from the authenticated session. Never trust a client-supplied tenant identifier for tenant APIs.
- All list endpoints use cursor pagination, filtering and stable sorting.
- Mutating business endpoints accept `Idempotency-Key`.
- Store timestamps in UTC and return ISO 8601 values with timezone.
- Enforce tenant isolation with PostgreSQL RLS plus application authorization.
- Audit assignments, exports, overrides, role/scope changes, merges, consent/opposition and security actions.
- Completed actions and audit evidence are append-only; corrections create new events.

Priority:

- **P0**: required for the operational MVP.
- **P1**: required for the complete designed product and all six roles.
- **P2**: SaaS/platform expansion.

## 2. Authentication and personal account — P0

| Method | Endpoint                              | Purpose                                                           |
| ------ | ------------------------------------- | ----------------------------------------------------------------- |
| POST   | `/auth/login`                         | Authenticate and issue access/refresh tokens or an MFA challenge. |
| POST   | `/auth/refresh`                       | Rotate refresh token and issue a new access token.                |
| POST   | `/auth/logout`                        | Revoke the current session.                                       |
| POST   | `/auth/password/forgot`               | Send a privacy-safe reset message.                                |
| POST   | `/auth/password/reset`                | Validate reset token and set a new password.                      |
| POST   | `/auth/mfa/enroll`                    | Start MFA enrollment and return QR/setup data.                    |
| POST   | `/auth/mfa/verify`                    | Verify MFA during login or enrollment.                            |
| POST   | `/auth/mfa/recovery`                  | Authenticate with a single-use recovery code.                     |
| POST   | `/auth/mfa/recovery-codes/regenerate` | Replace recovery codes after re-authentication.                   |
| DELETE | `/auth/mfa`                           | Disable MFA after step-up authentication.                         |
| POST   | `/invitations/{token}/accept`         | Accept a tenant invitation and activate membership.               |
| GET    | `/me`                                 | Return identity, active membership, role and workspace.           |
| PATCH  | `/me`                                 | Update name, phone, avatar metadata, locale and timezone.         |
| GET    | `/me/memberships`                     | List available workspaces and roles.                              |
| POST   | `/me/active-membership`               | Switch active workspace/membership and issue refreshed claims.    |
| GET    | `/me/permissions`                     | Return effective permissions and scope.                           |
| GET    | `/me/sessions`                        | List active web/mobile sessions.                                  |
| DELETE | `/me/sessions/{sessionId}`            | Revoke one session.                                               |
| DELETE | `/me/sessions/others`                 | Revoke all sessions except the current one.                       |
| GET    | `/me/preferences`                     | Read personal UI, locale and accessibility preferences.           |
| PATCH  | `/me/preferences`                     | Update personal preferences.                                      |

## 3. Tenant, users, roles and scope — P0

| Method | Endpoint                                     | Purpose                                                    |
| ------ | -------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/tenant`                                    | Read current tenant settings.                              |
| PATCH  | `/tenant`                                    | Update tenant name, locale, timezone and allowed settings. |
| GET    | `/memberships`                               | List users/memberships by role, status, team or scope.     |
| POST   | `/memberships`                               | Invite a user with role and initial scope.                 |
| GET    | `/memberships/{membershipId}`                | Read user, role, capacity, teams and effective scope.      |
| PATCH  | `/memberships/{membershipId}`                | Change role, status or capacity.                           |
| POST   | `/memberships/{membershipId}/resend-invite`  | Resend invitation.                                         |
| POST   | `/memberships/{membershipId}/suspend`        | Suspend tenant access with reason.                         |
| POST   | `/memberships/{membershipId}/reactivate`     | Reactivate suspended access.                               |
| GET    | `/roles`                                     | List the six supported roles and descriptions.             |
| GET    | `/permissions`                               | List atomic permissions.                                   |
| GET    | `/roles/{role}/permissions`                  | Read default role permissions.                             |
| PUT    | `/roles/{role}/permissions`                  | Update configurable tenant-role permissions where allowed. |
| GET    | `/memberships/{membershipId}/scopes`         | List organization/team/territory/campaign scope rules.     |
| POST   | `/memberships/{membershipId}/scopes`         | Add a scoped grant/restriction.                            |
| PATCH  | `/membership-scopes/{scopeId}`               | Change a scope rule.                                       |
| DELETE | `/membership-scopes/{scopeId}`               | Remove a scope rule.                                       |
| GET    | `/memberships/{membershipId}/access-history` | Read immutable role and scope history.                     |

## 4. Organizations and teams — P0

| Method | Endpoint                                       | Purpose                                           |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| GET    | `/organizations`                               | List organizations in effective scope.            |
| POST   | `/organizations`                               | Create an organization/brand.                     |
| GET    | `/organizations/{organizationId}`              | Read details and summary.                         |
| PATCH  | `/organizations/{organizationId}`              | Update mutable organization data.                 |
| DELETE | `/organizations/{organizationId}`              | Soft-delete/deactivate organization.              |
| GET    | `/organization-relationships`                  | List parent/child and coordination relationships. |
| POST   | `/organization-relationships`                  | Create a relationship.                            |
| DELETE | `/organization-relationships/{relationshipId}` | End a relationship.                               |
| GET    | `/teams`                                       | List teams in effective scope.                    |
| POST   | `/teams`                                       | Create a team.                                    |
| GET    | `/teams/{teamId}`                              | Read team, manager, capacity and summary.         |
| PATCH  | `/teams/{teamId}`                              | Update name, manager or capacity.                 |
| DELETE | `/teams/{teamId}`                              | Deactivate team.                                  |
| GET    | `/teams/{teamId}/members`                      | List active and historical team members.          |
| POST   | `/teams/{teamId}/members`                      | Add a tenant membership to team.                  |
| PATCH  | `/teams/{teamId}/members/{membershipId}`       | Change team role/effective dates.                 |
| DELETE | `/teams/{teamId}/members/{membershipId}`       | End team membership.                              |
| GET    | `/teams/{teamId}/capacity`                     | Return workload, capacity and allocation room.    |

## 5. Territories and map data — P0/P1

| Priority | Method | Endpoint                                | Purpose                                                   |
| -------- | ------ | --------------------------------------- | --------------------------------------------------------- |
| P0       | GET    | `/territories`                          | List scoped territory hierarchy.                          |
| P0       | POST   | `/territories`                          | Create territory with optional PostGIS boundary.          |
| P0       | GET    | `/territories/{territoryId}`            | Read territory and geometry.                              |
| P0       | PATCH  | `/territories/{territoryId}`            | Update metadata, hierarchy or geometry.                   |
| P0       | DELETE | `/territories/{territoryId}`            | Deactivate territory.                                     |
| P0       | GET    | `/territories/map`                      | Return map-ready GeoJSON boundaries and centers.          |
| P0       | GET    | `/territory-assignments`                | List user/team territorial responsibility.                |
| P0       | POST   | `/territory-assignments`                | Assign territory to team/user.                            |
| P0       | PATCH  | `/territory-assignments/{assignmentId}` | Change priority/effective dates.                          |
| P0       | DELETE | `/territory-assignments/{assignmentId}` | End responsibility.                                       |
| P0       | GET    | `/prospects/map`                        | Return scoped, clustered map markers and status summary.  |
| P1       | GET    | `/prospects/nearby`                     | Return authorized prospects within radius of coordinates. |
| P1       | GET    | `/map/heatmap`                          | Return aggregate activity/conversion heat layer.          |
| P1       | GET    | `/map/coverage`                         | Return aggregate coverage layer by territory.             |

## 6. Campaigns — P0

| Method | Endpoint                                                 | Purpose                                |
| ------ | -------------------------------------------------------- | -------------------------------------- |
| GET    | `/campaigns`                                             | List visible campaigns.                |
| POST   | `/campaigns`                                             | Create draft campaign.                 |
| GET    | `/campaigns/{campaignId}`                                | Read configuration, scope and summary. |
| PATCH  | `/campaigns/{campaignId}`                                | Update editable campaign fields.       |
| DELETE | `/campaigns/{campaignId}`                                | Archive campaign.                      |
| POST   | `/campaigns/{campaignId}/status`                         | Activate, pause, complete or archive.  |
| GET    | `/campaigns/{campaignId}/organizations`                  | List participating organizations.      |
| POST   | `/campaigns/{campaignId}/organizations`                  | Add organization and access mode.      |
| PATCH  | `/campaigns/{campaignId}/organizations/{organizationId}` | Change access mode.                    |
| DELETE | `/campaigns/{campaignId}/organizations/{organizationId}` | Remove organization.                   |
| GET    | `/campaigns/{campaignId}/territories`                    | List included territories.             |
| POST   | `/campaigns/{campaignId}/territories`                    | Add territory.                         |
| DELETE | `/campaigns/{campaignId}/territories/{territoryId}`      | Remove territory.                      |
| GET    | `/campaigns/{campaignId}/members`                        | List participating users/teams.        |
| POST   | `/campaigns/{campaignId}/members`                        | Add user/team.                         |
| PATCH  | `/campaign-members/{campaignMemberId}`                   | Change campaign role.                  |
| DELETE | `/campaign-members/{campaignMemberId}`                   | Remove participant.                    |

## 7. Prospects, contacts and data quality — P0

| Method | Endpoint                                     | Purpose                                                     |
| ------ | -------------------------------------------- | ----------------------------------------------------------- |
| GET    | `/prospects`                                 | Search, filter, sort and paginate scoped prospects.         |
| POST   | `/prospects`                                 | Create prospect.                                            |
| GET    | `/prospects/{prospectId}`                    | Read full authorized prospect record.                       |
| PATCH  | `/prospects/{prospectId}`                    | Update mutable master data.                                 |
| DELETE | `/prospects/{prospectId}`                    | Soft-delete/archive prospect.                               |
| POST   | `/prospects/{prospectId}/restore`            | Restore archived prospect where allowed.                    |
| GET    | `/prospects/{prospectId}/timeline`           | Unified action, assignment, status and reservation history. |
| GET    | `/prospects/{prospectId}/addresses`          | List sites/locations.                                       |
| POST   | `/prospects/{prospectId}/addresses`          | Add/geocode address.                                        |
| PATCH  | `/prospect-addresses/{addressId}`            | Update location/primary flag.                               |
| DELETE | `/prospect-addresses/{addressId}`            | Remove address.                                             |
| GET    | `/prospects/{prospectId}/contacts`           | List contacts.                                              |
| POST   | `/prospects/{prospectId}/contacts`           | Add contact.                                                |
| PATCH  | `/prospect-contacts/{contactId}`             | Update contact.                                             |
| DELETE | `/prospect-contacts/{contactId}`             | Soft-delete contact.                                        |
| GET    | `/prospects/{prospectId}/consents`           | Read consent/opposition history.                            |
| POST   | `/prospects/{prospectId}/consents`           | Append consent, opposition or channel-block evidence.       |
| GET    | `/tags`                                      | List tags.                                                  |
| POST   | `/tags`                                      | Create tag.                                                 |
| PATCH  | `/tags/{tagId}`                              | Update tag.                                                 |
| DELETE | `/tags/{tagId}`                              | Delete unused tag.                                          |
| POST   | `/prospects/{prospectId}/tags/{tagId}`       | Tag prospect.                                               |
| DELETE | `/prospects/{prospectId}/tags/{tagId}`       | Remove tag.                                                 |
| GET    | `/custom-fields`                             | List custom-field definitions.                              |
| POST   | `/custom-fields`                             | Create definition.                                          |
| PATCH  | `/custom-fields/{fieldId}`                   | Update validation/visibility.                               |
| DELETE | `/custom-fields/{fieldId}`                   | Deactivate field.                                           |
| PUT    | `/prospects/{prospectId}/custom-fields`      | Batch upsert field values.                                  |
| GET    | `/prospect-duplicates`                       | List candidate/resolved duplicates.                         |
| GET    | `/prospect-duplicates/{duplicateId}`         | Compare records and match evidence.                         |
| POST   | `/prospect-duplicates/{duplicateId}/resolve` | Reject candidate or merge transactionally.                  |
| GET    | `/data-quality/overview`                     | Return completeness, validity and duplicate metrics.        |

## 8. Imports — P0

| Method | Endpoint                       | Purpose                                     |
| ------ | ------------------------------ | ------------------------------------------- |
| GET    | `/imports`                     | List import jobs.                           |
| POST   | `/imports`                     | Create import job/upload session.           |
| GET    | `/imports/{importId}`          | Read step, mapping and counts.              |
| POST   | `/imports/{importId}/file`     | Attach uploaded CSV/XLSX.                   |
| PUT    | `/imports/{importId}/mapping`  | Save column mapping/normalization.          |
| POST   | `/imports/{importId}/validate` | Parse, normalize, deduplicate and validate. |
| GET    | `/imports/{importId}/rows`     | Paginate staged rows.                       |
| GET    | `/imports/{importId}/issues`   | List errors/warnings/duplicates.            |
| PATCH  | `/import-issues/{issueId}`     | Save manual resolution.                     |
| POST   | `/imports/{importId}/commit`   | Atomically import valid/resolved rows.      |
| POST   | `/imports/{importId}/cancel`   | Cancel unfinished import.                   |
| GET    | `/imports/{importId}/report`   | Download final processing report.           |

## 9. Assignments and workload — P0

| Method | Endpoint                               | Purpose                                                   |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| GET    | `/assignments`                         | List assignments by campaign/team/user/status.            |
| GET    | `/assignments/unassigned`              | Return scoped unassigned prospect queue.                  |
| POST   | `/assignments/preview`                 | Preview conflicts, capacity and impact before assignment. |
| POST   | `/assignments`                         | Assign one prospect.                                      |
| POST   | `/assignments/bulk`                    | Assign a selected lot transactionally.                    |
| GET    | `/assignments/{assignmentId}`          | Read ownership and history.                               |
| PATCH  | `/assignments/{assignmentId}`          | Change priority or open status.                           |
| POST   | `/assignments/{assignmentId}/reassign` | End current ownership and create replacement.             |
| POST   | `/assignments/{assignmentId}/complete` | Complete assignment.                                      |
| POST   | `/assignments/{assignmentId}/revoke`   | Revoke with reason.                                       |
| GET    | `/assignment-suggestions`              | Return capacity/proximity/skill recommendations.          |

## 10. Reservations, collisions and overrides — P0 critical

| Method | Endpoint                                           | Purpose                                                                  |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/reservation-rules`                               | List locking and cooldown rules.                                         |
| POST   | `/reservation-rules`                               | Create rule.                                                             |
| GET    | `/reservation-rules/{ruleId}`                      | Read rule.                                                               |
| PATCH  | `/reservation-rules/{ruleId}`                      | Update duration/cooldown/override policy.                                |
| DELETE | `/reservation-rules/{ruleId}`                      | Deactivate rule.                                                         |
| POST   | `/reservations/check`                              | Return allowed, blocked or manager-validation decision without claiming. |
| GET    | `/reservations`                                    | List scoped reservations.                                                |
| POST   | `/reservations/claim`                              | Atomically check and claim prospect.                                     |
| GET    | `/reservations/{reservationId}`                    | Read owner, token and expiry.                                            |
| POST   | `/reservations/{reservationId}/heartbeat`          | Keep an active allowed reservation alive.                                |
| POST   | `/reservations/{reservationId}/release`            | Release owned reservation.                                               |
| POST   | `/reservations/{reservationId}/extend`             | Extend when policy allows.                                               |
| GET    | `/collision-events`                                | List detected conflicts.                                                 |
| GET    | `/collision-events/{collisionId}`                  | Read rule evaluation and decision.                                       |
| POST   | `/collision-events/{collisionId}/override-request` | Request manager exception.                                               |
| GET    | `/override-requests`                               | List pending/decided requests.                                           |
| GET    | `/override-requests/{requestId}`                   | Read request and policy context.                                         |
| POST   | `/override-requests/{requestId}/approve`           | Approve and execute override transaction.                                |
| POST   | `/override-requests/{requestId}/reject`            | Reject with immutable reason.                                            |
| POST   | `/override-requests/{requestId}/cancel`            | Cancel own pending request.                                              |

## 11. Actions, outcomes and follow-ups — P0

| Method | Endpoint                            | Purpose                                                              |
| ------ | ----------------------------------- | -------------------------------------------------------------------- |
| GET    | `/dashboard/today`                  | Prospector priorities, follow-ups, meetings and route summary.       |
| GET    | `/actions`                          | List scoped actions.                                                 |
| POST   | `/actions`                          | Create planned call/email/visit/message/task/note.                   |
| GET    | `/actions/{actionId}`               | Read action, outcome and history.                                    |
| PATCH  | `/actions/{actionId}`               | Update an open action only.                                          |
| POST   | `/actions/{actionId}/start`         | Start action after authorization/collision check.                    |
| POST   | `/actions/{actionId}/complete`      | Atomically store outcome, status, follow-up and reservation changes. |
| POST   | `/actions/{actionId}/cancel`        | Cancel open action with reason.                                      |
| GET    | `/actions/{actionId}/events`        | Read immutable action event stream.                                  |
| POST   | `/actions/{actionId}/corrections`   | Append a reasoned correction event.                                  |
| GET    | `/follow-ups`                       | List due/completed/missed/cancelled follow-ups.                      |
| GET    | `/follow-ups/{followUpId}`          | Read source and next action.                                         |
| PATCH  | `/follow-ups/{followUpId}`          | Reschedule/update open follow-up.                                    |
| POST   | `/follow-ups/{followUpId}/complete` | Complete follow-up.                                                  |
| POST   | `/follow-ups/{followUpId}/cancel`   | Cancel with reason.                                                  |

`POST /actions/{actionId}/complete` must accept the outcome, notes, contact updates, explicit prospect status change, optional next follow-up and reservation disposition in one idempotent transaction.

## 12. Routes and field rounds — P1

| Method | Endpoint                       | Purpose                                   |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | `/routes`                      | List own or scoped team routes.           |
| POST   | `/routes`                      | Create field round.                       |
| GET    | `/routes/{routeId}`            | Read route, metrics and ordered stops.    |
| PATCH  | `/routes/{routeId}`            | Update draft/status/endpoints.            |
| DELETE | `/routes/{routeId}`            | Cancel draft route.                       |
| POST   | `/routes/{routeId}/stops`      | Add prospect/action stop.                 |
| PATCH  | `/route-stops/{stopId}`        | Update position, ETA, arrival or outcome. |
| DELETE | `/route-stops/{stopId}`        | Remove stop.                              |
| PUT    | `/routes/{routeId}/stop-order` | Reorder stops.                            |
| POST   | `/routes/{routeId}/optimize`   | Calculate optimized order and distance.   |
| POST   | `/routes/{routeId}/start`      | Start route.                              |
| POST   | `/routes/{routeId}/complete`   | Complete route.                           |

## 13. Messaging and attachments — P1

| Method | Endpoint                                                      | Purpose                                            |
| ------ | ------------------------------------------------------------- | -------------------------------------------------- |
| GET    | `/conversations`                                              | List conversations where user participates.        |
| POST   | `/conversations`                                              | Create direct/team/prospect/campaign conversation. |
| GET    | `/conversations/{conversationId}`                             | Read context and participants.                     |
| PATCH  | `/conversations/{conversationId}`                             | Rename/archive where authorized.                   |
| GET    | `/conversations/{conversationId}/participants`                | List participants/read state.                      |
| POST   | `/conversations/{conversationId}/participants`                | Add participant.                                   |
| DELETE | `/conversations/{conversationId}/participants/{membershipId}` | Remove participant.                                |
| GET    | `/conversations/{conversationId}/messages`                    | Paginate messages.                                 |
| POST   | `/conversations/{conversationId}/messages`                    | Send human message or contextual card.             |
| PATCH  | `/messages/{messageId}`                                       | Edit authorized human message.                     |
| DELETE | `/messages/{messageId}`                                       | Soft-delete authorized human message.              |
| POST   | `/conversations/{conversationId}/read`                        | Advance read timestamp.                            |
| PATCH  | `/conversations/{conversationId}/mute`                        | Set/clear mute duration.                           |
| POST   | `/uploads/presign`                                            | Create authorized object-storage upload.           |
| POST   | `/messages/{messageId}/attachments`                           | Attach uploaded file metadata.                     |
| GET    | `/attachments/{attachmentId}/download`                        | Return short-lived download URL.                   |

## 14. Notifications — P0 basic / P1 complete

| Priority | Method | Endpoint                               | Purpose                                               |
| -------- | ------ | -------------------------------------- | ----------------------------------------------------- |
| P0       | GET    | `/notifications`                       | List notifications by severity/read state.            |
| P0       | GET    | `/notifications/unread-count`          | Return sidebar unread count.                          |
| P0       | POST   | `/notifications/{notificationId}/read` | Mark one read.                                        |
| P0       | POST   | `/notifications/read-all`              | Mark matching notifications read.                     |
| P1       | GET    | `/notification-preferences`            | Read event/channel preferences.                       |
| P1       | PUT    | `/notification-preferences`            | Update preferences while preserving mandatory alerts. |
| P1       | POST   | `/devices`                             | Register push-notification device.                    |
| P1       | DELETE | `/devices/{deviceId}`                  | Revoke push device.                                   |

## 15. Dashboards, reports, objectives and forecasts — P0/P1

Shared report filters: `from`, `to`, `organizationId`, `teamId`, `territoryId`, `campaignId`, `managerId`, `prospectorId`.

| Priority | Method | Endpoint                                     | Purpose                                                         |
| -------- | ------ | -------------------------------------------- | --------------------------------------------------------------- |
| P0       | GET    | `/dashboard/manager`                         | Team workload, exceptions, performance and territory summary.   |
| P0       | GET    | `/dashboard/admin`                           | Workspace readiness, adoption, alerts and data-quality summary. |
| P1       | GET    | `/dashboard/director`                        | Executive KPIs, objective risks and organization comparison.    |
| P2       | GET    | `/platform/dashboard`                        | Super Admin tenant/service health summary.                      |
| P0       | GET    | `/reports/overview`                          | Authorized summary KPIs.                                        |
| P0       | GET    | `/reports/workload`                          | Portfolio load/capacity/backlog.                                |
| P0       | GET    | `/reports/actions`                           | Activity by date/channel/type.                                  |
| P0       | GET    | `/reports/funnel`                            | Assigned-to-converted funnel.                                   |
| P0       | GET    | `/reports/conversions`                       | Contact, qualification and conversion rates.                    |
| P0       | GET    | `/reports/follow-ups`                        | Timeliness and overdue metrics.                                 |
| P0       | GET    | `/reports/coverage`                          | Assigned prospect coverage.                                     |
| P0       | GET    | `/reports/collisions`                        | Prevented collisions and overrides.                             |
| P0       | GET    | `/reports/data-quality`                      | Completeness/enrichment metrics.                                |
| P1       | GET    | `/reports/territories`                       | Geographic performance aggregates.                              |
| P1       | GET    | `/reports/forecast`                          | Forecast with confidence and assumptions.                       |
| P1       | GET    | `/objectives`                                | List objectives in scope.                                       |
| P1       | POST   | `/objectives`                                | Create objective (Admin/authorized Manager).                    |
| P1       | GET    | `/objectives/{objectiveId}`                  | Read target, actual, history and contributing metrics.          |
| P1       | PATCH  | `/objectives/{objectiveId}`                  | Update future/editable target definition.                       |
| P1       | GET    | `/objectives/at-risk`                        | Return risk-ranked objectives.                                  |
| P1       | GET    | `/report-definitions`                        | List standard report definitions and metric metadata.           |
| P1       | GET    | `/reports/{reportId}`                        | Run/read a detailed report with reproducible filters.           |
| P1       | GET    | `/scheduled-reports`                         | List personal/authorized schedules.                             |
| P1       | POST   | `/scheduled-reports`                         | Create schedule.                                                |
| P1       | PATCH  | `/scheduled-reports/{scheduleId}`            | Update recipients/cadence/format.                               |
| P1       | DELETE | `/scheduled-reports/{scheduleId}`            | Delete schedule.                                                |
| P1       | GET    | `/scheduled-reports/{scheduleId}/deliveries` | Read generation/delivery history.                               |

## 16. Saved views and exports — P0/P1

| Priority | Method | Endpoint                       | Purpose                                                  |
| -------- | ------ | ------------------------------ | -------------------------------------------------------- |
| P0       | GET    | `/saved-views`                 | List personal/shared views.                              |
| P0       | POST   | `/saved-views`                 | Save filters, sort and columns.                          |
| P0       | PATCH  | `/saved-views/{viewId}`        | Rename/update/default view.                              |
| P0       | DELETE | `/saved-views/{viewId}`        | Delete owned view.                                       |
| P0       | POST   | `/exports/preview`             | Validate scope, fields, estimate rows and show warnings. |
| P0       | GET    | `/exports`                     | List authorized export jobs.                             |
| P0       | POST   | `/exports`                     | Request audited asynchronous CSV/XLSX export.            |
| P0       | GET    | `/exports/{exportId}`          | Poll status/expiry.                                      |
| P0       | POST   | `/exports/{exportId}/cancel`   | Cancel queued export.                                    |
| P0       | GET    | `/exports/{exportId}/download` | Issue short-lived authorized download.                   |
| P1       | GET    | `/exports/{exportId}/audit`    | Read requester, scope and download evidence.             |

## 17. Audit, Observer/Auditor and compliance — P1

All endpoints are read-only except creating an audited evidence export or access-review workflow.

| Method | Endpoint                                  | Purpose                                                   |
| ------ | ----------------------------------------- | --------------------------------------------------------- |
| GET    | `/audit/events`                           | Search immutable audit events within effective scope.     |
| GET    | `/audit/events/{eventId}`                 | Read before/after, actor, integrity and chain of custody. |
| GET    | `/audit/overview`                         | Evidence volume, coverage and sensitive-event summary.    |
| GET    | `/audit/assignments`                      | Assignment history evidence.                              |
| GET    | `/audit/assignments/{assignmentId}`       | Assignment ownership timeline.                            |
| GET    | `/audit/overrides`                        | Override register.                                        |
| GET    | `/audit/overrides/{overrideId}`           | Full conflict/request/decision evidence.                  |
| GET    | `/audit/collisions`                       | Collision decision register.                              |
| GET    | `/audit/collisions/{collisionId}`         | Inputs, policy version and server decision.               |
| GET    | `/audit/exports`                          | Export evidence register.                                 |
| GET    | `/audit/exports/{exportId}`               | Scope, fields, checksum and download history.             |
| GET    | `/audit/users/{membershipId}/access`      | Effective access and privileged-event history.            |
| GET    | `/audit/security-events`                  | Login, MFA, session and privilege security events.        |
| GET    | `/audit/security-events/{eventId}`        | Full security evidence timeline.                          |
| GET    | `/audit/data-changes`                     | Sensitive prospect/import/consent/merge changes.          |
| GET    | `/audit/retention`                        | Retention versions, runs, legal holds and exceptions.     |
| POST   | `/audit/evidence-exports`                 | Request scoped, redacted, audited evidence package.       |
| GET    | `/audit/evidence-exports/{exportId}`      | Poll/download signed evidence package.                    |
| GET    | `/access-reviews`                         | List access-review periods.                               |
| POST   | `/access-reviews`                         | Start review (Tenant Admin only).                         |
| GET    | `/access-reviews/{reviewId}`              | Read progress and evidence.                               |
| GET    | `/access-reviews/{reviewId}/memberships`  | List reviewed users/scopes.                               |
| POST   | `/access-reviews/{reviewId}/decisions`    | Record reviewer decision (authorized reviewer).           |
| POST   | `/access-reviews/{reviewId}/complete`     | Seal completed review.                                    |
| GET    | `/compliance-reports`                     | List report definitions/generated reports.                |
| POST   | `/compliance-reports`                     | Generate versioned compliance report.                     |
| GET    | `/compliance-reports/{reportId}`          | Read parameters/evidence set.                             |
| GET    | `/compliance-reports/{reportId}/download` | Download signed report.                                   |

## 18. Integrations, API clients and webhooks — P1

| Method | Endpoint                                 | Purpose                              |
| ------ | ---------------------------------------- | ------------------------------------ |
| GET    | `/integrations`                          | List connected providers and health. |
| POST   | `/integrations/{provider}/connect`       | Start OAuth/provider authorization.  |
| GET    | `/integrations/{provider}/callback`      | Complete provider authorization.     |
| POST   | `/integrations/{integrationId}/test`     | Test connection.                     |
| POST   | `/integrations/{integrationId}/sync`     | Trigger sync.                        |
| DELETE | `/integrations/{integrationId}`          | Revoke/disconnect.                   |
| GET    | `/api-clients`                           | List scoped clients without secrets. |
| POST   | `/api-clients`                           | Create client; return secret once.   |
| PATCH  | `/api-clients/{clientId}`                | Update scopes/name/expiry.           |
| POST   | `/api-clients/{clientId}/rotate-secret`  | Rotate secret.                       |
| DELETE | `/api-clients/{clientId}`                | Revoke client.                       |
| GET    | `/webhooks`                              | List webhook subscriptions.          |
| POST   | `/webhooks`                              | Create signed subscription.          |
| PATCH  | `/webhooks/{webhookId}`                  | Update endpoint/events/status.       |
| DELETE | `/webhooks/{webhookId}`                  | Remove webhook.                      |
| POST   | `/webhooks/{webhookId}/test`             | Send test event.                     |
| GET    | `/webhooks/{webhookId}/deliveries`       | List delivery attempts.              |
| GET    | `/webhook-deliveries/{deliveryId}`       | Read sanitized request/response.     |
| POST   | `/webhook-deliveries/{deliveryId}/retry` | Retry failed delivery.               |

## 19. Super Admin platform APIs — P2

These APIs use a separate platform authorization boundary and do not grant routine tenant business-data access.

| Method | Endpoint                                            | Purpose                                       |
| ------ | --------------------------------------------------- | --------------------------------------------- |
| GET    | `/platform/tenants`                                 | Search tenants.                               |
| POST   | `/platform/tenants`                                 | Provision tenant and initial admin.           |
| GET    | `/platform/tenants/{tenantId}`                      | Read plan, usage, health and admins.          |
| PATCH  | `/platform/tenants/{tenantId}`                      | Update platform metadata.                     |
| POST   | `/platform/tenants/{tenantId}/suspend`              | Suspend with reason/impact.                   |
| POST   | `/platform/tenants/{tenantId}/reactivate`           | Reactivate tenant.                            |
| GET    | `/platform/users`                                   | Search platform identities/memberships.       |
| GET    | `/platform/users/{userId}`                          | Read identity, sessions and security events.  |
| POST   | `/platform/users/{userId}/unlock`                   | Unlock account with audit.                    |
| GET    | `/platform/plans`                                   | List plans/versions.                          |
| POST   | `/platform/plans`                                   | Create plan/version.                          |
| GET    | `/platform/plans/{planId}`                          | Read entitlements and tenant usage.           |
| PATCH  | `/platform/plans/{planId}`                          | Update draft plan.                            |
| POST   | `/platform/plans/{planId}/publish`                  | Publish version.                              |
| GET    | `/platform/subscriptions`                           | List subscription lifecycle/seat usage.       |
| GET    | `/platform/subscriptions/{subscriptionId}`          | Read provider reference and history.          |
| PATCH  | `/platform/subscriptions/{subscriptionId}`          | Apply authorized lifecycle change.            |
| GET    | `/platform/feature-flags`                           | List global/tenant rollout.                   |
| POST   | `/platform/feature-flags`                           | Create flag.                                  |
| PATCH  | `/platform/feature-flags/{flagId}`                  | Update rollout/dependencies.                  |
| POST   | `/platform/feature-flags/{flagId}/disable`          | Emergency disable.                            |
| GET    | `/platform/health`                                  | API, DB, queues, storage and realtime health. |
| GET    | `/platform/jobs`                                    | Search background jobs.                       |
| GET    | `/platform/jobs/{jobId}`                            | Read attempts/logs/safe payload metadata.     |
| POST   | `/platform/jobs/{jobId}/retry`                      | Retry failed job.                             |
| POST   | `/platform/jobs/{jobId}/cancel`                     | Cancel cancellable job.                       |
| GET    | `/platform/security-incidents`                      | List incidents.                               |
| GET    | `/platform/security-incidents/{incidentId}`         | Read evidence/containment/resolution.         |
| POST   | `/platform/security-incidents/{incidentId}/contain` | Record containment action.                    |
| POST   | `/platform/security-incidents/{incidentId}/resolve` | Resolve with evidence.                        |
| GET    | `/platform/support-access`                          | List requests/active sessions.                |
| POST   | `/platform/support-access`                          | Request time-limited tenant-approved access.  |
| GET    | `/platform/support-access/{requestId}`              | Read scope/approval/actions/expiry.           |
| POST   | `/platform/support-access/{requestId}/revoke`       | Revoke support session.                       |
| GET    | `/platform/audit`                                   | Search global platform audit.                 |
| GET    | `/platform/configuration`                           | Read regions/providers/defaults.              |
| PATCH  | `/platform/configuration`                           | Update platform configuration.                |
| GET    | `/platform/releases`                                | List release/rollout status.                  |
| POST   | `/platform/releases`                                | Create release record.                        |
| POST   | `/platform/releases/{releaseId}/rollout`            | Advance rollout stage.                        |
| POST   | `/platform/releases/{releaseId}/rollback`           | Record/execute rollback workflow.             |

## 20. Realtime channels — P0/P1

Use WebSocket or Server-Sent Events; do not poll continuously.

| Channel                   | Events                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `/realtime/notifications` | `notification.created`, `followup.due`, `override.requested`, `override.decided`.           |
| `/realtime/reservations`  | `reservation.claimed`, `reservation.released`, `reservation.expired`, `collision.detected`. |
| `/realtime/messages`      | `message.created`, `message.edited`, `conversation.read`.                                   |
| `/realtime/imports`       | `import.progress`, `import.needs_review`, `import.completed`, `import.failed`.              |
| `/realtime/exports`       | `export.progress`, `export.ready`, `export.failed`, `export.expired`.                       |

## 21. Supporting and cross-cutting APIs — P0/P1

These are commonly missed when teams implement only database CRUD.

| Priority | Method | Endpoint                                    | Purpose                                                       |
| -------- | ------ | ------------------------------------------- | ------------------------------------------------------------- |
| P0       | GET    | `/auth/config`                              | Return enabled password, MFA and SSO methods without secrets. |
| P0       | POST   | `/auth/reauthenticate`                      | Step-up authentication before sensitive actions.              |
| P1       | POST   | `/auth/sso/{provider}/start`                | Start configured enterprise SSO.                              |
| P1       | GET    | `/auth/sso/{provider}/callback`             | Complete SSO flow.                                            |
| P0       | GET    | `/auth/password-reset/{token}/status`       | Validate reset token without consuming it.                    |
| P0       | GET    | `/invitations/{token}`                      | Show safe invitation/workspace information.                   |
| P1       | POST   | `/me/avatar/upload-url`                     | Create avatar upload session.                                 |
| P1       | POST   | `/me/avatar/confirm`                        | Confirm uploaded avatar.                                      |
| P1       | DELETE | `/me/avatar`                                | Remove avatar.                                                |
| P0       | GET    | `/search`                                   | Permission-filtered global search.                            |
| P0       | GET    | `/metadata/statuses`                        | Return allowed status labels and transitions.                 |
| P0       | GET    | `/metadata/filter-facets`                   | Return authorization-filtered filter values/counts.           |
| P1       | GET    | `/metadata/metric-definitions`              | Explain formula, scope and freshness of reporting metrics.    |
| P0       | GET    | `/prospects/facets`                         | Return scoped filter counts for prospect lists.               |
| P0       | GET    | `/prospects/{prospectId}/data-quality`      | Return missing/invalid-field guidance.                        |
| P1       | GET    | `/prospects/{prospectId}/change-history`    | Read authorized master-data changes.                          |
| P1       | GET    | `/prospects/{prospectId}/notes`             | List authorized notes.                                        |
| P1       | POST   | `/prospects/{prospectId}/notes`             | Add note with visibility level.                               |
| P1       | PATCH  | `/prospect-notes/{noteId}`                  | Update permitted mutable note.                                |
| P1       | DELETE | `/prospect-notes/{noteId}`                  | Soft-delete permitted note.                                   |
| P1       | GET    | `/assignment-rules`                         | List automatic allocation rules.                              |
| P1       | POST   | `/assignment-rules`                         | Create capacity/round-robin/skill/proximity rule.             |
| P1       | PATCH  | `/assignment-rules/{ruleId}`                | Update rule/order/active state.                               |
| P1       | DELETE | `/assignment-rules/{ruleId}`                | Deactivate rule.                                              |
| P1       | POST   | `/assignment-rules/{ruleId}/simulate`       | Preview allocations and conflicts.                            |
| P1       | GET    | `/notification-policies`                    | List tenant alert/digest policies.                            |
| P1       | PATCH  | `/notification-policies/{policyId}`         | Update allowed channels and cadence.                          |
| P1       | GET    | `/notification-templates`                   | List tenant notification templates.                           |
| P1       | PATCH  | `/notification-templates/{templateId}`      | Update editable template.                                     |
| P1       | POST   | `/notification-templates/{templateId}/test` | Send safe test notification.                                  |
| P1       | GET    | `/sync/bootstrap`                           | Return first offline/PWA dataset within scope.                |
| P1       | GET    | `/sync/changes`                             | Return authorized changes after cursor.                       |
| P1       | POST   | `/sync/operations`                          | Replay idempotent offline operations and conflicts.           |
| P1       | GET    | `/settings/security`                        | Read tenant security settings.                                |
| P1       | PATCH  | `/settings/security`                        | Update MFA/session/password/SSO policy.                       |
| P1       | GET    | `/settings/default-statuses`                | Read configured lifecycle/action outcomes.                    |
| P1       | PATCH  | `/settings/default-statuses`                | Update allowed tenant status configuration.                   |
| P2       | GET    | `/subscription`                             | Read tenant plan, lifecycle and billing contact.              |
| P2       | GET    | `/subscription/usage`                       | Read seat/feature quota usage.                                |
| P2       | PATCH  | `/subscription`                             | Request allowed plan or seat change.                          |
| P2       | POST   | `/subscription/billing-portal`              | Create short-lived provider billing-portal session.           |

Use `ETag`/`If-Match` on mutable resources and return a structured conflict response. Use asynchronous job status/events for imports, exports, report generation, webhooks and long-running platform tasks.

## 22. Required schema additions before full API implementation

The current SQL foundation needs these changes:

1. Add `director` and `auditor` to the tenant role model. Keep `super_admin` in a separate platform-role boundary or explicit platform membership table.
2. Add `feature_flags`; it exists in the architecture but not the current SQL schema.
3. Add `objectives` and objective-history tables.
4. Add `scheduled_reports` and report-delivery history.
5. Add access-review campaign, membership decision and review-evidence tables.
6. Add evidence-package/export records and integrity/signature metadata.
7. Add security incidents and incident-event tables.
8. Add retention policy versions, retention runs and legal holds.
9. Add time-limited support-access/impersonation records.
10. Add platform configuration, releases and background-job operational views/tables.
11. Create materialized/incremental reporting views for workload, funnel, conversion, timeliness, collision, coverage and data quality.

System-written resources such as audit logs, action events, collision events, outbox events and webhook-delivery history must not expose generic public create/update/delete APIs.

## 23. Recommended build order

1. Authentication, tenant context, memberships, roles, permissions and RLS.
2. Organizations, teams, territories and campaigns.
3. Prospects, contacts, consent/opposition, imports and duplicates.
4. Assignments, actions and follow-ups.
5. Transactional reservations, collision events and manager overrides.
6. Notifications and basic manager/admin reporting.
7. Maps, routes and messaging.
8. Director dashboards, objectives, forecasts and scheduled reports.
9. Auditor evidence, access reviews, compliance reports and evidence exports.
10. Integrations, API clients, webhooks and complete export controls.
11. Super Admin platform operations, billing, support access and releases.
