# Browser API endpoints

[Overview](API_CATALOG.md) · [Backend endpoints](API_ENDPOINTS.md) · [Request schemas](API_REQUEST_SCHEMAS.md)

The Next.js app defines **185 explicit method/path handlers** below. These paths are on the web app origin, not the backend origin. The proxy authenticates with HttpOnly session cookies and supplies the backend bearer token. It may refresh the session. The browser does not receive the access/refresh token pair in a login response.

Unless a handler transforms data, a proxy returns the backend JSON without runtime schema validation. Its TypeScript generic describes the expected payload; extra backend fields may still pass through. For pass-through handlers, the authoritative response is therefore the linked backend response. Expanded browser shapes below show the UI contract or explicit transformation. Missing session returns 401; backend errors are relayed; upstream transport errors generally become 502.

Accepted JSON bodies inherit the linked backend DTO and business rules, unless a per-route note says otherwise. The query names below are those forwarded/read by the browser handler; other backend filters may not be reachable through that browser route. Required Idempotency-Key and supported If-Match headers still need to be supplied to browser writes when the upstream requires them; consult the route source for exact forwarding. Path IDs are required strings with backend validation.

## Differences to remember

- Login, workspace selection and MFA completion return a next-step object and set cookies only after full authentication. Browser refresh/logout require no JSON refreshToken body and return 204 on success.
- Follow-up mappings replace campaignProspectId with prospectId, derive ownership as team/user, and omit assignedUserId/createdBy. Category and channel are preserved in this working tree.
- Prospector-today fills absent completedToday with 0, and absent contact/coordinate fields with null.
- Work-queue operations map to campaign-scoped endpoints and can first check work-queue access using teamId.
- Browser POST handlers may return 200 even when the upstream created a resource with 201; use the status shown here.
- The override decision path accepts only approve, reject or cancel; other decisions return 404 UNKNOWN_DECISION.

## Index

| Method | Browser path                                                                                                                                                | Backend endpoint                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | [`/api/actions`](#get-api-actions)                                                                                                                          | [`GET /actions`](API_ENDPOINTS.md#get-actions)                                                                                                                                                                                                                                                                                  |
| POST   | [`/api/actions`](#post-api-actions)                                                                                                                         | [`POST /actions`](API_ENDPOINTS.md#post-actions)                                                                                                                                                                                                                                                                                |
| GET    | [`/api/actions/:actionId`](#get-api-actions-actionid)                                                                                                       | [`GET /actions/:actionId`](API_ENDPOINTS.md#get-actions-actionid)                                                                                                                                                                                                                                                               |
| PATCH  | [`/api/actions/:actionId`](#patch-api-actions-actionid)                                                                                                     | [`PATCH /actions/:actionId`](API_ENDPOINTS.md#patch-actions-actionid)                                                                                                                                                                                                                                                           |
| POST   | [`/api/actions/:actionId/cancel`](#post-api-actions-actionid-cancel)                                                                                        | [`POST /actions/:actionId/cancel`](API_ENDPOINTS.md#post-actions-actionid-cancel)                                                                                                                                                                                                                                               |
| POST   | [`/api/actions/:actionId/complete`](#post-api-actions-actionid-complete)                                                                                    | [`POST /actions/:actionId/complete`](API_ENDPOINTS.md#post-actions-actionid-complete)                                                                                                                                                                                                                                           |
| POST   | [`/api/actions/:actionId/corrections`](#post-api-actions-actionid-corrections)                                                                              | [`POST /actions/:actionId/corrections`](API_ENDPOINTS.md#post-actions-actionid-corrections)                                                                                                                                                                                                                                     |
| GET    | [`/api/actions/:actionId/events`](#get-api-actions-actionid-events)                                                                                         | [`GET /actions/:actionId/events`](API_ENDPOINTS.md#get-actions-actionid-events)                                                                                                                                                                                                                                                 |
| POST   | [`/api/actions/:actionId/start`](#post-api-actions-actionid-start)                                                                                          | [`POST /actions/:actionId/start`](API_ENDPOINTS.md#post-actions-actionid-start)                                                                                                                                                                                                                                                 |
| GET    | [`/api/assignments`](#get-api-assignments)                                                                                                                  | [`GET /assignments`](API_ENDPOINTS.md#get-assignments)                                                                                                                                                                                                                                                                          |
| GET    | [`/api/assignments/:assignmentId`](#get-api-assignments-assignmentid)                                                                                       | [`GET /assignments/:assignmentId`](API_ENDPOINTS.md#get-assignments-assignmentid)                                                                                                                                                                                                                                               |
| PATCH  | [`/api/assignments/:assignmentId`](#patch-api-assignments-assignmentid)                                                                                     | [`PATCH /assignments/:assignmentId`](API_ENDPOINTS.md#patch-assignments-assignmentid)                                                                                                                                                                                                                                           |
| POST   | [`/api/assignments/:assignmentId/complete`](#post-api-assignments-assignmentid-complete)                                                                    | [`POST /assignments/:assignmentId/complete`](API_ENDPOINTS.md#post-assignments-assignmentid-complete)                                                                                                                                                                                                                           |
| POST   | [`/api/assignments/:assignmentId/reassign`](#post-api-assignments-assignmentid-reassign)                                                                    | [`POST /assignments/:assignmentId/reassign`](API_ENDPOINTS.md#post-assignments-assignmentid-reassign)                                                                                                                                                                                                                           |
| POST   | [`/api/assignments/:assignmentId/revoke`](#post-api-assignments-assignmentid-revoke)                                                                        | [`POST /assignments/:assignmentId/revoke`](API_ENDPOINTS.md#post-assignments-assignmentid-revoke)                                                                                                                                                                                                                               |
| POST   | [`/api/assignments/bulk`](#post-api-assignments-bulk)                                                                                                       | [`POST /assignments/bulk`](API_ENDPOINTS.md#post-assignments-bulk)                                                                                                                                                                                                                                                              |
| POST   | [`/api/assignments/preview`](#post-api-assignments-preview)                                                                                                 | [`POST /assignments/preview`](API_ENDPOINTS.md#post-assignments-preview)                                                                                                                                                                                                                                                        |
| GET    | [`/api/assignments/unassigned`](#get-api-assignments-unassigned)                                                                                            | [`GET /assignments/unassigned`](API_ENDPOINTS.md#get-assignments-unassigned)                                                                                                                                                                                                                                                    |
| GET    | [`/api/audit/events`](#get-api-audit-events)                                                                                                                | [`GET /audit/events`](API_ENDPOINTS.md#get-audit-events)                                                                                                                                                                                                                                                                        |
| GET    | [`/api/audit/events/:eventId`](#get-api-audit-events-eventid)                                                                                               | [`GET /audit/events/:eventId`](API_ENDPOINTS.md#get-audit-events-eventid)                                                                                                                                                                                                                                                       |
| GET    | [`/api/audit/overview`](#get-api-audit-overview)                                                                                                            | [`GET /audit/overview`](API_ENDPOINTS.md#get-audit-overview)                                                                                                                                                                                                                                                                    |
| GET    | [`/api/auth/config`](#get-api-auth-config)                                                                                                                  | [`GET /auth/config`](API_ENDPOINTS.md#get-auth-config)                                                                                                                                                                                                                                                                          |
| POST   | [`/api/auth/login`](#post-api-auth-login)                                                                                                                   | [`POST /auth/login`](API_ENDPOINTS.md#post-auth-login)                                                                                                                                                                                                                                                                          |
| POST   | [`/api/auth/logout`](#post-api-auth-logout)                                                                                                                 | [`POST /auth/logout`](API_ENDPOINTS.md#post-auth-logout)                                                                                                                                                                                                                                                                        |
| GET    | [`/api/auth/me`](#get-api-auth-me)                                                                                                                          | [`GET /auth/me`](API_ENDPOINTS.md#get-auth-me)                                                                                                                                                                                                                                                                                  |
| GET    | [`/api/auth/me/access-grants`](#get-api-auth-me-access-grants)                                                                                              | [`GET /auth/me/access-grants`](API_ENDPOINTS.md#get-auth-me-access-grants)                                                                                                                                                                                                                                                      |
| DELETE | [`/api/auth/mfa`](#delete-api-auth-mfa)                                                                                                                     | [`DELETE /auth/mfa`](API_ENDPOINTS.md#delete-auth-mfa)                                                                                                                                                                                                                                                                          |
| POST   | [`/api/auth/mfa/enroll`](#post-api-auth-mfa-enroll)                                                                                                         | [`POST /auth/mfa/enroll`](API_ENDPOINTS.md#post-auth-mfa-enroll)                                                                                                                                                                                                                                                                |
| POST   | [`/api/auth/mfa/recovery`](#post-api-auth-mfa-recovery)                                                                                                     | [`POST /auth/mfa/recovery`](API_ENDPOINTS.md#post-auth-mfa-recovery)                                                                                                                                                                                                                                                            |
| POST   | [`/api/auth/mfa/recovery-codes/regenerate`](#post-api-auth-mfa-recovery-codes-regenerate)                                                                   | [`POST /auth/mfa/recovery-codes/regenerate`](API_ENDPOINTS.md#post-auth-mfa-recovery-codes-regenerate)                                                                                                                                                                                                                          |
| POST   | [`/api/auth/mfa/verify`](#post-api-auth-mfa-verify)                                                                                                         | [`POST /auth/mfa/verify`](API_ENDPOINTS.md#post-auth-mfa-verify)                                                                                                                                                                                                                                                                |
| POST   | [`/api/auth/password/forgot`](#post-api-auth-password-forgot)                                                                                               | [`POST /auth/password/forgot`](API_ENDPOINTS.md#post-auth-password-forgot)                                                                                                                                                                                                                                                      |
| POST   | [`/api/auth/password/reset`](#post-api-auth-password-reset)                                                                                                 | [`POST /auth/password/reset`](API_ENDPOINTS.md#post-auth-password-reset)                                                                                                                                                                                                                                                        |
| GET    | [`/api/auth/password-reset/:token/status`](#get-api-auth-password-reset-token-status)                                                                       | [`GET /auth/password-reset/:token/status`](API_ENDPOINTS.md#get-auth-password-reset-token-status)                                                                                                                                                                                                                               |
| POST   | [`/api/auth/refresh`](#post-api-auth-refresh)                                                                                                               | [`POST /auth/refresh`](API_ENDPOINTS.md#post-auth-refresh)                                                                                                                                                                                                                                                                      |
| POST   | [`/api/auth/select-workspace`](#post-api-auth-select-workspace)                                                                                             | [`POST /auth/select-tenant`](API_ENDPOINTS.md#post-auth-select-tenant)                                                                                                                                                                                                                                                          |
| PATCH  | [`/api/campaign-members/:memberId`](#patch-api-campaign-members-memberid)                                                                                   | [`PATCH /campaign-members/:id`](API_ENDPOINTS.md#patch-campaign-members-id)                                                                                                                                                                                                                                                     |
| DELETE | [`/api/campaign-members/:memberId`](#delete-api-campaign-members-memberid)                                                                                  | [`DELETE /campaign-members/:id`](API_ENDPOINTS.md#delete-campaign-members-id)                                                                                                                                                                                                                                                   |
| GET    | [`/api/campaigns`](#get-api-campaigns)                                                                                                                      | [`GET /campaigns`](API_ENDPOINTS.md#get-campaigns)                                                                                                                                                                                                                                                                              |
| POST   | [`/api/campaigns`](#post-api-campaigns)                                                                                                                     | [`POST /campaigns`](API_ENDPOINTS.md#post-campaigns)                                                                                                                                                                                                                                                                            |
| GET    | [`/api/campaigns/:campaignId`](#get-api-campaigns-campaignid)                                                                                               | [`GET /campaigns/:campaignId`](API_ENDPOINTS.md#get-campaigns-campaignid)                                                                                                                                                                                                                                                       |
| PATCH  | [`/api/campaigns/:campaignId`](#patch-api-campaigns-campaignid)                                                                                             | [`PATCH /campaigns/:campaignId`](API_ENDPOINTS.md#patch-campaigns-campaignid)                                                                                                                                                                                                                                                   |
| DELETE | [`/api/campaigns/:campaignId`](#delete-api-campaigns-campaignid)                                                                                            | [`DELETE /campaigns/:campaignId`](API_ENDPOINTS.md#delete-campaigns-campaignid)                                                                                                                                                                                                                                                 |
| POST   | [`/api/campaigns/:campaignId/geographic-allocation/apply`](#post-api-campaigns-campaignid-geographic-allocation-apply)                                      | [`POST /campaigns/:campaignId/geographic-allocation/apply`](API_ENDPOINTS.md#post-campaigns-campaignid-geographic-allocation-apply)                                                                                                                                                                                             |
| POST   | [`/api/campaigns/:campaignId/geographic-allocation/preview`](#post-api-campaigns-campaignid-geographic-allocation-preview)                                  | [`POST /campaigns/:campaignId/geographic-allocation/preview`](API_ENDPOINTS.md#post-campaigns-campaignid-geographic-allocation-preview)                                                                                                                                                                                         |
| GET    | [`/api/campaigns/:campaignId/members`](#get-api-campaigns-campaignid-members)                                                                               | [`GET /campaigns/:campaignId/members`](API_ENDPOINTS.md#get-campaigns-campaignid-members)                                                                                                                                                                                                                                       |
| POST   | [`/api/campaigns/:campaignId/members`](#post-api-campaigns-campaignid-members)                                                                              | [`POST /campaigns/:campaignId/members`](API_ENDPOINTS.md#post-campaigns-campaignid-members)                                                                                                                                                                                                                                     |
| GET    | [`/api/campaigns/:campaignId/organizations`](#get-api-campaigns-campaignid-organizations)                                                                   | [`GET /campaigns/:campaignId/organizations`](API_ENDPOINTS.md#get-campaigns-campaignid-organizations)                                                                                                                                                                                                                           |
| POST   | [`/api/campaigns/:campaignId/organizations`](#post-api-campaigns-campaignid-organizations)                                                                  | [`POST /campaigns/:campaignId/organizations`](API_ENDPOINTS.md#post-campaigns-campaignid-organizations)                                                                                                                                                                                                                         |
| GET    | [`/api/campaigns/:campaignId/prospects/:campaignProspectId/timeline`](#get-api-campaigns-campaignid-prospects-campaignprospectid-timeline)                  | [`GET /campaigns/:campaignId/prospects/:prospectId/timeline`](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-timeline)                                                                                                                                                                                          |
| POST   | [`/api/campaigns/:campaignId/prospects/bulk`](#post-api-campaigns-campaignid-prospects-bulk)                                                                | [`POST /campaigns/:campaignId/prospects/bulk`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-bulk)                                                                                                                                                                                                                       |
| POST   | [`/api/campaigns/:campaignId/prospects/bulk/preview`](#post-api-campaigns-campaignid-prospects-bulk-preview)                                                | [`POST /campaigns/:campaignId/prospects/bulk/preview`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-bulk-preview)                                                                                                                                                                                                       |
| POST   | [`/api/campaigns/:campaignId/status`](#post-api-campaigns-campaignid-status)                                                                                | [`POST /campaigns/:campaignId/status`](API_ENDPOINTS.md#post-campaigns-campaignid-status)                                                                                                                                                                                                                                       |
| GET    | [`/api/collision-events`](#get-api-collision-events)                                                                                                        | [`GET /collision-events`](API_ENDPOINTS.md#get-collision-events)                                                                                                                                                                                                                                                                |
| GET    | [`/api/collision-events/:collisionId`](#get-api-collision-events-collisionid)                                                                               | [`GET /collision-events/:collisionId`](API_ENDPOINTS.md#get-collision-events-collisionid)                                                                                                                                                                                                                                       |
| POST   | [`/api/collision-events/:collisionId/override-request`](#post-api-collision-events-collisionid-override-request)                                            | [`POST /collision-events/:collisionId/override-request`](API_ENDPOINTS.md#post-collision-events-collisionid-override-request)                                                                                                                                                                                                   |
| GET    | [`/api/conversations`](#get-api-conversations)                                                                                                              | [`GET /conversations`](API_ENDPOINTS.md#get-conversations)                                                                                                                                                                                                                                                                      |
| POST   | [`/api/conversations`](#post-api-conversations)                                                                                                             | [`POST /conversations`](API_ENDPOINTS.md#post-conversations)                                                                                                                                                                                                                                                                    |
| GET    | [`/api/conversations/:conversationId`](#get-api-conversations-conversationid)                                                                               | [`GET /conversations/:id`](API_ENDPOINTS.md#get-conversations-id)                                                                                                                                                                                                                                                               |
| PATCH  | [`/api/conversations/:conversationId`](#patch-api-conversations-conversationid)                                                                             | [`PATCH /conversations/:id`](API_ENDPOINTS.md#patch-conversations-id)                                                                                                                                                                                                                                                           |
| GET    | [`/api/conversations/:conversationId/messages`](#get-api-conversations-conversationid-messages)                                                             | [`GET /conversations/:id/messages`](API_ENDPOINTS.md#get-conversations-id-messages)                                                                                                                                                                                                                                             |
| POST   | [`/api/conversations/:conversationId/messages`](#post-api-conversations-conversationid-messages)                                                            | [`POST /conversations/:id/messages`](API_ENDPOINTS.md#post-conversations-id-messages)                                                                                                                                                                                                                                           |
| PATCH  | [`/api/conversations/:conversationId/mute`](#patch-api-conversations-conversationid-mute)                                                                   | [`PATCH /conversations/:id/mute`](API_ENDPOINTS.md#patch-conversations-id-mute)                                                                                                                                                                                                                                                 |
| GET    | [`/api/conversations/:conversationId/participants`](#get-api-conversations-conversationid-participants)                                                     | [`GET /conversations/:id/participants`](API_ENDPOINTS.md#get-conversations-id-participants)                                                                                                                                                                                                                                     |
| POST   | [`/api/conversations/:conversationId/participants`](#post-api-conversations-conversationid-participants)                                                    | [`POST /conversations/:id/participants`](API_ENDPOINTS.md#post-conversations-id-participants)                                                                                                                                                                                                                                   |
| DELETE | [`/api/conversations/:conversationId/participants/:membershipId`](#delete-api-conversations-conversationid-participants-membershipid)                       | [`DELETE /conversations/:id/participants/:membershipId`](API_ENDPOINTS.md#delete-conversations-id-participants-membershipid)                                                                                                                                                                                                    |
| POST   | [`/api/conversations/:conversationId/read`](#post-api-conversations-conversationid-read)                                                                    | [`POST /conversations/:id/read`](API_ENDPOINTS.md#post-conversations-id-read)                                                                                                                                                                                                                                                   |
| GET    | [`/api/dashboard/admin`](#get-api-dashboard-admin)                                                                                                          | [`GET /dashboard/admin`](API_ENDPOINTS.md#get-dashboard-admin)                                                                                                                                                                                                                                                                  |
| GET    | [`/api/dashboard/director`](#get-api-dashboard-director)                                                                                                    | [`GET /dashboard/director`](API_ENDPOINTS.md#get-dashboard-director)                                                                                                                                                                                                                                                            |
| POST   | [`/api/devices`](#post-api-devices)                                                                                                                         | [`POST /devices`](API_ENDPOINTS.md#post-devices)                                                                                                                                                                                                                                                                                |
| DELETE | [`/api/devices/:deviceId`](#delete-api-devices-deviceid)                                                                                                    | [`DELETE /devices/:deviceId`](API_ENDPOINTS.md#delete-devices-deviceid)                                                                                                                                                                                                                                                         |
| GET    | [`/api/exports`](#get-api-exports)                                                                                                                          | [`GET /exports`](API_ENDPOINTS.md#get-exports)                                                                                                                                                                                                                                                                                  |
| POST   | [`/api/exports`](#post-api-exports)                                                                                                                         | [`POST /exports`](API_ENDPOINTS.md#post-exports)                                                                                                                                                                                                                                                                                |
| GET    | [`/api/exports/:exportId`](#get-api-exports-exportid)                                                                                                       | [`GET /exports/:exportId`](API_ENDPOINTS.md#get-exports-exportid)                                                                                                                                                                                                                                                               |
| POST   | [`/api/exports/:exportId/cancel`](#post-api-exports-exportid-cancel)                                                                                        | [`POST /exports/:exportId/cancel`](API_ENDPOINTS.md#post-exports-exportid-cancel)                                                                                                                                                                                                                                               |
| GET    | [`/api/exports/:exportId/download`](#get-api-exports-exportid-download)                                                                                     | [`GET /exports/:exportId/download`](API_ENDPOINTS.md#get-exports-exportid-download)                                                                                                                                                                                                                                             |
| GET    | [`/api/exports/:exportId/file`](#get-api-exports-exportid-file)                                                                                             | [`GET /exports/:exportId/file`](API_ENDPOINTS.md#get-exports-exportid-file)                                                                                                                                                                                                                                                     |
| POST   | [`/api/exports/preview`](#post-api-exports-preview)                                                                                                         | [`POST /exports/preview`](API_ENDPOINTS.md#post-exports-preview)                                                                                                                                                                                                                                                                |
| GET    | [`/api/follow-ups`](#get-api-follow-ups)                                                                                                                    | [`GET /follow-ups`](API_ENDPOINTS.md#get-follow-ups)                                                                                                                                                                                                                                                                            |
| GET    | [`/api/health`](#get-api-health)                                                                                                                            | [`GET /health`](API_ENDPOINTS.md#get-health)                                                                                                                                                                                                                                                                                    |
| PATCH  | [`/api/import-issues/:issueId`](#patch-api-import-issues-issueid)                                                                                           | [`PATCH /import-issues/:issueId`](API_ENDPOINTS.md#patch-import-issues-issueid)                                                                                                                                                                                                                                                 |
| GET    | [`/api/imports`](#get-api-imports)                                                                                                                          | [`GET /imports`](API_ENDPOINTS.md#get-imports)                                                                                                                                                                                                                                                                                  |
| POST   | [`/api/imports`](#post-api-imports)                                                                                                                         | [`POST /imports`](API_ENDPOINTS.md#post-imports)                                                                                                                                                                                                                                                                                |
| GET    | [`/api/imports/:importId`](#get-api-imports-importid)                                                                                                       | [`GET /imports/:importId`](API_ENDPOINTS.md#get-imports-importid)                                                                                                                                                                                                                                                               |
| POST   | [`/api/imports/:importId/cancel`](#post-api-imports-importid-cancel)                                                                                        | [`POST /imports/:importId/cancel`](API_ENDPOINTS.md#post-imports-importid-cancel)                                                                                                                                                                                                                                               |
| POST   | [`/api/imports/:importId/commit`](#post-api-imports-importid-commit)                                                                                        | [`POST /imports/:importId/commit`](API_ENDPOINTS.md#post-imports-importid-commit)                                                                                                                                                                                                                                               |
| POST   | [`/api/imports/:importId/file`](#post-api-imports-importid-file)                                                                                            | [`POST /imports/:importId/file`](API_ENDPOINTS.md#post-imports-importid-file)                                                                                                                                                                                                                                                   |
| GET    | [`/api/imports/:importId/issues`](#get-api-imports-importid-issues)                                                                                         | [`GET /imports/:importId/issues`](API_ENDPOINTS.md#get-imports-importid-issues)                                                                                                                                                                                                                                                 |
| PUT    | [`/api/imports/:importId/mapping`](#put-api-imports-importid-mapping)                                                                                       | [`PUT /imports/:importId/mapping`](API_ENDPOINTS.md#put-imports-importid-mapping)                                                                                                                                                                                                                                               |
| GET    | [`/api/imports/:importId/report`](#get-api-imports-importid-report)                                                                                         | [`GET /imports/:importId/report`](API_ENDPOINTS.md#get-imports-importid-report)                                                                                                                                                                                                                                                 |
| GET    | [`/api/imports/:importId/rows`](#get-api-imports-importid-rows)                                                                                             | [`GET /imports/:importId/rows`](API_ENDPOINTS.md#get-imports-importid-rows)                                                                                                                                                                                                                                                     |
| POST   | [`/api/imports/:importId/validate`](#post-api-imports-importid-validate)                                                                                    | [`POST /imports/:importId/validate`](API_ENDPOINTS.md#post-imports-importid-validate)                                                                                                                                                                                                                                           |
| GET    | [`/api/manager/dashboard`](#get-api-manager-dashboard)                                                                                                      | [`GET /manager/dashboard`](API_ENDPOINTS.md#get-manager-dashboard)                                                                                                                                                                                                                                                              |
| GET    | [`/api/me`](#get-api-me)                                                                                                                                    | [`GET /me`](API_ENDPOINTS.md#get-me)                                                                                                                                                                                                                                                                                            |
| PATCH  | [`/api/me`](#patch-api-me)                                                                                                                                  | [`PATCH /me`](API_ENDPOINTS.md#patch-me)                                                                                                                                                                                                                                                                                        |
| POST   | [`/api/me/active-membership`](#post-api-me-active-membership)                                                                                               | [`POST /me/active-membership`](API_ENDPOINTS.md#post-me-active-membership)                                                                                                                                                                                                                                                      |
| GET    | [`/api/me/memberships`](#get-api-me-memberships)                                                                                                            | [`GET /me/memberships`](API_ENDPOINTS.md#get-me-memberships)                                                                                                                                                                                                                                                                    |
| GET    | [`/api/me/preferences`](#get-api-me-preferences)                                                                                                            | [`GET /me/preferences`](API_ENDPOINTS.md#get-me-preferences)                                                                                                                                                                                                                                                                    |
| PATCH  | [`/api/me/preferences`](#patch-api-me-preferences)                                                                                                          | [`PATCH /me/preferences`](API_ENDPOINTS.md#patch-me-preferences)                                                                                                                                                                                                                                                                |
| GET    | [`/api/me/sessions`](#get-api-me-sessions)                                                                                                                  | [`GET /me/sessions`](API_ENDPOINTS.md#get-me-sessions)                                                                                                                                                                                                                                                                          |
| DELETE | [`/api/me/sessions/:sessionId`](#delete-api-me-sessions-sessionid)                                                                                          | [`DELETE /me/sessions/:sessionId`](API_ENDPOINTS.md#delete-me-sessions-sessionid)                                                                                                                                                                                                                                               |
| DELETE | [`/api/me/sessions/others`](#delete-api-me-sessions-others)                                                                                                 | [`DELETE /me/sessions/others`](API_ENDPOINTS.md#delete-me-sessions-others)                                                                                                                                                                                                                                                      |
| GET    | [`/api/memberships`](#get-api-memberships)                                                                                                                  | [`GET /memberships`](API_ENDPOINTS.md#get-memberships)                                                                                                                                                                                                                                                                          |
| POST   | [`/api/memberships`](#post-api-memberships)                                                                                                                 | [`POST /memberships`](API_ENDPOINTS.md#post-memberships)                                                                                                                                                                                                                                                                        |
| GET    | [`/api/memberships/:membershipId`](#get-api-memberships-membershipid)                                                                                       | [`GET /memberships/:membershipId`](API_ENDPOINTS.md#get-memberships-membershipid)                                                                                                                                                                                                                                               |
| PATCH  | [`/api/memberships/:membershipId`](#patch-api-memberships-membershipid)                                                                                     | [`PATCH /memberships/:membershipId`](API_ENDPOINTS.md#patch-memberships-membershipid)                                                                                                                                                                                                                                           |
| POST   | [`/api/memberships/:membershipId/reactivate`](#post-api-memberships-membershipid-reactivate)                                                                | [`POST /memberships/:membershipId/reactivate`](API_ENDPOINTS.md#post-memberships-membershipid-reactivate)                                                                                                                                                                                                                       |
| POST   | [`/api/memberships/:membershipId/resend-invite`](#post-api-memberships-membershipid-resend-invite)                                                          | [`POST /memberships/:membershipId/resend-invite`](API_ENDPOINTS.md#post-memberships-membershipid-resend-invite)                                                                                                                                                                                                                 |
| POST   | [`/api/memberships/:membershipId/suspend`](#post-api-memberships-membershipid-suspend)                                                                      | [`POST /memberships/:membershipId/suspend`](API_ENDPOINTS.md#post-memberships-membershipid-suspend)                                                                                                                                                                                                                             |
| PATCH  | [`/api/messages/:messageId`](#patch-api-messages-messageid)                                                                                                 | [`PATCH /messages/:id`](API_ENDPOINTS.md#patch-messages-id)                                                                                                                                                                                                                                                                     |
| DELETE | [`/api/messages/:messageId`](#delete-api-messages-messageid)                                                                                                | [`DELETE /messages/:id`](API_ENDPOINTS.md#delete-messages-id)                                                                                                                                                                                                                                                                   |
| GET    | [`/api/notification-preferences`](#get-api-notification-preferences)                                                                                        | [`GET /notification-preferences`](API_ENDPOINTS.md#get-notification-preferences)                                                                                                                                                                                                                                                |
| PUT    | [`/api/notification-preferences`](#put-api-notification-preferences)                                                                                        | [`PUT /notification-preferences`](API_ENDPOINTS.md#put-notification-preferences)                                                                                                                                                                                                                                                |
| GET    | [`/api/notifications`](#get-api-notifications)                                                                                                              | [`GET /notifications`](API_ENDPOINTS.md#get-notifications)                                                                                                                                                                                                                                                                      |
| POST   | [`/api/notifications/:notificationId/read`](#post-api-notifications-notificationid-read)                                                                    | [`POST /notifications/:notificationId/read`](API_ENDPOINTS.md#post-notifications-notificationid-read)                                                                                                                                                                                                                           |
| POST   | [`/api/notifications/read-all`](#post-api-notifications-read-all)                                                                                           | [`POST /notifications/read-all`](API_ENDPOINTS.md#post-notifications-read-all)                                                                                                                                                                                                                                                  |
| GET    | [`/api/notifications/unread-count`](#get-api-notifications-unread-count)                                                                                    | [`GET /notifications/unread-count`](API_ENDPOINTS.md#get-notifications-unread-count)                                                                                                                                                                                                                                            |
| GET    | [`/api/organizations`](#get-api-organizations)                                                                                                              | [`GET /organizations`](API_ENDPOINTS.md#get-organizations)                                                                                                                                                                                                                                                                      |
| GET    | [`/api/override-requests`](#get-api-override-requests)                                                                                                      | [`GET /override-requests`](API_ENDPOINTS.md#get-override-requests)                                                                                                                                                                                                                                                              |
| GET    | [`/api/override-requests/:requestId`](#get-api-override-requests-requestid)                                                                                 | [`GET /override-requests/:requestId`](API_ENDPOINTS.md#get-override-requests-requestid)                                                                                                                                                                                                                                         |
| POST   | [`/api/override-requests/:requestId/:decision`](#post-api-override-requests-requestid-decision)                                                             | [`POST /override-requests/:requestId/approve`](API_ENDPOINTS.md#post-override-requests-requestid-approve)<br>[`POST /override-requests/:requestId/reject`](API_ENDPOINTS.md#post-override-requests-requestid-reject)<br>[`POST /override-requests/:requestId/cancel`](API_ENDPOINTS.md#post-override-requests-requestid-cancel) |
| GET    | [`/api/permissions`](#get-api-permissions)                                                                                                                  | [`GET /permissions`](API_ENDPOINTS.md#get-permissions)                                                                                                                                                                                                                                                                          |
| GET    | [`/api/prospector/today`](#get-api-prospector-today)                                                                                                        | [`GET /prospector/today`](API_ENDPOINTS.md#get-prospector-today)                                                                                                                                                                                                                                                                |
| GET    | [`/api/prospects`](#get-api-prospects)                                                                                                                      | [`GET /prospects`](API_ENDPOINTS.md#get-prospects)                                                                                                                                                                                                                                                                              |
| GET    | [`/api/prospects/:prospectId`](#get-api-prospects-prospectid)                                                                                               | [`GET /prospects/:prospectId`](API_ENDPOINTS.md#get-prospects-prospectid)                                                                                                                                                                                                                                                       |
| GET    | [`/api/prospects/:prospectId/addresses`](#get-api-prospects-prospectid-addresses)                                                                           | [`GET /prospects/:prospectId/addresses`](API_ENDPOINTS.md#get-prospects-prospectid-addresses)                                                                                                                                                                                                                                   |
| GET    | [`/api/prospects/:prospectId/campaign-memberships`](#get-api-prospects-prospectid-campaign-memberships)                                                     | [`GET /prospects/:prospectId/campaign-memberships`](API_ENDPOINTS.md#get-prospects-prospectid-campaign-memberships)                                                                                                                                                                                                             |
| GET    | [`/api/prospects/:prospectId/consents`](#get-api-prospects-prospectid-consents)                                                                             | [`GET /prospects/:prospectId/consents`](API_ENDPOINTS.md#get-prospects-prospectid-consents)                                                                                                                                                                                                                                     |
| POST   | [`/api/prospects/:prospectId/consents`](#post-api-prospects-prospectid-consents)                                                                            | [`POST /prospects/:prospectId/consents`](API_ENDPOINTS.md#post-prospects-prospectid-consents)                                                                                                                                                                                                                                   |
| GET    | [`/api/prospects/:prospectId/contacts`](#get-api-prospects-prospectid-contacts)                                                                             | [`GET /prospects/:prospectId/contacts`](API_ENDPOINTS.md#get-prospects-prospectid-contacts)                                                                                                                                                                                                                                     |
| GET    | [`/api/prospects/nearby`](#get-api-prospects-nearby)                                                                                                        | [`GET /prospects/nearby`](API_ENDPOINTS.md#get-prospects-nearby)                                                                                                                                                                                                                                                                |
| GET    | [`/api/reports/:report`](#get-api-reports-report)                                                                                                           | [`GET /reports/:reportId([0-9a-fA-F-]{36})`](API_ENDPOINTS.md#get-reports-reportid-0-9a-fa-f-36)                                                                                                                                                                                                                                |
| GET    | [`/api/reservations`](#get-api-reservations)                                                                                                                | [`GET /reservations`](API_ENDPOINTS.md#get-reservations)                                                                                                                                                                                                                                                                        |
| GET    | [`/api/reservations/:reservationId`](#get-api-reservations-reservationid)                                                                                   | [`GET /reservations/:reservationId`](API_ENDPOINTS.md#get-reservations-reservationid)                                                                                                                                                                                                                                           |
| POST   | [`/api/reservations/:reservationId/extend`](#post-api-reservations-reservationid-extend)                                                                    | [`POST /reservations/:reservationId/extend`](API_ENDPOINTS.md#post-reservations-reservationid-extend)                                                                                                                                                                                                                           |
| POST   | [`/api/reservations/:reservationId/heartbeat`](#post-api-reservations-reservationid-heartbeat)                                                              | [`POST /reservations/:reservationId/heartbeat`](API_ENDPOINTS.md#post-reservations-reservationid-heartbeat)                                                                                                                                                                                                                     |
| POST   | [`/api/reservations/:reservationId/release`](#post-api-reservations-reservationid-release)                                                                  | [`POST /reservations/:reservationId/release`](API_ENDPOINTS.md#post-reservations-reservationid-release)                                                                                                                                                                                                                         |
| POST   | [`/api/reservations/check`](#post-api-reservations-check)                                                                                                   | [`POST /reservations/check`](API_ENDPOINTS.md#post-reservations-check)                                                                                                                                                                                                                                                          |
| GET    | [`/api/roles`](#get-api-roles)                                                                                                                              | [`GET /roles`](API_ENDPOINTS.md#get-roles)                                                                                                                                                                                                                                                                                      |
| GET    | [`/api/roles/:role/permissions`](#get-api-roles-role-permissions)                                                                                           | [`GET /roles/:role/permissions`](API_ENDPOINTS.md#get-roles-role-permissions)                                                                                                                                                                                                                                                   |
| PUT    | [`/api/roles/:role/permissions`](#put-api-roles-role-permissions)                                                                                           | [`PUT /roles/:role/permissions`](API_ENDPOINTS.md#put-roles-role-permissions)                                                                                                                                                                                                                                                   |
| GET    | [`/api/routes`](#get-api-routes)                                                                                                                            | [`GET /routes`](API_ENDPOINTS.md#get-routes)                                                                                                                                                                                                                                                                                    |
| POST   | [`/api/routes`](#post-api-routes)                                                                                                                           | [`POST /routes`](API_ENDPOINTS.md#post-routes)                                                                                                                                                                                                                                                                                  |
| PATCH  | [`/api/route-stops/:stopId`](#patch-api-route-stops-stopid)                                                                                                 | [`PATCH /route-stops/:stopId`](API_ENDPOINTS.md#patch-route-stops-stopid)                                                                                                                                                                                                                                                       |
| DELETE | [`/api/route-stops/:stopId`](#delete-api-route-stops-stopid)                                                                                                | [`DELETE /route-stops/:stopId`](API_ENDPOINTS.md#delete-route-stops-stopid)                                                                                                                                                                                                                                                     |
| GET    | [`/api/routes/:routeId`](#get-api-routes-routeid)                                                                                                           | [`GET /routes/:routeId`](API_ENDPOINTS.md#get-routes-routeid)                                                                                                                                                                                                                                                                   |
| PATCH  | [`/api/routes/:routeId`](#patch-api-routes-routeid)                                                                                                         | [`PATCH /routes/:routeId`](API_ENDPOINTS.md#patch-routes-routeid)                                                                                                                                                                                                                                                               |
| DELETE | [`/api/routes/:routeId`](#delete-api-routes-routeid)                                                                                                        | [`DELETE /routes/:routeId`](API_ENDPOINTS.md#delete-routes-routeid)                                                                                                                                                                                                                                                             |
| POST   | [`/api/routes/:routeId/complete`](#post-api-routes-routeid-complete)                                                                                        | [`POST /routes/:routeId/complete`](API_ENDPOINTS.md#post-routes-routeid-complete)                                                                                                                                                                                                                                               |
| POST   | [`/api/routes/:routeId/optimize`](#post-api-routes-routeid-optimize)                                                                                        | [`POST /routes/:routeId/optimize`](API_ENDPOINTS.md#post-routes-routeid-optimize)                                                                                                                                                                                                                                               |
| POST   | [`/api/routes/:routeId/start`](#post-api-routes-routeid-start)                                                                                              | [`POST /routes/:routeId/start`](API_ENDPOINTS.md#post-routes-routeid-start)                                                                                                                                                                                                                                                     |
| PUT    | [`/api/routes/:routeId/stop-order`](#put-api-routes-routeid-stop-order)                                                                                     | [`PUT /routes/:routeId/stop-order`](API_ENDPOINTS.md#put-routes-routeid-stop-order)                                                                                                                                                                                                                                             |
| POST   | [`/api/routes/:routeId/stops`](#post-api-routes-routeid-stops)                                                                                              | [`POST /routes/:routeId/stops`](API_ENDPOINTS.md#post-routes-routeid-stops)                                                                                                                                                                                                                                                     |
| GET    | [`/api/search`](#get-api-search)                                                                                                                            | [`GET /search`](API_ENDPOINTS.md#get-search)                                                                                                                                                                                                                                                                                    |
| GET    | [`/api/search/facets`](#get-api-search-facets)                                                                                                              | [`GET /search/facets`](API_ENDPOINTS.md#get-search-facets)                                                                                                                                                                                                                                                                      |
| GET    | [`/api/settings/default-statuses`](#get-api-settings-default-statuses)                                                                                      | [`GET /settings/default-statuses`](API_ENDPOINTS.md#get-settings-default-statuses)                                                                                                                                                                                                                                              |
| GET    | [`/api/teams`](#get-api-teams)                                                                                                                              | [`GET /teams`](API_ENDPOINTS.md#get-teams)                                                                                                                                                                                                                                                                                      |
| GET    | [`/api/teams/:teamId`](#get-api-teams-teamid)                                                                                                               | [`GET /teams/:teamId`](API_ENDPOINTS.md#get-teams-teamid)                                                                                                                                                                                                                                                                       |
| PATCH  | [`/api/teams/:teamId`](#patch-api-teams-teamid)                                                                                                             | [`PATCH /teams/:teamId`](API_ENDPOINTS.md#patch-teams-teamid)                                                                                                                                                                                                                                                                   |
| GET    | [`/api/teams/:teamId/capacity`](#get-api-teams-teamid-capacity)                                                                                             | [`GET /teams/:teamId/capacity`](API_ENDPOINTS.md#get-teams-teamid-capacity)                                                                                                                                                                                                                                                     |
| GET    | [`/api/teams/:teamId/members`](#get-api-teams-teamid-members)                                                                                               | [`GET /teams/:teamId/members`](API_ENDPOINTS.md#get-teams-teamid-members)                                                                                                                                                                                                                                                       |
| POST   | [`/api/teams/:teamId/members`](#post-api-teams-teamid-members)                                                                                              | [`POST /teams/:teamId/members`](API_ENDPOINTS.md#post-teams-teamid-members)                                                                                                                                                                                                                                                     |
| PATCH  | [`/api/teams/:teamId/members/:membershipId`](#patch-api-teams-teamid-members-membershipid)                                                                  | [`PATCH /teams/:teamId/members/:membershipId`](API_ENDPOINTS.md#patch-teams-teamid-members-membershipid)                                                                                                                                                                                                                        |
| DELETE | [`/api/teams/:teamId/members/:membershipId`](#delete-api-teams-teamid-members-membershipid)                                                                 | [`DELETE /teams/:teamId/members/:membershipId`](API_ENDPOINTS.md#delete-teams-teamid-members-membershipid)                                                                                                                                                                                                                      |
| GET    | [`/api/territories`](#get-api-territories)                                                                                                                  | [`GET /territories`](API_ENDPOINTS.md#get-territories)                                                                                                                                                                                                                                                                          |
| GET    | [`/api/territories/map`](#get-api-territories-map)                                                                                                          | [`GET /territories/map`](API_ENDPOINTS.md#get-territories-map)                                                                                                                                                                                                                                                                  |
| GET    | [`/api/territory-assignments`](#get-api-territory-assignments)                                                                                              | [`GET /territory-assignments`](API_ENDPOINTS.md#get-territory-assignments)                                                                                                                                                                                                                                                      |
| POST   | [`/api/territory-assignments`](#post-api-territory-assignments)                                                                                             | [`POST /territory-assignments`](API_ENDPOINTS.md#post-territory-assignments)                                                                                                                                                                                                                                                    |
| PATCH  | [`/api/territory-assignments/:assignmentId`](#patch-api-territory-assignments-assignmentid)                                                                 | [`PATCH /territory-assignments/:id`](API_ENDPOINTS.md#patch-territory-assignments-id)                                                                                                                                                                                                                                           |
| DELETE | [`/api/territory-assignments/:assignmentId`](#delete-api-territory-assignments-assignmentid)                                                                | [`DELETE /territory-assignments/:id`](API_ENDPOINTS.md#delete-territory-assignments-id)                                                                                                                                                                                                                                         |
| GET    | [`/api/work-queue`](#get-api-work-queue)                                                                                                                    | [`GET /work-queue`](API_ENDPOINTS.md#get-work-queue)                                                                                                                                                                                                                                                                            |
| GET    | [`/api/work-queue/:campaignId/:prospectId`](#get-api-work-queue-campaignid-prospectid)                                                                      | [`GET /work-queue/:campaignId/:prospectId`](API_ENDPOINTS.md#get-work-queue-campaignid-prospectid)                                                                                                                                                                                                                              |
| POST   | [`/api/work-queue/:campaignId/:prospectId/activities`](#post-api-work-queue-campaignid-prospectid-activities)                                               | [`POST /campaigns/:campaignId/prospects/:prospectId/activities`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-activities)                                                                                                                                                                                    |
| GET    | [`/api/work-queue/:campaignId/:prospectId/collision-decision`](#get-api-work-queue-campaignid-prospectid-collision-decision)                                | [`GET /campaigns/:campaignId/prospects/:prospectId/collision-decision`](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-collision-decision)                                                                                                                                                                      |
| POST   | [`/api/work-queue/:campaignId/:prospectId/collision-overrides`](#post-api-work-queue-campaignid-prospectid-collision-overrides)                             | [`POST /campaigns/:campaignId/prospects/:prospectId/collision-overrides`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-collision-overrides)                                                                                                                                                                  |
| GET    | [`/api/work-queue/:campaignId/:prospectId/follow-ups`](#get-api-work-queue-campaignid-prospectid-follow-ups)                                                | [`GET /campaigns/:campaignId/prospects/:prospectId/follow-ups`](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-follow-ups)                                                                                                                                                                                      |
| POST   | [`/api/work-queue/:campaignId/:prospectId/follow-ups`](#post-api-work-queue-campaignid-prospectid-follow-ups)                                               | [`POST /campaigns/:campaignId/prospects/:prospectId/follow-ups`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups)                                                                                                                                                                                    |
| POST   | [`/api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/cancel`](#post-api-work-queue-campaignid-prospectid-follow-ups-followupid-cancel)          | [`POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/cancel`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-cancel)                                                                                                                                               |
| POST   | [`/api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/complete`](#post-api-work-queue-campaignid-prospectid-follow-ups-followupid-complete)      | [`POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/complete`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-complete)                                                                                                                                           |
| PATCH  | [`/api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/reschedule`](#patch-api-work-queue-campaignid-prospectid-follow-ups-followupid-reschedule) | [`PATCH /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule`](API_ENDPOINTS.md#patch-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-reschedule)                                                                                                                                     |
| GET    | [`/api/work-queue/:campaignId/:prospectId/reservation`](#get-api-work-queue-campaignid-prospectid-reservation)                                              | [`GET /campaigns/:campaignId/prospects/:prospectId/reservation`](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-reservation)                                                                                                                                                                                    |
| POST   | [`/api/work-queue/:campaignId/:prospectId/reservation`](#post-api-work-queue-campaignid-prospectid-reservation)                                             | [`POST /campaigns/:campaignId/prospects/:prospectId/reservation`](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-reservation)                                                                                                                                                                                  |
| DELETE | [`/api/work-queue/:campaignId/:prospectId/reservation/:reservationId`](#delete-api-work-queue-campaignid-prospectid-reservation-reservationid)              | [`DELETE /campaigns/:campaignId/prospects/:prospectId/reservation/:reservationId`](API_ENDPOINTS.md#delete-campaigns-campaignid-prospects-prospectid-reservation-reservationid)                                                                                                                                                 |
| GET    | [`/api/work-queue/:campaignId/:prospectId/timeline`](#get-api-work-queue-campaignid-prospectid-timeline)                                                    | [`GET /campaigns/:campaignId/prospects/:prospectId/timeline`](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-timeline)                                                                                                                                                                                          |
| GET    | [`/api/work-queue/options`](#get-api-work-queue-options)                                                                                                    | [`GET /work-queue/options`](API_ENDPOINTS.md#get-work-queue-options)                                                                                                                                                                                                                                                            |

<a id="get-api-actions"></a>

## GET /api/actions

[Source](../../apps/web/src/app/api/actions/route.ts#L16)

- **Backend contract:** [GET /actions](API_ENDPOINTS.md#get-actions).
- **Query forwarded/read:** `campaignId`, `assigneeMembershipId`, `status`, `type`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    campaignId: string;
    campaignProspectId: string;
    type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
    subject: string;
    status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
    outcomeCode:
      | null
      | 'completed'
      | 'no_answer'
      | 'contacted'
      | 'interested'
      | 'not_interested'
      | 'qualified'
      | 'converted'
      | 'do_not_contact';
    dueAt: null | string;
    completedAt: null | string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-actions"></a>

## POST /api/actions

[Source](../../apps/web/src/app/api/actions/route.ts#L46)

- **Backend contract:** [POST /actions](API_ENDPOINTS.md#post-actions).
- **Query forwarded/read:** `campaignId`, `assigneeMembershipId`, `status`, `type`, `cursor`, `limit`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateActionDto](API_REQUEST_SCHEMAS.md#createactiondto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="get-api-actions-actionid"></a>

## GET /api/actions/:actionId

[Source](../../apps/web/src/app/api/actions/[actionId]/route.ts#L8)

- **Backend contract:** [GET /actions/:actionId](API_ENDPOINTS.md#get-actions-actionid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="patch-api-actions-actionid"></a>

## PATCH /api/actions/:actionId

[Source](../../apps/web/src/app/api/actions/[actionId]/route.ts#L29)

- **Backend contract:** [PATCH /actions/:actionId](API_ENDPOINTS.md#patch-actions-actionid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateActionDto](API_REQUEST_SCHEMAS.md#updateactiondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="post-api-actions-actionid-cancel"></a>

## POST /api/actions/:actionId/cancel

[Source](../../apps/web/src/app/api/actions/[actionId]/cancel/route.ts#L8)

- **Backend contract:** [POST /actions/:actionId/cancel](API_ENDPOINTS.md#post-actions-actionid-cancel).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ReasonDto](API_REQUEST_SCHEMAS.md#reasondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="post-api-actions-actionid-complete"></a>

## POST /api/actions/:actionId/complete

[Source](../../apps/web/src/app/api/actions/[actionId]/complete/route.ts#L14)

- **Backend contract:** [POST /actions/:actionId/complete](API_ENDPOINTS.md#post-actions-actionid-complete).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CompleteActionDto](API_REQUEST_SCHEMAS.md#completeactiondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="post-api-actions-actionid-corrections"></a>

## POST /api/actions/:actionId/corrections

[Source](../../apps/web/src/app/api/actions/[actionId]/corrections/route.ts#L8)

- **Backend contract:** [POST /actions/:actionId/corrections](API_ENDPOINTS.md#post-actions-actionid-corrections).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CorrectionDto](API_REQUEST_SCHEMAS.md#correctiondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="get-api-actions-actionid-events"></a>

## GET /api/actions/:actionId/events

[Source](../../apps/web/src/app/api/actions/[actionId]/events/route.ts#L7)

- **Backend contract:** [GET /actions/:actionId/events](API_ENDPOINTS.md#get-actions-actionid-events).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    actionId: string;
    eventType: string;
    actorMembershipId: null | string;
    payload: {
      [key: string]: unknown;
    };
    occurredAt: string;
  }>;
  nextCursor?: undefined | null | string;
};
```

<a id="post-api-actions-actionid-start"></a>

## POST /api/actions/:actionId/start

[Source](../../apps/web/src/app/api/actions/[actionId]/start/route.ts#L14)

- **Backend contract:** [POST /actions/:actionId/start](API_ENDPOINTS.md#post-actions-actionid-start).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [StartActionDto](API_REQUEST_SCHEMAS.md#startactiondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  subject: string;
  status: 'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';
  outcomeCode:
    | null
    | 'completed'
    | 'no_answer'
    | 'contacted'
    | 'interested'
    | 'not_interested'
    | 'qualified'
    | 'converted'
    | 'do_not_contact';
  dueAt: null | string;
  completedAt: null | string;
};
```

<a id="get-api-assignments"></a>

## GET /api/assignments

[Source](../../apps/web/src/app/api/assignments/route.ts#L8)

- **Backend contract:** [GET /assignments](API_ENDPOINTS.md#get-assignments).
- **Query forwarded/read:** `campaignId`, `teamId`, `assignedUserId`, `status`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    organizationId: string;
    teamId: string;
    assignedUserId: null | string;
    assignedAt: string;
    endedAt: null | string;
    status: 'completed' | 'active' | 'paused' | 'revoked';
    priority: 'low' | 'normal' | 'high' | 'critical';
    endReason: null | string;
    updatedAt: string;
    etag: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-assignments-assignmentid"></a>

## GET /api/assignments/:assignmentId

[Source](../../apps/web/src/app/api/assignments/[assignmentId]/route.ts#L8)

- **Backend contract:** [GET /assignments/:assignmentId](API_ENDPOINTS.md#get-assignments-assignmentid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string;
  endedAt: null | string;
  status: 'completed' | 'active' | 'paused' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string;
  etag: string;
};
```

<a id="patch-api-assignments-assignmentid"></a>

## PATCH /api/assignments/:assignmentId

[Source](../../apps/web/src/app/api/assignments/[assignmentId]/route.ts#L29)

- **Backend contract:** [PATCH /assignments/:assignmentId](API_ENDPOINTS.md#patch-assignments-assignmentid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateAssignmentDto](API_REQUEST_SCHEMAS.md#updateassignmentdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string;
  endedAt: null | string;
  status: 'completed' | 'active' | 'paused' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-assignments-assignmentid-complete"></a>

## POST /api/assignments/:assignmentId/complete

[Source](../../apps/web/src/app/api/assignments/[assignmentId]/complete/route.ts#L8)

- **Backend contract:** [POST /assignments/:assignmentId/complete](API_ENDPOINTS.md#post-assignments-assignmentid-complete).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string;
  endedAt: null | string;
  status: 'completed' | 'active' | 'paused' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-assignments-assignmentid-reassign"></a>

## POST /api/assignments/:assignmentId/reassign

[Source](../../apps/web/src/app/api/assignments/[assignmentId]/reassign/route.ts#L8)

- **Backend contract:** [POST /assignments/:assignmentId/reassign](API_ENDPOINTS.md#post-assignments-assignmentid-reassign).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ReassignAssignmentDto](API_REQUEST_SCHEMAS.md#reassignassignmentdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string;
  endedAt: null | string;
  status: 'completed' | 'active' | 'paused' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-assignments-assignmentid-revoke"></a>

## POST /api/assignments/:assignmentId/revoke

[Source](../../apps/web/src/app/api/assignments/[assignmentId]/revoke/route.ts#L8)

- **Backend contract:** [POST /assignments/:assignmentId/revoke](API_ENDPOINTS.md#post-assignments-assignmentid-revoke).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string;
  endedAt: null | string;
  status: 'completed' | 'active' | 'paused' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-assignments-bulk"></a>

## POST /api/assignments/bulk

[Source](../../apps/web/src/app/api/assignments/bulk/route.ts#L12)

- **Backend contract:** [POST /assignments/bulk](API_ENDPOINTS.md#post-assignments-bulk).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto).

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  ruleId: null | string;
  mode: 'preview' | 'apply';
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: Array<{
    prospectId: string;
    outcome: 'proposed' | 'already_assigned' | 'inactive_prospect' | 'missing_coordinates';
    teamId?: undefined | string;
    assignedUserId?: undefined | null | string;
    conflict?:
      | undefined
      | null
      | {
          teamId?: undefined | string;
          assignedUserId?: undefined | null | string;
        };
  }>;
};
```

<a id="post-api-assignments-preview"></a>

## POST /api/assignments/preview

[Source](../../apps/web/src/app/api/assignments/preview/route.ts#L12)

- **Backend contract:** [POST /assignments/preview](API_ENDPOINTS.md#post-assignments-preview).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto).

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  ruleId: null | string;
  mode: 'preview' | 'apply';
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: Array<{
    prospectId: string;
    outcome: 'proposed' | 'already_assigned' | 'inactive_prospect' | 'missing_coordinates';
    teamId?: undefined | string;
    assignedUserId?: undefined | null | string;
    conflict?:
      | undefined
      | null
      | {
          teamId?: undefined | string;
          assignedUserId?: undefined | null | string;
        };
  }>;
};
```

<a id="get-api-assignments-unassigned"></a>

## GET /api/assignments/unassigned

[Source](../../apps/web/src/app/api/assignments/unassigned/route.ts#L27)

- **Backend contract:** [GET /assignments/unassigned](API_ENDPOINTS.md#get-assignments-unassigned).
- **Query forwarded/read:** `campaignId`, `teamId`, `cursor`, `limit`, `search`, `category`, `department`, `city`, `regionId`, `lifecycleStage`, `contactable`, `availability`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignProspectId: string;
    campaignId: string;
    establishmentId: string;
    name: string;
    category:
      | null
      | 'prospection'
      | 'justice_enquetes'
      | 'sante'
      | 'asile_social'
      | 'douanes_onaf'
      | 'cra'
      | 'prescripteurs';
    city: null | string;
    postalCode: null | string;
    department: null | string;
    regionId: null | string;
    latitude: null | number;
    longitude: null | number;
    lifecycleStage:
      'in_progress' | 'qualified' | 'converted' | 'to_contact' | 'contact_made' | 'follow_up';
    contactBlocked: boolean;
    activeElsewhere: boolean;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-audit-events"></a>

## GET /api/audit/events

[Source](../../apps/web/src/app/api/audit/events/route.ts#L26)

- **Backend contract:** [GET /audit/events](API_ENDPOINTS.md#get-audit-events).
- **Query forwarded/read:** `stream`, `action`, `resourceType`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    actorType: 'user' | 'system';
    actorUserId: null | string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: {
      [key: string]: unknown;
    };
    occurredAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-audit-events-eventid"></a>

## GET /api/audit/events/:eventId

[Source](../../apps/web/src/app/api/audit/events/[eventId]/route.ts#L7)

- **Backend contract:** [GET /audit/events/:eventId](API_ENDPOINTS.md#get-audit-events-eventid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  actorType: 'user' | 'system';
  actorUserId: null | string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: {
    [key: string]: unknown;
  };
  occurredAt: string;
};
```

<a id="get-api-audit-overview"></a>

## GET /api/audit/overview

[Source](../../apps/web/src/app/api/audit/overview/route.ts#L7)

- **Backend contract:** [GET /audit/overview](API_ENDPOINTS.md#get-audit-overview).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  tenantId: string;
  events: number;
  actors: number;
  latest: null | string;
};
```

<a id="get-api-auth-config"></a>

## GET /api/auth/config

[Source](../../apps/web/src/app/api/auth/config/route.ts#L10)

- **Backend contract:** [GET /auth/config](API_ENDPOINTS.md#get-auth-config).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  password: boolean;
  mfa: {
    totp: boolean;
    recoveryCodes: boolean;
  };
  passwordRecovery: boolean;
  sso: {
    enabled: boolean;
    providers?: undefined | Array<string>;
  };
};
```

<a id="post-api-auth-login"></a>

## POST /api/auth/login

[Source](../../apps/web/src/app/api/auth/login/route.ts#L6)

- **Backend contract:** [POST /auth/login](API_ENDPOINTS.md#post-auth-login).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [LoginDto](API_REQUEST_SCHEMAS.md#logindto).

**Success: 200.**

```ts
type ResponseBody =
  | {
      next: 'authenticated';
    }
  | {
      next: 'mfa';
      challengeToken: string;
      expiresIn: number;
    }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    };
```

<a id="post-api-auth-logout"></a>

## POST /api/auth/logout

[Source](../../apps/web/src/app/api/auth/logout/route.ts#L6)

- **Backend contract:** [POST /auth/logout](API_ENDPOINTS.md#post-auth-logout).
- **Query forwarded/read:** none declared.
- **Body:** none.

The refresh token comes from the session cookie; do not send it in the browser body.

**Success: 204.**

No response body.

<a id="get-api-auth-me"></a>

## GET /api/auth/me

[Source](../../apps/web/src/app/api/auth/me/route.ts#L6)

- **Backend contract:** [GET /auth/me](API_ENDPOINTS.md#get-auth-me).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  userId: string;
  tenantId: string;
};
```

<a id="get-api-auth-me-access-grants"></a>

## GET /api/auth/me/access-grants

[Source](../../apps/web/src/app/api/auth/me/access-grants/route.ts#L7)

- **Backend contract:** [GET /auth/me/access-grants](API_ENDPOINTS.md#get-auth-me-access-grants).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  email: string;
  displayName: null | string;
  locale: string;
  grants: Array<{
    role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
    scopeType: 'tenant' | 'organization' | 'team';
    organizationId: null | string;
    teamId: null | string;
  }>;
  userId: string;
  tenantId: string;
};
```

<a id="delete-api-auth-mfa"></a>

## DELETE /api/auth/mfa

[Source](../../apps/web/src/app/api/auth/mfa/route.ts#L7)

- **Backend contract:** [DELETE /auth/mfa](API_ENDPOINTS.md#delete-auth-mfa).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto).

**Success: 204.**

No response body.

<a id="post-api-auth-mfa-enroll"></a>

## POST /api/auth/mfa/enroll

[Source](../../apps/web/src/app/api/auth/mfa/enroll/route.ts#L12)

- **Backend contract:** [POST /auth/mfa/enroll](API_ENDPOINTS.md#post-auth-mfa-enroll).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MfaEnrollDto](API_REQUEST_SCHEMAS.md#mfaenrolldto).

**Success: 200.**

```ts
type ResponseBody = {
  challengeToken: string;
  setupKey: string;
  otpauthUri: string;
  expiresIn: number;
};
```

<a id="post-api-auth-mfa-recovery"></a>

## POST /api/auth/mfa/recovery

[Source](../../apps/web/src/app/api/auth/mfa/recovery/route.ts#L11)

- **Backend contract:** [POST /auth/mfa/recovery](API_ENDPOINTS.md#post-auth-mfa-recovery).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MfaRecoveryDto](API_REQUEST_SCHEMAS.md#mfarecoverydto).

**Success: 200.**

```ts
type ResponseBody =
  | {
      next: 'authenticated';
    }
  | {
      next: 'mfa';
      challengeToken: string;
      expiresIn: number;
    }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    };
```

<a id="post-api-auth-mfa-recovery-codes-regenerate"></a>

## POST /api/auth/mfa/recovery-codes/regenerate

[Source](../../apps/web/src/app/api/auth/mfa/recovery-codes/regenerate/route.ts#L7)

- **Backend contract:** [POST /auth/mfa/recovery-codes/regenerate](API_ENDPOINTS.md#post-auth-mfa-recovery-codes-regenerate).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto).

**Success: 200.**

```ts
type ResponseBody = {
  recoveryCodes: Array<string>;
};
```

<a id="post-api-auth-mfa-verify"></a>

## POST /api/auth/mfa/verify

[Source](../../apps/web/src/app/api/auth/mfa/verify/route.ts#L11)

- **Backend contract:** [POST /auth/mfa/verify](API_ENDPOINTS.md#post-auth-mfa-verify).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MfaVerifyDto](API_REQUEST_SCHEMAS.md#mfaverifydto).

**Success: 200.**

```ts
type ResponseBody =
  | {
      next: 'authenticated';
    }
  | {
      next: 'mfa';
      challengeToken: string;
      expiresIn: number;
    }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    };
```

<a id="post-api-auth-password-forgot"></a>

## POST /api/auth/password/forgot

[Source](../../apps/web/src/app/api/auth/password/forgot/route.ts#L9)

- **Backend contract:** [POST /auth/password/forgot](API_ENDPOINTS.md#post-auth-password-forgot).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ForgotPasswordDto](API_REQUEST_SCHEMAS.md#forgotpassworddto).

**Success: 202.**

No response body.

<a id="post-api-auth-password-reset"></a>

## POST /api/auth/password/reset

[Source](../../apps/web/src/app/api/auth/password/reset/route.ts#L4)

- **Backend contract:** [POST /auth/password/reset](API_ENDPOINTS.md#post-auth-password-reset).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ResetPasswordDto](API_REQUEST_SCHEMAS.md#resetpassworddto).

**Success: 204.**

No response body.

<a id="get-api-auth-password-reset-token-status"></a>

## GET /api/auth/password-reset/:token/status

[Source](../../apps/web/src/app/api/auth/password-reset/[token]/status/route.ts#L7)

- **Backend contract:** [GET /auth/password-reset/:token/status](API_ENDPOINTS.md#get-auth-password-reset-token-status).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  valid: boolean;
  expiresAt?: undefined | string;
};
```

<a id="post-api-auth-refresh"></a>

## POST /api/auth/refresh

[Source](../../apps/web/src/app/api/auth/refresh/route.ts#L4)

- **Backend contract:** [POST /auth/refresh](API_ENDPOINTS.md#post-auth-refresh).
- **Query forwarded/read:** none declared.
- **Body:** none.

The refresh token comes from the session cookie; do not send it in the browser body.

**Success: 204.**

No response body.

<a id="post-api-auth-select-workspace"></a>

## POST /api/auth/select-workspace

[Source](../../apps/web/src/app/api/auth/select-workspace/route.ts#L11)

- **Backend contract:** [POST /auth/select-tenant](API_ENDPOINTS.md#post-auth-select-tenant).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [SelectWorkspaceDto](API_REQUEST_SCHEMAS.md#selectworkspacedto).

**Success: 200.**

```ts
type ResponseBody =
  | {
      next: 'authenticated';
    }
  | {
      next: 'mfa';
      challengeToken: string;
      expiresIn: number;
    }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    };
```

<a id="patch-api-campaign-members-memberid"></a>

## PATCH /api/campaign-members/:memberId

[Source](../../apps/web/src/app/api/campaign-members/[memberId]/route.ts#L8)

- **Backend contract:** [PATCH /campaign-members/:id](API_ENDPOINTS.md#patch-campaign-members-id).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateCampaignMemberDto](API_REQUEST_SCHEMAS.md#updatecampaignmemberdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  membershipId: null | string;
  teamId: null | string;
  role: 'observer' | 'member' | 'coordinator';
  startsAt: string;
  endsAt: null | string;
  revokedAt: null | string;
  state: 'active' | 'revoked' | 'scheduled' | 'ended';
  etag?: undefined | string;
};
```

<a id="delete-api-campaign-members-memberid"></a>

## DELETE /api/campaign-members/:memberId

[Source](../../apps/web/src/app/api/campaign-members/[memberId]/route.ts#L30)

- **Backend contract:** [DELETE /campaign-members/:id](API_ENDPOINTS.md#delete-campaign-members-id).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="get-api-campaigns"></a>

## GET /api/campaigns

[Source](../../apps/web/src/app/api/campaigns/route.ts#L20)

- **Backend contract:** [GET /campaigns](API_ENDPOINTS.md#get-campaigns).
- **Query forwarded/read:** `organizationId`, `territoryId`, `status`, `search`, `startsAfter`, `startsBefore`, `sort`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    organizationId: string;
    name: string;
    description: null | string;
    status: 'completed' | 'active' | 'paused' | 'draft' | 'archived';
    startsAt: null | string;
    endsAt: null | string;
    createdAt?: undefined | string;
    updatedAt?: undefined | string;
    etag?: undefined | string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-campaigns"></a>

## POST /api/campaigns

[Source](../../apps/web/src/app/api/campaigns/route.ts#L38)

- **Backend contract:** [POST /campaigns](API_ENDPOINTS.md#post-campaigns).
- **Query forwarded/read:** `organizationId`, `territoryId`, `status`, `search`, `startsAfter`, `startsBefore`, `sort`, `cursor`, `limit`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateCampaignDto](API_REQUEST_SCHEMAS.md#createcampaigndto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'completed' | 'active' | 'paused' | 'draft' | 'archived';
  startsAt: null | string;
  endsAt: null | string;
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="get-api-campaigns-campaignid"></a>

## GET /api/campaigns/:campaignId

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/route.ts#L9)

- **Backend contract:** [GET /campaigns/:campaignId](API_ENDPOINTS.md#get-campaigns-campaignid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'completed' | 'active' | 'paused' | 'draft' | 'archived';
  startsAt: null | string;
  endsAt: null | string;
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="patch-api-campaigns-campaignid"></a>

## PATCH /api/campaigns/:campaignId

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/route.ts#L30)

- **Backend contract:** [PATCH /campaigns/:campaignId](API_ENDPOINTS.md#patch-campaigns-campaignid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateCampaignDto](API_REQUEST_SCHEMAS.md#updatecampaigndto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'completed' | 'active' | 'paused' | 'draft' | 'archived';
  startsAt: null | string;
  endsAt: null | string;
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="delete-api-campaigns-campaignid"></a>

## DELETE /api/campaigns/:campaignId

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/route.ts#L53)

- **Backend contract:** [DELETE /campaigns/:campaignId](API_ENDPOINTS.md#delete-campaigns-campaignid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="post-api-campaigns-campaignid-geographic-allocation-apply"></a>

## POST /api/campaigns/:campaignId/geographic-allocation/apply

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/geographic-allocation/apply/route.ts#L7)

- **Backend contract:** [POST /campaigns/:campaignId/geographic-allocation/apply](API_ENDPOINTS.md#post-campaigns-campaignid-geographic-allocation-apply).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="post-api-campaigns-campaignid-geographic-allocation-preview"></a>

## POST /api/campaigns/:campaignId/geographic-allocation/preview

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/geographic-allocation/preview/route.ts#L7)

- **Backend contract:** [POST /campaigns/:campaignId/geographic-allocation/preview](API_ENDPOINTS.md#post-campaigns-campaignid-geographic-allocation-preview).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="get-api-campaigns-campaignid-members"></a>

## GET /api/campaigns/:campaignId/members

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/members/route.ts#L8)

- **Backend contract:** [GET /campaigns/:campaignId/members](API_ENDPOINTS.md#get-campaigns-campaignid-members).
- **Query forwarded/read:** `state`, `membershipId`, `teamId`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    membershipId: null | string;
    teamId: null | string;
    role: 'observer' | 'member' | 'coordinator';
    startsAt: string;
    endsAt: null | string;
    revokedAt: null | string;
    state: 'active' | 'revoked' | 'scheduled' | 'ended';
    etag?: undefined | string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-campaigns-campaignid-members"></a>

## POST /api/campaigns/:campaignId/members

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/members/route.ts#L33)

- **Backend contract:** [POST /campaigns/:campaignId/members](API_ENDPOINTS.md#post-campaigns-campaignid-members).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateCampaignMemberDto](API_REQUEST_SCHEMAS.md#createcampaignmemberdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  membershipId: null | string;
  teamId: null | string;
  role: 'observer' | 'member' | 'coordinator';
  startsAt: string;
  endsAt: null | string;
  revokedAt: null | string;
  state: 'active' | 'revoked' | 'scheduled' | 'ended';
  etag?: undefined | string;
};
```

<a id="get-api-campaigns-campaignid-organizations"></a>

## GET /api/campaigns/:campaignId/organizations

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/organizations/route.ts#L8)

- **Backend contract:** [GET /campaigns/:campaignId/organizations](API_ENDPOINTS.md#get-campaigns-campaignid-organizations).
- **Query forwarded/read:** `state`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    organizationId: string;
    accessMode: 'participate' | 'read_only';
    endedAt?: undefined | null | string;
    etag?: undefined | string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-campaigns-campaignid-organizations"></a>

## POST /api/campaigns/:campaignId/organizations

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/organizations/route.ts#L33)

- **Backend contract:** [POST /campaigns/:campaignId/organizations](API_ENDPOINTS.md#post-campaigns-campaignid-organizations).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateCampaignOrganizationDto](API_REQUEST_SCHEMAS.md#createcampaignorganizationdto).

**Success: 201.**

```ts
type ResponseBody = undefined | {};
```

<a id="get-api-campaigns-campaignid-prospects-campaignprospectid-timeline"></a>

## GET /api/campaigns/:campaignId/prospects/:campaignProspectId/timeline

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/prospects/[campaignProspectId]/timeline/route.ts#L23)

- **Backend contract:** [GET /campaigns/:campaignId/prospects/:prospectId/timeline](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-timeline).
- **Query forwarded/read:** `limit`, `cursor`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    kind: 'activity';
    id: string;
    occurredAt: string;
    activityType: 'call' | 'email' | 'message' | 'visit';
    actor: {
      userId: string;
    };
    context: {
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
    };
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-campaigns-campaignid-prospects-bulk"></a>

## POST /api/campaigns/:campaignId/prospects/bulk

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/prospects/bulk/route.ts#L15)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/bulk](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-bulk).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="post-api-campaigns-campaignid-prospects-bulk-preview"></a>

## POST /api/campaigns/:campaignId/prospects/bulk/preview

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/prospects/bulk/preview/route.ts#L13)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/bulk/preview](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-bulk-preview).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="post-api-campaigns-campaignid-status"></a>

## POST /api/campaigns/:campaignId/status

[Source](../../apps/web/src/app/api/campaigns/[campaignId]/status/route.ts#L9)

- **Backend contract:** [POST /campaigns/:campaignId/status](API_ENDPOINTS.md#post-campaigns-campaignid-status).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CampaignStatusDto](API_REQUEST_SCHEMAS.md#campaignstatusdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'completed' | 'active' | 'paused' | 'draft' | 'archived';
  startsAt: null | string;
  endsAt: null | string;
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="get-api-collision-events"></a>

## GET /api/collision-events

[Source](../../apps/web/src/app/api/collision-events/route.ts#L8)

- **Backend contract:** [GET /collision-events](API_ENDPOINTS.md#get-collision-events).
- **Query forwarded/read:** `campaignId`, `reasonCode`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    assignmentId: null | string;
    detectedBy: string;
    createdAt: string;
    expiresAt: string;
    decision: 'allow' | 'block' | 'warn' | 'require_override';
    reasonCode:
      | 'NO_COLLISION'
      | 'ACTIVE_RESERVATION'
      | 'ACTIVE_ASSIGNMENT'
      | 'PLANNED_ACTION'
      | 'RECENT_CONTACT';
    policy: {
      evaluatorVersion?: undefined | string | number;
      defaultCoolingOffMinutes?: undefined | number;
    };
    overrideable: boolean;
    [key: string]: unknown;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-collision-events-collisionid"></a>

## GET /api/collision-events/:collisionId

[Source](../../apps/web/src/app/api/collision-events/[collisionId]/route.ts#L7)

- **Backend contract:** [GET /collision-events/:collisionId](API_ENDPOINTS.md#get-collision-events-collisionid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: null | string;
  detectedBy: string;
  createdAt: string;
  expiresAt: string;
  decision: 'allow' | 'block' | 'warn' | 'require_override';
  reasonCode:
    | 'NO_COLLISION'
    | 'ACTIVE_RESERVATION'
    | 'ACTIVE_ASSIGNMENT'
    | 'PLANNED_ACTION'
    | 'RECENT_CONTACT';
  policy: {
    evaluatorVersion?: undefined | string | number;
    defaultCoolingOffMinutes?: undefined | number;
  };
  overrideable: boolean;
  [key: string]: unknown;
};
```

<a id="post-api-collision-events-collisionid-override-request"></a>

## POST /api/collision-events/:collisionId/override-request

[Source](../../apps/web/src/app/api/collision-events/[collisionId]/override-request/route.ts#L7)

- **Backend contract:** [POST /collision-events/:collisionId/override-request](API_ENDPOINTS.md#post-collision-events-collisionid-override-request).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto).

**Success: 201.**

```ts
type ResponseBody = undefined | {};
```

<a id="get-api-conversations"></a>

## GET /api/conversations

[Source](../../apps/web/src/app/api/conversations/route.ts#L8)

- **Backend contract:** [GET /conversations](API_ENDPOINTS.md#get-conversations).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    kind: 'team' | 'direct' | 'prospect' | 'campaign';
    title: null | string;
    status: 'active' | 'archived';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-conversations"></a>

## POST /api/conversations

[Source](../../apps/web/src/app/api/conversations/route.ts#L26)

- **Backend contract:** [POST /conversations](API_ENDPOINTS.md#post-conversations).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateConversationDto](API_REQUEST_SCHEMAS.md#createconversationdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  kind: 'team' | 'direct' | 'prospect' | 'campaign';
  title: null | string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-conversations-conversationid"></a>

## GET /api/conversations/:conversationId

[Source](../../apps/web/src/app/api/conversations/[conversationId]/route.ts#L8)

- **Backend contract:** [GET /conversations/:id](API_ENDPOINTS.md#get-conversations-id).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  kind: 'team' | 'direct' | 'prospect' | 'campaign';
  title: null | string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="patch-api-conversations-conversationid"></a>

## PATCH /api/conversations/:conversationId

[Source](../../apps/web/src/app/api/conversations/[conversationId]/route.ts#L29)

- **Backend contract:** [PATCH /conversations/:id](API_ENDPOINTS.md#patch-conversations-id).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateConversationDto](API_REQUEST_SCHEMAS.md#updateconversationdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  kind: 'team' | 'direct' | 'prospect' | 'campaign';
  title: null | string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-conversations-conversationid-messages"></a>

## GET /api/conversations/:conversationId/messages

[Source](../../apps/web/src/app/api/conversations/[conversationId]/messages/route.ts#L8)

- **Backend contract:** [GET /conversations/:id/messages](API_ENDPOINTS.md#get-conversations-id-messages).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    senderId: string;
    body: string;
    status: 'sent' | 'edited' | 'deleted';
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-conversations-conversationid-messages"></a>

## POST /api/conversations/:conversationId/messages

[Source](../../apps/web/src/app/api/conversations/[conversationId]/messages/route.ts#L31)

- **Backend contract:** [POST /conversations/:id/messages](API_ENDPOINTS.md#post-conversations-id-messages).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: 'sent' | 'edited' | 'deleted';
  createdAt: string;
  updatedAt: string;
};
```

<a id="patch-api-conversations-conversationid-mute"></a>

## PATCH /api/conversations/:conversationId/mute

[Source](../../apps/web/src/app/api/conversations/[conversationId]/mute/route.ts#L7)

- **Backend contract:** [PATCH /conversations/:id/mute](API_ENDPOINTS.md#patch-conversations-id-mute).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MuteConversationDto](API_REQUEST_SCHEMAS.md#muteconversationdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="get-api-conversations-conversationid-participants"></a>

## GET /api/conversations/:conversationId/participants

[Source](../../apps/web/src/app/api/conversations/[conversationId]/participants/route.ts#L8)

- **Backend contract:** [GET /conversations/:id/participants](API_ENDPOINTS.md#get-conversations-id-participants).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  conversationId: string;
  membershipId: string;
  lastReadAt: null | string;
  mutedUntil: null | string;
  joinedAt: string;
}>;
```

<a id="post-api-conversations-conversationid-participants"></a>

## POST /api/conversations/:conversationId/participants

[Source](../../apps/web/src/app/api/conversations/[conversationId]/participants/route.ts#L29)

- **Backend contract:** [POST /conversations/:id/participants](API_ENDPOINTS.md#post-conversations-id-participants).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AddParticipantDto](API_REQUEST_SCHEMAS.md#addparticipantdto).

**Success: 201.**

```ts
type ResponseBody = undefined | {};
```

<a id="delete-api-conversations-conversationid-participants-membershipid"></a>

## DELETE /api/conversations/:conversationId/participants/:membershipId

[Source](../../apps/web/src/app/api/conversations/[conversationId]/participants/[membershipId]/route.ts#L7)

- **Backend contract:** [DELETE /conversations/:id/participants/:membershipId](API_ENDPOINTS.md#delete-conversations-id-participants-membershipid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="post-api-conversations-conversationid-read"></a>

## POST /api/conversations/:conversationId/read

[Source](../../apps/web/src/app/api/conversations/[conversationId]/read/route.ts#L7)

- **Backend contract:** [POST /conversations/:id/read](API_ENDPOINTS.md#post-conversations-id-read).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="get-api-dashboard-admin"></a>

## GET /api/dashboard/admin

[Source](../../apps/web/src/app/api/dashboard/admin/route.ts#L7)

- **Backend contract:** [GET /dashboard/admin](API_ENDPOINTS.md#get-dashboard-admin).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  scope: {
    tenantId: string;
  };
  metrics: {
    activeMembers: number;
    sessionsLast30Days: number;
    activeOrganizations: number;
    activeTeams: number;
    activeCampaigns: number;
    prospectsMissingCoordinates: number;
    prospectsMissingPhone: number;
    failedExports: number;
    importsAwaitingCommit: number;
  };
  readiness: {
    productionCertified: boolean;
    checks: string;
  };
};
```

<a id="get-api-dashboard-director"></a>

## GET /api/dashboard/director

[Source](../../apps/web/src/app/api/dashboard/director/route.ts#L8)

- **Backend contract:** [GET /dashboard/director](API_ENDPOINTS.md#get-dashboard-director).
- **Query forwarded/read:** `from`, `to`, `organizationId`, `teamId`, `userId`, `campaignId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  workload?:
    | undefined
    | {
        items: Array<{
          [key: string]: unknown;
        }>;
        truncated: boolean;
      };
  territories?:
    | undefined
    | {
        items: Array<{
          [key: string]: unknown;
        }>;
        truncated: boolean;
        basis?: undefined | string;
      };
  outcomes?:
    | undefined
    | Array<{
        [key: string]: unknown;
      }>;
  organizationComparison?:
    | undefined
    | {
        items: Array<{
          [key: string]: unknown;
        }>;
        truncated: boolean;
      };
  objectiveRisks?:
    | undefined
    | {
        available: boolean;
        generatedAt: string;
        total: number;
        items: Array<{
          id: string;
          name: string;
          metric: string;
          target: number;
          startsAt: string;
          endsAt: string;
          ownerId: string;
          progress: {
            actual: number;
            target: number;
            remaining: number;
            progressPercent: number;
            elapsedPercent: number;
            expectedToDate: number;
            pace: null | number;
            status: 'achieved' | 'not_started' | 'missed' | 'at_risk' | 'watch' | 'on_track';
          };
          [key: string]: unknown;
        }>;
        truncated: boolean;
      };
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  scope: {
    authority: 'client_admin' | 'director' | 'manager';
    organizationId: null | string;
    teamId: null | string;
  };
  filters: {
    organizationId: null | string;
    teamId: null | string;
    userId: null | string;
    campaignId: null | string;
  };
  activities: {
    total: number;
    byType: {
      [key: string]: number;
    };
    activeProspectors: number;
  };
  assignments: {
    current: number;
    individuallyAssigned: number;
    teamOwned: number;
  };
  followUps: {
    pending: number;
    overdue: number;
    dueInRange: number;
    completedInRange: number;
    cancelledInRange: number;
  };
  byProspector: Array<{
    userId: string;
    activities: number;
    currentAssignments: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  }>;
};
```

<a id="post-api-devices"></a>

## POST /api/devices

[Source](../../apps/web/src/app/api/devices/route.ts#L8)

- **Backend contract:** [POST /devices](API_ENDPOINTS.md#post-devices).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [RegisterDeviceDto](API_REQUEST_SCHEMAS.md#registerdevicedto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  membershipId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  lastSeenAt: null | string;
  revokedAt: null | string;
};
```

<a id="delete-api-devices-deviceid"></a>

## DELETE /api/devices/:deviceId

[Source](../../apps/web/src/app/api/devices/[deviceId]/route.ts#L7)

- **Backend contract:** [DELETE /devices/:deviceId](API_ENDPOINTS.md#delete-devices-deviceid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="get-api-exports"></a>

## GET /api/exports

[Source](../../apps/web/src/app/api/exports/route.ts#L8)

- **Backend contract:** [GET /exports](API_ENDPOINTS.md#get-exports).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    requesterId: string;
    status: 'completed' | 'cancelled' | 'queued' | 'processing' | 'failed' | 'expired';
    request: {
      [key: string]: unknown;
    };
    filename: null | string;
    contentType: null | string;
    rowCount: null | number;
    failureCode: null | string;
    attempts: number;
    downloadExpiresAt: null | string;
    expiresAt: null | string;
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-exports"></a>

## POST /api/exports

[Source](../../apps/web/src/app/api/exports/route.ts#L27)

- **Backend contract:** [POST /exports](API_ENDPOINTS.md#post-exports).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto).

**Success: 202.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'completed' | 'cancelled' | 'queued' | 'processing' | 'failed' | 'expired';
  request: {
    [key: string]: unknown;
  };
  filename: null | string;
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  downloadExpiresAt: null | string;
  expiresAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-exports-exportid"></a>

## GET /api/exports/:exportId

[Source](../../apps/web/src/app/api/exports/[exportId]/route.ts#L7)

- **Backend contract:** [GET /exports/:exportId](API_ENDPOINTS.md#get-exports-exportid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'completed' | 'cancelled' | 'queued' | 'processing' | 'failed' | 'expired';
  request: {
    [key: string]: unknown;
  };
  filename: null | string;
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  downloadExpiresAt: null | string;
  expiresAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="post-api-exports-exportid-cancel"></a>

## POST /api/exports/:exportId/cancel

[Source](../../apps/web/src/app/api/exports/[exportId]/cancel/route.ts#L8)

- **Backend contract:** [POST /exports/:exportId/cancel](API_ENDPOINTS.md#post-exports-exportid-cancel).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'completed' | 'cancelled' | 'queued' | 'processing' | 'failed' | 'expired';
  request: {
    [key: string]: unknown;
  };
  filename: null | string;
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  downloadExpiresAt: null | string;
  expiresAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-exports-exportid-download"></a>

## GET /api/exports/:exportId/download

[Source](../../apps/web/src/app/api/exports/[exportId]/download/route.ts#L13)

- **Backend contract:** [GET /exports/:exportId/download](API_ENDPOINTS.md#get-exports-exportid-download).
- **Query forwarded/read:** `token`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  url: string;
  expiresAt: string;
  filename: null | string;
};
```

<a id="get-api-exports-exportid-file"></a>

## GET /api/exports/:exportId/file

[Source](../../apps/web/src/app/api/exports/[exportId]/file/route.ts#L6)

- **Backend contract:** [GET /exports/:exportId/file](API_ENDPOINTS.md#get-exports-exportid-file).
- **Query forwarded/read:** `token`.
- **Body:** none.

**Success: 200.**

Upstream response body and content type are passed through; see the linked backend contract.

<a id="post-api-exports-preview"></a>

## POST /api/exports/preview

[Source](../../apps/web/src/app/api/exports/preview/route.ts#L8)

- **Backend contract:** [POST /exports/preview](API_ENDPOINTS.md#post-exports-preview).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto).

**Success: 200.**

```ts
type ResponseBody = {
  rowCount?: undefined | number;
  columns?: undefined | Array<string>;
  sample?:
    | undefined
    | Array<{
        [key: string]: unknown;
      }>;
  [key: string]: unknown;
};
```

<a id="get-api-follow-ups"></a>

## GET /api/follow-ups

[Source](../../apps/web/src/app/api/follow-ups/route.ts#L13)

- **Backend contract:** [GET /follow-ups](API_ENDPOINTS.md#get-follow-ups).
- **Query forwarded/read:** `teamId`, `overdue`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignName: string;
    establishmentName: string;
    id: string;
    campaignId: string;
    prospectId: string;
    establishmentId: string;
    dueAt: string;
    status: 'completed' | 'cancelled' | 'pending';
    category: 'follow_up' | 'todo' | 'meeting';
    channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
    ownership: 'user' | 'team';
    completedAt: null | string;
    cancelledAt: null | string;
    createdAt: string;
    updatedAt: string;
  }>;
};
```

<a id="get-api-health"></a>

## GET /api/health

[Source](../../apps/web/src/app/api/health/route.ts#L7)

- **Backend contract:** [GET /health](API_ENDPOINTS.md#get-health).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: upstream status (200 on success).**

Upstream response body and content type are passed through; see the linked backend contract.

<a id="patch-api-import-issues-issueid"></a>

## PATCH /api/import-issues/:issueId

[Source](../../apps/web/src/app/api/import-issues/[issueId]/route.ts#L8)

- **Backend contract:** [PATCH /import-issues/:issueId](API_ENDPOINTS.md#patch-import-issues-issueid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ImportIssueResolutionDto](API_REQUEST_SCHEMAS.md#importissueresolutiondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="get-api-imports"></a>

## GET /api/imports

[Source](../../apps/web/src/app/api/imports/route.ts#L8)

- **Backend contract:** [GET /imports](API_ENDPOINTS.md#get-imports).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    requesterId: string;
    status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
    filename: null | string;
    fileHash: null | string;
    headers: Array<string>;
    mapping: {
      [key: string]: string;
    };
    summary: {
      totalRows?: undefined | number;
      validRows?: undefined | number;
      warningRows?: undefined | number;
      invalidRows?: undefined | number;
      issueCount?: undefined | number;
      existingDuplicates?: undefined | number;
      createdEstablishments?: undefined | number;
      reusedEstablishments?: undefined | number;
      createdContacts?: undefined | number;
      skippedRows?: undefined | number;
    };
    rowCount: number;
    createdAt: string;
    updatedAt: string;
    etag: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-imports"></a>

## POST /api/imports

[Source](../../apps/web/src/app/api/imports/route.ts#L26)

- **Backend contract:** [POST /imports](API_ENDPOINTS.md#post-imports).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="get-api-imports-importid"></a>

## GET /api/imports/:importId

[Source](../../apps/web/src/app/api/imports/[importId]/route.ts#L7)

- **Backend contract:** [GET /imports/:importId](API_ENDPOINTS.md#get-imports-importid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-imports-importid-cancel"></a>

## POST /api/imports/:importId/cancel

[Source](../../apps/web/src/app/api/imports/[importId]/cancel/route.ts#L8)

- **Backend contract:** [POST /imports/:importId/cancel](API_ENDPOINTS.md#post-imports-importid-cancel).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-imports-importid-commit"></a>

## POST /api/imports/:importId/commit

[Source](../../apps/web/src/app/api/imports/[importId]/commit/route.ts#L8)

- **Backend contract:** [POST /imports/:importId/commit](API_ENDPOINTS.md#post-imports-importid-commit).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-imports-importid-file"></a>

## POST /api/imports/:importId/file

[Source](../../apps/web/src/app/api/imports/[importId]/file/route.ts#L8)

- **Backend contract:** [POST /imports/:importId/file](API_ENDPOINTS.md#post-imports-importid-file).
- **Query forwarded/read:** none declared.
- **Body:** multipart/form-data, forwarded with its original boundary.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="get-api-imports-importid-issues"></a>

## GET /api/imports/:importId/issues

[Source](../../apps/web/src/app/api/imports/[importId]/issues/route.ts#L8)

- **Backend contract:** [GET /imports/:importId/issues](API_ENDPOINTS.md#get-imports-importid-issues).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    importId: string;
    rowId: string;
    code: string;
    severity: 'warning' | 'error';
    message: string;
    resolvedAt: null | string;
  }>;
  nextCursor: null | string;
};
```

<a id="put-api-imports-importid-mapping"></a>

## PUT /api/imports/:importId/mapping

[Source](../../apps/web/src/app/api/imports/[importId]/mapping/route.ts#L8)

- **Backend contract:** [PUT /imports/:importId/mapping](API_ENDPOINTS.md#put-imports-importid-mapping).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ImportMappingDto](API_REQUEST_SCHEMAS.md#importmappingdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="get-api-imports-importid-report"></a>

## GET /api/imports/:importId/report

[Source](../../apps/web/src/app/api/imports/[importId]/report/route.ts#L6)

- **Backend contract:** [GET /imports/:importId/report](API_ENDPOINTS.md#get-imports-importid-report).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

Upstream response body and content type are passed through; see the linked backend contract.

<a id="get-api-imports-importid-rows"></a>

## GET /api/imports/:importId/rows

[Source](../../apps/web/src/app/api/imports/[importId]/rows/route.ts#L8)

- **Backend contract:** [GET /imports/:importId/rows](API_ENDPOINTS.md#get-imports-importid-rows).
- **Query forwarded/read:** `afterRow`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    importId: string;
    rowNumber: number;
    data: {
      rowNumber: number;
      status: 'warning' | 'valid' | 'invalid';
      establishment: null | {
        externalReference: null | string;
        name: string;
        addressLine1: null | string;
        postalCode: null | string;
        city: null | string;
        countryCode: string;
        phone: null | string;
        website: null | string;
        latitude: null | number;
        longitude: null | number;
        category:
          | null
          | 'prospection'
          | 'justice_enquetes'
          | 'sante'
          | 'asile_social'
          | 'douanes_onaf'
          | 'cra'
          | 'prescripteurs';
      };
      contact: null | {
        name: null | string;
        jobTitle: null | string;
        email: null | string;
        phone: null | string;
        isPrimary: boolean;
      };
      issues: Array<{
        field?: undefined | string;
        code: string;
        message: string;
        severity: 'warning' | 'error';
      }>;
    };
    resolution: null | 'skip' | 'reuse';
    existingId: null | string;
    establishmentId: null | string;
    contactId: null | string;
    result: null | 'created' | 'reused' | 'skipped';
  }>;
  nextAfterRow: null | number;
};
```

<a id="post-api-imports-importid-validate"></a>

## POST /api/imports/:importId/validate

[Source](../../apps/web/src/app/api/imports/[importId]/validate/route.ts#L8)

- **Backend contract:** [POST /imports/:importId/validate](API_ENDPOINTS.md#post-imports-importid-validate).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requesterId: string;
  status: 'cancelled' | 'draft' | 'uploaded' | 'validated' | 'committed';
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    totalRows?: undefined | number;
    validRows?: undefined | number;
    warningRows?: undefined | number;
    invalidRows?: undefined | number;
    issueCount?: undefined | number;
    existingDuplicates?: undefined | number;
    createdEstablishments?: undefined | number;
    reusedEstablishments?: undefined | number;
    createdContacts?: undefined | number;
    skippedRows?: undefined | number;
  };
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="get-api-manager-dashboard"></a>

## GET /api/manager/dashboard

[Source](../../apps/web/src/app/api/manager/dashboard/route.ts#L12)

- **Backend contract:** [GET /manager/dashboard](API_ENDPOINTS.md#get-manager-dashboard).
- **Query forwarded/read:** `from`, `to`, `organizationId`, `teamId`, `userId`, `campaignId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  scope: {
    authority: 'client_admin' | 'director' | 'manager';
    organizationId: null | string;
    teamId: null | string;
  };
  filters: {
    organizationId: null | string;
    teamId: null | string;
    userId: null | string;
    campaignId: null | string;
  };
  activities: {
    total: number;
    byType: {
      [key: string]: number;
    };
    activeProspectors: number;
  };
  assignments: {
    current: number;
    individuallyAssigned: number;
    teamOwned: number;
  };
  followUps: {
    pending: number;
    overdue: number;
    dueInRange: number;
    completedInRange: number;
    cancelledInRange: number;
  };
  byProspector: Array<{
    userId: string;
    activities: number;
    currentAssignments: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  }>;
};
```

<a id="get-api-me"></a>

## GET /api/me

[Source](../../apps/web/src/app/api/me/route.ts#L7)

- **Backend contract:** [GET /me](API_ENDPOINTS.md#get-me).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  identityId: string;
  email: string;
  membershipId: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  displayName: null | string;
  phone: null | string;
  locale: string;
  timezone: string;
  mfaEnabled?: undefined | boolean;
  grants: Array<{
    role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
    scopeType: 'tenant' | 'organization' | 'team';
    organizationId: null | string;
    teamId: null | string;
  }>;
};
```

<a id="patch-api-me"></a>

## PATCH /api/me

[Source](../../apps/web/src/app/api/me/route.ts#L11)

- **Backend contract:** [PATCH /me](API_ENDPOINTS.md#patch-me).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateAccountDto](API_REQUEST_SCHEMAS.md#updateaccountdto).

**Success: 200.**

```ts
type ResponseBody = {
  identityId: string;
  email: string;
  membershipId: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  displayName: null | string;
  phone: null | string;
  locale: string;
  timezone: string;
  mfaEnabled?: undefined | boolean;
  grants: Array<{
    role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
    scopeType: 'tenant' | 'organization' | 'team';
    organizationId: null | string;
    teamId: null | string;
  }>;
};
```

<a id="post-api-me-active-membership"></a>

## POST /api/me/active-membership

[Source](../../apps/web/src/app/api/me/active-membership/route.ts#L13)

- **Backend contract:** [POST /me/active-membership](API_ENDPOINTS.md#post-me-active-membership).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [SwitchMembershipDto](API_REQUEST_SCHEMAS.md#switchmembershipdto).

**Success: 200.**

```ts
type ResponseBody =
  | {
      next: 'authenticated';
    }
  | {
      next: 'mfa';
      challengeToken: string;
      expiresIn: number;
    }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    };
```

<a id="get-api-me-memberships"></a>

## GET /api/me/memberships

[Source](../../apps/web/src/app/api/me/memberships/route.ts#L7)

- **Backend contract:** [GET /me/memberships](API_ENDPOINTS.md#get-me-memberships).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = Array<{
  membershipId: string;
  tenantId: string;
  tenantName: string;
  displayName: null | string;
  current: boolean;
  roles: Array<string>;
}>;
```

<a id="get-api-me-preferences"></a>

## GET /api/me/preferences

[Source](../../apps/web/src/app/api/me/preferences/route.ts#L8)

- **Backend contract:** [GET /me/preferences](API_ENDPOINTS.md#get-me-preferences).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  reducedMotion: boolean;
  highContrast: boolean;
};
```

<a id="patch-api-me-preferences"></a>

## PATCH /api/me/preferences

[Source](../../apps/web/src/app/api/me/preferences/route.ts#L12)

- **Backend contract:** [PATCH /me/preferences](API_ENDPOINTS.md#patch-me-preferences).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdatePreferencesDto](API_REQUEST_SCHEMAS.md#updatepreferencesdto).

**Success: 200.**

```ts
type ResponseBody = {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  reducedMotion: boolean;
  highContrast: boolean;
};
```

<a id="get-api-me-sessions"></a>

## GET /api/me/sessions

[Source](../../apps/web/src/app/api/me/sessions/route.ts#L9)

- **Backend contract:** [GET /me/sessions](API_ENDPOINTS.md#get-me-sessions).
- **Query forwarded/read:** `limit`, `cursor`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    absoluteExpiresAt: string;
    current: boolean;
  }>;
  nextCursor: null | string;
};
```

<a id="delete-api-me-sessions-sessionid"></a>

## DELETE /api/me/sessions/:sessionId

[Source](../../apps/web/src/app/api/me/sessions/[sessionId]/route.ts#L7)

- **Backend contract:** [DELETE /me/sessions/:sessionId](API_ENDPOINTS.md#delete-me-sessions-sessionid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  revoked: number;
};
```

<a id="delete-api-me-sessions-others"></a>

## DELETE /api/me/sessions/others

[Source](../../apps/web/src/app/api/me/sessions/others/route.ts#L8)

- **Backend contract:** [DELETE /me/sessions/others](API_ENDPOINTS.md#delete-me-sessions-others).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  revoked: number;
};
```

<a id="get-api-memberships"></a>

## GET /api/memberships

[Source](../../apps/web/src/app/api/memberships/route.ts#L20)

- **Backend contract:** [GET /memberships](API_ENDPOINTS.md#get-memberships).
- **Query forwarded/read:** `teamId`, `organizationId`, `territoryId`, `campaignId`, `role`, `status`, `search`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    identityId: string;
    email: string;
    displayName: null | string;
    status: 'active' | 'invited' | 'suspended' | 'departed';
    roles: Array<string>;
    capacity: null | number;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-memberships"></a>

## POST /api/memberships

[Source](../../apps/web/src/app/api/memberships/route.ts#L50)

- **Backend contract:** [POST /memberships](API_ENDPOINTS.md#post-memberships).
- **Query forwarded/read:** `teamId`, `organizationId`, `territoryId`, `campaignId`, `role`, `status`, `search`, `cursor`, `limit`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateInvitationDto](API_REQUEST_SCHEMAS.md#createinvitationdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  identityId: string;
  email: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  roles: Array<string>;
  capacity: null | number;
};
```

<a id="get-api-memberships-membershipid"></a>

## GET /api/memberships/:membershipId

[Source](../../apps/web/src/app/api/memberships/[membershipId]/route.ts#L8)

- **Backend contract:** [GET /memberships/:membershipId](API_ENDPOINTS.md#get-memberships-membershipid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  invitedAt: null | string;
  activatedAt: null | string;
  suspendedAt: null | string;
  departedAt: null | string;
  updatedAt: string;
  capacity: null | number;
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: {
    structural?:
      | undefined
      | Array<{
          grantId: string;
          role: string;
          scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
          organizationId: null | string;
          teamId: null | string;
          permissions: Array<string>;
        }>;
    resources?: undefined | Array<unknown>;
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
};
```

<a id="patch-api-memberships-membershipid"></a>

## PATCH /api/memberships/:membershipId

[Source](../../apps/web/src/app/api/memberships/[membershipId]/route.ts#L29)

- **Backend contract:** [PATCH /memberships/:membershipId](API_ENDPOINTS.md#patch-memberships-membershipid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateMembershipDto](API_REQUEST_SCHEMAS.md#updatemembershipdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  invitedAt: null | string;
  activatedAt: null | string;
  suspendedAt: null | string;
  departedAt: null | string;
  updatedAt: string;
  capacity: null | number;
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: {
    structural?:
      | undefined
      | Array<{
          grantId: string;
          role: string;
          scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
          organizationId: null | string;
          teamId: null | string;
          permissions: Array<string>;
        }>;
    resources?: undefined | Array<unknown>;
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
};
```

<a id="post-api-memberships-membershipid-reactivate"></a>

## POST /api/memberships/:membershipId/reactivate

[Source](../../apps/web/src/app/api/memberships/[membershipId]/reactivate/route.ts#L9)

- **Backend contract:** [POST /memberships/:membershipId/reactivate](API_ENDPOINTS.md#post-memberships-membershipid-reactivate).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  invitedAt: null | string;
  activatedAt: null | string;
  suspendedAt: null | string;
  departedAt: null | string;
  updatedAt: string;
  capacity: null | number;
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: {
    structural?:
      | undefined
      | Array<{
          grantId: string;
          role: string;
          scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
          organizationId: null | string;
          teamId: null | string;
          permissions: Array<string>;
        }>;
    resources?: undefined | Array<unknown>;
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
};
```

<a id="post-api-memberships-membershipid-resend-invite"></a>

## POST /api/memberships/:membershipId/resend-invite

[Source](../../apps/web/src/app/api/memberships/[membershipId]/resend-invite/route.ts#L9)

- **Backend contract:** [POST /memberships/:membershipId/resend-invite](API_ENDPOINTS.md#post-memberships-membershipid-resend-invite).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  invitedAt: null | string;
  activatedAt: null | string;
  suspendedAt: null | string;
  departedAt: null | string;
  updatedAt: string;
  capacity: null | number;
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: {
    structural?:
      | undefined
      | Array<{
          grantId: string;
          role: string;
          scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
          organizationId: null | string;
          teamId: null | string;
          permissions: Array<string>;
        }>;
    resources?: undefined | Array<unknown>;
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
};
```

<a id="post-api-memberships-membershipid-suspend"></a>

## POST /api/memberships/:membershipId/suspend

[Source](../../apps/web/src/app/api/memberships/[membershipId]/suspend/route.ts#L9)

- **Backend contract:** [POST /memberships/:membershipId/suspend](API_ENDPOINTS.md#post-memberships-membershipid-suspend).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: null | string;
  status: 'active' | 'invited' | 'suspended' | 'departed';
  invitedAt: null | string;
  activatedAt: null | string;
  suspendedAt: null | string;
  departedAt: null | string;
  updatedAt: string;
  capacity: null | number;
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: {
    structural?:
      | undefined
      | Array<{
          grantId: string;
          role: string;
          scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
          organizationId: null | string;
          teamId: null | string;
          permissions: Array<string>;
        }>;
    resources?: undefined | Array<unknown>;
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
};
```

<a id="patch-api-messages-messageid"></a>

## PATCH /api/messages/:messageId

[Source](../../apps/web/src/app/api/messages/[messageId]/route.ts#L8)

- **Backend contract:** [PATCH /messages/:id](API_ENDPOINTS.md#patch-messages-id).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: 'sent' | 'edited' | 'deleted';
  createdAt: string;
  updatedAt: string;
};
```

<a id="delete-api-messages-messageid"></a>

## DELETE /api/messages/:messageId

[Source](../../apps/web/src/app/api/messages/[messageId]/route.ts#L30)

- **Backend contract:** [DELETE /messages/:id](API_ENDPOINTS.md#delete-messages-id).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="get-api-notification-preferences"></a>

## GET /api/notification-preferences

[Source](../../apps/web/src/app/api/notification-preferences/route.ts#L7)

- **Backend contract:** [GET /notification-preferences](API_ENDPOINTS.md#get-notification-preferences).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  assignments?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  overrides?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  collisions?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  followUps?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  messages?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  imports?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
};
```

<a id="put-api-notification-preferences"></a>

## PUT /api/notification-preferences

[Source](../../apps/web/src/app/api/notification-preferences/route.ts#L23)

- **Backend contract:** [PUT /notification-preferences](API_ENDPOINTS.md#put-notification-preferences).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [NotificationPreferencesDto](API_REQUEST_SCHEMAS.md#notificationpreferencesdto).

**Success: 200.**

```ts
type ResponseBody = {
  assignments?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  overrides?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  collisions?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  followUps?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  messages?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
  imports?:
    | undefined
    | {
        email?: undefined | boolean;
        push?: undefined | boolean;
        inApp?: undefined | boolean;
      };
};
```

<a id="get-api-notifications"></a>

## GET /api/notifications

[Source](../../apps/web/src/app/api/notifications/route.ts#L9)

- **Backend contract:** [GET /notifications](API_ENDPOINTS.md#get-notifications).
- **Query forwarded/read:** `severity`, `readState`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    type: string;
    severity: 'critical' | 'warning' | 'error' | 'info';
    title: string;
    message: null | string;
    followUpId: null | string;
    scheduledFor: null | string;
    readAt: null | string;
    createdAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-notifications-notificationid-read"></a>

## POST /api/notifications/:notificationId/read

[Source](../../apps/web/src/app/api/notifications/[notificationId]/read/route.ts#L6)

- **Backend contract:** [POST /notifications/:notificationId/read](API_ENDPOINTS.md#post-notifications-notificationid-read).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  tenantId: string;
  type: 'follow_up_reminder';
  message: string;
  severity: 'critical' | 'warning' | 'error' | 'info';
  followUpId: string;
  recipientUserId: string;
  scheduledFor: string /* ISO 8601 date-time */;
  title: string;
  readAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-api-notifications-read-all"></a>

## POST /api/notifications/read-all

[Source](../../apps/web/src/app/api/notifications/read-all/route.ts#L6)

- **Backend contract:** [POST /notifications/read-all](API_ENDPOINTS.md#post-notifications-read-all).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  updated: number;
};
```

<a id="get-api-notifications-unread-count"></a>

## GET /api/notifications/unread-count

[Source](../../apps/web/src/app/api/notifications/unread-count/route.ts#L6)

- **Backend contract:** [GET /notifications/unread-count](API_ENDPOINTS.md#get-notifications-unread-count).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  count: number;
};
```

<a id="get-api-organizations"></a>

## GET /api/organizations

[Source](../../apps/web/src/app/api/organizations/route.ts#L20)

- **Backend contract:** [GET /organizations](API_ENDPOINTS.md#get-organizations).
- **Query forwarded/read:** `status`, `search`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    status: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-override-requests"></a>

## GET /api/override-requests

[Source](../../apps/web/src/app/api/override-requests/route.ts#L9)

- **Backend contract:** [GET /override-requests](API_ENDPOINTS.md#get-override-requests).
- **Query forwarded/read:** `status`, `campaignId`, `reasonCode`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    collisionId: string;
    campaignProspectId: string;
    requestedBy: string;
    reason: string;
    status: 'cancelled' | 'pending' | 'approved' | 'rejected';
    decidedBy: null | string;
    decisionReason: null | string;
    decidedAt: null | string;
    overrideId: null | string;
    createdAt: string;
    updatedAt: string;
    etag: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-override-requests-requestid"></a>

## GET /api/override-requests/:requestId

[Source](../../apps/web/src/app/api/override-requests/[requestId]/route.ts#L7)

- **Backend contract:** [GET /override-requests/:requestId](API_ENDPOINTS.md#get-override-requests-requestid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  collision: {
    id: string;
    campaignId: string;
    campaignProspectId: string;
    assignmentId: null | string;
    detectedBy: string;
    createdAt: string;
    expiresAt: null | string;
    decision?: undefined | string;
    reasonCode?:
      | undefined
      | 'NO_COLLISION'
      | 'ACTIVE_RESERVATION'
      | 'ACTIVE_ASSIGNMENT'
      | 'PLANNED_ACTION'
      | 'RECENT_CONTACT';
    conflict?:
      | undefined
      | null
      | {
          [key: string]: unknown;
        };
    policy: {
      evaluatorVersion?: undefined | string;
      defaultCoolingOffMinutes?: undefined | number;
    };
    overrideable: boolean;
  };
  approval: null | {
    id: string;
    expiresAt: null | string;
  };
  id: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: 'cancelled' | 'pending' | 'approved' | 'rejected';
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string;
  overrideId: null | string;
  createdAt: string;
  updatedAt: string;
  etag: string;
};
```

<a id="post-api-override-requests-requestid-decision"></a>

## POST /api/override-requests/:requestId/:decision

[Source](../../apps/web/src/app/api/override-requests/[requestId]/[decision]/route.ts#L14)

- **Backend contract:** [POST /override-requests/:requestId/approve](API_ENDPOINTS.md#post-override-requests-requestid-approve); [POST /override-requests/:requestId/reject](API_ENDPOINTS.md#post-override-requests-requestid-reject); [POST /override-requests/:requestId/cancel](API_ENDPOINTS.md#post-override-requests-requestid-cancel).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto).
- **decision:** `approve \| reject \| cancel`.

**Success: 200.**

The JSON response is passed through from the selected backend operation; see its linked response schema.

<a id="get-api-permissions"></a>

## GET /api/permissions

[Source](../../apps/web/src/app/api/permissions/route.ts#L7)

- **Backend contract:** [GET /permissions](API_ENDPOINTS.md#get-permissions).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    permission: string;
    description: string;
    configurable: boolean;
    roles: Array<string>;
  }>;
};
```

<a id="get-api-prospector-today"></a>

## GET /api/prospector/today

[Source](../../apps/web/src/app/api/prospector/today/route.ts#L12)

- **Backend contract:** [GET /prospector/today](API_ENDPOINTS.md#get-prospector-today).
- **Query forwarded/read:** `teamId`, `timeZone`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  day: {
    date: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
  };
  summary: {
    actionsLeft: number;
    toDo: number;
    followUps: number;
    meetings: number;
    overdue: number;
    completedToday: number;
  };
  priorities: Array<{
    id: string;
    campaignId: string;
    campaignProspectId: string;
    dueAt: string;
    isOverdue: boolean;
    category: 'follow_up' | 'todo' | 'meeting';
    channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
    establishment: {
      id: string;
      name: string;
      city: null | string;
      phone: null | string;
      latitude: null | number;
      longitude: null | number;
    };
  }>;
};
```

<a id="get-api-prospects"></a>

## GET /api/prospects

[Source](../../apps/web/src/app/api/prospects/route.ts#L31)

- **Backend contract:** [GET /prospects](API_ENDPOINTS.md#get-prospects).
- **Query forwarded/read:** `search`, `category`, `department`, `city`, `regionId`, `campaignId`, `status`, `sort`, `direction`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    regionId: null | string;
    externalReference: null | string;
    name: string;
    normalizedName: string;
    addressLine1: null | string;
    postalCode: null | string;
    city: null | string;
    countryCode: string;
    phone: null | string;
    website: null | string;
    latitude: null | number;
    longitude: null | number;
    status: 'active' | 'archived' | 'inactive';
    source: 'manual' | 'import' | 'api';
    category:
      | null
      | 'prospection'
      | 'justice_enquetes'
      | 'sante'
      | 'asile_social'
      | 'douanes_onaf'
      | 'cra'
      | 'prescripteurs';
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-prospects-prospectid"></a>

## GET /api/prospects/:prospectId

[Source](../../apps/web/src/app/api/prospects/[prospectId]/route.ts#L19)

- **Backend contract:** [GET /prospects/:prospectId](API_ENDPOINTS.md#get-prospects-prospectid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: string;
  };
  mergedIntoId: null | string;
  mergedSourceIds: Array<string>;
  id: string;
  tenantId: string;
  regionId: null | string;
  externalReference: null | string;
  name: string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  city: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
  status: 'active' | 'archived' | 'inactive';
  source: 'manual' | 'import' | 'api';
  category:
    | null
    | 'prospection'
    | 'justice_enquetes'
    | 'sante'
    | 'asile_social'
    | 'douanes_onaf'
    | 'cra'
    | 'prescripteurs';
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-prospects-prospectid-addresses"></a>

## GET /api/prospects/:prospectId/addresses

[Source](../../apps/web/src/app/api/prospects/[prospectId]/addresses/route.ts#L13)

- **Backend contract:** [GET /prospects/:prospectId/addresses](API_ENDPOINTS.md#get-prospects-prospectid-addresses).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    prospectId: string;
    label: null | string;
    line1: string;
    line2: null | string;
    postalCode: null | string;
    city: null | string;
    region: null | string;
    countryCode: string;
    latitude: null | number;
    longitude: null | number;
    isPrimary: boolean;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-prospects-prospectid-campaign-memberships"></a>

## GET /api/prospects/:prospectId/campaign-memberships

[Source](../../apps/web/src/app/api/prospects/[prospectId]/campaign-memberships/route.ts#L16)

- **Backend contract:** [GET /prospects/:prospectId/campaign-memberships](API_ENDPOINTS.md#get-prospects-prospectid-campaign-memberships).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignProspectId: string;
    campaign: {
      id: string;
      name: string;
      status: string;
    };
    organization: {
      id: string;
      name: string;
    };
    membership: {
      status: string;
      lifecycleStage: string;
      includedAt: string;
      updatedAt: string;
    };
    assignment: null | {
      id: string;
      status: string;
      priority: string;
      assignedAt: string;
      teamId: string;
      teamName: null | string;
      assignedUserId: null | string;
      assignedUserName: null | string;
    };
    latestActivity: null | {
      id: string;
      type: string;
      occurredAt: string;
    };
    nextFollowUp: null | {
      id: string;
      dueAt: string;
      category: string;
      status: string;
    };
  }>;
};
```

<a id="get-api-prospects-prospectid-consents"></a>

## GET /api/prospects/:prospectId/consents

[Source](../../apps/web/src/app/api/prospects/[prospectId]/consents/route.ts#L8)

- **Backend contract:** [GET /prospects/:prospectId/consents](API_ENDPOINTS.md#get-prospects-prospectid-consents).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    establishmentId: string;
    contactId: null | string;
    channel: 'email' | 'visit' | 'all' | 'phone' | 'sms';
    status: 'allowed' | 'blocked' | 'unknown';
    reason: string;
    evidence: null | {
      [key: string]: string;
    };
    effectiveAt: string;
    expiresAt: null | string;
    recordedBy: string;
    createdAt: string;
  }>;
  nextCursor: null | string;
  restrictions: Array<{
    channel: 'email' | 'visit' | 'phone' | 'sms';
    blocked: boolean;
  }>;
};
```

<a id="post-api-prospects-prospectid-consents"></a>

## POST /api/prospects/:prospectId/consents

[Source](../../apps/web/src/app/api/prospects/[prospectId]/consents/route.ts#L31)

- **Backend contract:** [POST /prospects/:prospectId/consents](API_ENDPOINTS.md#post-prospects-prospectid-consents).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateConsentDto](API_REQUEST_SCHEMAS.md#createconsentdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  establishmentId: string;
  contactId: null | string;
  channel: 'email' | 'visit' | 'all' | 'phone' | 'sms';
  status: 'allowed' | 'blocked' | 'unknown';
  reason: string;
  evidence: null | {
    [key: string]: string;
  };
  effectiveAt: string;
  expiresAt: null | string;
  recordedBy: string;
  createdAt: string;
};
```

<a id="get-api-prospects-prospectid-contacts"></a>

## GET /api/prospects/:prospectId/contacts

[Source](../../apps/web/src/app/api/prospects/[prospectId]/contacts/route.ts#L13)

- **Backend contract:** [GET /prospects/:prospectId/contacts](API_ENDPOINTS.md#get-prospects-prospectid-contacts).
- **Query forwarded/read:** `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    establishmentId: string;
    name: null | string;
    jobTitle: null | string;
    email: null | string;
    phone: null | string;
    isPrimary: boolean;
    status: 'active' | 'archived' | 'inactive';
    source: 'manual' | 'import' | 'api';
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-prospects-nearby"></a>

## GET /api/prospects/nearby

[Source](../../apps/web/src/app/api/prospects/nearby/route.ts#L8)

- **Backend contract:** [GET /prospects/nearby](API_ENDPOINTS.md#get-prospects-nearby).
- **Query forwarded/read:** `latitude`, `longitude`, `radiusMeters`, `limit`, `cursor`, `campaignId`, `teamId`, `stage`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    stages?: undefined | Array<string>;
    distance: number;
  }>;
  nextCursor: null | string;
  radiusMeters: number;
};
```

<a id="get-api-reports-report"></a>

## GET /api/reports/:report

[Source](../../apps/web/src/app/api/reports/[report]/route.ts#L8)

- **Backend contract:** [GET /reports/:reportId([0-9a-fA-F-]{36})](API_ENDPOINTS.md#get-reports-reportid-0-9a-fa-f-36).
- **Query forwarded/read:** `from`, `to`, `organizationId`, `teamId`, `userId`, `campaignId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  scope: {
    authority: 'client_admin' | 'director' | 'manager';
    organizationId: null | string;
    teamId: null | string;
  };
  filters: {
    organizationId: null | string;
    teamId: null | string;
    userId: null | string;
    campaignId: null | string;
  };
  activities: {
    total: number;
    byType: {
      [key: string]: number;
    };
    activeProspectors: number;
  };
  assignments: {
    current: number;
    individuallyAssigned: number;
    teamOwned: number;
  };
  followUps: {
    pending: number;
    overdue: number;
    dueInRange: number;
    completedInRange: number;
    cancelledInRange: number;
  };
  byProspector: Array<{
    userId: string;
    activities: number;
    currentAssignments: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  }>;
};
```

<a id="get-api-reservations"></a>

## GET /api/reservations

[Source](../../apps/web/src/app/api/reservations/route.ts#L8)

- **Backend contract:** [GET /reservations](API_ENDPOINTS.md#get-reservations).
- **Query forwarded/read:** `status`, `campaignId`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    membershipId?: undefined | string;
    status: 'active' | 'expired' | 'released';
    acquiredAt: string;
    expiresAt: string;
    releasedAt?: undefined | null | string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-reservations-reservationid"></a>

## GET /api/reservations/:reservationId

[Source](../../apps/web/src/app/api/reservations/[reservationId]/route.ts#L7)

- **Backend contract:** [GET /reservations/:reservationId](API_ENDPOINTS.md#get-reservations-reservationid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  membershipId?: undefined | string;
  status: 'active' | 'expired' | 'released';
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: undefined | null | string;
};
```

<a id="post-api-reservations-reservationid-extend"></a>

## POST /api/reservations/:reservationId/extend

[Source](../../apps/web/src/app/api/reservations/[reservationId]/extend/route.ts#L8)

- **Backend contract:** [POST /reservations/:reservationId/extend](API_ENDPOINTS.md#post-reservations-reservationid-extend).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ExtendReservationDto](API_REQUEST_SCHEMAS.md#extendreservationdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  membershipId?: undefined | string;
  status: 'active' | 'expired' | 'released';
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: undefined | null | string;
};
```

<a id="post-api-reservations-reservationid-heartbeat"></a>

## POST /api/reservations/:reservationId/heartbeat

[Source](../../apps/web/src/app/api/reservations/[reservationId]/heartbeat/route.ts#L8)

- **Backend contract:** [POST /reservations/:reservationId/heartbeat](API_ENDPOINTS.md#post-reservations-reservationid-heartbeat).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  membershipId?: undefined | string;
  status: 'active' | 'expired' | 'released';
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: undefined | null | string;
};
```

<a id="post-api-reservations-reservationid-release"></a>

## POST /api/reservations/:reservationId/release

[Source](../../apps/web/src/app/api/reservations/[reservationId]/release/route.ts#L8)

- **Backend contract:** [POST /reservations/:reservationId/release](API_ENDPOINTS.md#post-reservations-reservationid-release).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [ReleaseReservationDto](API_REQUEST_SCHEMAS.md#releasereservationdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  membershipId?: undefined | string;
  status: 'active' | 'expired' | 'released';
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: undefined | null | string;
};
```

<a id="post-api-reservations-check"></a>

## POST /api/reservations/check

[Source](../../apps/web/src/app/api/reservations/check/route.ts#L13)

- **Backend contract:** [POST /reservations/check](API_ENDPOINTS.md#post-reservations-check).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CheckCollisionDto](API_REQUEST_SCHEMAS.md#checkcollisiondto).

**Success: 200.**

```ts
type ResponseBody = {
  decision: 'allow' | 'block' | 'warn' | 'require_override';
  reasonCode:
    | 'NO_COLLISION'
    | 'ACTIVE_RESERVATION'
    | 'ACTIVE_ASSIGNMENT'
    | 'PLANNED_ACTION'
    | 'RECENT_CONTACT';
  establishmentId?: undefined | string;
  conflict?:
    | undefined
    | null
    | {
        expiresAt?: undefined | string;
        dueAt?: undefined | string;
        assignedAt?: undefined | string;
      };
  collisionId: null | string;
  overrideable: boolean;
  expiresAt?: undefined | string;
  policy?:
    | undefined
    | {
        evaluatorVersion?: undefined | string | number;
        defaultCoolingOffMinutes?: undefined | number;
      };
};
```

<a id="get-api-roles"></a>

## GET /api/roles

[Source](../../apps/web/src/app/api/roles/route.ts#L7)

- **Backend contract:** [GET /roles](API_ENDPOINTS.md#get-roles).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    role: string;
    description: string;
    scope: string;
  }>;
};
```

<a id="get-api-roles-role-permissions"></a>

## GET /api/roles/:role/permissions

[Source](../../apps/web/src/app/api/roles/[role]/permissions/route.ts#L8)

- **Backend contract:** [GET /roles/:role/permissions](API_ENDPOINTS.md#get-roles-role-permissions).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  role: string;
  scope?: undefined | string;
  configurable: boolean;
  permissions: Array<string>;
  configurablePermissions?: undefined | Array<string>;
  updatedAt: null | string;
  message?: undefined | string;
};
```

<a id="put-api-roles-role-permissions"></a>

## PUT /api/roles/:role/permissions

[Source](../../apps/web/src/app/api/roles/[role]/permissions/route.ts#L29)

- **Backend contract:** [PUT /roles/:role/permissions](API_ENDPOINTS.md#put-roles-role-permissions).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [RolePermissionsDto](API_REQUEST_SCHEMAS.md#rolepermissionsdto).

**Success: 200.**

```ts
type ResponseBody = {
  role: string;
  scope?: undefined | string;
  configurable: boolean;
  permissions: Array<string>;
  configurablePermissions?: undefined | Array<string>;
  updatedAt: null | string;
  message?: undefined | string;
};
```

<a id="get-api-routes"></a>

## GET /api/routes

[Source](../../apps/web/src/app/api/routes/route.ts#L9)

- **Backend contract:** [GET /routes](API_ENDPOINTS.md#get-routes).
- **Query forwarded/read:** `teamId`, `status`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    teamId: string;
    name: string;
    status: 'completed' | 'cancelled' | 'active' | 'draft';
    scheduledAt: string;
    startPoint: {
      latitude: number;
      longitude: number;
    };
    endPoint: null | {
      latitude: number;
      longitude: number;
    };
    stops?:
      | undefined
      | Array<{
          id: string;
          campaignProspectId: string;
          actionId: null | string;
          position: number;
          eta: null | string;
          status: null | 'completed' | 'skipped' | 'arrived';
          outcome: null | string;
          distanceMeters?: undefined | null | number;
          durationSeconds?: undefined | null | number;
        }>;
    totalDistanceMeters?: undefined | null | number;
    totalDurationSeconds?: undefined | null | number;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-routes"></a>

## POST /api/routes

[Source](../../apps/web/src/app/api/routes/route.ts#L38)

- **Backend contract:** [POST /routes](API_ENDPOINTS.md#post-routes).
- **Query forwarded/read:** `teamId`, `status`, `cursor`, `limit`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateRouteDto](API_REQUEST_SCHEMAS.md#createroutedto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="patch-api-route-stops-stopid"></a>

## PATCH /api/route-stops/:stopId

[Source](../../apps/web/src/app/api/route-stops/[stopId]/route.ts#L9)

- **Backend contract:** [PATCH /route-stops/:stopId](API_ENDPOINTS.md#patch-route-stops-stopid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateStopDto](API_REQUEST_SCHEMAS.md#updatestopdto).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  stops: Array<{
    id: string;
    status: 'pending' | 'completed' | 'arrived' | 'skipped';
    updatedAt: string /* ISO 8601 date-time */;
    tenantId: string;
    point: {
      latitude: number;
      longitude: number;
    };
    routeId: string;
    campaignProspectId: string;
    actionId: null | string;
    position: number;
    eta: null | string /* ISO 8601 date-time */;
    arrivedAt: null | string /* ISO 8601 date-time */;
    outcome: null | string;
  }>;
  metrics: {
    stopCount: number;
    completedStops: number;
    skippedStops: number;
    distanceKm: number;
    estimatedTravelMinutes: number;
    distanceBasis: string;
    durationBasis: string;
  };
  id: string;
  name: string;
  status: 'active' | 'draft' | 'completed' | 'cancelled';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  teamId: string;
  ownerId: string;
  scheduledAt: string /* ISO 8601 date-time */;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="delete-api-route-stops-stopid"></a>

## DELETE /api/route-stops/:stopId

[Source](../../apps/web/src/app/api/route-stops/[stopId]/route.ts#L13)

- **Backend contract:** [DELETE /route-stops/:stopId](API_ENDPOINTS.md#delete-route-stops-stopid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  stops: Array<{
    id: string;
    status: 'pending' | 'completed' | 'arrived' | 'skipped';
    updatedAt: string /* ISO 8601 date-time */;
    tenantId: string;
    point: {
      latitude: number;
      longitude: number;
    };
    routeId: string;
    campaignProspectId: string;
    actionId: null | string;
    position: number;
    eta: null | string /* ISO 8601 date-time */;
    arrivedAt: null | string /* ISO 8601 date-time */;
    outcome: null | string;
  }>;
  metrics: {
    stopCount: number;
    completedStops: number;
    skippedStops: number;
    distanceKm: number;
    estimatedTravelMinutes: number;
    distanceBasis: string;
    durationBasis: string;
  };
  id: string;
  name: string;
  status: 'active' | 'draft' | 'completed' | 'cancelled';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  teamId: string;
  ownerId: string;
  scheduledAt: string /* ISO 8601 date-time */;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-api-routes-routeid"></a>

## GET /api/routes/:routeId

[Source](../../apps/web/src/app/api/routes/[routeId]/route.ts#L10)

- **Backend contract:** [GET /routes/:routeId](API_ENDPOINTS.md#get-routes-routeid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="patch-api-routes-routeid"></a>

## PATCH /api/routes/:routeId

[Source](../../apps/web/src/app/api/routes/[routeId]/route.ts#L14)

- **Backend contract:** [PATCH /routes/:routeId](API_ENDPOINTS.md#patch-routes-routeid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateRouteDto](API_REQUEST_SCHEMAS.md#updateroutedto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="delete-api-routes-routeid"></a>

## DELETE /api/routes/:routeId

[Source](../../apps/web/src/app/api/routes/[routeId]/route.ts#L22)

- **Backend contract:** [DELETE /routes/:routeId](API_ENDPOINTS.md#delete-routes-routeid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="post-api-routes-routeid-complete"></a>

## POST /api/routes/:routeId/complete

[Source](../../apps/web/src/app/api/routes/[routeId]/complete/route.ts#L8)

- **Backend contract:** [POST /routes/:routeId/complete](API_ENDPOINTS.md#post-routes-routeid-complete).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="post-api-routes-routeid-optimize"></a>

## POST /api/routes/:routeId/optimize

[Source](../../apps/web/src/app/api/routes/[routeId]/optimize/route.ts#L8)

- **Backend contract:** [POST /routes/:routeId/optimize](API_ENDPOINTS.md#post-routes-routeid-optimize).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="post-api-routes-routeid-start"></a>

## POST /api/routes/:routeId/start

[Source](../../apps/web/src/app/api/routes/[routeId]/start/route.ts#L8)

- **Backend contract:** [POST /routes/:routeId/start](API_ENDPOINTS.md#post-routes-routeid-start).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="put-api-routes-routeid-stop-order"></a>

## PUT /api/routes/:routeId/stop-order

[Source](../../apps/web/src/app/api/routes/[routeId]/stop-order/route.ts#L8)

- **Backend contract:** [PUT /routes/:routeId/stop-order](API_ENDPOINTS.md#put-routes-routeid-stop-order).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [StopOrderDto](API_REQUEST_SCHEMAS.md#stoporderdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="post-api-routes-routeid-stops"></a>

## POST /api/routes/:routeId/stops

[Source](../../apps/web/src/app/api/routes/[routeId]/stops/route.ts#L8)

- **Backend contract:** [POST /routes/:routeId/stops](API_ENDPOINTS.md#post-routes-routeid-stops).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AddStopDto](API_REQUEST_SCHEMAS.md#addstopdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  teamId: string;
  name: string;
  status: 'completed' | 'cancelled' | 'active' | 'draft';
  scheduledAt: string;
  startPoint: {
    latitude: number;
    longitude: number;
  };
  endPoint: null | {
    latitude: number;
    longitude: number;
  };
  stops?:
    | undefined
    | Array<{
        id: string;
        campaignProspectId: string;
        actionId: null | string;
        position: number;
        eta: null | string;
        status: null | 'completed' | 'skipped' | 'arrived';
        outcome: null | string;
        distanceMeters?: undefined | null | number;
        durationSeconds?: undefined | null | number;
      }>;
  totalDistanceMeters?: undefined | null | number;
  totalDurationSeconds?: undefined | null | number;
};
```

<a id="get-api-search"></a>

## GET /api/search

[Source](../../apps/web/src/app/api/search/route.ts#L8)

- **Backend contract:** [GET /search](API_ENDPOINTS.md#get-search).
- **Query forwarded/read:** `q`, `type`, `limit`, `cursor`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    type: 'organization' | 'prospect' | 'campaign';
    title: string;
    subtitle: null | string;
    updatedAt: string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-search-facets"></a>

## GET /api/search/facets

[Source](../../apps/web/src/app/api/search/facets/route.ts#L8)

- **Backend contract:** [GET /search/facets](API_ENDPOINTS.md#get-search-facets).
- **Query forwarded/read:** `q`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  facets: Array<{
    type: 'organization' | 'prospect' | 'campaign';
    count: number;
  }>;
  [key: string]: unknown;
};
```

<a id="get-api-settings-default-statuses"></a>

## GET /api/settings/default-statuses

[Source](../../apps/web/src/app/api/settings/default-statuses/route.ts#L14)

- **Backend contract:** [GET /settings/default-statuses](API_ENDPOINTS.md#get-settings-default-statuses).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  outcomes: Array<{
    code: string;
    label: string;
    behavior: string;
    enabled: boolean;
    actionTypes: Array<string>;
  }>;
  lifecycleStages: Array<
    'in_progress' | 'qualified' | 'converted' | 'to_contact' | 'contact_made' | 'follow_up'
  >;
  etag?: undefined | string;
};
```

<a id="get-api-teams"></a>

## GET /api/teams

[Source](../../apps/web/src/app/api/teams/route.ts#L6)

- **Backend contract:** [GET /teams](API_ENDPOINTS.md#get-teams).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    organizationId: string;
    name: string;
    slug: string;
    status: 'active' | 'inactive';
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    capacity: number;
    managerMembershipId: null | string;
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-teams-teamid"></a>

## GET /api/teams/:teamId

[Source](../../apps/web/src/app/api/teams/[teamId]/route.ts#L8)

- **Backend contract:** [GET /teams/:teamId](API_ENDPOINTS.md#get-teams-teamid).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="patch-api-teams-teamid"></a>

## PATCH /api/teams/:teamId

[Source](../../apps/web/src/app/api/teams/[teamId]/route.ts#L27)

- **Backend contract:** [PATCH /teams/:teamId](API_ENDPOINTS.md#patch-teams-teamid).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateTeamDto](API_REQUEST_SCHEMAS.md#updateteamdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt?: undefined | string;
  updatedAt?: undefined | string;
  etag?: undefined | string;
};
```

<a id="get-api-teams-teamid-capacity"></a>

## GET /api/teams/:teamId/capacity

[Source](../../apps/web/src/app/api/teams/[teamId]/capacity/route.ts#L7)

- **Backend contract:** [GET /teams/:teamId/capacity](API_ENDPOINTS.md#get-teams-teamid-capacity).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  paused: number;
  teamOwned: number;
  members: {
    items: Array<{
      membershipId: string;
      displayName: null | string;
      email?: undefined | string;
      status: string;
      identityStatus: string;
      capacity: null | number;
      globalWorkload: string | number;
      eligible: boolean;
      available: null | number;
    }>;
    truncated: boolean;
  };
  [key: string]: unknown;
};
```

<a id="get-api-teams-teamid-members"></a>

## GET /api/teams/:teamId/members

[Source](../../apps/web/src/app/api/teams/[teamId]/members/route.ts#L8)

- **Backend contract:** [GET /teams/:teamId/members](API_ENDPOINTS.md#get-teams-teamid-members).
- **Query forwarded/read:** `state`, `membershipId`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    teamId: string;
    membershipId: string;
    teamRole: 'manager' | 'member';
    startsAt: string;
    endsAt: null | string;
    revokedAt: null | string;
    state: 'active' | 'revoked' | 'scheduled' | 'ended';
    etag: string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-teams-teamid-members"></a>

## POST /api/teams/:teamId/members

[Source](../../apps/web/src/app/api/teams/[teamId]/members/route.ts#L31)

- **Backend contract:** [POST /teams/:teamId/members](API_ENDPOINTS.md#post-teams-teamid-members).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateRosterDto](API_REQUEST_SCHEMAS.md#createrosterdto).

**Success: 201.**

```ts
type ResponseBody = undefined | {};
```

<a id="patch-api-teams-teamid-members-membershipid"></a>

## PATCH /api/teams/:teamId/members/:membershipId

[Source](../../apps/web/src/app/api/teams/[teamId]/members/[membershipId]/route.ts#L7)

- **Backend contract:** [PATCH /teams/:teamId/members/:membershipId](API_ENDPOINTS.md#patch-teams-teamid-members-membershipid).
- **Query forwarded/read:** `periodId`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateRosterDto](API_REQUEST_SCHEMAS.md#updaterosterdto).

**Success: 200.**

```ts
type ResponseBody = undefined | {};
```

<a id="delete-api-teams-teamid-members-membershipid"></a>

## DELETE /api/teams/:teamId/members/:membershipId

[Source](../../apps/web/src/app/api/teams/[teamId]/members/[membershipId]/route.ts#L37)

- **Backend contract:** [DELETE /teams/:teamId/members/:membershipId](API_ENDPOINTS.md#delete-teams-teamid-members-membershipid).
- **Query forwarded/read:** `periodId`.
- **Body:** none.

**Success: 204.**

No response body.

<a id="get-api-territories"></a>

## GET /api/territories

[Source](../../apps/web/src/app/api/territories/route.ts#L6)

- **Backend contract:** [GET /territories](API_ENDPOINTS.md#get-territories).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = Array<{
  boundary: null | {
    [key: string]: unknown;
  };
  center: null | {
    [key: string]: unknown;
  };
  id: string;
  tenantId: string;
  parentId: null | string;
  name: string;
  code: null | string;
  status: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
}>;
```

<a id="get-api-territories-map"></a>

## GET /api/territories/map

[Source](../../apps/web/src/app/api/territories/map/route.ts#L6)

- **Backend contract:** [GET /territories/map](API_ENDPOINTS.md#get-territories-map).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  type: string;
  features: Array<{
    type: string;
    id: string;
    geometry: null | {
      [key: string]: unknown;
    };
    properties: {
      name: string;
      code: null | string;
      parentId: null | string;
      center: null | {
        [key: string]: unknown;
      };
    };
  }>;
};
```

<a id="get-api-territory-assignments"></a>

## GET /api/territory-assignments

[Source](../../apps/web/src/app/api/territory-assignments/route.ts#L8)

- **Backend contract:** [GET /territory-assignments](API_ENDPOINTS.md#get-territory-assignments).
- **Query forwarded/read:** `territoryId`, `membershipId`, `teamId`, `state`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    territoryId: string;
    membershipId: null | string;
    teamId: null | string;
    priority: null | number;
    startsAt: string;
    endsAt: null | string;
    revokedAt: null | string;
    state: 'active' | 'revoked' | 'scheduled' | 'ended';
    etag?: undefined | string;
  }>;
  nextCursor: null | string;
};
```

<a id="post-api-territory-assignments"></a>

## POST /api/territory-assignments

[Source](../../apps/web/src/app/api/territory-assignments/route.ts#L33)

- **Backend contract:** [POST /territory-assignments](API_ENDPOINTS.md#post-territory-assignments).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#createterritoryassignmentdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  territoryId: string;
  membershipId: null | string;
  teamId: null | string;
  priority: null | number;
  startsAt: string;
  endsAt: null | string;
  revokedAt: null | string;
  state: 'active' | 'revoked' | 'scheduled' | 'ended';
  etag?: undefined | string;
};
```

<a id="patch-api-territory-assignments-assignmentid"></a>

## PATCH /api/territory-assignments/:assignmentId

[Source](../../apps/web/src/app/api/territory-assignments/[assignmentId]/route.ts#L8)

- **Backend contract:** [PATCH /territory-assignments/:id](API_ENDPOINTS.md#patch-territory-assignments-id).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [UpdateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#updateterritoryassignmentdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  territoryId: string;
  membershipId: null | string;
  teamId: null | string;
  priority: null | number;
  startsAt: string;
  endsAt: null | string;
  revokedAt: null | string;
  state: 'active' | 'revoked' | 'scheduled' | 'ended';
  etag?: undefined | string;
};
```

<a id="delete-api-territory-assignments-assignmentid"></a>

## DELETE /api/territory-assignments/:assignmentId

[Source](../../apps/web/src/app/api/territory-assignments/[assignmentId]/route.ts#L31)

- **Backend contract:** [DELETE /territory-assignments/:id](API_ENDPOINTS.md#delete-territory-assignments-id).
- **Query forwarded/read:** none declared.
- **Body:** none.

**Success: 204.**

No response body.

<a id="get-api-work-queue"></a>

## GET /api/work-queue

[Source](../../apps/web/src/app/api/work-queue/route.ts#L16)

- **Backend contract:** [GET /work-queue](API_ENDPOINTS.md#get-work-queue).
- **Query forwarded/read:** `teamId`, `campaignId`, `lifecycleStage`, `q`, `cursor`, `limit`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignProspectId: string;
    lifecycleStage:
      'in_progress' | 'qualified' | 'converted' | 'to_contact' | 'contact_made' | 'follow_up';
    latestActivity: null | {
      type: 'call' | 'email' | 'message' | 'visit';
      occurredAt: string;
    };
    nextFollowUp: null | {
      id: string;
      dueAt: string;
    };
    campaign: {
      id: string;
      name: string;
    };
    assignment: {
      id: string;
      organizationId: string;
      teamId: string;
      assignedAt: string;
    };
    establishment: {
      id: string;
      regionId: null | string;
      name: string;
      addressLine1: null | string;
      postalCode: null | string;
      city: null | string;
      countryCode: string;
      latitude: null | number;
      longitude: null | number;
      phone: null | string;
      website: null | string;
      status: 'active' | 'archived' | 'inactive';
    };
  }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: null | string;
  };
};
```

<a id="get-api-work-queue-campaignid-prospectid"></a>

## GET /api/work-queue/:campaignId/:prospectId

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/route.ts#L14)

- **Backend contract:** [GET /work-queue/:campaignId/:prospectId](API_ENDPOINTS.md#get-work-queue-campaignid-prospectid).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  campaignProspectId: string;
  campaign: {
    id: string;
    name: string;
  };
  assignment: {
    id: string;
    organizationId: string;
    teamId: string;
    assignedAt: string;
  };
  establishment: {
    id: string;
    regionId: null | string;
    name: string;
    addressLine1: null | string;
    postalCode: null | string;
    city: null | string;
    countryCode: string;
    latitude: null | number;
    longitude: null | number;
    phone: null | string;
    website: null | string;
    status: 'active' | 'archived' | 'inactive';
  };
};
```

<a id="post-api-work-queue-campaignid-prospectid-activities"></a>

## POST /api/work-queue/:campaignId/:prospectId/activities

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/activities/route.ts#L78)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/activities](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-activities).
- **Query forwarded/read:** `teamId`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateProspectActivityDto](API_REQUEST_SCHEMAS.md#createprospectactivitydto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  type: 'call' | 'email' | 'message' | 'visit';
  occurredAt: string;
};
```

<a id="get-api-work-queue-campaignid-prospectid-collision-decision"></a>

## GET /api/work-queue/:campaignId/:prospectId/collision-decision

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/collision-decision/route.ts#L72)

- **Backend contract:** [GET /campaigns/:campaignId/prospects/:prospectId/collision-decision](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-collision-decision).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  decision: 'allow' | 'block' | 'warn' | 'require_override';
  reasonCode:
    | 'NO_COLLISION'
    | 'ACTIVE_RESERVATION'
    | 'ACTIVE_ASSIGNMENT'
    | 'PLANNED_ACTION'
    | 'RECENT_CONTACT';
  conflict:
    | null
    | {
        expiresAt: string;
      }
    | {
        dueAt: string;
      }
    | {
        assignedAt: string;
      };
};
```

<a id="post-api-work-queue-campaignid-prospectid-collision-overrides"></a>

## POST /api/work-queue/:campaignId/:prospectId/collision-overrides

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/collision-overrides/route.ts#L25)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/collision-overrides](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-collision-overrides).
- **Query forwarded/read:** none declared.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateCollisionOverrideDto](API_REQUEST_SCHEMAS.md#createcollisionoverridedto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  prospectId: string;
  createdAt: string;
};
```

<a id="get-api-work-queue-campaignid-prospectid-follow-ups"></a>

## GET /api/work-queue/:campaignId/:prospectId/follow-ups

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/follow-ups/route.ts#L40)

- **Backend contract:** [GET /campaigns/:campaignId/prospects/:prospectId/follow-ups](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-follow-ups).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    campaignId: string;
    prospectId: string;
    establishmentId: string;
    dueAt: string;
    status: 'completed' | 'cancelled' | 'pending';
    category: 'follow_up' | 'todo' | 'meeting';
    channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
    ownership: 'user' | 'team';
    completedAt: null | string;
    cancelledAt: null | string;
    createdAt: string;
    updatedAt: string;
  }>;
};
```

<a id="post-api-work-queue-campaignid-prospectid-follow-ups"></a>

## POST /api/work-queue/:campaignId/:prospectId/follow-ups

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/follow-ups/route.ts#L68)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/follow-ups](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups).
- **Query forwarded/read:** `teamId`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [CreateProspectFollowUpDto](API_REQUEST_SCHEMAS.md#createprospectfollowupdto).

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  prospectId: string;
  establishmentId: string;
  dueAt: string;
  status: 'completed' | 'cancelled' | 'pending';
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
  ownership: 'user' | 'team';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="post-api-work-queue-campaignid-prospectid-follow-ups-followupid-cancel"></a>

## POST /api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/cancel

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/follow-ups/[followUpId]/cancel/route.ts#L22)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/cancel](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-cancel).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  prospectId: string;
  establishmentId: string;
  dueAt: string;
  status: 'completed' | 'cancelled' | 'pending';
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
  ownership: 'user' | 'team';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="post-api-work-queue-campaignid-prospectid-follow-ups-followupid-complete"></a>

## POST /api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/complete

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/follow-ups/[followUpId]/complete/route.ts#L22)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/complete](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-complete).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  prospectId: string;
  establishmentId: string;
  dueAt: string;
  status: 'completed' | 'cancelled' | 'pending';
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
  ownership: 'user' | 'team';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="patch-api-work-queue-campaignid-prospectid-follow-ups-followupid-reschedule"></a>

## PATCH /api/work-queue/:campaignId/:prospectId/follow-ups/:followUpId/reschedule

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/follow-ups/[followUpId]/reschedule/route.ts#L26)

- **Backend contract:** [PATCH /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule](API_ENDPOINTS.md#patch-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-reschedule).
- **Query forwarded/read:** `teamId`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [RescheduleProspectFollowUpDto](API_REQUEST_SCHEMAS.md#rescheduleprospectfollowupdto).

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  prospectId: string;
  establishmentId: string;
  dueAt: string;
  status: 'completed' | 'cancelled' | 'pending';
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'call' | 'email' | 'message' | 'visit' | 'letter';
  ownership: 'user' | 'team';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="get-api-work-queue-campaignid-prospectid-reservation"></a>

## GET /api/work-queue/:campaignId/:prospectId/reservation

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/reservation/route.ts#L83)

- **Backend contract:** [GET /campaigns/:campaignId/prospects/:prospectId/reservation](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-reservation).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody =
  | {
      state: 'none';
    }
  | {
      state: 'owned';
      reservationId: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      state: 'reserved';
      expiresAt: string;
    };
```

<a id="post-api-work-queue-campaignid-prospectid-reservation"></a>

## POST /api/work-queue/:campaignId/:prospectId/reservation

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/reservation/route.ts#L111)

- **Backend contract:** [POST /campaigns/:campaignId/prospects/:prospectId/reservation](API_ENDPOINTS.md#post-campaigns-campaignid-prospects-prospectid-reservation).
- **Query forwarded/read:** `teamId`.
- **Body:** JSON forwarded to backend.
- **Accepted fields:** [AcquireReservationDto](API_REQUEST_SCHEMAS.md#acquirereservationdto).

**Success: 201.**

```ts
type ResponseBody = {
  reservationId: string;
  acquiredAt: string;
  expiresAt: string;
};
```

<a id="delete-api-work-queue-campaignid-prospectid-reservation-reservationid"></a>

## DELETE /api/work-queue/:campaignId/:prospectId/reservation/:reservationId

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/reservation/[reservationId]/route.ts#L49)

- **Backend contract:** [DELETE /campaigns/:campaignId/prospects/:prospectId/reservation/:reservationId](API_ENDPOINTS.md#delete-campaigns-campaignid-prospects-prospectid-reservation-reservationid).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  released: true;
  reservationId: string;
};
```

<a id="get-api-work-queue-campaignid-prospectid-timeline"></a>

## GET /api/work-queue/:campaignId/:prospectId/timeline

[Source](../../apps/web/src/app/api/work-queue/[campaignId]/[prospectId]/timeline/route.ts#L16)

- **Backend contract:** [GET /campaigns/:campaignId/prospects/:prospectId/timeline](API_ENDPOINTS.md#get-campaigns-campaignid-prospects-prospectid-timeline).
- **Query forwarded/read:** `limit`, `cursor`, `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    kind: 'activity';
    id: string;
    occurredAt: string;
    activityType: 'call' | 'email' | 'message' | 'visit';
    actor: {
      userId: string;
    };
    context: {
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
    };
  }>;
  nextCursor: null | string;
};
```

<a id="get-api-work-queue-options"></a>

## GET /api/work-queue/options

[Source](../../apps/web/src/app/api/work-queue/options/route.ts#L7)

- **Backend contract:** [GET /work-queue/options](API_ENDPOINTS.md#get-work-queue-options).
- **Query forwarded/read:** `teamId`.
- **Body:** none.

**Success: 200.**

```ts
type ResponseBody = {
  campaigns: Array<{
    id: string;
    name: string;
  }>;
};
```
