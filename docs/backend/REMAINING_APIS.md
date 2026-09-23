# Remaining API contract checklist

Snapshot: 2026-09-23, after configurable outcomes and canonical workflows.

For APIs usable in frontend integration now, see the [frontend API handoff](FRONTEND_API_HANDOFF.md). Verified does not yet mean production deployment is signed off.

The ledger contains 153 verified operations, 15 partially completed operations, and 213 operations awaiting verification. The three implemented extension routes (two geographic-allocation routes and authenticated export file download) are outside these 381 base operations. These are acceptance-ledger counts, not a count of missing implementations. Some functionality exists under older or campaign-scoped routes and still needs contract reconciliation.

The roster-history endpoint is implemented; the older membership-detail ledger row still needs reconciliation. Geographic allocation and saved capacity/round-robin allocation rules are implemented; implicit priority rule chains remain pending. Reservation rules, canonical claim/read/release, heartbeat/extension and observed expiry history are now implemented. Transactional bulk assignments are implemented. Canonical assignment list/detail/lifecycle APIs are implemented. All four explicit allocation strategies and ranked suggestions are implemented. Staged CSV/XLSX imports, exact deduplication and asynchronous exports are implemented. Configurable activity outcomes, canonical follow-up transitions and manager/admin dashboards are implemented. Today route summaries and director objective-risk calculations remain partial; general prospect merge remains pending.

## 2. Authentication and personal account — P0

| Method | Endpoint | Required behavior                                         | Ledger status                                                                      |
| ------ | -------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| PATCH  | `/me`    | Update name, phone, avatar metadata, locale and timezone. | Partial: name/phone/locale/timezone, audit and conditional updates; avatar pending |

## 3. Tenant, users, roles and scope — P0

| Method | Endpoint                                     | Required behavior                                          | Ledger status                                                                                      |
| ------ | -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/memberships/{membershipId}`                | Read user, role, capacity, teams and effective scope.      | Partial: identity, capacity, current team grants and effective permissions; roster history pending |
| GET    | `/permissions`                               | List atomic permissions.                                   | Partial: nine published permissions; remaining domains pending                                     |
| PUT    | `/roles/{role}/permissions`                  | Update configurable tenant-role permissions where allowed. | Partial: four restriction-only configurable management capabilities                                |
| POST   | `/memberships/{membershipId}/scopes`         | Add a scoped grant/restriction.                            | Partial: positive grants at all five scopes; explicit deny rules pending                           |
| GET    | `/memberships/{membershipId}/access-history` | Read immutable role and scope history.                     | Partial: cursor-paginated append-only API audit; DB tamper protection pending                      |

## 4. Organizations and teams — P0

| Method | Endpoint                          | Required behavior                              | Ledger status                                                                          |
| ------ | --------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/organizations/{organizationId}` | Read details and summary.                      | Partial: authorized metadata; expanded summary pending                                 |
| GET    | `/teams/{teamId}/capacity`        | Return workload, capacity and allocation room. | Partial: assignment count/capacity/availability; richer allocation constraints pending |

## 5. Territories and map data — P0/P1

| Method | Endpoint            | Required behavior                                         | Ledger status        |
| ------ | ------------------- | --------------------------------------------------------- | -------------------- |
| GET    | `/prospects/map`    | Return scoped, clustered map markers and status summary.  | Pending verification |
| GET    | `/prospects/nearby` | Return authorized prospects within radius of coordinates. | Pending verification |
| GET    | `/map/heatmap`      | Return aggregate activity/conversion heat layer.          | Pending verification |
| GET    | `/map/coverage`     | Return aggregate coverage layer by territory.             | Pending verification |

## 6. Campaigns — P0

| Method | Endpoint                         | Required behavior                      | Ledger status                                                        |
| ------ | -------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/campaigns`                     | List visible campaigns.                | Partial: scope-filtered metadata list; advanced list filters pending |
| POST   | `/campaigns`                     | Create draft campaign.                 | Pending verification                                                 |
| GET    | `/campaigns/{campaignId}`        | Read configuration, scope and summary. | Partial: scoped campaign metadata; richer summary pending            |
| DELETE | `/campaigns/{campaignId}`        | Archive campaign.                      | Pending verification                                                 |
| POST   | `/campaigns/{campaignId}/status` | Activate, pause, complete or archive.  | Pending verification                                                 |

## 7. Prospects, contacts and data quality — P0

| Method | Endpoint                                     | Required behavior                                    | Ledger status        |
| ------ | -------------------------------------------- | ---------------------------------------------------- | -------------------- |
| GET    | `/prospects`                                 | Search, filter, sort and paginate scoped prospects.  | Pending verification |
| POST   | `/prospects`                                 | Create prospect.                                     | Pending verification |
| GET    | `/prospects/{prospectId}`                    | Read full authorized prospect record.                | Pending verification |
| PATCH  | `/prospects/{prospectId}`                    | Update mutable master data.                          | Pending verification |
| DELETE | `/prospects/{prospectId}`                    | Soft-delete/archive prospect.                        | Pending verification |
| POST   | `/prospects/{prospectId}/restore`            | Restore archived prospect where allowed.             | Pending verification |
| GET    | `/prospects/{prospectId}/addresses`          | List sites/locations.                                | Pending verification |
| POST   | `/prospects/{prospectId}/addresses`          | Add/geocode address.                                 | Pending verification |
| PATCH  | `/prospect-addresses/{addressId}`            | Update location/primary flag.                        | Pending verification |
| DELETE | `/prospect-addresses/{addressId}`            | Remove address.                                      | Pending verification |
| GET    | `/prospects/{prospectId}/contacts`           | List contacts.                                       | Pending verification |
| POST   | `/prospects/{prospectId}/contacts`           | Add contact.                                         | Pending verification |
| PATCH  | `/prospect-contacts/{contactId}`             | Update contact.                                      | Pending verification |
| DELETE | `/prospect-contacts/{contactId}`             | Soft-delete contact.                                 | Pending verification |
| GET    | `/tags`                                      | List tags.                                           | Pending verification |
| POST   | `/tags`                                      | Create tag.                                          | Pending verification |
| PATCH  | `/tags/{tagId}`                              | Update tag.                                          | Pending verification |
| DELETE | `/tags/{tagId}`                              | Delete unused tag.                                   | Pending verification |
| POST   | `/prospects/{prospectId}/tags/{tagId}`       | Tag prospect.                                        | Pending verification |
| DELETE | `/prospects/{prospectId}/tags/{tagId}`       | Remove tag.                                          | Pending verification |
| GET    | `/custom-fields`                             | List custom-field definitions.                       | Pending verification |
| POST   | `/custom-fields`                             | Create definition.                                   | Pending verification |
| PATCH  | `/custom-fields/{fieldId}`                   | Update validation/visibility.                        | Pending verification |
| DELETE | `/custom-fields/{fieldId}`                   | Deactivate field.                                    | Pending verification |
| PUT    | `/prospects/{prospectId}/custom-fields`      | Batch upsert field values.                           | Pending verification |
| GET    | `/prospect-duplicates`                       | List candidate/resolved duplicates.                  | Pending verification |
| GET    | `/prospect-duplicates/{duplicateId}`         | Compare records and match evidence.                  | Pending verification |
| POST   | `/prospect-duplicates/{duplicateId}/resolve` | Reject candidate or merge transactionally.           | Pending verification |
| GET    | `/data-quality/overview`                     | Return completeness, validity and duplicate metrics. | Pending verification |

## 8. Imports — P0

| Method | Endpoint | Required behavior | Ledger status |
| ------ | -------- | ----------------- | ------------- |

## 9. Assignments and workload — P0

| Method | Endpoint | Required behavior | Ledger status |
| ------ | -------- | ----------------- | ------------- |

## 11. Actions, outcomes and follow-ups — P0

| Method | Endpoint           | Required behavior                                              | Ledger status                                                                            |
| ------ | ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/dashboard/today` | Prospector priorities, follow-ups, meetings and route summary. | Partial: authorized daily priorities/follow-ups/meetings; route planning summary pending |

## 12. Routes and field rounds — P1

| Method | Endpoint                       | Required behavior                         | Ledger status        |
| ------ | ------------------------------ | ----------------------------------------- | -------------------- |
| GET    | `/routes`                      | List own or scoped team routes.           | Pending verification |
| POST   | `/routes`                      | Create field round.                       | Pending verification |
| GET    | `/routes/{routeId}`            | Read route, metrics and ordered stops.    | Pending verification |
| PATCH  | `/routes/{routeId}`            | Update draft/status/endpoints.            | Pending verification |
| DELETE | `/routes/{routeId}`            | Cancel draft route.                       | Pending verification |
| POST   | `/routes/{routeId}/stops`      | Add prospect/action stop.                 | Pending verification |
| PATCH  | `/route-stops/{stopId}`        | Update position, ETA, arrival or outcome. | Pending verification |
| DELETE | `/route-stops/{stopId}`        | Remove stop.                              | Pending verification |
| PUT    | `/routes/{routeId}/stop-order` | Reorder stops.                            | Pending verification |
| POST   | `/routes/{routeId}/optimize`   | Calculate optimized order and distance.   | Pending verification |
| POST   | `/routes/{routeId}/start`      | Start route.                              | Pending verification |
| POST   | `/routes/{routeId}/complete`   | Complete route.                           | Pending verification |

## 13. Messaging and attachments — P1

| Method | Endpoint                                                      | Required behavior                                  | Ledger status        |
| ------ | ------------------------------------------------------------- | -------------------------------------------------- | -------------------- |
| GET    | `/conversations`                                              | List conversations where user participates.        | Pending verification |
| POST   | `/conversations`                                              | Create direct/team/prospect/campaign conversation. | Pending verification |
| GET    | `/conversations/{conversationId}`                             | Read context and participants.                     | Pending verification |
| PATCH  | `/conversations/{conversationId}`                             | Rename/archive where authorized.                   | Pending verification |
| GET    | `/conversations/{conversationId}/participants`                | List participants/read state.                      | Pending verification |
| POST   | `/conversations/{conversationId}/participants`                | Add participant.                                   | Pending verification |
| DELETE | `/conversations/{conversationId}/participants/{membershipId}` | Remove participant.                                | Pending verification |
| GET    | `/conversations/{conversationId}/messages`                    | Paginate messages.                                 | Pending verification |
| POST   | `/conversations/{conversationId}/messages`                    | Send human message or contextual card.             | Pending verification |
| PATCH  | `/messages/{messageId}`                                       | Edit authorized human message.                     | Pending verification |
| DELETE | `/messages/{messageId}`                                       | Soft-delete authorized human message.              | Pending verification |
| POST   | `/conversations/{conversationId}/read`                        | Advance read timestamp.                            | Pending verification |
| PATCH  | `/conversations/{conversationId}/mute`                        | Set/clear mute duration.                           | Pending verification |
| POST   | `/uploads/presign`                                            | Create authorized object-storage upload.           | Pending verification |
| POST   | `/messages/{messageId}/attachments`                           | Attach uploaded file metadata.                     | Pending verification |
| GET    | `/attachments/{attachmentId}/download`                        | Return short-lived download URL.                   | Pending verification |

## 14. Notifications — P0 basic / P1 complete

| Method | Endpoint                    | Required behavior                                     | Ledger status                                                        |
| ------ | --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/notifications`            | List notifications by severity/read state.            | Partial: owned cursor inbox/unread filtering; severity model pending |
| GET    | `/notification-preferences` | Read event/channel preferences.                       | Pending verification                                                 |
| PUT    | `/notification-preferences` | Update preferences while preserving mandatory alerts. | Pending verification                                                 |
| POST   | `/devices`                  | Register push-notification device.                    | Pending verification                                                 |
| DELETE | `/devices/{deviceId}`       | Revoke push device.                                   | Pending verification                                                 |

## 15. Dashboards, reports, objectives and forecasts — P0/P1

| Method | Endpoint                                     | Required behavior                                            | Ledger status                                                                            |
| ------ | -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| GET    | `/dashboard/director`                        | Executive KPIs, objective risks and organization comparison. | Partial: scoped performance and organization comparison; objective targets/risks pending |
| GET    | `/platform/dashboard`                        | Super Admin tenant/service health summary.                   | Pending verification                                                                     |
| GET    | `/reports/overview`                          | Authorized summary KPIs.                                     | Pending verification                                                                     |
| GET    | `/reports/workload`                          | Portfolio load/capacity/backlog.                             | Pending verification                                                                     |
| GET    | `/reports/actions`                           | Activity by date/channel/type.                               | Pending verification                                                                     |
| GET    | `/reports/funnel`                            | Assigned-to-converted funnel.                                | Pending verification                                                                     |
| GET    | `/reports/conversions`                       | Contact, qualification and conversion rates.                 | Pending verification                                                                     |
| GET    | `/reports/follow-ups`                        | Timeliness and overdue metrics.                              | Pending verification                                                                     |
| GET    | `/reports/coverage`                          | Assigned prospect coverage.                                  | Pending verification                                                                     |
| GET    | `/reports/collisions`                        | Prevented collisions and overrides.                          | Pending verification                                                                     |
| GET    | `/reports/data-quality`                      | Completeness/enrichment metrics.                             | Pending verification                                                                     |
| GET    | `/reports/territories`                       | Geographic performance aggregates.                           | Pending verification                                                                     |
| GET    | `/reports/forecast`                          | Forecast with confidence and assumptions.                    | Pending verification                                                                     |
| GET    | `/objectives`                                | List objectives in scope.                                    | Pending verification                                                                     |
| POST   | `/objectives`                                | Create objective (Admin/authorized Manager).                 | Pending verification                                                                     |
| GET    | `/objectives/{objectiveId}`                  | Read target, actual, history and contributing metrics.       | Pending verification                                                                     |
| PATCH  | `/objectives/{objectiveId}`                  | Update future/editable target definition.                    | Pending verification                                                                     |
| GET    | `/objectives/at-risk`                        | Return risk-ranked objectives.                               | Pending verification                                                                     |
| GET    | `/report-definitions`                        | List standard report definitions and metric metadata.        | Pending verification                                                                     |
| GET    | `/reports/{reportId}`                        | Run/read a detailed report with reproducible filters.        | Pending verification                                                                     |
| GET    | `/scheduled-reports`                         | List personal/authorized schedules.                          | Pending verification                                                                     |
| POST   | `/scheduled-reports`                         | Create schedule.                                             | Pending verification                                                                     |
| PATCH  | `/scheduled-reports/{scheduleId}`            | Update recipients/cadence/format.                            | Pending verification                                                                     |
| DELETE | `/scheduled-reports/{scheduleId}`            | Delete schedule.                                             | Pending verification                                                                     |
| GET    | `/scheduled-reports/{scheduleId}/deliveries` | Read generation/delivery history.                            | Pending verification                                                                     |

## 16. Saved views and exports — P0/P1

| Method | Endpoint                | Required behavior               | Ledger status        |
| ------ | ----------------------- | ------------------------------- | -------------------- |
| GET    | `/saved-views`          | List personal/shared views.     | Pending verification |
| POST   | `/saved-views`          | Save filters, sort and columns. | Pending verification |
| PATCH  | `/saved-views/{viewId}` | Rename/update/default view.     | Pending verification |
| DELETE | `/saved-views/{viewId}` | Delete owned view.              | Pending verification |

## 17. Audit, Observer/Auditor and compliance — P1

| Method | Endpoint                                  | Required behavior                                         | Ledger status        |
| ------ | ----------------------------------------- | --------------------------------------------------------- | -------------------- |
| GET    | `/audit/events`                           | Search immutable audit events within effective scope.     | Pending verification |
| GET    | `/audit/events/{eventId}`                 | Read before/after, actor, integrity and chain of custody. | Pending verification |
| GET    | `/audit/overview`                         | Evidence volume, coverage and sensitive-event summary.    | Pending verification |
| GET    | `/audit/assignments`                      | Assignment history evidence.                              | Pending verification |
| GET    | `/audit/assignments/{assignmentId}`       | Assignment ownership timeline.                            | Pending verification |
| GET    | `/audit/overrides`                        | Override register.                                        | Pending verification |
| GET    | `/audit/overrides/{overrideId}`           | Full conflict/request/decision evidence.                  | Pending verification |
| GET    | `/audit/collisions`                       | Collision decision register.                              | Pending verification |
| GET    | `/audit/collisions/{collisionId}`         | Inputs, policy version and server decision.               | Pending verification |
| GET    | `/audit/exports`                          | Export evidence register.                                 | Pending verification |
| GET    | `/audit/exports/{exportId}`               | Scope, fields, checksum and download history.             | Pending verification |
| GET    | `/audit/users/{membershipId}/access`      | Effective access and privileged-event history.            | Pending verification |
| GET    | `/audit/security-events`                  | Login, MFA, session and privilege security events.        | Pending verification |
| GET    | `/audit/security-events/{eventId}`        | Full security evidence timeline.                          | Pending verification |
| GET    | `/audit/data-changes`                     | Sensitive prospect/import/consent/merge changes.          | Pending verification |
| GET    | `/audit/retention`                        | Retention versions, runs, legal holds and exceptions.     | Pending verification |
| POST   | `/audit/evidence-exports`                 | Request scoped, redacted, audited evidence package.       | Pending verification |
| GET    | `/audit/evidence-exports/{exportId}`      | Poll/download signed evidence package.                    | Pending verification |
| GET    | `/access-reviews`                         | List access-review periods.                               | Pending verification |
| POST   | `/access-reviews`                         | Start review (Tenant Admin only).                         | Pending verification |
| GET    | `/access-reviews/{reviewId}`              | Read progress and evidence.                               | Pending verification |
| GET    | `/access-reviews/{reviewId}/memberships`  | List reviewed users/scopes.                               | Pending verification |
| POST   | `/access-reviews/{reviewId}/decisions`    | Record reviewer decision (authorized reviewer).           | Pending verification |
| POST   | `/access-reviews/{reviewId}/complete`     | Seal completed review.                                    | Pending verification |
| GET    | `/compliance-reports`                     | List report definitions/generated reports.                | Pending verification |
| POST   | `/compliance-reports`                     | Generate versioned compliance report.                     | Pending verification |
| GET    | `/compliance-reports/{reportId}`          | Read parameters/evidence set.                             | Pending verification |
| GET    | `/compliance-reports/{reportId}/download` | Download signed report.                                   | Pending verification |

## 18. Integrations, API clients and webhooks — P1

| Method | Endpoint                                 | Required behavior                    | Ledger status        |
| ------ | ---------------------------------------- | ------------------------------------ | -------------------- |
| GET    | `/integrations`                          | List connected providers and health. | Pending verification |
| POST   | `/integrations/{provider}/connect`       | Start OAuth/provider authorization.  | Pending verification |
| GET    | `/integrations/{provider}/callback`      | Complete provider authorization.     | Pending verification |
| POST   | `/integrations/{integrationId}/test`     | Test connection.                     | Pending verification |
| POST   | `/integrations/{integrationId}/sync`     | Trigger sync.                        | Pending verification |
| DELETE | `/integrations/{integrationId}`          | Revoke/disconnect.                   | Pending verification |
| GET    | `/api-clients`                           | List scoped clients without secrets. | Pending verification |
| POST   | `/api-clients`                           | Create client; return secret once.   | Pending verification |
| PATCH  | `/api-clients/{clientId}`                | Update scopes/name/expiry.           | Pending verification |
| POST   | `/api-clients/{clientId}/rotate-secret`  | Rotate secret.                       | Pending verification |
| DELETE | `/api-clients/{clientId}`                | Revoke client.                       | Pending verification |
| GET    | `/webhooks`                              | List webhook subscriptions.          | Pending verification |
| POST   | `/webhooks`                              | Create signed subscription.          | Pending verification |
| PATCH  | `/webhooks/{webhookId}`                  | Update endpoint/events/status.       | Pending verification |
| DELETE | `/webhooks/{webhookId}`                  | Remove webhook.                      | Pending verification |
| POST   | `/webhooks/{webhookId}/test`             | Send test event.                     | Pending verification |
| GET    | `/webhooks/{webhookId}/deliveries`       | List delivery attempts.              | Pending verification |
| GET    | `/webhook-deliveries/{deliveryId}`       | Read sanitized request/response.     | Pending verification |
| POST   | `/webhook-deliveries/{deliveryId}/retry` | Retry failed delivery.               | Pending verification |

## 19. Super Admin platform APIs — P2

| Method | Endpoint                                            | Required behavior                             | Ledger status        |
| ------ | --------------------------------------------------- | --------------------------------------------- | -------------------- |
| GET    | `/platform/tenants`                                 | Search tenants.                               | Pending verification |
| POST   | `/platform/tenants`                                 | Provision tenant and initial admin.           | Pending verification |
| GET    | `/platform/tenants/{tenantId}`                      | Read plan, usage, health and admins.          | Pending verification |
| PATCH  | `/platform/tenants/{tenantId}`                      | Update platform metadata.                     | Pending verification |
| POST   | `/platform/tenants/{tenantId}/suspend`              | Suspend with reason/impact.                   | Pending verification |
| POST   | `/platform/tenants/{tenantId}/reactivate`           | Reactivate tenant.                            | Pending verification |
| GET    | `/platform/users`                                   | Search platform identities/memberships.       | Pending verification |
| GET    | `/platform/users/{userId}`                          | Read identity, sessions and security events.  | Pending verification |
| POST   | `/platform/users/{userId}/unlock`                   | Unlock account with audit.                    | Pending verification |
| GET    | `/platform/plans`                                   | List plans/versions.                          | Pending verification |
| POST   | `/platform/plans`                                   | Create plan/version.                          | Pending verification |
| GET    | `/platform/plans/{planId}`                          | Read entitlements and tenant usage.           | Pending verification |
| PATCH  | `/platform/plans/{planId}`                          | Update draft plan.                            | Pending verification |
| POST   | `/platform/plans/{planId}/publish`                  | Publish version.                              | Pending verification |
| GET    | `/platform/subscriptions`                           | List subscription lifecycle/seat usage.       | Pending verification |
| GET    | `/platform/subscriptions/{subscriptionId}`          | Read provider reference and history.          | Pending verification |
| PATCH  | `/platform/subscriptions/{subscriptionId}`          | Apply authorized lifecycle change.            | Pending verification |
| GET    | `/platform/feature-flags`                           | List global/tenant rollout.                   | Pending verification |
| POST   | `/platform/feature-flags`                           | Create flag.                                  | Pending verification |
| PATCH  | `/platform/feature-flags/{flagId}`                  | Update rollout/dependencies.                  | Pending verification |
| POST   | `/platform/feature-flags/{flagId}/disable`          | Emergency disable.                            | Pending verification |
| GET    | `/platform/health`                                  | API, DB, queues, storage and realtime health. | Pending verification |
| GET    | `/platform/jobs`                                    | Search background jobs.                       | Pending verification |
| GET    | `/platform/jobs/{jobId}`                            | Read attempts/logs/safe payload metadata.     | Pending verification |
| POST   | `/platform/jobs/{jobId}/retry`                      | Retry failed job.                             | Pending verification |
| POST   | `/platform/jobs/{jobId}/cancel`                     | Cancel cancellable job.                       | Pending verification |
| GET    | `/platform/security-incidents`                      | List incidents.                               | Pending verification |
| GET    | `/platform/security-incidents/{incidentId}`         | Read evidence/containment/resolution.         | Pending verification |
| POST   | `/platform/security-incidents/{incidentId}/contain` | Record containment action.                    | Pending verification |
| POST   | `/platform/security-incidents/{incidentId}/resolve` | Resolve with evidence.                        | Pending verification |
| GET    | `/platform/support-access`                          | List requests/active sessions.                | Pending verification |
| POST   | `/platform/support-access`                          | Request time-limited tenant-approved access.  | Pending verification |
| GET    | `/platform/support-access/{requestId}`              | Read scope/approval/actions/expiry.           | Pending verification |
| POST   | `/platform/support-access/{requestId}/revoke`       | Revoke support session.                       | Pending verification |
| GET    | `/platform/audit`                                   | Search global platform audit.                 | Pending verification |
| GET    | `/platform/configuration`                           | Read regions/providers/defaults.              | Pending verification |
| PATCH  | `/platform/configuration`                           | Update platform configuration.                | Pending verification |
| GET    | `/platform/releases`                                | List release/rollout status.                  | Pending verification |
| POST   | `/platform/releases`                                | Create release record.                        | Pending verification |
| POST   | `/platform/releases/{releaseId}/rollout`            | Advance rollout stage.                        | Pending verification |
| POST   | `/platform/releases/{releaseId}/rollback`           | Record/execute rollback workflow.             | Pending verification |

## 21. Supporting and cross-cutting APIs — P0/P1

| Method | Endpoint                                    | Required behavior                                          | Ledger status                                                |
| ------ | ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| POST   | `/auth/reauthenticate`                      | Step-up authentication before sensitive actions.           | Pending verification                                         |
| POST   | `/auth/sso/{provider}/start`                | Start configured enterprise SSO.                           | Pending verification                                         |
| GET    | `/auth/sso/{provider}/callback`             | Complete SSO flow.                                         | Pending verification                                         |
| POST   | `/me/avatar/upload-url`                     | Create avatar upload session.                              | Pending verification                                         |
| POST   | `/me/avatar/confirm`                        | Confirm uploaded avatar.                                   | Pending verification                                         |
| DELETE | `/me/avatar`                                | Remove avatar.                                             | Pending verification                                         |
| GET    | `/search`                                   | Permission-filtered global search.                         | Pending verification                                         |
| GET    | `/metadata/statuses`                        | Return allowed status labels and transitions.              | Pending verification                                         |
| GET    | `/metadata/filter-facets`                   | Return authorization-filtered filter values/counts.        | Pending verification                                         |
| GET    | `/metadata/metric-definitions`              | Explain formula, scope and freshness of reporting metrics. | Pending verification                                         |
| GET    | `/prospects/facets`                         | Return scoped filter counts for prospect lists.            | Pending verification                                         |
| GET    | `/prospects/{prospectId}/data-quality`      | Return missing/invalid-field guidance.                     | Pending verification                                         |
| GET    | `/prospects/{prospectId}/change-history`    | Read authorized master-data changes.                       | Pending verification                                         |
| GET    | `/prospects/{prospectId}/notes`             | List authorized notes.                                     | Pending verification                                         |
| POST   | `/prospects/{prospectId}/notes`             | Add note with visibility level.                            | Pending verification                                         |
| PATCH  | `/prospect-notes/{noteId}`                  | Update permitted mutable note.                             | Pending verification                                         |
| DELETE | `/prospect-notes/{noteId}`                  | Soft-delete permitted note.                                | Pending verification                                         |
| GET    | `/notification-policies`                    | List tenant alert/digest policies.                         | Pending verification                                         |
| PATCH  | `/notification-policies/{policyId}`         | Update allowed channels and cadence.                       | Pending verification                                         |
| GET    | `/notification-templates`                   | List tenant notification templates.                        | Pending verification                                         |
| PATCH  | `/notification-templates/{templateId}`      | Update editable template.                                  | Pending verification                                         |
| POST   | `/notification-templates/{templateId}/test` | Send safe test notification.                               | Pending verification                                         |
| GET    | `/sync/bootstrap`                           | Return first offline/PWA dataset within scope.             | Pending verification                                         |
| GET    | `/sync/changes`                             | Return authorized changes after cursor.                    | Pending verification                                         |
| POST   | `/sync/operations`                          | Replay idempotent offline operations and conflicts.        | Pending verification                                         |
| GET    | `/settings/security`                        | Read tenant security settings.                             | Partial: enforced MFA/password/session policies; SSO pending |
| PATCH  | `/settings/security`                        | Update MFA/session/password/SSO policy.                    | Partial: enforced MFA/password/session policies; SSO pending |
| GET    | `/subscription`                             | Read tenant plan, lifecycle and billing contact.           | Pending verification                                         |
| GET    | `/subscription/usage`                       | Read seat/feature quota usage.                             | Pending verification                                         |
| PATCH  | `/subscription`                             | Request allowed plan or seat change.                       | Pending verification                                         |
| POST   | `/subscription/billing-portal`              | Create short-lived provider billing-portal session.        | Pending verification                                         |
