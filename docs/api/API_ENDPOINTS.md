# Backend API endpoints

[Overview and conventions](API_CATALOG.md) · [Request fields](API_REQUEST_SCHEMAS.md) · [Browser API](WEB_API_ENDPOINTS.md)

389 registered method/path pairs. Prefix each path with /api/v1 for the versioned alias. Success schemas below are source-derived; common failure responses are described in the overview. Request DTO links expand every field and validator. Path placeholders are required. “No declared body/query” means the handler declares neither, not that arbitrary input is a supported contract.

## Index

| Domain                                                | Endpoints |
| ----------------------------------------------------- | --------: |
| [account](#account)                                   |        10 |
| [actions](#actions)                                   |        10 |
| [activities](#activities)                             |         2 |
| [assignments](#assignments)                           |        21 |
| [audit](#audit)                                       |        18 |
| [auth](#auth)                                         |        17 |
| [authorization](#authorization)                       |         4 |
| [campaign-organizations](#campaign-organizations)     |         4 |
| [campaigns](#campaigns)                               |        12 |
| [collisions](#collisions)                             |        11 |
| [communications](#communications)                     |         7 |
| [compliance](#compliance)                             |        10 |
| [consents](#consents)                                 |         2 |
| [data-jobs](#data-jobs)                               |        20 |
| [establishment-contacts](#establishment-contacts)     |         4 |
| [establishments](#establishments)                     |         5 |
| [exports](#exports)                                   |         3 |
| [follow-ups](#follow-ups)                             |        10 |
| [geographic-allocation](#geographic-allocation)       |         2 |
| [health](#health)                                     |         3 |
| [imports](#imports)                                   |         2 |
| [integrations](#integrations)                         |        20 |
| [maps](#maps)                                         |         4 |
| [memberships](#memberships)                           |        10 |
| [messaging](#messaging)                               |        13 |
| [notifications](#notifications)                       |         5 |
| [objectives](#objectives)                             |         5 |
| [organization-structure](#organization-structure)     |         7 |
| [outcome-settings](#outcome-settings)                 |         2 |
| [participation](#participation)                       |         8 |
| [permissions](#permissions)                           |         4 |
| [prospect-enrichment](#prospect-enrichment)           |        15 |
| [prospect-master](#prospect-master)                   |        15 |
| [prospector-today](#prospector-today)                 |         1 |
| [regions](#regions)                                   |         5 |
| [reporting](#reporting)                               |        18 |
| [reservations](#reservations)                         |        14 |
| [routes](#routes)                                     |        12 |
| [saved-views](#saved-views)                           |         4 |
| [scheduled-reports](#scheduled-reports)               |         5 |
| [search](#search)                                     |         2 |
| [security-administration](#security-administration)   |         6 |
| [tenants](#tenants)                                   |         9 |
| [territories](#territories)                           |         9 |
| [user-management](#user-management)                   |         3 |
| [work-queue](#work-queue)                             |         3 |
| [workspace-administration](#workspace-administration) |        13 |

## account

Current profile, preferences, workspace memberships and session management.

| Method | Path                                                       | Accepted data                                                             | Success |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| GET    | [`/me`](#get-me)                                           | No declared body/query                                                    | 200     |
| PATCH  | [`/me`](#patch-me)                                         | Body: [UpdateAccountDto](API_REQUEST_SCHEMAS.md#updateaccountdto)         | 200     |
| GET    | [`/me/memberships`](#get-me-memberships)                   | No declared body/query                                                    | 200     |
| GET    | [`/me/permissions`](#get-me-permissions)                   | No declared body/query                                                    | 200     |
| POST   | [`/me/active-membership`](#post-me-active-membership)      | Body: [SwitchMembershipDto](API_REQUEST_SCHEMAS.md#switchmembershipdto)   | 200     |
| GET    | [`/me/preferences`](#get-me-preferences)                   | No declared body/query                                                    | 200     |
| PATCH  | [`/me/preferences`](#patch-me-preferences)                 | Body: [UpdatePreferencesDto](API_REQUEST_SCHEMAS.md#updatepreferencesdto) | 200     |
| GET    | [`/me/sessions`](#get-me-sessions)                         | Query: [ListSessionsDto](API_REQUEST_SCHEMAS.md#listsessionsdto)          | 200     |
| DELETE | [`/me/sessions/others`](#delete-me-sessions-others)        | No declared body/query                                                    | 200     |
| DELETE | [`/me/sessions/:sessionId`](#delete-me-sessions-sessionid) | No declared body/query                                                    | 200     |

<a id="get-me"></a>

### GET /me

[AccountController.get](../../apps/api/src/account/account.controller.ts#L41)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  userId: string;
  grants: Array<
    | {
        role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
        scopeType: 'campaign' | 'territory';
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  identityId: string;
  email: string;
  membershipId: string;
  tenantId: string;
  tenantName: string;
  displayName: null | string;
  phone: null | string;
  avatar: null | {
    url: string;
    altText: string;
  };
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
};
```

<a id="patch-me"></a>

### PATCH /me

[AccountController.update](../../apps/api/src/account/account.controller.ts#L46)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('account.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [UpdateAccountDto](API_REQUEST_SCHEMAS.md#updateaccountdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                  | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  userId: string;
  grants: Array<
    | {
        role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
        scopeType: 'campaign' | 'territory';
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  identityId: string;
  email: string;
  membershipId: string;
  tenantId: string;
  tenantName: string;
  displayName: null | string;
  phone: null | string;
  avatar: null | {
    url: string;
    altText: string;
  };
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
};
```

<a id="get-me-memberships"></a>

### GET /me/memberships

[AccountController.memberships](../../apps/api/src/account/account.controller.ts#L56)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

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

<a id="get-me-permissions"></a>

### GET /me/permissions

[AccountController.permissions](../../apps/api/src/account/account.controller.ts#L61)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<
  | {
      permissions: Array<string>;
      grantId: string;
      role: null;
      scopeType: string;
      organizationId: null;
      teamId: null;
      effect: string;
      resourceId: string;
      reason: string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      role: string;
      scopeType: 'tenant' | 'organization' | 'team';
      organizationId: null | string;
      teamId: null | string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      source: string;
      role: null;
      scopeType: string;
      organizationId: string;
      teamId: null;
      campaignId: string;
      territoryId: null;
      accessLevel: string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      source: string;
      role: null;
      scopeType: string;
      organizationId: string;
      teamId: string;
      campaignId: null;
      territoryId: null;
      accessLevel: string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      source: string;
      role: null;
      scopeType: string;
      organizationId: null;
      teamId: null;
      campaignId: string;
      territoryId: null;
      accessLevel: string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      source: string;
      role: null;
      scopeType: string;
      organizationId: null;
      teamId: null;
      campaignId: null;
      territoryId: string;
      accessLevel: string;
    }
  | {
      permissions: Array<string>;
      grantId: string;
      role: string;
      scopeType: 'campaign' | 'territory';
      organizationId: null;
      teamId: null;
      campaignId: null | string;
      territoryId: null | string;
      accessLevel: 'read' | 'read_write' | 'manage';
    }
>;
```

<a id="post-me-active-membership"></a>

### POST /me/active-membership

[AccountController.switchMembership](../../apps/api/src/account/account.controller.ts#L66)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [SwitchMembershipDto](API_REQUEST_SCHEMAS.md#switchmembershipdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  accessToken: string;
  refreshToken: string;
};
```

<a id="get-me-preferences"></a>

### GET /me/preferences

[AccountController.preferences](../../apps/api/src/account/account.controller.ts#L75)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  theme: string;
  density: string;
  reducedMotion: boolean;
  highContrast: boolean;
};
```

<a id="patch-me-preferences"></a>

### PATCH /me/preferences

[AccountController.updatePreferences](../../apps/api/src/account/account.controller.ts#L80)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('account.preferences')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [UpdatePreferencesDto](API_REQUEST_SCHEMAS.md#updatepreferencesdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                          | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  theme: string;
  density: string;
  reducedMotion: boolean;
  highContrast: boolean;
};
```

<a id="get-me-sessions"></a>

### GET /me/sessions

[AccountController.sessions](../../apps/api/src/account/account.controller.ts#L90)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListSessionsDto](API_REQUEST_SCHEMAS.md#listsessionsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    createdAt: string /* ISO 8601 date-time */;
    expiresAt: string /* ISO 8601 date-time */;
    absoluteExpiresAt: string /* ISO 8601 date-time */;
    current: boolean;
  }>;
  nextCursor: null | string;
};
```

<a id="delete-me-sessions-others"></a>

### DELETE /me/sessions/others

[AccountController.revokeOthers](../../apps/api/src/account/account.controller.ts#L95)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('session.revoke_others')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  revoked: number;
};
```

<a id="delete-me-sessions-sessionid"></a>

### DELETE /me/sessions/:sessionId

[AccountController.revoke](../../apps/api/src/account/account.controller.ts#L101)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('session.revoke')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `sessionId`   | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  revoked: number;
};
```

## actions

Plan, start, complete, cancel and correct prospecting actions; unified prospect history.

| Method | Path                                                                    | Accepted data                                                       | Success |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ------- |
| GET    | [`/actions`](#get-actions)                                              | Query: [ListActionsDto](API_REQUEST_SCHEMAS.md#listactionsdto)      | 200     |
| POST   | [`/actions`](#post-actions)                                             | Body: [CreateActionDto](API_REQUEST_SCHEMAS.md#createactiondto)     | 201     |
| GET    | [`/actions/:actionId`](#get-actions-actionid)                           | No declared body/query                                              | 200     |
| GET    | [`/actions/:actionId/events`](#get-actions-actionid-events)             | Query: [ListActionsDto](API_REQUEST_SCHEMAS.md#listactionsdto)      | 200     |
| PATCH  | [`/actions/:actionId`](#patch-actions-actionid)                         | Body: [UpdateActionDto](API_REQUEST_SCHEMAS.md#updateactiondto)     | 200     |
| POST   | [`/actions/:actionId/start`](#post-actions-actionid-start)              | Body: [StartActionDto](API_REQUEST_SCHEMAS.md#startactiondto)       | 200     |
| POST   | [`/actions/:actionId/complete`](#post-actions-actionid-complete)        | Body: [CompleteActionDto](API_REQUEST_SCHEMAS.md#completeactiondto) | 200     |
| POST   | [`/actions/:actionId/cancel`](#post-actions-actionid-cancel)            | Body: [ReasonDto](API_REQUEST_SCHEMAS.md#reasondto)                 | 200     |
| POST   | [`/actions/:actionId/corrections`](#post-actions-actionid-corrections)  | Body: [CorrectionDto](API_REQUEST_SCHEMAS.md#correctiondto)         | 200     |
| GET    | [`/prospects/:prospectId/timeline`](#get-prospects-prospectid-timeline) | Query: [TimelineQuery](API_REQUEST_SCHEMAS.md#timelinequery)        | 200     |

<a id="get-actions"></a>

### GET /actions

[ActionController.list](../../apps/api/src/actions/action.controller.ts#L68)

- **Access:** `AuthGuard`

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListActionsDto](API_REQUEST_SCHEMAS.md#listactionsdto) | All fields, defaults and validators in linked schema |

Response verified from [service return expression](../../apps/api/src/actions/action.service.ts#L125).

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignmentId: string;
    assigneeMembershipId: string;
    createdBy: string;
    type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
    status: 'completed' | 'cancelled' | 'planned' | 'started';
    subject: string;
    notes: null | string;
    dueAt: null | string /* ISO 8601 date-time */;
    startedAt: null | string /* ISO 8601 date-time */;
    completedAt: null | string /* ISO 8601 date-time */;
    cancelledAt: null | string /* ISO 8601 date-time */;
    reservationId: null | string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-actions"></a>

### POST /actions

[ActionController.create](../../apps/api/src/actions/action.controller.ts#L71)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.create')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateActionDto](API_REQUEST_SCHEMAS.md#createactiondto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  establishmentId: string;
  campaignId: string;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  campaignProspectId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
};
```

<a id="get-actions-actionid"></a>

### GET /actions/:actionId

[ActionController.detail](../../apps/api/src/actions/action.controller.ts#L78)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `actionId`    | `string`; `new ParseUUIDPipe()` |

Response verified from [service return expression](../../apps/api/src/actions/action.service.ts#L146).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  outcome: null | {
    id: string;
    tenantId: string;
    actionId: string;
    outcomeCode: string;
    notes: null | string;
    recordedBy: string;
    recordedAt: string /* ISO 8601 date-time */;
  };
  effects: Array<{
    id: string;
    type: 'release_reservation' | 'schedule_follow_up';
    deliveredAt: null | string /* ISO 8601 date-time */;
  }>;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-actions-actionid-events"></a>

### GET /actions/:actionId/events

[ActionController.events](../../apps/api/src/actions/action.controller.ts#L84)

- **Access:** `AuthGuard`

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListActionsDto](API_REQUEST_SCHEMAS.md#listactionsdto) | All fields, defaults and validators in linked schema |

Response verified from [service return expression](../../apps/api/src/actions/action.service.ts#L164).

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    actionId: string;
    eventType: string;
    actorMembershipId: string;
    data: {
      [key: string]: unknown;
    };
    createdAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="patch-actions-actionid"></a>

### PATCH /actions/:actionId

[ActionController.update](../../apps/api/src/actions/action.controller.ts#L91)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.update')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateActionDto](API_REQUEST_SCHEMAS.md#updateactiondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-actions-actionid-start"></a>

### POST /actions/:actionId/start

[ActionController.start](../../apps/api/src/actions/action.controller.ts#L102)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.start')`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [StartActionDto](API_REQUEST_SCHEMAS.md#startactiondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                              | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-actions-actionid-complete"></a>

### POST /actions/:actionId/complete

[ActionController.complete](../../apps/api/src/actions/action.controller.ts#L114)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.complete')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CompleteActionDto](API_REQUEST_SCHEMAS.md#completeactiondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-actions-actionid-cancel"></a>

### POST /actions/:actionId/cancel

[ActionController.cancel](../../apps/api/src/actions/action.controller.ts#L126)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.cancel')`.

| Input location | Name / schema                                 | Type / constraints                                   |
| -------------- | --------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ReasonDto](API_REQUEST_SCHEMAS.md#reasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-actions-actionid-corrections"></a>

### POST /actions/:actionId/corrections

[ActionController.correct](../../apps/api/src/actions/action.controller.ts#L138)

- **Access:** `AuthGuard`, `ActionWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('action.correct')`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `actionId`                                            | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CorrectionDto](API_REQUEST_SCHEMAS.md#correctiondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                            | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assigneeMembershipId: string;
  createdBy: string;
  type: 'email' | 'call' | 'message' | 'visit' | 'task' | 'note';
  status: 'completed' | 'cancelled' | 'planned' | 'started';
  subject: string;
  notes: null | string;
  dueAt: null | string /* ISO 8601 date-time */;
  startedAt: null | string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  reservationId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-prospects-prospectid-timeline"></a>

### GET /prospects/:prospectId/timeline

[UnifiedTimelineController.list](../../apps/api/src/actions/unified-timeline.controller.ts#L16)

- **Access:** `AuthGuard`

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                          | `string`; `new ParseUUIDPipe()`                      |
| Query          | [TimelineQuery](API_REQUEST_SCHEMAS.md#timelinequery) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    kind: string;
    occurred_at: string;
    data: {
      [key: string]: unknown;
    };
  }>;
  nextCursor: null | string;
};
```

## activities

Append campaign-scoped activities and read their timeline.

| Method | Path                                                                                                                    | Accepted data                                                                              | Success |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------- |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/activities`](#post-campaigns-campaignid-prospects-prospectid-activities) | Body: [CreateProspectActivityDto](API_REQUEST_SCHEMAS.md#createprospectactivitydto)        | 201     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/timeline`](#get-campaigns-campaignid-prospects-prospectid-timeline)      | Query: [ListProspectTimelineQueryDto](API_REQUEST_SCHEMAS.md#listprospecttimelinequerydto) | 200     |

<a id="post-campaigns-campaignid-prospects-prospectid-activities"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/activities

[ProspectActivityController.record](../../apps/api/src/activities/prospect-activity.controller.ts#L18)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('activity.record')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateProspectActivityDto](API_REQUEST_SCHEMAS.md#createprospectactivitydto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  tenantId: string;
  userId: string;
  occurredAt: string /* ISO 8601 date-time */;
  type: 'email' | 'call' | 'message' | 'visit';
  establishmentId: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: string;
  reservationId: string;
};
```

<a id="get-campaigns-campaignid-prospects-prospectid-timeline"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/timeline

[ProspectTimelineController.getTimeline](../../apps/api/src/activities/prospect-timeline.controller.ts#L19)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                       | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                        | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                        | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListProspectTimelineQueryDto](API_REQUEST_SCHEMAS.md#listprospecttimelinequerydto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    kind: 'activity';
    id: string;
    occurredAt: string;
    activityType: 'email' | 'call' | 'message' | 'visit';
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

## assignments

Assign campaign prospects, preview/apply bulk allocation, manage rules, reassign and end ownership.

| Method | Path                                                                                                                                   | Accepted data                                                                       | Success |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| GET    | [`/assignments`](#get-assignments)                                                                                                     | Query: [AssignmentListDto](API_REQUEST_SCHEMAS.md#assignmentlistdto)                | 200     |
| GET    | [`/assignments/unassigned`](#get-assignments-unassigned)                                                                               | Query: [UnassignedListDto](API_REQUEST_SCHEMAS.md#unassignedlistdto)                | 200     |
| POST   | [`/assignments`](#post-assignments)                                                                                                    | Body: [CreateAssignmentDto](API_REQUEST_SCHEMAS.md#createassignmentdto)             | 201     |
| GET    | [`/assignments/:assignmentId`](#get-assignments-assignmentid)                                                                          | No declared body/query                                                              | 200     |
| PATCH  | [`/assignments/:assignmentId`](#patch-assignments-assignmentid)                                                                        | Body: [UpdateAssignmentDto](API_REQUEST_SCHEMAS.md#updateassignmentdto)             | 200     |
| POST   | [`/assignments/:assignmentId/reassign`](#post-assignments-assignmentid-reassign)                                                       | Body: [ReassignAssignmentDto](API_REQUEST_SCHEMAS.md#reassignassignmentdto)         | 200     |
| POST   | [`/assignments/:assignmentId/complete`](#post-assignments-assignmentid-complete)                                                       | Body: [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto)                   | 200     |
| POST   | [`/assignments/:assignmentId/revoke`](#post-assignments-assignmentid-revoke)                                                           | Body: [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto)                   | 200     |
| POST   | [`/assignments/preview`](#post-assignments-preview)                                                                                    | Body: [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto)               | 200     |
| POST   | [`/assignments/bulk`](#post-assignments-bulk)                                                                                          | Body: [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto)               | 201     |
| GET    | [`/assignment-rules`](#get-assignment-rules)                                                                                           | Query: [AssignmentRuleListDto](API_REQUEST_SCHEMAS.md#assignmentrulelistdto)        | 200     |
| POST   | [`/assignment-rules`](#post-assignment-rules)                                                                                          | Body: [CreateAssignmentRuleDto](API_REQUEST_SCHEMAS.md#createassignmentruledto)     | 201     |
| PATCH  | [`/assignment-rules/:ruleId`](#patch-assignment-rules-ruleid)                                                                          | Body: [AssignmentRulePatchDto](API_REQUEST_SCHEMAS.md#assignmentrulepatchdto)       | 200     |
| DELETE | [`/assignment-rules/:ruleId`](#delete-assignment-rules-ruleid)                                                                         | No declared body/query                                                              | 200     |
| POST   | [`/assignment-rules/:ruleId/simulate`](#post-assignment-rules-ruleid-simulate)                                                         | Body: [AssignmentSelectionDto](API_REQUEST_SCHEMAS.md#assignmentselectiondto)       | 200     |
| GET    | [`/assignment-suggestions`](#get-assignment-suggestions)                                                                               | Query: [AssignmentSuggestionDto](API_REQUEST_SCHEMAS.md#assignmentsuggestiondto)    | 200     |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/assignment`](#post-campaigns-campaignid-prospects-prospectid-assignment)                | Body: [AssignCampaignProspectDto](API_REQUEST_SCHEMAS.md#assigncampaignprospectdto) | 201     |
| PUT    | [`/campaigns/:campaignId/prospects/:prospectId/assignment`](#put-campaigns-campaignid-prospects-prospectid-assignment)                 | Body: [AssignCampaignProspectDto](API_REQUEST_SCHEMAS.md#assigncampaignprospectdto) | 200     |
| DELETE | [`/campaigns/:campaignId/prospects/:prospectId/assignment`](#delete-campaigns-campaignid-prospects-prospectid-assignment)              | No declared body/query                                                              | 200     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/assignment`](#get-campaigns-campaignid-prospects-prospectid-assignment)                 | No declared body/query                                                              | 200     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/assignment-history`](#get-campaigns-campaignid-prospects-prospectid-assignment-history) | No declared body/query                                                              | 200     |

<a id="get-assignments"></a>

### GET /assignments

[AssignmentLifecycleController.list](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L70)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [AssignmentListDto](API_REQUEST_SCHEMAS.md#assignmentlistdto) | All fields, defaults and validators in linked schema |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L84).

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    organizationId: string;
    teamId: string;
    assignedUserId: null | string;
    assignedAt: string /* ISO 8601 date-time */;
    status: 'active' | 'paused' | 'completed' | 'revoked';
    priority: 'low' | 'normal' | 'high' | 'critical';
    endReason: null | string;
    updatedAt: string /* ISO 8601 date-time */;
    endedAt: null | string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-assignments-unassigned"></a>

### GET /assignments/unassigned

[AssignmentLifecycleController.unassigned](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L73)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [UnassignedListDto](API_REQUEST_SCHEMAS.md#unassignedlistdto) | All fields, defaults and validators in linked schema |

Fields are taken from the SQL SELECT projection; category and lifecycleStage use the database enums. Coordinates are nullable.

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L192).

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignProspectId: string;
    campaignId: string;
    establishmentId: string;
    lifecycleStage: string;
    name: string;
    category: string | null;
    city: string | null;
    postalCode: string | null;
    regionId: string | null;
    latitude: number | null;
    longitude: number | null;
    department: string | null;
    contactBlocked: boolean;
    activeElsewhere: boolean;
  }>;
  nextCursor: string | null;
};
```

<a id="post-assignments"></a>

### POST /assignments

[AssignmentLifecycleController.create](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L79)

- **Access:** `AuthGuard`, `AssignmentLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('canonical_assignment.create')`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateAssignmentDto](API_REQUEST_SCHEMAS.md#createassignmentdto) | All fields, defaults and validators in linked schema |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L117).

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  history: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    organizationId: string;
    teamId: string;
    assignedUserId: null | string;
    assignedAt: string /* ISO 8601 date-time */;
    status: 'active' | 'paused' | 'completed' | 'revoked';
    priority: 'low' | 'normal' | 'high' | 'critical';
    endReason: null | string;
    updatedAt: string /* ISO 8601 date-time */;
    endedAt: null | string /* ISO 8601 date-time */;
  }>;
  historyTruncated: boolean;
  events: Array<{
    id: string;
    action: string;
    occurredAt: string /* ISO 8601 date-time */;
    reason: null | {};
  }>;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string /* ISO 8601 date-time */;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-assignments-assignmentid"></a>

### GET /assignments/:assignmentId

[AssignmentLifecycleController.detail](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L85)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints              |
| -------------- | -------------- | ------------------------------- |
| Param          | `assignmentId` | `string`; `new ParseUUIDPipe()` |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L117).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  history: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    organizationId: string;
    teamId: string;
    assignedUserId: null | string;
    assignedAt: string /* ISO 8601 date-time */;
    status: 'active' | 'paused' | 'completed' | 'revoked';
    priority: 'low' | 'normal' | 'high' | 'critical';
    endReason: null | string;
    updatedAt: string /* ISO 8601 date-time */;
    endedAt: null | string /* ISO 8601 date-time */;
  }>;
  historyTruncated: boolean;
  events: Array<{
    id: string;
    action: string;
    occurredAt: string /* ISO 8601 date-time */;
    reason: null | {};
  }>;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  updatedAt: string /* ISO 8601 date-time */;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="patch-assignments-assignmentid"></a>

### PATCH /assignments/:assignmentId

[AssignmentLifecycleController.update](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L91)

- **Access:** `AuthGuard`, `AssignmentLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('canonical_assignment.update')`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `assignmentId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateAssignmentDto](API_REQUEST_SCHEMAS.md#updateassignmentdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                        | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L323).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-assignments-assignmentid-reassign"></a>

### POST /assignments/:assignmentId/reassign

[AssignmentLifecycleController.reassign](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L102)

- **Access:** `AuthGuard`, `AssignmentLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('canonical_assignment.reassign')`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `assignmentId`                                                        | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ReassignAssignmentDto](API_REQUEST_SCHEMAS.md#reassignassignmentdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                            | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L323).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-assignments-assignmentid-complete"></a>

### POST /assignments/:assignmentId/complete

[AssignmentLifecycleController.complete](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L114)

- **Access:** `AuthGuard`, `AssignmentLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('canonical_assignment.complete')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `assignmentId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                  | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L323).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-assignments-assignmentid-revoke"></a>

### POST /assignments/:assignmentId/revoke

[AssignmentLifecycleController.revoke](../../apps/api/src/assignments/assignment-lifecycle.controller.ts#L126)

- **Access:** `AuthGuard`, `AssignmentLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('canonical_assignment.revoke')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `assignmentId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignmentEndDto](API_REQUEST_SCHEMAS.md#assignmentenddto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                  | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/assignments/assignment-lifecycle.service.ts#L323).

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-assignments-preview"></a>

### POST /assignments/preview

[AssignmentBatchController.preview](../../apps/api/src/assignments/assignment-batch.controller.ts#L83)

- **Access:** `AuthGuard`, `AssignmentBatchGuard`

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  ruleId: null | string;
  mode: string;
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: Array<{
    prospectId: string;
    outcome:
      | 'missing_coordinates'
      | 'proposed'
      | 'assigned'
      | 'already_assigned'
      | 'inactive_prospect'
      | 'capacity_exhausted'
      | 'ineligible_target'
      | 'no_skill_match'
      | 'no_proximity_match';
    teamId?: undefined | string;
    assignedUserId?: undefined | null | string;
    assignmentId?: undefined | string;
    distanceKm?: undefined | number;
    candidates?:
      | undefined
      | Array<{
          teamId: string;
          assignedUserId: null | string;
          distanceKm: null | number;
          availableTeamCapacity: number;
          availableMemberCapacity: null | number;
        }>;
  }>;
};
```

<a id="post-assignments-bulk"></a>

### POST /assignments/bulk

[AssignmentBatchController.bulk](../../apps/api/src/assignments/assignment-batch.controller.ts#L88)

- **Access:** `AuthGuard`, `AssignmentBatchGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment.bulk')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [AssignmentBatchDto](API_REQUEST_SCHEMAS.md#assignmentbatchdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  campaignId: string;
  ruleId: null | string;
  mode: string;
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: Array<{
    prospectId: string;
    outcome:
      | 'missing_coordinates'
      | 'proposed'
      | 'assigned'
      | 'already_assigned'
      | 'inactive_prospect'
      | 'capacity_exhausted'
      | 'ineligible_target'
      | 'no_skill_match'
      | 'no_proximity_match';
    teamId?: undefined | string;
    assignedUserId?: undefined | null | string;
    assignmentId?: undefined | string;
    distanceKm?: undefined | number;
    candidates?:
      | undefined
      | Array<{
          teamId: string;
          assignedUserId: null | string;
          distanceKm: null | number;
          availableTeamCapacity: number;
          availableMemberCapacity: null | number;
        }>;
  }>;
};
```

<a id="get-assignment-rules"></a>

### GET /assignment-rules

[AssignmentRuleController.list](../../apps/api/src/assignments/assignment-batch.controller.ts#L101)

- **Access:** `AuthGuard`, `AssignmentRuleGuard`

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [AssignmentRuleListDto](API_REQUEST_SCHEMAS.md#assignmentrulelistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    campaignId: string;
    name: string;
    strategy: 'capacity' | 'round_robin' | 'skill' | 'proximity';
    targets: Array<{
      teamId: string;
      assignedUserId: null | string;
      skills?: undefined | Array<string>;
      location?:
        | undefined
        | {
            longitude: number;
            latitude: number;
          };
    }>;
    requiredSkills: Array<string>;
    maxDistanceKm: null | number;
    priority: number;
    isActive: boolean;
    nextTarget: number;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextOffset: null | number;
};
```

<a id="post-assignment-rules"></a>

### POST /assignment-rules

[AssignmentRuleController.create](../../apps/api/src/assignments/assignment-batch.controller.ts#L104)

- **Access:** `AuthGuard`, `AssignmentRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment_rule.create')`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateAssignmentRuleDto](API_REQUEST_SCHEMAS.md#createassignmentruledto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  name: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: string;
  priority: number;
  strategy: 'capacity' | 'round_robin' | 'skill' | 'proximity';
  targets: Array<{
    teamId: string;
    assignedUserId: null | string;
    skills?: undefined | Array<string>;
    location?:
      | undefined
      | {
          longitude: number;
          latitude: number;
        };
  }>;
  requiredSkills: Array<string>;
  maxDistanceKm: null | number;
  nextTarget: number;
};
```

<a id="patch-assignment-rules-ruleid"></a>

### PATCH /assignment-rules/:ruleId

[AssignmentRuleController.update](../../apps/api/src/assignments/assignment-batch.controller.ts#L109)

- **Access:** `AuthGuard`, `AssignmentRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment_rule.update')`.

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `ruleId`                                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignmentRulePatchDto](API_REQUEST_SCHEMAS.md#assignmentrulepatchdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                              | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  name: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: string;
  priority: number;
  strategy: 'capacity' | 'round_robin' | 'skill' | 'proximity';
  targets: Array<{
    teamId: string;
    assignedUserId: null | string;
    skills?: undefined | Array<string>;
    location?:
      | undefined
      | {
          longitude: number;
          latitude: number;
        };
  }>;
  requiredSkills: Array<string>;
  maxDistanceKm: null | number;
  nextTarget: number;
};
```

<a id="delete-assignment-rules-ruleid"></a>

### DELETE /assignment-rules/:ruleId

[AssignmentRuleController.remove](../../apps/api/src/assignments/assignment-batch.controller.ts#L119)

- **Access:** `AuthGuard`, `AssignmentRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment_rule.deactivate')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `ruleId`      | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  name: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: string;
  priority: number;
  strategy: 'capacity' | 'round_robin' | 'skill' | 'proximity';
  targets: Array<{
    teamId: string;
    assignedUserId: null | string;
    skills?: undefined | Array<string>;
    location?:
      | undefined
      | {
          longitude: number;
          latitude: number;
        };
  }>;
  requiredSkills: Array<string>;
  maxDistanceKm: null | number;
  nextTarget: number;
};
```

<a id="post-assignment-rules-ruleid-simulate"></a>

### POST /assignment-rules/:ruleId/simulate

[AssignmentRuleController.simulate](../../apps/api/src/assignments/assignment-batch.controller.ts#L128)

- **Access:** `AuthGuard`, `AssignmentRuleGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `ruleId`                                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignmentSelectionDto](API_REQUEST_SCHEMAS.md#assignmentselectiondto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  ruleId: null | string;
  mode: string;
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: Array<{
    prospectId: string;
    outcome:
      | 'missing_coordinates'
      | 'proposed'
      | 'assigned'
      | 'already_assigned'
      | 'inactive_prospect'
      | 'capacity_exhausted'
      | 'ineligible_target'
      | 'no_skill_match'
      | 'no_proximity_match';
    teamId?: undefined | string;
    assignedUserId?: undefined | null | string;
    assignmentId?: undefined | string;
    distanceKm?: undefined | number;
    candidates?:
      | undefined
      | Array<{
          teamId: string;
          assignedUserId: null | string;
          distanceKm: null | number;
          availableTeamCapacity: number;
          availableMemberCapacity: null | number;
        }>;
  }>;
};
```

<a id="get-assignment-suggestions"></a>

### GET /assignment-suggestions

[AssignmentSuggestionController.suggest](../../apps/api/src/assignments/assignment-batch.controller.ts#L144)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [AssignmentSuggestionDto](API_REQUEST_SCHEMAS.md#assignmentsuggestiondto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  prospectId?: undefined | string;
  outcome?:
    | undefined
    | 'missing_coordinates'
    | 'proposed'
    | 'assigned'
    | 'already_assigned'
    | 'inactive_prospect'
    | 'capacity_exhausted'
    | 'ineligible_target'
    | 'no_skill_match'
    | 'no_proximity_match';
  teamId?: undefined | string;
  assignedUserId?: undefined | null | string;
  assignmentId?: undefined | string;
  distanceKm?: undefined | number;
  candidates: Array<{
    teamId: string;
    assignedUserId: null | string;
    distanceKm: null | number;
    availableTeamCapacity: number;
    availableMemberCapacity: null | number;
  }>;
  ruleId: string;
  strategy: 'capacity' | 'round_robin' | 'skill' | 'proximity';
  requiredSkills: Array<string>;
};
```

<a id="post-campaigns-campaignid-prospects-prospectid-assignment"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/assignment

[CampaignProspectAssignmentController.assign](../../apps/api/src/assignments/campaign-prospect-assignment.controller.ts#L30)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment.assign')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignCampaignProspectDto](API_REQUEST_SCHEMAS.md#assigncampaignprospectdto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="put-campaigns-campaignid-prospects-prospectid-assignment"></a>

### PUT /campaigns/:campaignId/prospects/:prospectId/assignment

[CampaignProspectAssignmentController.reassign](../../apps/api/src/assignments/campaign-prospect-assignment.controller.ts#L60)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment.reassign')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AssignCampaignProspectDto](API_REQUEST_SCHEMAS.md#assigncampaignprospectdto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="delete-campaigns-campaignid-prospects-prospectid-assignment"></a>

### DELETE /campaigns/:campaignId/prospects/:prospectId/assignment

[CampaignProspectAssignmentController.unassign](../../apps/api/src/assignments/campaign-prospect-assignment.controller.ts#L96)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('assignment.unassign')`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-campaigns-campaignid-prospects-prospectid-assignment"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/assignment

[CampaignProspectAssignmentController.getCurrent](../../apps/api/src/assignments/campaign-prospect-assignment.controller.ts#L119)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = null | {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-campaigns-campaignid-prospects-prospectid-assignment-history"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/assignment-history

[CampaignProspectAssignmentController.getHistory](../../apps/api/src/assignments/campaign-prospect-assignment.controller.ts#L134)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  status: 'active' | 'paused' | 'completed' | 'revoked';
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: string;
  campaignId: string;
  campaignProspectId: string;
  assignedUserId: null | string;
  assignedAt: string /* ISO 8601 date-time */;
  priority: 'low' | 'normal' | 'high' | 'critical';
  endReason: null | string;
  endedAt: null | string /* ISO 8601 date-time */;
}>;
```

## audit

Audit events, security and data-change history, access history and evidence exports.

| Method | Path                                                                        | Accepted data                                                                                                                                                         | Success |
| ------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| GET    | [`/audit/events`](#get-audit-events)                                        | Query: `limit?: undefined \| number`<br>Query: `cursor?: undefined \| string`<br>Query: `action?: undefined \| string`<br>Query: `resourceType?: undefined \| string` | 200     |
| GET    | [`/audit/events/:eventId`](#get-audit-events-eventid)                       | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/overview`](#get-audit-overview)                                    | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/users/:membershipId/access`](#get-audit-users-membershipid-access) | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/data-changes`](#get-audit-data-changes)                            | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/security-events`](#get-audit-security-events)                      | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/security-events/:eventId`](#get-audit-security-events-eventid)     | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/assignments`](#get-audit-assignments)                              | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/assignments/:assignmentId`](#get-audit-assignments-assignmentid)   | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/overrides`](#get-audit-overrides)                                  | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/overrides/:overrideId`](#get-audit-overrides-overrideid)           | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/collisions`](#get-audit-collisions)                                | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/collisions/:collisionId`](#get-audit-collisions-collisionid)       | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/exports`](#get-audit-exports)                                      | Query: `{ [key: string]: string; }`                                                                                                                                   | 200     |
| GET    | [`/audit/exports/:exportId`](#get-audit-exports-exportid)                   | No declared body/query                                                                                                                                                | 200     |
| GET    | [`/audit/retention`](#get-audit-retention)                                  | No declared body/query                                                                                                                                                | 200     |
| POST   | [`/audit/evidence-exports`](#post-audit-evidence-exports)                   | Body: [EvidenceExportScopeDto](API_REQUEST_SCHEMAS.md#evidenceexportscopedto)                                                                                         | 202     |
| GET    | [`/audit/evidence-exports/:exportId`](#get-audit-evidence-exports-exportid) | No declared body/query                                                                                                                                                | 200     |

<a id="get-audit-events"></a>

### GET /audit/events

[AuditController.list](../../apps/api/src/audit/audit.controller.ts#L33)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints                        |
| -------------- | -------------- | ----------------------------------------- |
| Query          | `limit`        | `undefined \| number`; optional parameter |
| Query          | `cursor`       | `undefined \| string`; optional parameter |
| Query          | `action`       | `undefined \| string`; optional parameter |
| Query          | `resourceType` | `undefined \| string`; optional parameter |

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-events-eventid"></a>

### GET /audit/events/:eventId

[AuditController.detail](../../apps/api/src/audit/audit.controller.ts#L57)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `eventId`     | `string`; `ParseUUIDPipe` |

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
  occurredAt: string /* ISO 8601 date-time */;
};
```

<a id="get-audit-overview"></a>

### GET /audit/overview

[AuditController.overview](../../apps/api/src/audit/audit.controller.ts#L69)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  events?: undefined | number;
  actors?: undefined | number;
  latest?: undefined | string /* ISO 8601 date-time */;
  tenantId: string;
};
```

<a id="get-audit-users-membershipid-access"></a>

### GET /audit/users/:membershipId/access

[AuditController.access](../../apps/api/src/audit/audit.controller.ts#L81)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints        |
| -------------- | -------------- | ------------------------- |
| Param          | `membershipId` | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = Array<{
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
  occurredAt: string /* ISO 8601 date-time */;
}>;
```

<a id="get-audit-data-changes"></a>

### GET /audit/data-changes

[AuditController.data](../../apps/api/src/audit/audit.controller.ts#L93)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-security-events"></a>

### GET /audit/security-events

[AuditController.security](../../apps/api/src/audit/audit.controller.ts#L96)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-security-events-eventid"></a>

### GET /audit/security-events/:eventId

[AuditController.securityDetail](../../apps/api/src/audit/audit.controller.ts#L99)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `eventId`     | `string`           |

**Success: 200.**

```ts
type ResponseBody = {
  resourceType: string;
  resourceId: string;
  events: Array<{
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-audit-assignments"></a>

### GET /audit/assignments

[AuditController.assignments](../../apps/api/src/audit/audit.controller.ts#L105)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-assignments-assignmentid"></a>

### GET /audit/assignments/:assignmentId

[AuditController.assignment](../../apps/api/src/audit/audit.controller.ts#L108)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints |
| -------------- | -------------- | ------------------ |
| Param          | `assignmentId` | `string`           |

**Success: 200.**

```ts
type ResponseBody = {
  resourceType: string;
  resourceId: string;
  events: Array<{
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-audit-overrides"></a>

### GET /audit/overrides

[AuditController.overrides](../../apps/api/src/audit/audit.controller.ts#L114)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-overrides-overrideid"></a>

### GET /audit/overrides/:overrideId

[AuditController.override](../../apps/api/src/audit/audit.controller.ts#L117)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `overrideId`  | `string`           |

**Success: 200.**

```ts
type ResponseBody = {
  resourceType: string;
  resourceId: string;
  events: Array<{
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-audit-collisions"></a>

### GET /audit/collisions

[AuditController.collisions](../../apps/api/src/audit/audit.controller.ts#L120)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-collisions-collisionid"></a>

### GET /audit/collisions/:collisionId

[AuditController.collision](../../apps/api/src/audit/audit.controller.ts#L123)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `collisionId` | `string`           |

**Success: 200.**

```ts
type ResponseBody = {
  resourceType: string;
  resourceId: string;
  events: Array<{
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-audit-exports"></a>

### GET /audit/exports

[AuditController.exports](../../apps/api/src/audit/audit.controller.ts#L129)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints           |
| -------------- | ------------- | ---------------------------- |
| Query          | `object`      | `{ [key: string]: string; }` |

Reads only query limit, cursor and action; resourceType is fixed by this route. Other query keys are ignored.

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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-audit-exports-exportid"></a>

### GET /audit/exports/:exportId

[AuditController.export](../../apps/api/src/audit/audit.controller.ts#L132)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `exportId`    | `string`           |

**Success: 200.**

```ts
type ResponseBody = {
  resourceType: string;
  resourceId: string;
  events: Array<{
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-audit-retention"></a>

### GET /audit/retention

[AuditController.retention](../../apps/api/src/audit/audit.controller.ts#L135)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  events?: undefined | number;
  actors?: undefined | number;
  latest?: undefined | string /* ISO 8601 date-time */;
  tenantId: string;
};
```

<a id="post-audit-evidence-exports"></a>

### POST /audit/evidence-exports

[AuditController.evidence](../../apps/api/src/audit/audit.controller.ts#L138)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [EvidenceExportScopeDto](API_REQUEST_SCHEMAS.md#evidenceexportscopedto) | All fields, defaults and validators in linked schema |

**Success: 202.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      expiresAt: null | string /* ISO 8601 date-time */;
      scope: unknown;
      tenantId: string;
      requestedBy: string;
      objectKey: null | string;
    };
```

<a id="get-audit-evidence-exports-exportid"></a>

### GET /audit/evidence-exports/:exportId

[AuditController.evidenceDetail](../../apps/api/src/audit/audit.controller.ts#L155)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `exportId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requestedBy: string;
  scope: unknown;
  status: string;
  objectKey: null | string;
  createdAt: string /* ISO 8601 date-time */;
  expiresAt: null | string /* ISO 8601 date-time */;
};
```

## auth

Password login, MFA, tenant selection, token rotation, logout, password recovery and SSO provider flow.

| Method | Path                                                                              | Accepted data                                                         | Success |
| ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| POST   | [`/auth/password/forgot`](#post-auth-password-forgot)                             | Body: [ForgotPasswordDto](API_REQUEST_SCHEMAS.md#forgotpassworddto)   | 202     |
| GET    | [`/auth/password-reset/:token/status`](#get-auth-password-reset-token-status)     | No declared body/query                                                | 200     |
| POST   | [`/auth/password/reset`](#post-auth-password-reset)                               | Body: [ResetPasswordDto](API_REQUEST_SCHEMAS.md#resetpassworddto)     | 204     |
| POST   | [`/auth/mfa/enroll`](#post-auth-mfa-enroll)                                       | Body: [MfaEnrollDto](API_REQUEST_SCHEMAS.md#mfaenrolldto)             | 200     |
| POST   | [`/auth/mfa/verify`](#post-auth-mfa-verify)                                       | Body: [MfaVerifyDto](API_REQUEST_SCHEMAS.md#mfaverifydto)             | 200     |
| POST   | [`/auth/mfa/recovery`](#post-auth-mfa-recovery)                                   | Body: [MfaRecoveryDto](API_REQUEST_SCHEMAS.md#mfarecoverydto)         | 200     |
| POST   | [`/auth/mfa/recovery-codes/regenerate`](#post-auth-mfa-recovery-codes-regenerate) | Body: [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto)             | 200     |
| DELETE | [`/auth/mfa`](#delete-auth-mfa)                                                   | Body: [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto)             | 204     |
| GET    | [`/auth/config`](#get-auth-config)                                                | No declared body/query                                                | 200     |
| POST   | [`/auth/login`](#post-auth-login)                                                 | Body: [LoginDto](API_REQUEST_SCHEMAS.md#logindto)                     | 200     |
| POST   | [`/auth/select-tenant`](#post-auth-select-tenant)                                 | Body: [SelectWorkspaceDto](API_REQUEST_SCHEMAS.md#selectworkspacedto) | 200     |
| POST   | [`/auth/refresh`](#post-auth-refresh)                                             | Body: [RefreshTokenDto](API_REQUEST_SCHEMAS.md#refreshtokendto)       | 200     |
| POST   | [`/auth/logout`](#post-auth-logout)                                               | Body: [RefreshTokenDto](API_REQUEST_SCHEMAS.md#refreshtokendto)       | 204     |
| GET    | [`/auth/me`](#get-auth-me)                                                        | No declared body/query                                                | 200     |
| GET    | [`/auth/sso/:provider/start`](#get-auth-sso-provider-start)                       | No declared body/query                                                | 200     |
| GET    | [`/auth/sso/:provider/callback`](#get-auth-sso-provider-callback)                 | Query: `code: string`<br>Query: `state: string`                       | 200     |
| POST   | [`/auth/sso/:provider/refresh`](#post-auth-sso-provider-refresh)                  | No declared body/query                                                | 201     |

<a id="post-auth-password-forgot"></a>

### POST /auth/password/forgot

[PasswordRecoveryController.forgotPassword](../../apps/api/src/auth/password-recovery.controller.ts#L24)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ForgotPasswordDto](API_REQUEST_SCHEMAS.md#forgotpassworddto) | All fields, defaults and validators in linked schema |

**Success: 202.**

```ts
type ResponseBody = {
  message: string;
};
```

<a id="get-auth-password-reset-token-status"></a>

### GET /auth/password-reset/:token/status

[PasswordRecoveryController.resetStatus](../../apps/api/src/auth/password-recovery.controller.ts#L30)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`; `@Header('Referrer-Policy', 'no-referrer')`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | [ResetTokenDto](API_REQUEST_SCHEMAS.md#resettokendto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  valid: boolean;
};
```

<a id="post-auth-password-reset"></a>

### POST /auth/password/reset

[PasswordRecoveryController.resetPassword](../../apps/api/src/auth/password-recovery.controller.ts#L36)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ResetPasswordDto](API_REQUEST_SCHEMAS.md#resetpassworddto) | All fields, defaults and validators in linked schema |

**Success: 204.**

No response body.

<a id="post-auth-mfa-enroll"></a>

### POST /auth/mfa/enroll

[MfaController.enroll](../../apps/api/src/auth/mfa.controller.ts#L18)

- **Access:** `AuthRateLimitGuard`, `AuthGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Body           | [MfaEnrollDto](API_REQUEST_SCHEMAS.md#mfaenrolldto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  challengeToken: string;
  setupKey: string;
  otpauthUri: string;
  expiresIn: number;
};
```

<a id="post-auth-mfa-verify"></a>

### POST /auth/mfa/verify

[MfaController.verify](../../apps/api/src/auth/mfa.controller.ts#L25)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Body           | [MfaVerifyDto](API_REQUEST_SCHEMAS.md#mfaverifydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      accessToken: string;
      refreshToken: string;
    }
  | {
      workspaceRequired: true;
      selectionToken: string;
      expiresIn: 300;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    }
  | {
      mfaRequired: true;
      challengeToken: string;
      expiresIn: 300;
    }
  | {
      mfaEnrollmentRequired: true;
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      enrolled: true;
      recoveryCodes: Array<string>;
    };
```

<a id="post-auth-mfa-recovery"></a>

### POST /auth/mfa/recovery

[MfaController.recovery](../../apps/api/src/auth/mfa.controller.ts#L31)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [MfaRecoveryDto](API_REQUEST_SCHEMAS.md#mfarecoverydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      accessToken: string;
      refreshToken: string;
    }
  | {
      workspaceRequired: true;
      selectionToken: string;
      expiresIn: 300;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    }
  | {
      mfaRequired: true;
      challengeToken: string;
      expiresIn: 300;
    }
  | {
      mfaEnrollmentRequired: true;
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      enrolled: true;
      recoveryCodes: Array<string>;
    };
```

<a id="post-auth-mfa-recovery-codes-regenerate"></a>

### POST /auth/mfa/recovery-codes/regenerate

[MfaController.regenerate](../../apps/api/src/auth/mfa.controller.ts#L37)

- **Access:** `AuthRateLimitGuard`, `AuthGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Body           | [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  recoveryCodes: Array<string>;
};
```

<a id="delete-auth-mfa"></a>

### DELETE /auth/mfa

[MfaController.disable](../../apps/api/src/auth/mfa.controller.ts#L44)

- **Access:** `AuthRateLimitGuard`, `AuthGuard`

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Body           | [MfaStepUpDto](API_REQUEST_SCHEMAS.md#mfastepupdto) | All fields, defaults and validators in linked schema |

**Success: 204.**

No response body.

<a id="get-auth-config"></a>

### GET /auth/config

[AuthController.configuration](../../apps/api/src/auth/auth.controller.ts#L29)

- **Access:** No route guard declared (public or token/challenge validated in the service).
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

No declared JSON body or query parameters.

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
  };
};
```

<a id="post-auth-login"></a>

### POST /auth/login

[AuthController.login](../../apps/api/src/auth/auth.controller.ts#L43)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                               | Type / constraints                                   |
| -------------- | ------------------------------------------- | ---------------------------------------------------- |
| Body           | [LoginDto](API_REQUEST_SCHEMAS.md#logindto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      accessToken: string;
      refreshToken: string;
    }
  | {
      workspaceRequired: true;
      selectionToken: string;
      expiresIn: 300;
      memberships: Array<{
        membershipId: string;
        tenantId: string;
        tenantName: string;
        displayName: null | string;
      }>;
    }
  | {
      mfaRequired: true;
      challengeToken: string;
      expiresIn: 300;
    }
  | {
      mfaEnrollmentRequired: true;
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    };
```

<a id="post-auth-select-tenant"></a>

### POST /auth/select-tenant

[AuthController.selectTenant](../../apps/api/src/auth/auth.controller.ts#L51)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [SelectWorkspaceDto](API_REQUEST_SCHEMAS.md#selectworkspacedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  accessToken: string;
  refreshToken: string;
};
```

<a id="post-auth-refresh"></a>

### POST /auth/refresh

[AuthController.refresh](../../apps/api/src/auth/auth.controller.ts#L59)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [RefreshTokenDto](API_REQUEST_SCHEMAS.md#refreshtokendto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  accessToken: string;
  refreshToken: string;
};
```

<a id="post-auth-logout"></a>

### POST /auth/logout

[AuthController.logout](../../apps/api/src/auth/auth.controller.ts#L67)

- **Access:** No route guard declared (public or token/challenge validated in the service).

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [RefreshTokenDto](API_REQUEST_SCHEMAS.md#refreshtokendto) | All fields, defaults and validators in linked schema |

**Success: 204.**

No response body.

<a id="get-auth-me"></a>

### GET /auth/me

[AuthController.getCurrentUser](../../apps/api/src/auth/auth.controller.ts#L73)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  userId: string;
  tenantId: string;
};
```

<a id="get-auth-sso-provider-start"></a>

### GET /auth/sso/:provider/start

[OAuthProviderController.start](../../apps/api/src/auth/oauth-provider.controller.ts#L9)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `provider`    | `"google" \| "microsoft"` |

Availability depends on configured provider/SSO settings. /auth/config currently reports sso.enabled=false; the presence of a route does not certify a configured provider.

**Success: 200.**

```ts
type ResponseBody = {
  provider: 'google' | 'microsoft';
  authorizationUrl: string;
  expiresAt: string;
};
```

<a id="get-auth-sso-provider-callback"></a>

### GET /auth/sso/:provider/callback

[OAuthProviderController.callback](../../apps/api/src/auth/oauth-provider.controller.ts#L15)

- **Access:** No route guard declared (public or token/challenge validated in the service).

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `provider`    | `"google" \| "microsoft"` |
| Query          | `code`        | `string`                  |
| Query          | `state`       | `string`                  |

Availability depends on configured provider/SSO settings. /auth/config currently reports sso.enabled=false; the presence of a route does not certify a configured provider.

**Success: 200.**

```ts
type ResponseBody = {
  provider: 'google' | 'microsoft';
  tenantId: string;
  membershipId: string;
  connected: boolean;
};
```

<a id="post-auth-sso-provider-refresh"></a>

### POST /auth/sso/:provider/refresh

[OAuthProviderController.refresh](../../apps/api/src/auth/oauth-provider.controller.ts#L22)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `provider`    | `"google" \| "microsoft"` |

Availability depends on configured provider/SSO settings. /auth/config currently reports sso.enabled=false; the presence of a route does not certify a configured provider.

**Success: 201.**

```ts
type ResponseBody = {
  provider: 'google' | 'microsoft';
  refreshed: boolean;
};
```

## authorization

Access grants and the signed-in user’s effective grants.

| Method | Path                                                                                  | Accepted data                                                             | Success |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| GET    | [`/users/:userId/access-grants`](#get-users-userid-access-grants)                     | No declared body/query                                                    | 200     |
| POST   | [`/users/:userId/access-grants`](#post-users-userid-access-grants)                    | Body: [CreateAccessGrantDto](API_REQUEST_SCHEMAS.md#createaccessgrantdto) | 201     |
| DELETE | [`/users/:userId/access-grants/:grantId`](#delete-users-userid-access-grants-grantid) | No declared body/query                                                    | 200     |
| GET    | [`/auth/me/access-grants`](#get-auth-me-access-grants)                                | No declared body/query                                                    | 200     |

<a id="get-users-userid-access-grants"></a>

### GET /users/:userId/access-grants

[AccessGrantController.list](../../apps/api/src/authorization/access-grant.controller.ts#L21)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `userId`      | `string`           |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  userId: string;
  organizationId: null | string;
  role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
  scopeType: 'tenant' | 'organization' | 'team';
  teamId: null | string;
}>;
```

<a id="post-users-userid-access-grants"></a>

### POST /users/:userId/access-grants

[AccessGrantController.create](../../apps/api/src/authorization/access-grant.controller.ts#L32)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `userId`                                                            | `string`                                             |
| Body           | [CreateAccessGrantDto](API_REQUEST_SCHEMAS.md#createaccessgrantdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  userId: string;
  organizationId: null | string;
  role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
  scopeType: 'tenant' | 'organization' | 'team';
  teamId: null | string;
};
```

<a id="delete-users-userid-access-grants-grantid"></a>

### DELETE /users/:userId/access-grants/:grantId

[AccessGrantController.revoke](../../apps/api/src/authorization/access-grant.controller.ts#L110)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `userId`      | `string`           |
| Param          | `grantId`     | `string`           |

**Success: 200.**

No response body.

<a id="get-auth-me-access-grants"></a>

### GET /auth/me/access-grants

[SelfAccessController.getCurrentAccess](../../apps/api/src/authorization/self-access.controller.ts#L14)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: null | string;
  locale: string;
  grants: Array<{
    role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
    scopeType: 'tenant' | 'organization' | 'team';
    organizationId: null | string;
    teamId: null | string;
  }>;
};
```

## campaign-organizations

Attach organizations to a campaign and configure participation/collision policy.

| Method | Path                                                                                                                | Accepted data                                                                               | Success |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| GET    | [`/campaigns/:campaignId/organizations`](#get-campaigns-campaignid-organizations)                                   | Query: [ListCampaignOrganizationsDto](API_REQUEST_SCHEMAS.md#listcampaignorganizationsdto)  | 200     |
| POST   | [`/campaigns/:campaignId/organizations`](#post-campaigns-campaignid-organizations)                                  | Body: [CreateCampaignOrganizationDto](API_REQUEST_SCHEMAS.md#createcampaignorganizationdto) | 201     |
| PATCH  | [`/campaigns/:campaignId/organizations/:organizationId`](#patch-campaigns-campaignid-organizations-organizationid)  | Body: [UpdateCampaignOrganizationDto](API_REQUEST_SCHEMAS.md#updatecampaignorganizationdto) | 200     |
| DELETE | [`/campaigns/:campaignId/organizations/:organizationId`](#delete-campaigns-campaignid-organizations-organizationid) | No declared body/query                                                                      | 204     |

<a id="get-campaigns-campaignid-organizations"></a>

### GET /campaigns/:campaignId/organizations

[CampaignOrganizationController.list](../../apps/api/src/campaign-organizations/campaign-organization.controller.ts#L54)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                       | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                        | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListCampaignOrganizationsDto](API_REQUEST_SCHEMAS.md#listcampaignorganizationsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  owner: {
    organizationId: string;
    accessMode: string;
  };
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    campaignId: string;
    organizationId: string;
    accessMode: 'participate' | 'read_only';
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    endedAt: null | string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-campaigns-campaignid-organizations"></a>

### POST /campaigns/:campaignId/organizations

[CampaignOrganizationController.create](../../apps/api/src/campaign-organizations/campaign-organization.controller.ts#L61)

- **Access:** `AuthGuard`, `CampaignOrganizationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_organization.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateCampaignOrganizationDto](API_REQUEST_SCHEMAS.md#createcampaignorganizationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  campaignId: string;
  endedAt: null | string /* ISO 8601 date-time */;
  accessMode: 'participate' | 'read_only';
};
```

<a id="patch-campaigns-campaignid-organizations-organizationid"></a>

### PATCH /campaigns/:campaignId/organizations/:organizationId

[CampaignOrganizationController.update](../../apps/api/src/campaign-organizations/campaign-organization.controller.ts#L71)

- **Access:** `AuthGuard`, `CampaignOrganizationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_organization.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Param          | `organizationId`                                                                      | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateCampaignOrganizationDto](API_REQUEST_SCHEMAS.md#updatecampaignorganizationdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                            | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  campaignId: string;
  endedAt: null | string /* ISO 8601 date-time */;
  accessMode: 'participate' | 'read_only';
};
```

<a id="delete-campaigns-campaignid-organizations-organizationid"></a>

### DELETE /campaigns/:campaignId/organizations/:organizationId

[CampaignOrganizationController.end](../../apps/api/src/campaign-organizations/campaign-organization.controller.ts#L83)

- **Access:** `AuthGuard`, `CampaignOrganizationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_organization.end')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema    | Type / constraints                        |
| -------------- | ---------------- | ----------------------------------------- |
| Param          | `campaignId`     | `string`; `new ParseUUIDPipe()`           |
| Param          | `organizationId` | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`       | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

## campaigns

Campaign lifecycle and enrollment of establishments as campaign prospects.

| Method | Path                                                                                                 | Accepted data                                                                       | Success |
| ------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| POST   | [`/campaigns/:campaignId/prospects`](#post-campaigns-campaignid-prospects)                           | Body: [AddCampaignProspectDto](API_REQUEST_SCHEMAS.md#addcampaignprospectdto)       | 201     |
| POST   | [`/campaigns/:campaignId/prospects/bulk/preview`](#post-campaigns-campaignid-prospects-bulk-preview) | Body: [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto) | 200     |
| POST   | [`/campaigns/:campaignId/prospects/bulk`](#post-campaigns-campaignid-prospects-bulk)                 | Body: [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto) | 200     |
| GET    | [`/campaigns/:campaignId/prospects`](#get-campaigns-campaignid-prospects)                            | No declared body/query                                                              | 200     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId`](#get-campaigns-campaignid-prospects-prospectid)     | No declared body/query                                                              | 200     |
| PATCH  | [`/campaigns/:campaignId/prospects/:prospectId`](#patch-campaigns-campaignid-prospects-prospectid)   | Body: [UpdateCampaignProspectDto](API_REQUEST_SCHEMAS.md#updatecampaignprospectdto) | 200     |
| POST   | [`/campaigns`](#post-campaigns)                                                                      | Body: [CreateCampaignDto](API_REQUEST_SCHEMAS.md#createcampaigndto)                 | 201     |
| GET    | [`/campaigns`](#get-campaigns)                                                                       | Query: [ListCampaignsDto](API_REQUEST_SCHEMAS.md#listcampaignsdto)                  | 200     |
| GET    | [`/campaigns/:campaignId`](#get-campaigns-campaignid)                                                | No declared body/query                                                              | 200     |
| PATCH  | [`/campaigns/:campaignId`](#patch-campaigns-campaignid)                                              | Body: [UpdateCampaignDto](API_REQUEST_SCHEMAS.md#updatecampaigndto)                 | 200     |
| POST   | [`/campaigns/:campaignId/status`](#post-campaigns-campaignid-status)                                 | Body: [CampaignStatusDto](API_REQUEST_SCHEMAS.md#campaignstatusdto)                 | 200     |
| DELETE | [`/campaigns/:campaignId`](#delete-campaigns-campaignid)                                             | No declared body/query                                                              | 204     |

<a id="post-campaigns-campaignid-prospects"></a>

### POST /campaigns/:campaignId/prospects

[CampaignProspectController.add](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L32)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                            | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AddCampaignProspectDto](API_REQUEST_SCHEMAS.md#addcampaignprospectdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'excluded';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  establishmentId: string;
  campaignId: string;
  lifecycleStage:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
};
```

<a id="post-campaigns-campaignid-prospects-bulk-preview"></a>

### POST /campaigns/:campaignId/prospects/bulk/preview

[CampaignProspectController.previewEnrolment](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L59)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  mode: 'preview' | 'apply';
  matched: number;
  selected: number;
  truncated: boolean;
  enrollable: number;
  enrolled: number;
  alreadyActive: number;
  alreadyExcluded: number;
  limit: number;
};
```

<a id="post-campaigns-campaignid-prospects-bulk"></a>

### POST /campaigns/:campaignId/prospects/bulk

[CampaignProspectController.enrol](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L80)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_prospect.bulk_enrol')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [EnrolCampaignProspectsDto](API_REQUEST_SCHEMAS.md#enrolcampaignprospectsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  mode: 'preview' | 'apply';
  matched: number;
  selected: number;
  truncated: boolean;
  enrollable: number;
  enrolled: number;
  alreadyActive: number;
  alreadyExcluded: number;
  limit: number;
};
```

<a id="get-campaigns-campaignid-prospects"></a>

### GET /campaigns/:campaignId/prospects

[CampaignProspectController.list](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L102)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  status: 'active' | 'excluded';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  establishmentId: string;
  campaignId: string;
  lifecycleStage:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
}>;
```

<a id="get-campaigns-campaignid-prospects-prospectid"></a>

### GET /campaigns/:campaignId/prospects/:prospectId

[CampaignProspectController.findById](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L113)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'excluded';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  establishmentId: string;
  campaignId: string;
  lifecycleStage:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
};
```

<a id="patch-campaigns-campaignid-prospects-prospectid"></a>

### PATCH /campaigns/:campaignId/prospects/:prospectId

[CampaignProspectController.update](../../apps/api/src/campaigns/campaign-prospect.controller.ts#L127)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateCampaignProspectDto](API_REQUEST_SCHEMAS.md#updatecampaignprospectdto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  status: 'active' | 'excluded';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  establishmentId: string;
  campaignId: string;
  lifecycleStage:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
};
```

<a id="post-campaigns"></a>

### POST /campaigns

[CampaignController.create](../../apps/api/src/campaigns/campaign.controller.ts#L41)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** optional; `@Idempotent('campaign.create', { optional: true })`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateCampaignDto](API_REQUEST_SCHEMAS.md#createcampaigndto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
  startsAt: null | string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-campaigns"></a>

### GET /campaigns

[CampaignController.list](../../apps/api/src/campaigns/campaign.controller.ts#L55)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                                       |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Query          | [ListCampaignsDto](API_REQUEST_SCHEMAS.md#listcampaignsdto) | All fields, defaults and validators in linked schema; optional parameter |

Compatibility behavior: no effective list filters yields the legacy array; supplied list filters use a paginated object. See ResourceScopeService.listCampaigns.

**Success: 200.**

```ts
type ResponseBody =
  | Array<{
      id: string;
      tenantId: string;
      organizationId: string;
      name: string;
      description: null | string;
      status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
      startsAt: null | string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }>
  | {
      items: Array<{
        id: string;
        tenantId: string;
        organizationId: string;
        name: string;
        description: null | string;
        status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
        startsAt: null | string /* ISO 8601 date-time */;
        endsAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>;
      nextCursor: null | string;
    };
```

<a id="get-campaigns-campaignid"></a>

### GET /campaigns/:campaignId

[CampaignController.findById](../../apps/api/src/campaigns/campaign.controller.ts#L64)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
  startsAt: null | string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="patch-campaigns-campaignid"></a>

### PATCH /campaigns/:campaignId

[CampaignController.update](../../apps/api/src/campaigns/campaign.controller.ts#L76)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** optional; `@Idempotent('campaign.update', { optional: true })`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateCampaignDto](API_REQUEST_SCHEMAS.md#updatecampaigndto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
  startsAt: null | string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-campaigns-campaignid-status"></a>

### POST /campaigns/:campaignId/status

[CampaignController.status](../../apps/api/src/campaigns/campaign.controller.ts#L94)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign.status')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CampaignStatusDto](API_REQUEST_SCHEMAS.md#campaignstatusdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: null | string;
  status: 'active' | 'archived' | 'draft' | 'paused' | 'completed';
  startsAt: null | string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="delete-campaigns-campaignid"></a>

### DELETE /campaigns/:campaignId

[CampaignController.archive](../../apps/api/src/campaigns/campaign.controller.ts#L108)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign.archive')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

## collisions

Preflight collision checks, collision events, override requests and manager decisions.

| Method | Path                                                                                                                                      | Accepted data                                                                         | Success |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------- |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/collision-decision`](#get-campaigns-campaignid-prospects-prospectid-collision-decision)    | No declared body/query                                                                | 200     |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/collision-overrides`](#post-campaigns-campaignid-prospects-prospectid-collision-overrides) | Body: [CreateCollisionOverrideDto](API_REQUEST_SCHEMAS.md#createcollisionoverridedto) | 201     |
| POST   | [`/reservations/check`](#post-reservations-check)                                                                                         | Body: [CheckCollisionDto](API_REQUEST_SCHEMAS.md#checkcollisiondto)                   | 200     |
| GET    | [`/collision-events`](#get-collision-events)                                                                                              | Query: [CollisionListDto](API_REQUEST_SCHEMAS.md#collisionlistdto)                    | 200     |
| GET    | [`/collision-events/:collisionId`](#get-collision-events-collisionid)                                                                     | No declared body/query                                                                | 200     |
| POST   | [`/collision-events/:collisionId/override-request`](#post-collision-events-collisionid-override-request)                                  | Body: [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto)                   | 201     |
| GET    | [`/override-requests`](#get-override-requests)                                                                                            | Query: [CollisionListDto](API_REQUEST_SCHEMAS.md#collisionlistdto)                    | 200     |
| GET    | [`/override-requests/:requestId`](#get-override-requests-requestid)                                                                       | No declared body/query                                                                | 200     |
| POST   | [`/override-requests/:requestId/approve`](#post-override-requests-requestid-approve)                                                      | Body: [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto)                   | 200     |
| POST   | [`/override-requests/:requestId/reject`](#post-override-requests-requestid-reject)                                                        | Body: [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto)                   | 200     |
| POST   | [`/override-requests/:requestId/cancel`](#post-override-requests-requestid-cancel)                                                        | Body: [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto)                   | 200     |

<a id="get-campaigns-campaignid-prospects-prospectid-collision-decision"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/collision-decision

[CollisionDecisionController.evaluate](../../apps/api/src/collisions/collision-decision.controller.ts#L18)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  decision: 'allow' | 'block' | 'warn' | 'require_override';
  reasonCode:
    | 'NO_COLLISION'
    | 'ACTIVE_ASSIGNMENT'
    | 'ACTIVE_RESERVATION'
    | 'PLANNED_ACTION'
    | 'RECENT_CONTACT';
  establishmentId: string;
  conflict:
    | null
    | {
        expiresAt: string;
      }
    | {
        dueAt: null | string;
      }
    | {
        assignedAt: string;
      };
};
```

<a id="post-campaigns-campaignid-prospects-prospectid-collision-overrides"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/collision-overrides

[ManagerOverrideController.create](../../apps/api/src/collisions/manager-override.controller.ts#L18)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('collision_override.create')`.

| Input location | Name / schema                                                                   | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                    | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateCollisionOverrideDto](API_REQUEST_SCHEMAS.md#createcollisionoverridedto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  overrideId: string;
  reasonCode: 'ACTIVE_ASSIGNMENT' | 'PLANNED_ACTION' | 'RECENT_CONTACT';
  approvedByRole: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';
  expiresAt: string;
  createdAt: string;
};
```

<a id="post-reservations-check"></a>

### POST /reservations/check

[CollisionWorkflowController.check](../../apps/api/src/collisions/collision-workflow.controller.ts#L62)

- **Access:** `AuthGuard`, `CollisionWorkflowGuard`
- **Idempotency-Key:** required; `@Idempotent('collision.check')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CheckCollisionDto](API_REQUEST_SCHEMAS.md#checkcollisiondto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      collisionId: null;
      overrideable: boolean;
      decision: 'allow' | 'block' | 'warn' | 'require_override';
      reasonCode:
        | 'NO_COLLISION'
        | 'ACTIVE_ASSIGNMENT'
        | 'ACTIVE_RESERVATION'
        | 'PLANNED_ACTION'
        | 'RECENT_CONTACT';
      establishmentId: string;
      conflict:
        | null
        | {
            expiresAt: string;
            dueAt?: undefined;
            assignedAt?: undefined;
          }
        | {
            dueAt: null | string;
            expiresAt?: undefined;
            assignedAt?: undefined;
          }
        | {
            assignedAt: string;
            expiresAt?: undefined;
            dueAt?: undefined;
          };
    }
  | {
      collisionId: string;
      policy: {
        evaluatorVersion: unknown;
        defaultCoolingOffMinutes: unknown;
      };
      overrideable: boolean;
      decision: 'allow' | 'block' | 'warn' | 'require_override';
      reasonCode:
        | 'NO_COLLISION'
        | 'ACTIVE_ASSIGNMENT'
        | 'ACTIVE_RESERVATION'
        | 'PLANNED_ACTION'
        | 'RECENT_CONTACT';
      establishmentId: string;
      conflict:
        | null
        | {
            expiresAt: string;
            dueAt?: undefined;
            assignedAt?: undefined;
          }
        | {
            dueAt: null | string;
            expiresAt?: undefined;
            assignedAt?: undefined;
          }
        | {
            assignedAt: string;
            expiresAt?: undefined;
            dueAt?: undefined;
          };
      id: string;
      tenantId: string;
      campaignId: string;
      campaignProspectId: string;
      assignmentId: string;
      detectedBy: string;
      createdAt: string /* ISO 8601 date-time */;
      expiresAt: string /* ISO 8601 date-time */;
    };
```

<a id="get-collision-events"></a>

### GET /collision-events

[CollisionWorkflowController.events](../../apps/api/src/collisions/collision-workflow.controller.ts#L69)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [CollisionListDto](API_REQUEST_SCHEMAS.md#collisionlistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    policy: {
      evaluatorVersion: unknown;
      defaultCoolingOffMinutes: unknown;
    };
    overrideable: boolean;
    decision: 'allow' | 'block' | 'warn' | 'require_override';
    reasonCode:
      | 'NO_COLLISION'
      | 'ACTIVE_ASSIGNMENT'
      | 'ACTIVE_RESERVATION'
      | 'PLANNED_ACTION'
      | 'RECENT_CONTACT';
    establishmentId: string;
    conflict:
      | null
      | {
          expiresAt: string;
          dueAt?: undefined;
          assignedAt?: undefined;
        }
      | {
          dueAt: null | string;
          expiresAt?: undefined;
          assignedAt?: undefined;
        }
      | {
          assignedAt: string;
          expiresAt?: undefined;
          dueAt?: undefined;
        };
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    assignmentId: string;
    detectedBy: string;
    createdAt: string /* ISO 8601 date-time */;
    expiresAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-collision-events-collisionid"></a>

### GET /collision-events/:collisionId

[CollisionWorkflowController.event](../../apps/api/src/collisions/collision-workflow.controller.ts#L73)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `collisionId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  policy: {
    evaluatorVersion: unknown;
    defaultCoolingOffMinutes: unknown;
  };
  overrideable: boolean;
  decision: 'allow' | 'block' | 'warn' | 'require_override';
  reasonCode:
    | 'NO_COLLISION'
    | 'ACTIVE_ASSIGNMENT'
    | 'ACTIVE_RESERVATION'
    | 'PLANNED_ACTION'
    | 'RECENT_CONTACT';
  establishmentId: string;
  conflict:
    | null
    | {
        expiresAt: string;
        dueAt?: undefined;
        assignedAt?: undefined;
      }
    | {
        dueAt: null | string;
        expiresAt?: undefined;
        assignedAt?: undefined;
      }
    | {
        assignedAt: string;
        expiresAt?: undefined;
        dueAt?: undefined;
      };
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: string;
  detectedBy: string;
  createdAt: string /* ISO 8601 date-time */;
  expiresAt: string /* ISO 8601 date-time */;
};
```

<a id="post-collision-events-collisionid-override-request"></a>

### POST /collision-events/:collisionId/override-request

[CollisionWorkflowController.request](../../apps/api/src/collisions/collision-workflow.controller.ts#L80)

- **Access:** `AuthGuard`, `CollisionWorkflowGuard`
- **Idempotency-Key:** required; `@Idempotent('override.request')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `collisionId`                                                 | `string`; `new ParseUUIDPipe()`                      |
| Body           | [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  status: 'pending' | 'cancelled' | 'approved' | 'rejected';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requestedBy: string;
  campaignProspectId: string;
  reason: string;
  collisionId: string;
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string /* ISO 8601 date-time */;
  overrideId: null | string;
};
```

<a id="get-override-requests"></a>

### GET /override-requests

[CollisionWorkflowController.requests](../../apps/api/src/collisions/collision-workflow.controller.ts#L90)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [CollisionListDto](API_REQUEST_SCHEMAS.md#collisionlistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    collisionId: string;
    campaignProspectId: string;
    requestedBy: string;
    reason: string;
    status: 'pending' | 'cancelled' | 'approved' | 'rejected';
    decidedBy: null | string;
    decisionReason: null | string;
    decidedAt: null | string /* ISO 8601 date-time */;
    overrideId: null | string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-override-requests-requestid"></a>

### GET /override-requests/:requestId

[CollisionWorkflowController.detail](../../apps/api/src/collisions/collision-workflow.controller.ts#L94)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `requestId`   | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  collision: {
    policy: {
      evaluatorVersion: unknown;
      defaultCoolingOffMinutes: unknown;
    };
    overrideable: boolean;
    decision: 'allow' | 'block' | 'warn' | 'require_override';
    reasonCode:
      | 'NO_COLLISION'
      | 'ACTIVE_ASSIGNMENT'
      | 'ACTIVE_RESERVATION'
      | 'PLANNED_ACTION'
      | 'RECENT_CONTACT';
    establishmentId: string;
    conflict:
      | null
      | {
          expiresAt: string;
          dueAt?: undefined;
          assignedAt?: undefined;
        }
      | {
          dueAt: null | string;
          expiresAt?: undefined;
          assignedAt?: undefined;
        }
      | {
          assignedAt: string;
          expiresAt?: undefined;
          dueAt?: undefined;
        };
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    assignmentId: string;
    detectedBy: string;
    createdAt: string /* ISO 8601 date-time */;
    expiresAt: string /* ISO 8601 date-time */;
  };
  approval: null | {
    id: string;
    expiresAt: string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'cancelled' | 'approved' | 'rejected';
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string /* ISO 8601 date-time */;
  overrideId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-override-requests-requestid-approve"></a>

### POST /override-requests/:requestId/approve

[CollisionWorkflowController.approve](../../apps/api/src/collisions/collision-workflow.controller.ts#L101)

- **Access:** `AuthGuard`, `CollisionWorkflowGuard`
- **Idempotency-Key:** required; `@Idempotent('override.approve')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `requestId`                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  approval: null | {
    id: string;
    expiresAt: null | string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'cancelled' | 'approved' | 'rejected';
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string /* ISO 8601 date-time */;
  overrideId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-override-requests-requestid-reject"></a>

### POST /override-requests/:requestId/reject

[CollisionWorkflowController.reject](../../apps/api/src/collisions/collision-workflow.controller.ts#L113)

- **Access:** `AuthGuard`, `CollisionWorkflowGuard`
- **Idempotency-Key:** required; `@Idempotent('override.reject')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `requestId`                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  approval: null | {
    id: string;
    expiresAt: null | string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'cancelled' | 'approved' | 'rejected';
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string /* ISO 8601 date-time */;
  overrideId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-override-requests-requestid-cancel"></a>

### POST /override-requests/:requestId/cancel

[CollisionWorkflowController.cancel](../../apps/api/src/collisions/collision-workflow.controller.ts#L125)

- **Access:** `AuthGuard`, `CollisionWorkflowGuard`
- **Idempotency-Key:** required; `@Idempotent('override.cancel')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `requestId`                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [OverrideReasonDto](API_REQUEST_SCHEMAS.md#overridereasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  approval: null | {
    id: string;
    expiresAt: null | string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'cancelled' | 'approved' | 'rejected';
  decidedBy: null | string;
  decisionReason: null | string;
  decidedAt: null | string /* ISO 8601 date-time */;
  overrideId: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

## communications

Notification preferences, devices and broadcast announcements.

| Method | Path                                                                            | Accepted data                                                                         | Success |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------- |
| POST   | [`/uploads/presign`](#post-uploads-presign)                                     | Body: [PresignUploadDto](API_REQUEST_SCHEMAS.md#presignuploaddto)                     | 201     |
| POST   | [`/messages/:messageId/attachments`](#post-messages-messageid-attachments)      | Body: [AttachUploadDto](API_REQUEST_SCHEMAS.md#attachuploaddto)                       | 201     |
| GET    | [`/attachments/:attachmentId/download`](#get-attachments-attachmentid-download) | No declared body/query                                                                | 200     |
| GET    | [`/notification-preferences`](#get-notification-preferences)                    | No declared body/query                                                                | 200     |
| PUT    | [`/notification-preferences`](#put-notification-preferences)                    | Body: [NotificationPreferencesDto](API_REQUEST_SCHEMAS.md#notificationpreferencesdto) | 200     |
| POST   | [`/devices`](#post-devices)                                                     | Body: [RegisterDeviceDto](API_REQUEST_SCHEMAS.md#registerdevicedto)                   | 201     |
| DELETE | [`/devices/:deviceId`](#delete-devices-deviceid)                                | No declared body/query                                                                | 200     |

<a id="post-uploads-presign"></a>

### POST /uploads/presign

[CommunicationsController.presign](../../apps/api/src/communications/communications.module.ts#L179)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('upload.presign')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [PresignUploadDto](API_REQUEST_SCHEMAS.md#presignuploaddto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  method: string;
  headers: {};
};
content - type;
string;
```

<a id="post-messages-messageid-attachments"></a>

### POST /messages/:messageId/attachments

[CommunicationsController.attach](../../apps/api/src/communications/communications.module.ts#L185)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('message.attachment')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `messageId`                                               | `string`; `ParseUUIDPipe`                            |
| Body           | [AttachUploadDto](API_REQUEST_SCHEMAS.md#attachuploaddto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      tenantId: string;
      objectKey: string;
      filename: string;
      contentType: string;
      messageId: string;
      uploadedBy: string;
      byteSize: number;
    };
```

<a id="get-attachments-attachmentid-download"></a>

### GET /attachments/:attachmentId/download

[CommunicationsController.download](../../apps/api/src/communications/communications.module.ts#L192)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints        |
| -------------- | -------------- | ------------------------- |
| Param          | `attachmentId` | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  attachmentId: string;
  downloadUrl: string;
  expiresInSeconds: number;
};
```

<a id="get-notification-preferences"></a>

### GET /notification-preferences

[CommunicationsController.preferences](../../apps/api/src/communications/communications.module.ts#L198)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  [key: string]: {
    email?: undefined | boolean;
    push?: undefined | boolean;
    inApp?: undefined | boolean;
  };
};
```

<a id="put-notification-preferences"></a>

### PUT /notification-preferences

[CommunicationsController.setPreferences](../../apps/api/src/communications/communications.module.ts#L201)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                   | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [NotificationPreferencesDto](API_REQUEST_SCHEMAS.md#notificationpreferencesdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  [key: string]: {
    email?: undefined | boolean;
    push?: undefined | boolean;
    inApp?: undefined | boolean;
  };
};
```

<a id="post-devices"></a>

### POST /devices

[CommunicationsController.device](../../apps/api/src/communications/communications.module.ts#L207)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('device.register')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [RegisterDeviceDto](API_REQUEST_SCHEMAS.md#registerdevicedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      membershipId: string;
      revokedAt: null | string /* ISO 8601 date-time */;
      platform: string;
      token: string;
      lastSeenAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-devices-deviceid"></a>

### DELETE /devices/:deviceId

[CommunicationsController.revoke](../../apps/api/src/communications/communications.module.ts#L213)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `deviceId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

No response body.

## compliance

Retention policy, privacy requests, consent evidence and access reviews.

| Method | Path                                                                                  | Accepted data                                                                       | Success |
| ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| GET    | [`/access-reviews`](#get-access-reviews)                                              | No declared body/query                                                              | 200     |
| POST   | [`/access-reviews`](#post-access-reviews)                                             | No declared body/query                                                              | 201     |
| GET    | [`/access-reviews/:reviewId`](#get-access-reviews-reviewid)                           | No declared body/query                                                              | 200     |
| GET    | [`/access-reviews/:reviewId/memberships`](#get-access-reviews-reviewid-memberships)   | No declared body/query                                                              | 200     |
| POST   | [`/access-reviews/:reviewId/decisions`](#post-access-reviews-reviewid-decisions)      | Body: [AccessReviewDecisionDto](API_REQUEST_SCHEMAS.md#accessreviewdecisiondto)     | 201     |
| POST   | [`/access-reviews/:reviewId/complete`](#post-access-reviews-reviewid-complete)        | No declared body/query                                                              | 200     |
| GET    | [`/compliance-reports`](#get-compliance-reports)                                      | No declared body/query                                                              | 200     |
| POST   | [`/compliance-reports`](#post-compliance-reports)                                     | Body: [CreateComplianceReportDto](API_REQUEST_SCHEMAS.md#createcompliancereportdto) | 201     |
| GET    | [`/compliance-reports/:reportId`](#get-compliance-reports-reportid)                   | No declared body/query                                                              | 200     |
| GET    | [`/compliance-reports/:reportId/download`](#get-compliance-reports-reportid-download) | No declared body/query                                                              | 200     |

<a id="get-access-reviews"></a>

### GET /access-reviews

[ComplianceController.reviews](../../apps/api/src/compliance/compliance.module.ts#L176)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  startedBy: string;
  status: string;
  periodStart: string /* ISO 8601 date-time */;
  periodEnd: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
}>;
```

<a id="post-access-reviews"></a>

### POST /access-reviews

[ComplianceController.start](../../apps/api/src/compliance/compliance.module.ts#L179)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('access_review.create')`.

No declared JSON body or query parameters.

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      tenantId: string;
      completedAt: null | string /* ISO 8601 date-time */;
      startedBy: string;
      periodStart: string /* ISO 8601 date-time */;
      periodEnd: null | string /* ISO 8601 date-time */;
    };
```

<a id="get-access-reviews-reviewid"></a>

### GET /access-reviews/:reviewId

[ComplianceController.review](../../apps/api/src/compliance/compliance.module.ts#L182)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `reviewId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  startedBy: string;
  status: string;
  periodStart: string /* ISO 8601 date-time */;
  periodEnd: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-access-reviews-reviewid-memberships"></a>

### GET /access-reviews/:reviewId/memberships

[ComplianceController.members](../../apps/api/src/compliance/compliance.module.ts#L188)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `reviewId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  displayName: null | string;
  status: 'active' | 'suspended' | 'invited' | 'departed';
  decision: null | string;
  reason: null | string;
}>;
```

<a id="post-access-reviews-reviewid-decisions"></a>

### POST /access-reviews/:reviewId/decisions

[ComplianceController.decision](../../apps/api/src/compliance/compliance.module.ts#L194)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `reviewId`                                                                | `string`; `ParseUUIDPipe`                            |
| Body           | [AccessReviewDecisionDto](API_REQUEST_SCHEMAS.md#accessreviewdecisiondto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: string;
      reason: null | string;
      decision: string;
      reviewId: string;
      reviewerId: string;
    };
```

<a id="post-access-reviews-reviewid-complete"></a>

### POST /access-reviews/:reviewId/complete

[ComplianceController.complete](../../apps/api/src/compliance/compliance.module.ts#L201)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `reviewId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  startedBy: string;
  status: string;
  periodStart: string /* ISO 8601 date-time */;
  periodEnd: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-compliance-reports"></a>

### GET /compliance-reports

[ComplianceController.reports](../../apps/api/src/compliance/compliance.module.ts#L207)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  requestedBy: string;
  reportType: string;
  parameters: unknown;
  status: string;
  createdAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
}>;
```

<a id="post-compliance-reports"></a>

### POST /compliance-reports

[ComplianceController.create](../../apps/api/src/compliance/compliance.module.ts#L210)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('compliance_report.create')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateComplianceReportDto](API_REQUEST_SCHEMAS.md#createcompliancereportdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      tenantId: string;
      requestedBy: string;
      completedAt: null | string /* ISO 8601 date-time */;
      reportType: string;
      parameters: unknown;
    };
```

<a id="get-compliance-reports-reportid"></a>

### GET /compliance-reports/:reportId

[ComplianceController.report](../../apps/api/src/compliance/compliance.module.ts#L216)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `reportId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  requestedBy: string;
  reportType: string;
  parameters: unknown;
  status: string;
  createdAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-compliance-reports-reportid-download"></a>

### GET /compliance-reports/:reportId/download

[ComplianceController.download](../../apps/api/src/compliance/compliance.module.ts#L222)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `reportId`    | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  reportId: string;
  downloadUrl: string;
  expiresInSeconds: number;
};
```

## consents

Read and record consent or contact opposition for a prospect.

| Method | Path                                                                     | Accepted data                                                     | Success |
| ------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------- |
| GET    | [`/prospects/:prospectId/consents`](#get-prospects-prospectid-consents)  | Query: [ListConsentsDto](API_REQUEST_SCHEMAS.md#listconsentsdto)  | 200     |
| POST   | [`/prospects/:prospectId/consents`](#post-prospects-prospectid-consents) | Body: [CreateConsentDto](API_REQUEST_SCHEMAS.md#createconsentdto) | 201     |

<a id="get-prospects-prospectid-consents"></a>

### GET /prospects/:prospectId/consents

[ConsentController.list](../../apps/api/src/consents/consent.controller.ts#L43)

- **Access:** `AuthGuard`

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListConsentsDto](API_REQUEST_SCHEMAS.md#listconsentsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    sequence: number;
    tenantId: string;
    prospectId: string;
    contactId: null | string;
    channel: 'email' | 'phone' | 'all' | 'visit' | 'sms';
    status: 'allowed' | 'blocked' | 'unknown';
    reason: string;
    evidence: {
      [key: string]: string;
    };
    effectiveAt: string /* ISO 8601 date-time */;
    expiresAt: null | string /* ISO 8601 date-time */;
    recordedAt: string /* ISO 8601 date-time */;
    recordedBy: string;
  }>;
  nextCursor: null | string;
  restrictions: Array<{
    channel: string;
    blocked: boolean;
  }>;
};
```

<a id="post-prospects-prospectid-consents"></a>

### POST /prospects/:prospectId/consents

[ConsentController.append](../../apps/api/src/consents/consent.controller.ts#L50)

- **Access:** `AuthGuard`, `ConsentWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('prospect_consent.append')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateConsentDto](API_REQUEST_SCHEMAS.md#createconsentdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  status: 'allowed' | 'blocked' | 'unknown';
  expiresAt: null | string /* ISO 8601 date-time */;
  tenantId: string;
  prospectId: string;
  channel: 'email' | 'phone' | 'all' | 'visit' | 'sms';
  contactId: null | string;
  reason: string;
  sequence: number;
  evidence: {
    [key: string]: string;
  };
  effectiveAt: string /* ISO 8601 date-time */;
  recordedAt: string /* ISO 8601 date-time */;
  recordedBy: string;
};
```

## data-jobs

Staged import jobs and asynchronous export jobs, files, status and audit.

| Method | Path                                                             | Accepted data                                                                     | Success |
| ------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| GET    | [`/imports`](#get-imports)                                       | Query: [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto)                            | 200     |
| POST   | [`/imports`](#post-imports)                                      | No declared body/query                                                            | 201     |
| GET    | [`/imports/:importId`](#get-imports-importid)                    | No declared body/query                                                            | 200     |
| POST   | [`/imports/:importId/file`](#post-imports-importid-file)         | Multipart file                                                                    | 200     |
| PUT    | [`/imports/:importId/mapping`](#put-imports-importid-mapping)    | Body: [ImportMappingDto](API_REQUEST_SCHEMAS.md#importmappingdto)                 | 200     |
| POST   | [`/imports/:importId/validate`](#post-imports-importid-validate) | No declared body/query                                                            | 200     |
| GET    | [`/imports/:importId/rows`](#get-imports-importid-rows)          | Query: [ImportRowsDto](API_REQUEST_SCHEMAS.md#importrowsdto)                      | 200     |
| GET    | [`/imports/:importId/issues`](#get-imports-importid-issues)      | Query: [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto)                            | 200     |
| POST   | [`/imports/:importId/commit`](#post-imports-importid-commit)     | No declared body/query                                                            | 200     |
| POST   | [`/imports/:importId/cancel`](#post-imports-importid-cancel)     | No declared body/query                                                            | 200     |
| GET    | [`/imports/:importId/report`](#get-imports-importid-report)      | No declared body/query                                                            | 200     |
| PATCH  | [`/import-issues/:issueId`](#patch-import-issues-issueid)        | Body: [ImportIssueResolutionDto](API_REQUEST_SCHEMAS.md#importissueresolutiondto) | 200     |
| POST   | [`/exports/preview`](#post-exports-preview)                      | Body: [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto)                 | 200     |
| GET    | [`/exports`](#get-exports)                                       | Query: [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto)                            | 200     |
| POST   | [`/exports`](#post-exports)                                      | Body: [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto)                 | 202     |
| GET    | [`/exports/:exportId`](#get-exports-exportid)                    | No declared body/query                                                            | 200     |
| POST   | [`/exports/:exportId/cancel`](#post-exports-exportid-cancel)     | No declared body/query                                                            | 200     |
| GET    | [`/exports/:exportId/download`](#get-exports-exportid-download)  | No declared body/query                                                            | 200     |
| GET    | [`/exports/:exportId/audit`](#get-exports-exportid-audit)        | Query: [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto)                            | 200     |
| GET    | [`/exports/:exportId/file`](#get-exports-exportid-file)          | Query: [DownloadExportDto](API_REQUEST_SCHEMAS.md#downloadexportdto)              | 200     |

<a id="get-imports"></a>

### GET /imports

[ImportJobController.list](../../apps/api/src/data-jobs/import-job.controller.ts#L50)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Query          | [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    rowCount: number;
    etag: string;
    id: string;
    status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    tenantId: string;
    requesterId: string;
    filename: null | string;
    fileHash: null | string;
    headers: Array<string>;
    mapping: {
      [key: string]: string;
    };
    summary: {
      [key: string]: number;
    };
  }>;
  nextCursor: null | string;
};
```

<a id="post-imports"></a>

### POST /imports

[ImportJobController.create](../../apps/api/src/data-jobs/import-job.controller.ts#L53)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.create')`.

No declared JSON body or query parameters.

**Success: 201.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="get-imports-importid"></a>

### GET /imports/:importId

[ImportJobController.detail](../../apps/api/src/data-jobs/import-job.controller.ts#L56)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="post-imports-importid-file"></a>

### POST /imports/:importId/file

[ImportJobController.file](../../apps/api/src/data-jobs/import-job.controller.ts#L62)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

multipart/form-data: one file part named file. Global upload limit is 5 MiB. The import service checks the file and current job state.

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="put-imports-importid-mapping"></a>

### PUT /imports/:importId/mapping

[ImportJobController.mapping](../../apps/api/src/data-jobs/import-job.controller.ts#L83)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.mapping')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `importId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ImportMappingDto](API_REQUEST_SCHEMAS.md#importmappingdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                  | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="post-imports-importid-validate"></a>

### POST /imports/:importId/validate

[ImportJobController.validate](../../apps/api/src/data-jobs/import-job.controller.ts#L91)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.validate')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="get-imports-importid-rows"></a>

### GET /imports/:importId/rows

[ImportJobController.rows](../../apps/api/src/data-jobs/import-job.controller.ts#L98)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `importId`                                            | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ImportRowsDto](API_REQUEST_SCHEMAS.md#importrowsdto) | All fields, defaults and validators in linked schema |

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
      status: 'valid' | 'warning' | 'invalid';
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
    result: null | 'skipped' | 'created' | 'reused';
  }>;
  nextAfterRow: null | number;
};
```

<a id="get-imports-importid-issues"></a>

### GET /imports/:importId/issues

[ImportJobController.issues](../../apps/api/src/data-jobs/import-job.controller.ts#L105)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Param          | `importId`                                      | `string`; `new ParseUUIDPipe()`                      |
| Query          | [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    importId: string;
    rowId: string;
    code: string;
    severity: string;
    message: string;
    resolvedAt: null | string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-imports-importid-commit"></a>

### POST /imports/:importId/commit

[ImportJobController.commit](../../apps/api/src/data-jobs/import-job.controller.ts#L112)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.commit')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="post-imports-importid-cancel"></a>

### POST /imports/:importId/cancel

[ImportJobController.cancel](../../apps/api/src/data-jobs/import-job.controller.ts#L119)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.cancel')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="get-imports-importid-report"></a>

### GET /imports/:importId/report

[ImportJobController.report](../../apps/api/src/data-jobs/import-job.controller.ts#L126)

- **Access:** `AuthGuard`, `ImportJobGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `importId`    | `string`; `new ParseUUIDPipe()` |

CSV attachment.

**Success: 200.**

Binary file body (download), not JSON.

<a id="patch-import-issues-issueid"></a>

### PATCH /import-issues/:issueId

[ImportIssueController.resolve](../../apps/api/src/data-jobs/import-job.controller.ts#L142)

- **Access:** `AuthGuard`, `ImportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('import_job.resolve')`.

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `issueId`                                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ImportIssueResolutionDto](API_REQUEST_SCHEMAS.md#importissueresolutiondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                  | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  rowCount: number;
  etag: string;
  id: string;
  status: 'draft' | 'cancelled' | 'uploaded' | 'validated' | 'committed';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  fileHash: null | string;
  headers: Array<string>;
  mapping: {
    [key: string]: string;
  };
  summary: {
    [key: string]: number;
  };
};
```

<a id="post-exports-preview"></a>

### POST /exports/preview

[ExportJobController.preview](../../apps/api/src/data-jobs/export-job.controller.ts#L47)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  type: 'activities' | 'assignments' | 'follow_ups';
  format: 'csv' | 'xlsx';
  fields: Array<string>;
  estimatedRows: number;
  scope: {
    authority: 'client_admin' | 'director' | 'manager';
    organizationId: null | string;
    teamId: null | string;
  };
  from: string /* ISO 8601 date-time */;
  to: string /* ISO 8601 date-time */;
  warnings: Array<string>;
  maximumRows: number;
};
```

<a id="get-exports"></a>

### GET /exports

[ExportJobController.list](../../apps/api/src/data-jobs/export-job.controller.ts#L53)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Query          | [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    status: 'completed' | 'cancelled' | 'failed' | 'queued' | 'processing' | 'expired';
    etag: string;
    id: string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    expiresAt: null | string /* ISO 8601 date-time */;
    tenantId: string;
    requesterId: string;
    filename: null | string;
    request: {
      [key: string]: unknown;
    };
    contentType: null | string;
    rowCount: null | number;
    failureCode: null | string;
    attempts: number;
    leaseUntil: null | string /* ISO 8601 date-time */;
    downloadExpiresAt: null | string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-exports"></a>

### POST /exports

[ExportJobController.create](../../apps/api/src/data-jobs/export-job.controller.ts#L56)

- **Access:** `AuthGuard`, `ExportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('export_job.create')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ExportRequestDto](API_REQUEST_SCHEMAS.md#exportrequestdto) | All fields, defaults and validators in linked schema |

**Success: 202.**

```ts
type ResponseBody = {
  status: 'completed' | 'cancelled' | 'failed' | 'queued' | 'processing' | 'expired';
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  expiresAt: null | string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  request: {
    [key: string]: unknown;
  };
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  leaseUntil: null | string /* ISO 8601 date-time */;
  downloadExpiresAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-exports-exportid"></a>

### GET /exports/:exportId

[ExportJobController.detail](../../apps/api/src/data-jobs/export-job.controller.ts#L62)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `exportId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  status: 'completed' | 'cancelled' | 'failed' | 'queued' | 'processing' | 'expired';
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  expiresAt: null | string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  request: {
    [key: string]: unknown;
  };
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  leaseUntil: null | string /* ISO 8601 date-time */;
  downloadExpiresAt: null | string /* ISO 8601 date-time */;
};
```

<a id="post-exports-exportid-cancel"></a>

### POST /exports/:exportId/cancel

[ExportJobController.cancel](../../apps/api/src/data-jobs/export-job.controller.ts#L68)

- **Access:** `AuthGuard`, `ExportJobGuard`
- **Idempotency-Key:** required; `@Idempotent('export_job.cancel')`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `exportId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  status: 'completed' | 'cancelled' | 'failed' | 'queued' | 'processing' | 'expired';
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  expiresAt: null | string /* ISO 8601 date-time */;
  tenantId: string;
  requesterId: string;
  filename: null | string;
  request: {
    [key: string]: unknown;
  };
  contentType: null | string;
  rowCount: null | number;
  failureCode: null | string;
  attempts: number;
  leaseUntil: null | string /* ISO 8601 date-time */;
  downloadExpiresAt: null | string /* ISO 8601 date-time */;
};
```

<a id="get-exports-exportid-download"></a>

### GET /exports/:exportId/download

[ExportJobController.download](../../apps/api/src/data-jobs/export-job.controller.ts#L74)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `exportId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  url: string;
  expiresAt: string /* ISO 8601 date-time */;
  filename: null | string;
};
```

<a id="get-exports-exportid-audit"></a>

### GET /exports/:exportId/audit

[ExportJobController.audit](../../apps/api/src/data-jobs/export-job.controller.ts#L80)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Param          | `exportId`                                      | `string`; `new ParseUUIDPipe()`                      |
| Query          | [JobListDto](API_REQUEST_SCHEMAS.md#joblistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  requesterId: string;
  request: {
    [key: string]: unknown;
  };
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
    occurredAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-exports-exportid-file"></a>

### GET /exports/:exportId/file

[ExportJobController.file](../../apps/api/src/data-jobs/export-job.controller.ts#L87)

- **Access:** `AuthGuard`, `ExportJobGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `exportId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Query          | [DownloadExportDto](API_REQUEST_SCHEMAS.md#downloadexportdto) | All fields, defaults and validators in linked schema |

File attachment; Content-Type and Content-Disposition come from the generated artifact.

**Success: 200.**

Binary file body (download), not JSON.

## establishment-contacts

Legacy establishment contact creation, reading and updates.

| Method | Path                                                                                                               | Accepted data                                                                               | Success |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------- |
| POST   | [`/establishments/:establishmentId/contacts`](#post-establishments-establishmentid-contacts)                       | Body: [CreateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#createestablishmentcontactdto) | 201     |
| GET    | [`/establishments/:establishmentId/contacts`](#get-establishments-establishmentid-contacts)                        | No declared body/query                                                                      | 200     |
| GET    | [`/establishments/:establishmentId/contacts/:contactId`](#get-establishments-establishmentid-contacts-contactid)   | No declared body/query                                                                      | 200     |
| PATCH  | [`/establishments/:establishmentId/contacts/:contactId`](#patch-establishments-establishmentid-contacts-contactid) | Body: [UpdateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#updateestablishmentcontactdto) | 200     |

<a id="post-establishments-establishmentid-contacts"></a>

### POST /establishments/:establishmentId/contacts

[EstablishmentContactController.create](../../apps/api/src/establishment-contacts/establishment-contact.controller.ts#L29)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `establishmentId`                                                                     | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#createestablishmentcontactdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  name: null | string;
  email: null | string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  phone: null | string;
  source: 'manual' | 'import' | 'api';
  isPrimary: boolean;
  establishmentId: string;
  jobTitle: null | string;
};
```

<a id="get-establishments-establishmentid-contacts"></a>

### GET /establishments/:establishmentId/contacts

[EstablishmentContactController.list](../../apps/api/src/establishment-contacts/establishment-contact.controller.ts#L48)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema     | Type / constraints              |
| -------------- | ----------------- | ------------------------------- |
| Param          | `establishmentId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: null | string;
  email: null | string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  phone: null | string;
  source: 'manual' | 'import' | 'api';
  isPrimary: boolean;
  establishmentId: string;
  jobTitle: null | string;
}>;
```

<a id="get-establishments-establishmentid-contacts-contactid"></a>

### GET /establishments/:establishmentId/contacts/:contactId

[EstablishmentContactController.findById](../../apps/api/src/establishment-contacts/establishment-contact.controller.ts#L59)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema     | Type / constraints              |
| -------------- | ----------------- | ------------------------------- |
| Param          | `establishmentId` | `string`; `new ParseUUIDPipe()` |
| Param          | `contactId`       | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: null | string;
  email: null | string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  phone: null | string;
  source: 'manual' | 'import' | 'api';
  isPrimary: boolean;
  establishmentId: string;
  jobTitle: null | string;
};
```

<a id="patch-establishments-establishmentid-contacts-contactid"></a>

### PATCH /establishments/:establishmentId/contacts/:contactId

[EstablishmentContactController.update](../../apps/api/src/establishment-contacts/establishment-contact.controller.ts#L73)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `establishmentId`                                                                     | `string`; `new ParseUUIDPipe()`                      |
| Param          | `contactId`                                                                           | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#updateestablishmentcontactdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: null | string;
  email: null | string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  phone: null | string;
  source: 'manual' | 'import' | 'api';
  isPrimary: boolean;
  establishmentId: string;
  jobTitle: null | string;
};
```

## establishments

Legacy establishment CRUD and nearby search.

| Method | Path                                                                        | Accepted data                                                                              | Success |
| ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------- |
| POST   | [`/establishments`](#post-establishments)                                   | Body: [CreateEstablishmentDto](API_REQUEST_SCHEMAS.md#createestablishmentdto)              | 201     |
| GET    | [`/establishments`](#get-establishments)                                    | Query: [ListEstablishmentsQueryDto](API_REQUEST_SCHEMAS.md#listestablishmentsquerydto)     | 200     |
| GET    | [`/establishments/nearby`](#get-establishments-nearby)                      | Query: [NearbyEstablishmentsQueryDto](API_REQUEST_SCHEMAS.md#nearbyestablishmentsquerydto) | 200     |
| GET    | [`/establishments/:establishmentId`](#get-establishments-establishmentid)   | No declared body/query                                                                     | 200     |
| PATCH  | [`/establishments/:establishmentId`](#patch-establishments-establishmentid) | Body: [UpdateEstablishmentDto](API_REQUEST_SCHEMAS.md#updateestablishmentdto)              | 200     |

<a id="post-establishments"></a>

### POST /establishments

[EstablishmentController.create](../../apps/api/src/establishments/establishment.controller.ts#L32)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateEstablishmentDto](API_REQUEST_SCHEMAS.md#createestablishmentdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  externalReference: null | string;
  city: null | string;
  regionId: null | string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
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
};
```

<a id="get-establishments"></a>

### GET /establishments

[EstablishmentController.list](../../apps/api/src/establishments/establishment.controller.ts#L49)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                   | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListEstablishmentsQueryDto](API_REQUEST_SCHEMAS.md#listestablishmentsquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  externalReference: null | string;
  city: null | string;
  regionId: null | string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
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
}>;
```

<a id="get-establishments-nearby"></a>

### GET /establishments/nearby

[EstablishmentController.findNearby](../../apps/api/src/establishments/establishment.controller.ts#L62)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                                       | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [NearbyEstablishmentsQueryDto](API_REQUEST_SCHEMAS.md#nearbyestablishmentsquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  externalReference: null | string;
  city: null | string;
  regionId: null | string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
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
  distanceMeters: number;
}>;
```

<a id="get-establishments-establishmentid"></a>

### GET /establishments/:establishmentId

[EstablishmentController.findById](../../apps/api/src/establishments/establishment.controller.ts#L83)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema     | Type / constraints              |
| -------------- | ----------------- | ------------------------------- |
| Param          | `establishmentId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  externalReference: null | string;
  city: null | string;
  regionId: null | string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
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
};
```

<a id="patch-establishments-establishmentid"></a>

### PATCH /establishments/:establishmentId

[EstablishmentController.update](../../apps/api/src/establishments/establishment.controller.ts#L98)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `establishmentId`                                                       | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateEstablishmentDto](API_REQUEST_SCHEMAS.md#updateestablishmentdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  externalReference: null | string;
  city: null | string;
  regionId: null | string;
  normalizedName: string;
  addressLine1: null | string;
  postalCode: null | string;
  countryCode: string;
  phone: null | string;
  website: null | string;
  latitude: null | number;
  longitude: null | number;
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
};
```

## exports

Synchronous controlled CSV/XLSX exports of assignments, activities and follow-ups.

| Method | Path                                               | Accepted data                                                                      | Success |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| GET    | [`/exports/assignments`](#get-exports-assignments) | Query: [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | 200     |
| GET    | [`/exports/activities`](#get-exports-activities)   | Query: [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | 200     |
| GET    | [`/exports/follow_ups`](#get-exports-follow-ups)   | Query: [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | 200     |

<a id="get-exports-assignments"></a>

### GET /exports/assignments

[ControlledExportController.assignments](../../apps/api/src/exports/controlled-export.controller.ts#L20)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | All fields, defaults and validators in linked schema |

CSV or XLSX attachment according to format.

**Success: 200.**

Binary file body (download), not JSON.

<a id="get-exports-activities"></a>

### GET /exports/activities

[ControlledExportController.activities](../../apps/api/src/exports/controlled-export.controller.ts#L26)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | All fields, defaults and validators in linked schema |

CSV or XLSX attachment according to format.

**Success: 200.**

Binary file body (download), not JSON.

<a id="get-exports-follow-ups"></a>

### GET /exports/follow_ups

[ControlledExportController.followUps](../../apps/api/src/exports/controlled-export.controller.ts#L32)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ControlledExportQueryDto](API_REQUEST_SCHEMAS.md#controlledexportquerydto) | All fields, defaults and validators in linked schema |

CSV or XLSX attachment according to format.

**Success: 200.**

Binary file body (download), not JSON.

## follow-ups

Work queue, campaign-scoped follow-up creation, rescheduling and completion/cancellation.

| Method | Path                                                                                                                                                                  | Accepted data                                                                               | Success |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| GET    | [`/follow-ups/:followUpId`](#get-follow-ups-followupid)                                                                                                               | No declared body/query                                                                      | 200     |
| PATCH  | [`/follow-ups/:followUpId`](#patch-follow-ups-followupid)                                                                                                             | Body: [UpdateFollowUpDto](API_REQUEST_SCHEMAS.md#updatefollowupdto)                         | 200     |
| POST   | [`/follow-ups/:followUpId/complete`](#post-follow-ups-followupid-complete)                                                                                            | No declared body/query                                                                      | 200     |
| POST   | [`/follow-ups/:followUpId/cancel`](#post-follow-ups-followupid-cancel)                                                                                                | Body: [CancelFollowUpDto](API_REQUEST_SCHEMAS.md#cancelfollowupdto)                         | 200     |
| GET    | [`/follow-ups`](#get-follow-ups)                                                                                                                                      | Query: [ListFollowUpQueueQueryDto](API_REQUEST_SCHEMAS.md#listfollowupqueuequerydto)        | 200     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/follow-ups`](#get-campaigns-campaignid-prospects-prospectid-follow-ups)                                                | No declared body/query                                                                      | 200     |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/follow-ups`](#post-campaigns-campaignid-prospects-prospectid-follow-ups)                                               | Body: [CreateProspectFollowUpDto](API_REQUEST_SCHEMAS.md#createprospectfollowupdto)         | 201     |
| PATCH  | [`/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule`](#patch-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-reschedule) | Body: [RescheduleProspectFollowUpDto](API_REQUEST_SCHEMAS.md#rescheduleprospectfollowupdto) | 200     |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/complete`](#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-complete)      | No declared body/query                                                                      | 201     |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/cancel`](#post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-cancel)          | No declared body/query                                                                      | 201     |

<a id="get-follow-ups-followupid"></a>

### GET /follow-ups/:followUpId

[CanonicalFollowUpController.detail](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L58)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `followUpId`  | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  source: {
    assignmentId: string;
    createdBy: string;
    actionId: null | string;
  };
  nextAction: {
    category: 'follow_up' | 'todo' | 'meeting';
    channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
    dueAt: string /* ISO 8601 date-time */;
  };
  history: Array<{
    id: string;
    action: string;
    metadata: {
      [key: string]: unknown;
    };
    createdAt: string /* ISO 8601 date-time */;
  }>;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string /* ISO 8601 date-time */;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="patch-follow-ups-followupid"></a>

### PATCH /follow-ups/:followUpId

[CanonicalFollowUpController.update](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L64)

- **Access:** `AuthGuard`, `FollowUpWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.update')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `followUpId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateFollowUpDto](API_REQUEST_SCHEMAS.md#updatefollowupdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string /* ISO 8601 date-time */;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-follow-ups-followupid-complete"></a>

### POST /follow-ups/:followUpId/complete

[CanonicalFollowUpController.complete](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L72)

- **Access:** `AuthGuard`, `FollowUpWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.complete')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `followUpId`  | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string /* ISO 8601 date-time */;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-follow-ups-followupid-cancel"></a>

### POST /follow-ups/:followUpId/cancel

[CanonicalFollowUpController.cancel](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L83)

- **Access:** `AuthGuard`, `FollowUpWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.cancel')`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `followUpId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CancelFollowUpDto](API_REQUEST_SCHEMAS.md#cancelfollowupdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string /* ISO 8601 date-time */;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string /* ISO 8601 date-time */;
  cancelledAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-follow-ups"></a>

### GET /follow-ups

[FollowUpQueueController.list](../../apps/api/src/follow-ups/follow-up-queue.controller.ts#L24)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListFollowUpQueueQueryDto](API_REQUEST_SCHEMAS.md#listfollowupqueuequerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      items: Array<{
        etag: string;
        isOverdue: boolean;
        id: string;
        tenantId: string;
        campaignId: string;
        campaignProspectId: string;
        establishmentId: string;
        assignmentId: string;
        assignedUserId: null | string;
        createdBy: string;
        dueAt: string /* ISO 8601 date-time */;
        category: 'follow_up' | 'todo' | 'meeting';
        channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
        status: 'pending' | 'completed' | 'cancelled';
        completedAt: null | string /* ISO 8601 date-time */;
        cancelledAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>;
      nextCursor: null | string;
    }
  | {
      items: Array<{
        campaignName: string;
        establishmentName: string;
        id: string;
        campaignId: string;
        campaignProspectId: string;
        establishmentId: string;
        assignedUserId: null | string;
        createdBy: string;
        dueAt: string;
        category: 'follow_up' | 'todo' | 'meeting';
        channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
        status: 'pending' | 'completed' | 'cancelled';
        completedAt: null | string;
        cancelledAt: null | string;
        createdAt: string;
        updatedAt: string;
      }>;
    };
```

<a id="get-campaigns-campaignid-prospects-prospectid-follow-ups"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/follow-ups

[ProspectFollowUpController.list](../../apps/api/src/follow-ups/prospect-follow-up.controller.ts#L37)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignedUserId: null | string;
    createdBy: string;
    dueAt: string;
    category: 'follow_up' | 'todo' | 'meeting';
    channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
    status: 'pending' | 'completed' | 'cancelled';
    completedAt: null | string;
    cancelledAt: null | string;
    createdAt: string;
    updatedAt: string;
  }>;
};
```

<a id="post-campaigns-campaignid-prospects-prospectid-follow-ups"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/follow-ups

[ProspectFollowUpController.create](../../apps/api/src/follow-ups/prospect-follow-up.controller.ts#L58)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.create')`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateProspectFollowUpDto](API_REQUEST_SCHEMAS.md#createprospectfollowupdto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="patch-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-reschedule"></a>

### PATCH /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule

[ProspectFollowUpController.reschedule](../../apps/api/src/follow-ups/prospect-follow-up.controller.ts#L91)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.reschedule')`.

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Param          | `followUpId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Body           | [RescheduleProspectFollowUpDto](API_REQUEST_SCHEMAS.md#rescheduleprospectfollowupdto) | All fields, defaults and validators in linked schema |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-complete"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/complete

[ProspectFollowUpController.complete](../../apps/api/src/follow-ups/prospect-follow-up.controller.ts#L123)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.complete')`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `followUpId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

<a id="post-campaigns-campaignid-prospects-prospectid-follow-ups-followupid-cancel"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/cancel

[ProspectFollowUpController.cancel](../../apps/api/src/follow-ups/prospect-follow-up.controller.ts#L150)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('follow_up.cancel')`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `followUpId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignedUserId: null | string;
  createdBy: string;
  dueAt: string;
  category: 'follow_up' | 'todo' | 'meeting';
  channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: null | string;
  cancelledAt: null | string;
  createdAt: string;
  updatedAt: string;
};
```

## geographic-allocation

Preview and apply campaign allocation by geographic rules.

| Method | Path                                                                                                               | Accepted data                                                                   | Success |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------- |
| POST   | [`/campaigns/:campaignId/geographic-allocation/preview`](#post-campaigns-campaignid-geographic-allocation-preview) | Body: [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto) | 200     |
| POST   | [`/campaigns/:campaignId/geographic-allocation/apply`](#post-campaigns-campaignid-geographic-allocation-apply)     | Body: [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto) | 200     |

<a id="post-campaigns-campaignid-geographic-allocation-preview"></a>

### POST /campaigns/:campaignId/geographic-allocation/preview

[GeographicAllocationController.preview](../../apps/api/src/geographic-allocation/allocation.controller.ts#L42)

- **Access:** `AuthGuard`, `GeographicAllocationGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  mode: string;
  decisions: Array<{
    prospectId: string;
    outcome: string;
    teamId?: undefined | string;
    membershipId?: undefined | null | string;
    territoryId?: undefined | string;
    responsibilityId?: undefined | string;
    assignmentId?: undefined | string;
  }>;
  assigned: number;
  proposed: number;
  skipped: number;
};
```

<a id="post-campaigns-campaignid-geographic-allocation-apply"></a>

### POST /campaigns/:campaignId/geographic-allocation/apply

[GeographicAllocationController.apply](../../apps/api/src/geographic-allocation/allocation.controller.ts#L51)

- **Access:** `AuthGuard`, `GeographicAllocationGuard`
- **Idempotency-Key:** required; `@Idempotent('geographic_allocation.apply')`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [GeographicAllocationDto](API_REQUEST_SCHEMAS.md#geographicallocationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignId: string;
  mode: string;
  decisions: Array<{
    prospectId: string;
    outcome: string;
    teamId?: undefined | string;
    membershipId?: undefined | null | string;
    territoryId?: undefined | string;
    responsibilityId?: undefined | string;
    assignmentId?: undefined | string;
  }>;
  assigned: number;
  proposed: number;
  skipped: number;
};
```

## health

Liveness and PostgreSQL/Redis readiness.

| Method | Path                                 | Accepted data          | Success |
| ------ | ------------------------------------ | ---------------------- | ------- |
| GET    | [`/health`](#get-health)             | No declared body/query | 200     |
| GET    | [`/health/live`](#get-health-live)   | No declared body/query | 200     |
| GET    | [`/health/ready`](#get-health-ready) | No declared body/query | 200     |

<a id="get-health"></a>

### GET /health

[HealthController.getHealth](../../apps/api/src/health/health.controller.ts#L5)

- **Access:** No route guard declared (public or token/challenge validated in the service).

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  status: string;
};
```

<a id="get-health-live"></a>

### GET /health/live

[ReadinessController.live](../../apps/api/src/health/readiness.controller.ts#L13)

- **Access:** No route guard declared (public or token/challenge validated in the service).

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  status: string;
};
```

<a id="get-health-ready"></a>

### GET /health/ready

[ReadinessController.ready](../../apps/api/src/health/readiness.controller.ts#L18)

- **Access:** No route guard declared (public or token/challenge validated in the service).

No declared JSON body or query parameters.

Returns 503 when either PostgreSQL or Redis fails its readiness check. The global exception filter normalizes the error, so the thrown dependencies object is not the final error payload.

**Success: 200.**

```ts
type ResponseBody = {
  status: string;
  dependencies: {
    postgres: string;
    redis: string;
  };
};
```

## imports

Immediate CSV preview and execution.

| Method | Path                                        | Accepted data  | Success |
| ------ | ------------------------------------------- | -------------- | ------- |
| POST   | [`/imports/preview`](#post-imports-preview) | Multipart file | 200     |
| POST   | [`/imports/execute`](#post-imports-execute) | Multipart file | 200     |

<a id="post-imports-preview"></a>

### POST /imports/preview

[ImportPreviewController.preview](../../apps/api/src/imports/import-preview.controller.ts#L35)

- **Access:** `AuthGuard`, `ClientAdminGuard`

No declared JSON body or query parameters.

multipart/form-data: one file part named file, .csv filename, UTF-8 CSV; at most 5 MiB and 10,000 rows. Required headers: name, country_code. See the CSV section in API_CATALOG.md.

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    invalidRows: number;
  };
  rows: Array<{
    rowNumber: number;
    status: 'valid' | 'warning' | 'invalid';
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
  }>;
};
```

<a id="post-imports-execute"></a>

### POST /imports/execute

[ImportExecutionController.execute](../../apps/api/src/imports/import-execution.controller.ts#L41)

- **Access:** `AuthGuard`, `ClientAdminGuard`

No declared JSON body or query parameters.

multipart/form-data: one file part named file, .csv filename, UTF-8 CSV; at most 5 MiB and 10,000 rows. Required headers: name, country_code. See the CSV section in API_CATALOG.md.

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    totalRows: number;
    createdEstablishments: number;
    reusedEstablishments: number;
    createdContacts: number;
    skippedRows: number;
    failedRows: number;
  };
  rows: Array<{
    rowNumber: number;
    status: 'skipped' | 'created' | 'reused' | 'failed';
    establishmentId: null | string;
    contactId: null | string;
    reason: null | string;
  }>;
};
```

## integrations

External providers, API clients, webhooks, deliveries and retries.

| Method | Path                                                                                 | Accepted data                                                               | Success |
| ------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------- |
| GET    | [`/integrations`](#get-integrations)                                                 | No declared body/query                                                      | 200     |
| POST   | [`/integrations/:provider/connect`](#post-integrations-provider-connect)             | Body: [ConnectIntegrationDto](API_REQUEST_SCHEMAS.md#connectintegrationdto) | 201     |
| GET    | [`/integrations/:provider/callback`](#get-integrations-provider-callback)            | No declared body/query                                                      | 200     |
| POST   | [`/integrations/:integrationId/test`](#post-integrations-integrationid-test)         | No declared body/query                                                      | 201     |
| POST   | [`/integrations/:integrationId/sync`](#post-integrations-integrationid-sync)         | No declared body/query                                                      | 201     |
| GET    | [`/integrations/:provider/health`](#get-integrations-provider-health)                | No declared body/query                                                      | 200     |
| DELETE | [`/integrations/:integrationId`](#delete-integrations-integrationid)                 | No declared body/query                                                      | 204     |
| GET    | [`/api-clients`](#get-api-clients)                                                   | No declared body/query                                                      | 200     |
| POST   | [`/api-clients`](#post-api-clients)                                                  | Body: [ApiClientDto](API_REQUEST_SCHEMAS.md#apiclientdto)                   | 201     |
| PATCH  | [`/api-clients/:clientId`](#patch-api-clients-clientid)                              | Body: [ApiClientDto](API_REQUEST_SCHEMAS.md#apiclientdto)                   | 200     |
| DELETE | [`/api-clients/:clientId`](#delete-api-clients-clientid)                             | No declared body/query                                                      | 204     |
| POST   | [`/api-clients/:clientId/rotate-secret`](#post-api-clients-clientid-rotate-secret)   | No declared body/query                                                      | 201     |
| GET    | [`/webhooks`](#get-webhooks)                                                         | No declared body/query                                                      | 200     |
| POST   | [`/webhooks`](#post-webhooks)                                                        | Body: [WebhookDto](API_REQUEST_SCHEMAS.md#webhookdto)                       | 201     |
| PATCH  | [`/webhooks/:webhookId`](#patch-webhooks-webhookid)                                  | Body: [WebhookUpdateDto](API_REQUEST_SCHEMAS.md#webhookupdatedto)           | 200     |
| DELETE | [`/webhooks/:webhookId`](#delete-webhooks-webhookid)                                 | No declared body/query                                                      | 204     |
| POST   | [`/webhooks/:webhookId/test`](#post-webhooks-webhookid-test)                         | No declared body/query                                                      | 201     |
| GET    | [`/webhooks/:webhookId/deliveries`](#get-webhooks-webhookid-deliveries)              | No declared body/query                                                      | 200     |
| GET    | [`/webhook-deliveries/:deliveryId`](#get-webhook-deliveries-deliveryid)              | No declared body/query                                                      | 200     |
| POST   | [`/webhook-deliveries/:deliveryId/retry`](#post-webhook-deliveries-deliveryid-retry) | No declared body/query                                                      | 201     |

<a id="get-integrations"></a>

### GET /integrations

[IntegrationsController.list](../../apps/api/src/integrations/integrations.module.ts#L263)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  provider: string;
  status: string;
  config: unknown;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
}>;
```

<a id="post-integrations-provider-connect"></a>

### POST /integrations/:provider/connect

[IntegrationsController.connect](../../apps/api/src/integrations/integrations.module.ts#L266)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('integration.connect')`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `provider`                                                            | `string`                                             |
| Body           | [ConnectIntegrationDto](API_REQUEST_SCHEMAS.md#connectintegrationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      config: unknown;
      provider: string;
      connectedBy: string;
    };
```

<a id="get-integrations-provider-callback"></a>

### GET /integrations/:provider/callback

[IntegrationsController.callback](../../apps/api/src/integrations/integrations.module.ts#L279)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `provider`    | `string`           |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      config: unknown;
      provider: string;
      connectedBy: string;
    };
```

<a id="post-integrations-integrationid-test"></a>

### POST /integrations/:integrationId/test

[IntegrationsController.test](../../apps/api/src/integrations/integrations.module.ts#L285)

- **Access:** `AuthGuard`

| Input location | Name / schema   | Type / constraints        |
| -------------- | --------------- | ------------------------- |
| Param          | `integrationId` | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody = null | {
  id: string;
  provider: string;
  status: string;
  config: unknown;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-integrations-integrationid-sync"></a>

### POST /integrations/:integrationId/sync

[IntegrationsController.sync](../../apps/api/src/integrations/integrations.module.ts#L291)

- **Access:** `AuthGuard`

| Input location | Name / schema   | Type / constraints        |
| -------------- | --------------- | ------------------------- |
| Param          | `integrationId` | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody = null | {
  id: string;
  provider: string;
  status: string;
  config: unknown;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-integrations-provider-health"></a>

### GET /integrations/:provider/health

[IntegrationsController.health](../../apps/api/src/integrations/integrations.module.ts#L297)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints |
| -------------- | ------------- | ------------------ |
| Param          | `provider`    | `string`           |

**Success: 200.**

```ts
type ResponseBody =
  | {
      provider: string;
      connected: boolean;
      healthy: boolean;
      reason: string;
      tokenUpdatedAt?: undefined;
      stale?: undefined;
      updatedAt?: undefined;
    }
  | {
      provider: string;
      connected: boolean;
      healthy: boolean;
      tokenUpdatedAt: null | string;
      stale: boolean;
      updatedAt: string /* ISO 8601 date-time */;
      reason?: undefined;
    };
```

<a id="delete-integrations-integrationid"></a>

### DELETE /integrations/:integrationId

[IntegrationsController.remove](../../apps/api/src/integrations/integrations.module.ts#L303)

- **Access:** `AuthGuard`

| Input location | Name / schema   | Type / constraints        |
| -------------- | --------------- | ------------------------- |
| Param          | `integrationId` | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

<a id="get-api-clients"></a>

### GET /api-clients

[IntegrationsController.clients](../../apps/api/src/integrations/integrations.module.ts#L309)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: string;
  scopes: Array<string>;
  expiresAt: null | string /* ISO 8601 date-time */;
  revokedAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
}>;
```

<a id="post-api-clients"></a>

### POST /api-clients

[IntegrationsController.createClient](../../apps/api/src/integrations/integrations.module.ts#L312)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('api_client.create')`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ApiClientDto](API_REQUEST_SCHEMAS.md#apiclientdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  secret: string;
  id?: undefined | string;
  name?: undefined | string;
  createdAt?: undefined | string /* ISO 8601 date-time */;
  expiresAt?: undefined | null | string /* ISO 8601 date-time */;
  tenantId?: undefined | string;
  revokedAt?: undefined | null | string /* ISO 8601 date-time */;
  createdBy?: undefined | string;
  secretHash?: undefined | string;
  scopes?: undefined | Array<string>;
};
```

<a id="patch-api-clients-clientid"></a>

### PATCH /api-clients/:clientId

[IntegrationsController.updateClient](../../apps/api/src/integrations/integrations.module.ts#L318)

- **Access:** `AuthGuard`

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Param          | `clientId`                                          | `string`; `ParseUUIDPipe`                            |
| Body           | [ApiClientDto](API_REQUEST_SCHEMAS.md#apiclientdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  scopes: Array<string>;
  expiresAt: null | string /* ISO 8601 date-time */;
};
```

<a id="delete-api-clients-clientid"></a>

### DELETE /api-clients/:clientId

[IntegrationsController.revokeClient](../../apps/api/src/integrations/integrations.module.ts#L325)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `clientId`    | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

<a id="post-api-clients-clientid-rotate-secret"></a>

### POST /api-clients/:clientId/rotate-secret

[IntegrationsController.rotate](../../apps/api/src/integrations/integrations.module.ts#L331)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `clientId`    | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody = {
  secret: string;
  id: string;
};
```

<a id="get-webhooks"></a>

### GET /webhooks

[IntegrationsController.hooks](../../apps/api/src/integrations/integrations.module.ts#L337)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  url: string;
  events: Array<string>;
  active: boolean;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
}>;
```

<a id="post-webhooks"></a>

### POST /webhooks

[IntegrationsController.createHook](../../apps/api/src/integrations/integrations.module.ts#L340)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('webhook.create')`.

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Body           | [WebhookDto](API_REQUEST_SCHEMAS.md#webhookdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  secret: string;
  id?: undefined | string;
  active?: undefined | boolean;
  createdAt?: undefined | string /* ISO 8601 date-time */;
  updatedAt?: undefined | string /* ISO 8601 date-time */;
  tenantId?: undefined | string;
  events?: undefined | Array<string>;
  createdBy?: undefined | string;
  url?: undefined | string;
  secretHash?: undefined | string;
};
```

<a id="patch-webhooks-webhookid"></a>

### PATCH /webhooks/:webhookId

[IntegrationsController.updateHook](../../apps/api/src/integrations/integrations.module.ts#L346)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `webhookId`                                                 | `string`; `ParseUUIDPipe`                            |
| Body           | [WebhookUpdateDto](API_REQUEST_SCHEMAS.md#webhookupdatedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  url: string;
  events: Array<string>;
  active: boolean;
};
```

<a id="delete-webhooks-webhookid"></a>

### DELETE /webhooks/:webhookId

[IntegrationsController.deleteHook](../../apps/api/src/integrations/integrations.module.ts#L353)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `webhookId`   | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

<a id="post-webhooks-webhookid-test"></a>

### POST /webhooks/:webhookId/test

[IntegrationsController.testHook](../../apps/api/src/integrations/integrations.module.ts#L359)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `webhookId`   | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: string;
      createdAt: string /* ISO 8601 date-time */;
      tenantId: string;
      attempts: string;
      webhookId: string;
      event: string;
      responseCode: null | string;
      lastAttemptAt: null | string /* ISO 8601 date-time */;
    };
```

<a id="get-webhooks-webhookid-deliveries"></a>

### GET /webhooks/:webhookId/deliveries

[IntegrationsController.deliveries](../../apps/api/src/integrations/integrations.module.ts#L365)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `webhookId`   | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: string;
  responseCode: null | string;
  lastAttemptAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
}>;
```

<a id="get-webhook-deliveries-deliveryid"></a>

### GET /webhook-deliveries/:deliveryId

[IntegrationsController.delivery](../../apps/api/src/integrations/integrations.module.ts#L371)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `deliveryId`  | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = null | {
  id: string;
  tenantId: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: string;
  responseCode: null | string;
  lastAttemptAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
};
```

<a id="post-webhook-deliveries-deliveryid-retry"></a>

### POST /webhook-deliveries/:deliveryId/retry

[IntegrationsController.retry](../../apps/api/src/integrations/integrations.module.ts#L377)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `deliveryId`  | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: string;
  responseCode: null | string;
  lastAttemptAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
};
```

## maps

Prospect map/nearby search, activity heatmap and territory coverage.

| Method | Path                                         | Accepted data                                                          | Success |
| ------ | -------------------------------------------- | ---------------------------------------------------------------------- | ------- |
| GET    | [`/prospects/map`](#get-prospects-map)       | Query: [MapViewportDto](API_REQUEST_SCHEMAS.md#mapviewportdto)         | 200     |
| GET    | [`/prospects/nearby`](#get-prospects-nearby) | Query: [NearbyProspectsDto](API_REQUEST_SCHEMAS.md#nearbyprospectsdto) | 200     |
| GET    | [`/map/heatmap`](#get-map-heatmap)           | Query: [HeatmapDto](API_REQUEST_SCHEMAS.md#heatmapdto)                 | 200     |
| GET    | [`/map/coverage`](#get-map-coverage)         | Query: [MapAggregateDto](API_REQUEST_SCHEMAS.md#mapaggregatedto)       | 200     |

<a id="get-prospects-map"></a>

### GET /prospects/map

[ProspectMapController.markers](../../apps/api/src/maps/map.controller.ts#L13)

- **Access:** `AuthGuard`

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [MapViewportDto](API_REQUEST_SCHEMAS.md#mapviewportdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  type: string;
  features: unknown;
  bbox: Array<number>;
  zoom: number;
  summary: {
    prospects: unknown;
    campaignMemberships: unknown;
    byLifecycleStage: unknown;
  };
  truncated: boolean;
  totalFeatures: unknown;
};
```

<a id="get-prospects-nearby"></a>

### GET /prospects/nearby

[ProspectMapController.nearby](../../apps/api/src/maps/map.controller.ts#L16)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [NearbyProspectsDto](API_REQUEST_SCHEMAS.md#nearbyprospectsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
  }>;
  nextCursor: null | string;
  radiusMeters: number;
};
```

<a id="get-map-heatmap"></a>

### GET /map/heatmap

[MapAggregateController.heatmap](../../apps/api/src/maps/map.controller.ts#L24)

- **Access:** `AuthGuard`

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Query          | [HeatmapDto](API_REQUEST_SCHEMAS.md#heatmapdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  type: string;
  features: unknown;
  bbox: Array<number>;
  zoom: number;
  metric: 'activity' | 'conversion';
  activityWindow: {
    from: string;
    to: string;
  };
  conversionBasis: string;
  truncated: boolean;
  totalFeatures: unknown;
};
```

<a id="get-map-coverage"></a>

### GET /map/coverage

[MapAggregateController.coverage](../../apps/api/src/maps/map.controller.ts#L27)

- **Access:** `AuthGuard`

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [MapAggregateDto](API_REQUEST_SCHEMAS.md#mapaggregatedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  type: string;
  features: unknown;
  bbox: Array<number>;
  activityWindow: {
    from: string;
    to: string;
  };
  coverageBasis: string;
  overlappingTerritories: string;
};
```

## memberships

Tenant membership lifecycle, resource scopes and access history.

| Method | Path                                                                                        | Accepted data                                                           | Success |
| ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| GET    | [`/memberships`](#get-memberships)                                                          | Query: [ListMembershipsDto](API_REQUEST_SCHEMAS.md#listmembershipsdto)  | 200     |
| GET    | [`/memberships/:membershipId`](#get-memberships-membershipid)                               | No declared body/query                                                  | 200     |
| PATCH  | [`/memberships/:membershipId`](#patch-memberships-membershipid)                             | Body: [UpdateMembershipDto](API_REQUEST_SCHEMAS.md#updatemembershipdto) | 200     |
| POST   | [`/memberships/:membershipId/suspend`](#post-memberships-membershipid-suspend)              | Body: [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto) | 200     |
| POST   | [`/memberships/:membershipId/reactivate`](#post-memberships-membershipid-reactivate)        | Body: [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto) | 200     |
| GET    | [`/memberships/:membershipId/scopes`](#get-memberships-membershipid-scopes)                 | No declared body/query                                                  | 200     |
| POST   | [`/memberships/:membershipId/scopes`](#post-memberships-membershipid-scopes)                | Body: [MembershipScopeDto](API_REQUEST_SCHEMAS.md#membershipscopedto)   | 201     |
| GET    | [`/memberships/:membershipId/access-history`](#get-memberships-membershipid-access-history) | Query: [ListMembershipsDto](API_REQUEST_SCHEMAS.md#listmembershipsdto)  | 200     |
| PATCH  | [`/membership-scopes/:scopeId`](#patch-membership-scopes-scopeid)                           | Body: [MembershipScopeDto](API_REQUEST_SCHEMAS.md#membershipscopedto)   | 200     |
| DELETE | [`/membership-scopes/:scopeId`](#delete-membership-scopes-scopeid)                          | No declared body/query                                                  | 204     |

<a id="get-memberships"></a>

### GET /memberships

[MembershipController.list](../../apps/api/src/memberships/membership.controller.ts#L34)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListMembershipsDto](API_REQUEST_SCHEMAS.md#listmembershipsdto) | All fields, defaults and validators in linked schema |

Response verified from [service return expression](../../apps/api/src/memberships/membership.service.ts#L92).

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    identityId: string;
    email: string;
    displayName: null | string;
    status: 'active' | 'suspended' | 'invited' | 'departed';
    capacity: null | number;
    roles: Array<string>;
  }>;
  nextCursor: null | string;
};
```

<a id="get-memberships-membershipid"></a>

### GET /memberships/:membershipId

[MembershipController.get](../../apps/api/src/memberships/membership.controller.ts#L37)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema  | Type / constraints              |
| -------------- | -------------- | ------------------------------- |
| Param          | `membershipId` | `string`; `new ParseUUIDPipe()` |

Response verified from [service return expression](../../apps/api/src/memberships/membership.service.ts#L139).

**Success: 200.**

```ts
type ResponseBody = {
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: Array<
    | {
        permissions: Array<string>;
        grantId: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        effect: string;
        resourceId: string;
        reason: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: string;
        campaignId: null;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: null;
        territoryId: string;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'campaign' | 'territory';
        organizationId: null;
        teamId: null;
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: 'active' | 'suspended' | 'disabled';
  displayName: null | string;
  status: 'active' | 'suspended' | 'invited' | 'departed';
  invitedAt: null | string /* ISO 8601 date-time */;
  activatedAt: null | string /* ISO 8601 date-time */;
  suspendedAt: null | string /* ISO 8601 date-time */;
  departedAt: null | string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  capacity: null | number;
};
```

<a id="patch-memberships-membershipid"></a>

### PATCH /memberships/:membershipId

[MembershipController.update](../../apps/api/src/memberships/membership.controller.ts#L43)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `membershipId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateMembershipDto](API_REQUEST_SCHEMAS.md#updatemembershipdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                        | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/memberships/membership.service.ts#L139).

**Success: 200.**

```ts
type ResponseBody = {
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: Array<
    | {
        permissions: Array<string>;
        grantId: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        effect: string;
        resourceId: string;
        reason: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: string;
        campaignId: null;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: null;
        territoryId: string;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'campaign' | 'territory';
        organizationId: null;
        teamId: null;
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: 'active' | 'suspended' | 'disabled';
  displayName: null | string;
  status: 'active' | 'suspended' | 'invited' | 'departed';
  invitedAt: null | string /* ISO 8601 date-time */;
  activatedAt: null | string /* ISO 8601 date-time */;
  suspendedAt: null | string /* ISO 8601 date-time */;
  departedAt: null | string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  capacity: null | number;
};
```

<a id="post-memberships-membershipid-suspend"></a>

### POST /memberships/:membershipId/suspend

[MembershipController.suspend](../../apps/api/src/memberships/membership.controller.ts#L53)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.suspend')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `membershipId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                        | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/memberships/membership.service.ts#L139).

**Success: 200.**

```ts
type ResponseBody = {
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: Array<
    | {
        permissions: Array<string>;
        grantId: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        effect: string;
        resourceId: string;
        reason: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: string;
        campaignId: null;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: null;
        territoryId: string;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'campaign' | 'territory';
        organizationId: null;
        teamId: null;
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: 'active' | 'suspended' | 'disabled';
  displayName: null | string;
  status: 'active' | 'suspended' | 'invited' | 'departed';
  invitedAt: null | string /* ISO 8601 date-time */;
  activatedAt: null | string /* ISO 8601 date-time */;
  suspendedAt: null | string /* ISO 8601 date-time */;
  departedAt: null | string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  capacity: null | number;
};
```

<a id="post-memberships-membershipid-reactivate"></a>

### POST /memberships/:membershipId/reactivate

[MembershipController.reactivate](../../apps/api/src/memberships/membership.controller.ts#L69)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.reactivate')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `membershipId`                                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [MembershipReasonDto](API_REQUEST_SCHEMAS.md#membershipreasondto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                        | `undefined \| string`; optional parameter            |

Response verified from [service return expression](../../apps/api/src/memberships/membership.service.ts#L139).

**Success: 200.**

```ts
type ResponseBody = {
  activeAssignments: number;
  availableCapacity: null | number;
  scopes: Array<
    | {
        permissions: Array<string>;
        grantId: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        effect: string;
        resourceId: string;
        reason: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'tenant' | 'organization' | 'team';
        organizationId: null | string;
        teamId: null | string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: string;
        teamId: string;
        campaignId: null;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: string;
        territoryId: null;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        source: string;
        role: null;
        scopeType: string;
        organizationId: null;
        teamId: null;
        campaignId: null;
        territoryId: string;
        accessLevel: string;
      }
    | {
        permissions: Array<string>;
        grantId: string;
        role: string;
        scopeType: 'campaign' | 'territory';
        organizationId: null;
        teamId: null;
        campaignId: null | string;
        territoryId: null | string;
        accessLevel: 'read' | 'read_write' | 'manage';
      }
  >;
  rosterHistory: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: 'active' | 'suspended' | 'disabled';
  displayName: null | string;
  status: 'active' | 'suspended' | 'invited' | 'departed';
  invitedAt: null | string /* ISO 8601 date-time */;
  activatedAt: null | string /* ISO 8601 date-time */;
  suspendedAt: null | string /* ISO 8601 date-time */;
  departedAt: null | string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  capacity: null | number;
};
```

<a id="get-memberships-membershipid-scopes"></a>

### GET /memberships/:membershipId/scopes

[MembershipController.scopes](../../apps/api/src/memberships/membership.controller.ts#L80)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema  | Type / constraints              |
| -------------- | -------------- | ------------------------------- |
| Param          | `membershipId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = Array<
  | {
      etag: string;
      effect: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
      resourceId: string;
      reason: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      etag: string;
      role: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'tenant' | 'organization' | 'team';
      organizationId: null | string;
      teamId: null | string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      etag: string;
      role: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'campaign' | 'territory';
      territoryId: null | string;
      campaignId: null | string;
      accessLevel: 'read' | 'read_write' | 'manage';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }
>;
```

<a id="post-memberships-membershipid-scopes"></a>

### POST /memberships/:membershipId/scopes

[MembershipController.addScope](../../apps/api/src/memberships/membership.controller.ts#L86)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.add_scope')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `membershipId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [MembershipScopeDto](API_REQUEST_SCHEMAS.md#membershipscopedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      role: string;
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      userId: string;
      scopeType: 'campaign' | 'territory';
      campaignId: null | string;
      territoryId: null | string;
      accessLevel: 'read' | 'read_write' | 'manage';
    }
  | {
      effect: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
      resourceId: string;
      reason: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      role: string;
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      userId: string;
      organizationId: null | string;
      scopeType: 'tenant' | 'organization' | 'team';
      teamId: null | string;
    };
```

<a id="get-memberships-membershipid-access-history"></a>

### GET /memberships/:membershipId/access-history

[MembershipController.history](../../apps/api/src/memberships/membership.controller.ts#L95)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `membershipId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListMembershipsDto](API_REQUEST_SCHEMAS.md#listmembershipsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    integrity: {
      algorithm: string;
      digest: unknown;
      verified: unknown;
    };
  }>;
  nextCursor: unknown;
};
```

<a id="patch-membership-scopes-scopeid"></a>

### PATCH /membership-scopes/:scopeId

[MembershipScopeController.update](../../apps/api/src/memberships/membership.controller.ts#L108)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.change_scope')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `scopeId`                                                       | `string`; `new ParseUUIDPipe()`                      |
| Body           | [MembershipScopeDto](API_REQUEST_SCHEMAS.md#membershipscopedto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                      | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      role: string;
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      userId: string;
      scopeType: 'campaign' | 'territory';
      campaignId: null | string;
      territoryId: null | string;
      accessLevel: 'read' | 'read_write' | 'manage';
    }
  | {
      effect: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'tenant' | 'organization' | 'team' | 'campaign' | 'territory';
      resourceId: string;
      reason: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      role: string;
      id: string;
      tenantId: string;
      userId: string;
      scopeType: 'tenant' | 'organization' | 'team';
      organizationId: null | string;
      teamId: null | string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-membership-scopes-scopeid"></a>

### DELETE /membership-scopes/:scopeId

[MembershipScopeController.remove](../../apps/api/src/memberships/membership.controller.ts#L118)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.remove_scope')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `scopeId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

## messaging

Conversations, participants, messages, read markers and muting.

| Method | Path                                                                                                  | Accepted data                                                               | Success |
| ------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------- |
| GET    | [`/conversations`](#get-conversations)                                                                | Query: [ConversationListDto](API_REQUEST_SCHEMAS.md#conversationlistdto)    | 200     |
| POST   | [`/conversations`](#post-conversations)                                                               | Body: [CreateConversationDto](API_REQUEST_SCHEMAS.md#createconversationdto) | 201     |
| GET    | [`/conversations/:id`](#get-conversations-id)                                                         | No declared body/query                                                      | 200     |
| PATCH  | [`/conversations/:id`](#patch-conversations-id)                                                       | Body: [UpdateConversationDto](API_REQUEST_SCHEMAS.md#updateconversationdto) | 200     |
| GET    | [`/conversations/:id/participants`](#get-conversations-id-participants)                               | No declared body/query                                                      | 200     |
| POST   | [`/conversations/:id/participants`](#post-conversations-id-participants)                              | Body: [AddParticipantDto](API_REQUEST_SCHEMAS.md#addparticipantdto)         | 201     |
| DELETE | [`/conversations/:id/participants/:membershipId`](#delete-conversations-id-participants-membershipid) | No declared body/query                                                      | 204     |
| GET    | [`/conversations/:id/messages`](#get-conversations-id-messages)                                       | Query: [ConversationListDto](API_REQUEST_SCHEMAS.md#conversationlistdto)    | 200     |
| POST   | [`/conversations/:id/messages`](#post-conversations-id-messages)                                      | Body: [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto)               | 201     |
| POST   | [`/conversations/:id/read`](#post-conversations-id-read)                                              | No declared body/query                                                      | 201     |
| PATCH  | [`/conversations/:id/mute`](#patch-conversations-id-mute)                                             | Body: [MuteConversationDto](API_REQUEST_SCHEMAS.md#muteconversationdto)     | 200     |
| PATCH  | [`/messages/:id`](#patch-messages-id)                                                                 | Body: [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto)               | 200     |
| DELETE | [`/messages/:id`](#delete-messages-id)                                                                | No declared body/query                                                      | 204     |

<a id="get-conversations"></a>

### GET /conversations

[ConversationController.list](../../apps/api/src/messaging/messaging.module.ts#L335)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ConversationListDto](API_REQUEST_SCHEMAS.md#conversationlistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    kind: 'prospect' | 'team' | 'campaign' | 'direct';
    title: null | string;
    status: 'active' | 'archived';
    createdBy: string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-conversations"></a>

### POST /conversations

[ConversationController.create](../../apps/api/src/messaging/messaging.module.ts#L338)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('conversation.create')`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateConversationDto](API_REQUEST_SCHEMAS.md#createconversationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: 'active' | 'archived';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      createdBy: string;
      kind: 'prospect' | 'team' | 'campaign' | 'direct';
      title: null | string;
    };
```

<a id="get-conversations-id"></a>

### GET /conversations/:id

[ConversationController.get](../../apps/api/src/messaging/messaging.module.ts#L344)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `id`          | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  tenantId: string;
  kind: 'prospect' | 'team' | 'campaign' | 'direct';
  title: null | string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="patch-conversations-id"></a>

### PATCH /conversations/:id

[ConversationController.update](../../apps/api/src/messaging/messaging.module.ts#L347)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                                  | `string`; `ParseUUIDPipe`                            |
| Body           | [UpdateConversationDto](API_REQUEST_SCHEMAS.md#updateconversationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      kind: 'prospect' | 'team' | 'campaign' | 'direct';
      title: null | string;
      status: 'active' | 'archived';
      createdBy: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="get-conversations-id-participants"></a>

### GET /conversations/:id/participants

[ConversationController.participants](../../apps/api/src/messaging/messaging.module.ts#L354)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `id`          | `string`; `ParseUUIDPipe` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  conversationId: string;
  membershipId: string;
  lastReadAt: null | string /* ISO 8601 date-time */;
  mutedUntil: null | string /* ISO 8601 date-time */;
  joinedAt: string /* ISO 8601 date-time */;
}>;
```

<a id="post-conversations-id-participants"></a>

### POST /conversations/:id/participants

[ConversationController.add](../../apps/api/src/messaging/messaging.module.ts#L360)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                          | `string`; `ParseUUIDPipe`                            |
| Body           | [AddParticipantDto](API_REQUEST_SCHEMAS.md#addparticipantdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  conversationId: string;
  membershipId: string;
};
```

<a id="delete-conversations-id-participants-membershipid"></a>

### DELETE /conversations/:id/participants/:membershipId

[ConversationController.remove](../../apps/api/src/messaging/messaging.module.ts#L367)

- **Access:** `AuthGuard`

| Input location | Name / schema  | Type / constraints        |
| -------------- | -------------- | ------------------------- |
| Param          | `id`           | `string`; `ParseUUIDPipe` |
| Param          | `membershipId` | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

<a id="get-conversations-id-messages"></a>

### GET /conversations/:id/messages

[ConversationController.messages](../../apps/api/src/messaging/messaging.module.ts#L374)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                              | `string`; `ParseUUIDPipe`                            |
| Query          | [ConversationListDto](API_REQUEST_SCHEMAS.md#conversationlistdto) | All fields, defaults and validators in linked schema |

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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-conversations-id-messages"></a>

### POST /conversations/:id/messages

[ConversationController.send](../../apps/api/src/messaging/messaging.module.ts#L381)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('message.create')`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                    | `string`; `ParseUUIDPipe`                            |
| Body           | [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      status: 'sent' | 'edited' | 'deleted';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      conversationId: string;
      senderId: string;
      body: string;
    };
```

<a id="post-conversations-id-read"></a>

### POST /conversations/:id/read

[ConversationController.read](../../apps/api/src/messaging/messaging.module.ts#L388)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `id`          | `string`; `ParseUUIDPipe` |

**Success: 201.**

```ts
type ResponseBody = {
  conversationId: string;
  read: boolean;
};
```

<a id="patch-conversations-id-mute"></a>

### PATCH /conversations/:id/mute

[ConversationController.mute](../../apps/api/src/messaging/messaging.module.ts#L391)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                              | `string`; `ParseUUIDPipe`                            |
| Body           | [MuteConversationDto](API_REQUEST_SCHEMAS.md#muteconversationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      mutedUntil: null | string /* ISO 8601 date-time */;
    };
```

<a id="patch-messages-id"></a>

### PATCH /messages/:id

[MessageController.edit](../../apps/api/src/messaging/messaging.module.ts#L403)

- **Access:** `AuthGuard`

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                    | `string`; `ParseUUIDPipe`                            |
| Body           | [SendMessageDto](API_REQUEST_SCHEMAS.md#sendmessagedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      conversationId: string;
      senderId: string;
      body: string;
      status: 'sent' | 'edited' | 'deleted';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-messages-id"></a>

### DELETE /messages/:id

[MessageController.remove](../../apps/api/src/messaging/messaging.module.ts#L410)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `id`          | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

## notifications

Notification inbox, unread count and marking notifications read.

| Method | Path                                                                              | Accepted data                                                                        | Success |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| GET    | [`/notifications`](#get-notifications)                                            | Query: [ListNotificationsQueryDto](API_REQUEST_SCHEMAS.md#listnotificationsquerydto) | 200     |
| GET    | [`/notifications/unread-count`](#get-notifications-unread-count)                  | No declared body/query                                                               | 200     |
| POST   | [`/notifications/read-all`](#post-notifications-read-all)                         | No declared body/query                                                               | 200     |
| POST   | [`/notifications/:notificationId/read`](#post-notifications-notificationid-read)  | No declared body/query                                                               | 200     |
| PATCH  | [`/notifications/:notificationId/read`](#patch-notifications-notificationid-read) | No declared body/query                                                               | 200     |

<a id="get-notifications"></a>

### GET /notifications

[NotificationController.list](../../apps/api/src/notifications/notification.controller.ts#L31)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListNotificationsQueryDto](API_REQUEST_SCHEMAS.md#listnotificationsquerydto) | All fields, defaults and validators in linked schema |

Version difference: /api/v1/notifications returns the paginated shape; /notifications returns the legacy inbox shape. The union below includes both.

**Success: 200.**

```ts
type ResponseBody =
  | {
      items: Array<{
        id: string;
        tenantId: string;
        recipientUserId: string;
        type: 'follow_up_reminder';
        severity: 'critical' | 'warning' | 'error' | 'info';
        followUpId: string;
        scheduledFor: string /* ISO 8601 date-time */;
        title: string;
        message: string;
        readAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
      }>;
      nextCursor: null | string;
    }
  | Array<{
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
    }>;
```

<a id="get-notifications-unread-count"></a>

### GET /notifications/unread-count

[NotificationController.unreadCount](../../apps/api/src/notifications/notification.controller.ts#L60)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  count: number;
};
```

<a id="post-notifications-read-all"></a>

### POST /notifications/read-all

[NotificationController.markAllRead](../../apps/api/src/notifications/notification.controller.ts#L65)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('notification.read_all')`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  updated: number;
};
```

<a id="post-notifications-notificationid-read"></a>

### POST /notifications/:notificationId/read

[NotificationController.markReadVersioned](../../apps/api/src/notifications/notification.controller.ts#L72)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('notification.read')`.

| Input location | Name / schema    | Type / constraints              |
| -------------- | ---------------- | ------------------------------- |
| Param          | `notificationId` | `string`; `new ParseUUIDPipe()` |

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

<a id="patch-notifications-notificationid-read"></a>

### PATCH /notifications/:notificationId/read

[NotificationController.markRead](../../apps/api/src/notifications/notification.controller.ts#L86)

- **Access:** `AuthGuard`

| Input location | Name / schema    | Type / constraints              |
| -------------- | ---------------- | ------------------------------- |
| Param          | `notificationId` | `string`; `new ParseUUIDPipe()` |

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

## objectives

Operational targets, progress, risk and updates.

| Method | Path                                                        | Accepted data                                                         | Success |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| GET    | [`/objectives`](#get-objectives)                            | Query: [ObjectiveListDto](API_REQUEST_SCHEMAS.md#objectivelistdto)    | 200     |
| GET    | [`/objectives/at-risk`](#get-objectives-at-risk)            | Query: [ObjectiveListDto](API_REQUEST_SCHEMAS.md#objectivelistdto)    | 200     |
| GET    | [`/objectives/:objectiveId`](#get-objectives-objectiveid)   | No declared body/query                                                | 200     |
| POST   | [`/objectives`](#post-objectives)                           | Body: [CreateObjectiveDto](API_REQUEST_SCHEMAS.md#createobjectivedto) | 201     |
| PATCH  | [`/objectives/:objectiveId`](#patch-objectives-objectiveid) | Body: [UpdateObjectiveDto](API_REQUEST_SCHEMAS.md#updateobjectivedto) | 200     |

<a id="get-objectives"></a>

### GET /objectives

[ObjectiveController.list](../../apps/api/src/objectives/objective.controller.ts#L58)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ObjectiveListDto](API_REQUEST_SCHEMAS.md#objectivelistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  items: Array<{
    etag: string;
    progress: {
      actual: number;
      target: number;
      remaining: number;
      progressPercent: number;
      elapsedPercent: number;
      expectedToDate: number;
      projectedAtEnd: null | number;
      status: string;
      model: string;
      explanation: string;
    };
    id: string;
    name: string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    tenantId: string;
    organizationId: string;
    teamId: null | string;
    metric:
      | 'completed_actions'
      | 'completed_visits'
      | 'qualified_prospects'
      | 'converted_prospects'
      | 'completed_follow_ups';
    campaignId: null | string;
    ownerId: string;
    target: number;
    startsAt: string /* ISO 8601 date-time */;
    endsAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-objectives-at-risk"></a>

### GET /objectives/at-risk

[ObjectiveController.risks](../../apps/api/src/objectives/objective.controller.ts#L61)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ObjectiveListDto](API_REQUEST_SCHEMAS.md#objectivelistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  available: boolean;
  generatedAt: string;
  total: number;
  items: Array<{
    etag: string;
    progress: {
      actual: number;
      target: number;
      remaining: number;
      progressPercent: number;
      elapsedPercent: number;
      expectedToDate: number;
      projectedAtEnd: null | number;
      status: string;
      model: string;
      explanation: string;
    };
    id: string;
    name: string;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
    tenantId: string;
    organizationId: string;
    teamId: null | string;
    metric:
      | 'completed_actions'
      | 'completed_visits'
      | 'qualified_prospects'
      | 'converted_prospects'
      | 'completed_follow_ups';
    campaignId: null | string;
    ownerId: string;
    target: number;
    startsAt: string /* ISO 8601 date-time */;
    endsAt: string /* ISO 8601 date-time */;
  }>;
  truncated: boolean;
};
```

<a id="get-objectives-objectiveid"></a>

### GET /objectives/:objectiveId

[ObjectiveController.detail](../../apps/api/src/objectives/objective.controller.ts#L68)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `objectiveId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  history: Array<{
    id: string;
    tenantId: string;
    objectiveId: string;
    actorId: string;
    definition: {
      [key: string]: unknown;
    };
    createdAt: string /* ISO 8601 date-time */;
  }>;
  progressHistory: Array<{
    cumulative: number;
    date: string;
    count: number;
  }>;
  contributingMetrics: {
    metric:
      | 'completed_actions'
      | 'completed_visits'
      | 'qualified_prospects'
      | 'converted_prospects'
      | 'completed_follow_ups';
    period: string;
    deduplication: string;
    historyTimeZone: string;
  };
  etag: string;
  progress: {
    actual: number;
    target: number;
    remaining: number;
    progressPercent: number;
    elapsedPercent: number;
    expectedToDate: number;
    projectedAtEnd: null | number;
    status: string;
    model: string;
    explanation: string;
  };
  id: string;
  name: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  organizationId: string;
  teamId: null | string;
  metric:
    | 'completed_actions'
    | 'completed_visits'
    | 'qualified_prospects'
    | 'converted_prospects'
    | 'completed_follow_ups';
  campaignId: null | string;
  ownerId: string;
  target: number;
  startsAt: string /* ISO 8601 date-time */;
  endsAt: string /* ISO 8601 date-time */;
};
```

<a id="post-objectives"></a>

### POST /objectives

[ObjectiveController.create](../../apps/api/src/objectives/objective.controller.ts#L74)

- **Access:** `AuthGuard`, `ObjectiveWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('objective.create')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateObjectiveDto](API_REQUEST_SCHEMAS.md#createobjectivedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  id?: undefined | string;
  name?: undefined | string;
  createdAt?: undefined | string /* ISO 8601 date-time */;
  updatedAt?: undefined | string /* ISO 8601 date-time */;
  tenantId?: undefined | string;
  organizationId?: undefined | string;
  teamId?: undefined | null | string;
  metric?:
    | undefined
    | 'completed_actions'
    | 'completed_visits'
    | 'qualified_prospects'
    | 'converted_prospects'
    | 'completed_follow_ups';
  campaignId?: undefined | null | string;
  ownerId?: undefined | string;
  target?: undefined | number;
  startsAt?: undefined | string /* ISO 8601 date-time */;
  endsAt?: undefined | string /* ISO 8601 date-time */;
};
```

<a id="patch-objectives-objectiveid"></a>

### PATCH /objectives/:objectiveId

[ObjectiveController.update](../../apps/api/src/objectives/objective.controller.ts#L80)

- **Access:** `AuthGuard`, `ObjectiveWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('objective.update')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `objectiveId`                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateObjectiveDto](API_REQUEST_SCHEMAS.md#updateobjectivedto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                      | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id?: undefined | string;
  tenantId?: undefined | string;
  organizationId?: undefined | string;
  teamId?: undefined | null | string;
  campaignId?: undefined | null | string;
  ownerId?: undefined | string;
  name?: undefined | string;
  metric?:
    | undefined
    | 'completed_actions'
    | 'completed_visits'
    | 'qualified_prospects'
    | 'converted_prospects'
    | 'completed_follow_ups';
  target?: undefined | number;
  startsAt?: undefined | string /* ISO 8601 date-time */;
  endsAt?: undefined | string /* ISO 8601 date-time */;
  createdAt?: undefined | string /* ISO 8601 date-time */;
  updatedAt?: undefined | string /* ISO 8601 date-time */;
};
```

## organization-structure

Organization relationships and dated team memberships.

| Method | Path                                                                                | Accepted data                                                                                                                       | Success |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| GET    | [`/organization-relationships`](#get-organization-relationships)                    | Query: [ListRelationshipsDto](API_REQUEST_SCHEMAS.md#listrelationshipsdto)                                                          | 200     |
| POST   | [`/organization-relationships`](#post-organization-relationships)                   | Body: [CreateRelationshipDto](API_REQUEST_SCHEMAS.md#createrelationshipdto)                                                         | 201     |
| DELETE | [`/organization-relationships/:id`](#delete-organization-relationships-id)          | No declared body/query                                                                                                              | 204     |
| GET    | [`/teams/:teamId/members`](#get-teams-teamid-members)                               | Query: [ListRosterDto](API_REQUEST_SCHEMAS.md#listrosterdto)                                                                        | 200     |
| POST   | [`/teams/:teamId/members`](#post-teams-teamid-members)                              | Body: [CreateRosterDto](API_REQUEST_SCHEMAS.md#createrosterdto)                                                                     | 201     |
| PATCH  | [`/teams/:teamId/members/:membershipId`](#patch-teams-teamid-members-membershipid)  | Query: [RosterTargetDto](API_REQUEST_SCHEMAS.md#rostertargetdto)<br>Body: [UpdateRosterDto](API_REQUEST_SCHEMAS.md#updaterosterdto) | 200     |
| DELETE | [`/teams/:teamId/members/:membershipId`](#delete-teams-teamid-members-membershipid) | Query: [RosterTargetDto](API_REQUEST_SCHEMAS.md#rostertargetdto)                                                                    | 204     |

<a id="get-organization-relationships"></a>

### GET /organization-relationships

[OrganizationRelationshipController.list](../../apps/api/src/organization-structure/structure.controller.ts#L37)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListRelationshipsDto](API_REQUEST_SCHEMAS.md#listrelationshipsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    parentOrganizationId: string;
    childOrganizationId: string;
    relationshipType: 'brand' | 'parent' | 'partner' | 'coordination';
    createdAt: string /* ISO 8601 date-time */;
    endedAt: null | string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-organization-relationships"></a>

### POST /organization-relationships

[OrganizationRelationshipController.create](../../apps/api/src/organization-structure/structure.controller.ts#L40)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('organization_relationship.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateRelationshipDto](API_REQUEST_SCHEMAS.md#createrelationshipdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  tenantId: string;
  endedAt: null | string /* ISO 8601 date-time */;
  parentOrganizationId: string;
  childOrganizationId: string;
  relationshipType: 'brand' | 'parent' | 'partner' | 'coordination';
};
```

<a id="delete-organization-relationships-id"></a>

### DELETE /organization-relationships/:id

[OrganizationRelationshipController.end](../../apps/api/src/organization-structure/structure.controller.ts#L46)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('organization_relationship.end')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `id`          | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="get-teams-teamid-members"></a>

### GET /teams/:teamId/members

[TeamRosterController.list](../../apps/api/src/organization-structure/structure.controller.ts#L63)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `teamId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListRosterDto](API_REQUEST_SCHEMAS.md#listrosterdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    state: string;
    etag: string;
    id: string;
    tenantId: string;
    teamId: string;
    membershipId: string;
    teamRole: 'manager' | 'member';
    startsAt: string /* ISO 8601 date-time */;
    endsAt: null | string /* ISO 8601 date-time */;
    revokedAt: null | string /* ISO 8601 date-time */;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-teams-teamid-members"></a>

### POST /teams/:teamId/members

[TeamRosterController.create](../../apps/api/src/organization-structure/structure.controller.ts#L70)

- **Access:** `AuthGuard`, `RosterGuard`
- **Idempotency-Key:** required; `@Idempotent('team_roster.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `teamId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateRosterDto](API_REQUEST_SCHEMAS.md#createrosterdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  membershipId: string;
  revokedAt: null | string /* ISO 8601 date-time */;
  teamId: string;
  startsAt: string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  teamRole: 'manager' | 'member';
};
```

<a id="patch-teams-teamid-members-membershipid"></a>

### PATCH /teams/:teamId/members/:membershipId

[TeamRosterController.update](../../apps/api/src/organization-structure/structure.controller.ts#L80)

- **Access:** `AuthGuard`, `RosterGuard`
- **Idempotency-Key:** required; `@Idempotent('team_roster.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `teamId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `membershipId`                                            | `string`; `new ParseUUIDPipe()`                      |
| Query          | [RosterTargetDto](API_REQUEST_SCHEMAS.md#rostertargetdto) | All fields, defaults and validators in linked schema |
| Body           | [UpdateRosterDto](API_REQUEST_SCHEMAS.md#updaterosterdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  membershipId: string;
  revokedAt: null | string /* ISO 8601 date-time */;
  teamId: string;
  startsAt: string /* ISO 8601 date-time */;
  endsAt: null | string /* ISO 8601 date-time */;
  teamRole: 'manager' | 'member';
};
```

<a id="delete-teams-teamid-members-membershipid"></a>

### DELETE /teams/:teamId/members/:membershipId

[TeamRosterController.end](../../apps/api/src/organization-structure/structure.controller.ts#L93)

- **Access:** `AuthGuard`, `RosterGuard`
- **Idempotency-Key:** required; `@Idempotent('team_roster.end')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `teamId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Param          | `membershipId`                                            | `string`; `new ParseUUIDPipe()`                      |
| Query          | [RosterTargetDto](API_REQUEST_SCHEMAS.md#rostertargetdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                | `undefined \| string`; optional parameter            |

**Success: 204.**

No response body.

## outcome-settings

Configure action outcome/status policy.

| Method | Path                                                             | Accepted data                                           | Success |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| GET    | [`/settings/default-statuses`](#get-settings-default-statuses)   | No declared body/query                                  | 200     |
| PATCH  | [`/settings/default-statuses`](#patch-settings-default-statuses) | Body: [SettingsDto](API_REQUEST_SCHEMAS.md#settingsdto) | 200     |

<a id="get-settings-default-statuses"></a>

### GET /settings/default-statuses

[OutcomeSettingsController.read](../../apps/api/src/outcome-settings/outcome-settings.controller.ts#L71)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody =
  | {
      etag: string;
      lifecycleStages: Array<string>;
      tenantId: string;
      outcomes: Array<{
        code: string;
        label: string;
        behavior: string;
        enabled: boolean;
        actionTypes: Array<string>;
      }>;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      etag: string;
      lifecycleStages: Array<string>;
      tenantId: string;
      outcomes: Array<{
        code: string;
        label: string;
        behavior: string;
        enabled: boolean;
        actionTypes: Array<string>;
      }>;
      updatedAt: null;
    };
```

<a id="patch-settings-default-statuses"></a>

### PATCH /settings/default-statuses

[OutcomeSettingsController.update](../../apps/api/src/outcome-settings/outcome-settings.controller.ts#L74)

- **Access:** `AuthGuard`, `SettingsGuard`
- **Idempotency-Key:** required; `@Idempotent('outcome_settings.update')`.

| Input location | Name / schema                                     | Type / constraints                                   |
| -------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Body           | [SettingsDto](API_REQUEST_SCHEMAS.md#settingsdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                        | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  updatedAt?: undefined | string /* ISO 8601 date-time */;
  tenantId?: undefined | string;
  outcomes?:
    | undefined
    | Array<{
        code: string;
        label: string;
        behavior: string;
        enabled: boolean;
        actionTypes: Array<string>;
      }>;
};
```

## participation

Campaign roster and territory assignments.

| Method | Path                                                                   | Accepted data                                                                             | Success |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| GET    | [`/territory-assignments`](#get-territory-assignments)                 | Query: [ListParticipationDto](API_REQUEST_SCHEMAS.md#listparticipationdto)                | 200     |
| POST   | [`/territory-assignments`](#post-territory-assignments)                | Body: [CreateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#createterritoryassignmentdto) | 201     |
| PATCH  | [`/territory-assignments/:id`](#patch-territory-assignments-id)        | Body: [UpdateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#updateterritoryassignmentdto) | 200     |
| DELETE | [`/territory-assignments/:id`](#delete-territory-assignments-id)       | No declared body/query                                                                    | 204     |
| GET    | [`/campaigns/:campaignId/members`](#get-campaigns-campaignid-members)  | Query: [ListParticipationDto](API_REQUEST_SCHEMAS.md#listparticipationdto)                | 200     |
| POST   | [`/campaigns/:campaignId/members`](#post-campaigns-campaignid-members) | Body: [CreateCampaignMemberDto](API_REQUEST_SCHEMAS.md#createcampaignmemberdto)           | 201     |
| PATCH  | [`/campaign-members/:id`](#patch-campaign-members-id)                  | Body: [UpdateCampaignMemberDto](API_REQUEST_SCHEMAS.md#updatecampaignmemberdto)           | 200     |
| DELETE | [`/campaign-members/:id`](#delete-campaign-members-id)                 | No declared body/query                                                                    | 204     |

<a id="get-territory-assignments"></a>

### GET /territory-assignments

[TerritoryAssignmentController.list](../../apps/api/src/participation/participation.controller.ts#L35)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListParticipationDto](API_REQUEST_SCHEMAS.md#listparticipationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<
    | {
        state: string;
        etag: string;
        campaignId: string;
        campaignRole: 'observer' | 'member' | 'coordinator';
        id: string;
        tenantId: string;
        membershipId: null | string;
        teamId: null | string;
        startsAt: string /* ISO 8601 date-time */;
        endsAt: null | string /* ISO 8601 date-time */;
        revokedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }
    | {
        state: string;
        etag: string;
        territoryId: string;
        priority: number;
        id: string;
        tenantId: string;
        membershipId: null | string;
        teamId: null | string;
        startsAt: string /* ISO 8601 date-time */;
        endsAt: null | string /* ISO 8601 date-time */;
        revokedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }
  >;
  nextCursor: null | string;
};
```

<a id="post-territory-assignments"></a>

### POST /territory-assignments

[TerritoryAssignmentController.create](../../apps/api/src/participation/participation.controller.ts#L38)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('territory_assignment.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                       | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#createterritoryassignmentdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      priority: number;
      territoryId: string;
    }
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      campaignId: string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      campaignRole: 'observer' | 'member' | 'coordinator';
    };
```

<a id="patch-territory-assignments-id"></a>

### PATCH /territory-assignments/:id

[TerritoryAssignmentController.update](../../apps/api/src/participation/participation.controller.ts#L45)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('territory_assignment.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                       | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateTerritoryAssignmentDto](API_REQUEST_SCHEMAS.md#updateterritoryassignmentdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                          | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      priority: number;
      territoryId: string;
    }
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      campaignId: string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      campaignRole: 'observer' | 'member' | 'coordinator';
    };
```

<a id="delete-territory-assignments-id"></a>

### DELETE /territory-assignments/:id

[TerritoryAssignmentController.end](../../apps/api/src/participation/participation.controller.ts#L57)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('territory_assignment.end')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `id`          | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="get-campaigns-campaignid-members"></a>

### GET /campaigns/:campaignId/members

[CampaignRosterController.list](../../apps/api/src/participation/participation.controller.ts#L75)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                        | `string`; `new ParseUUIDPipe()`                      |
| Query          | [ListParticipationDto](API_REQUEST_SCHEMAS.md#listparticipationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<
    | {
        state: string;
        etag: string;
        campaignId: string;
        campaignRole: 'observer' | 'member' | 'coordinator';
        id: string;
        tenantId: string;
        membershipId: null | string;
        teamId: null | string;
        startsAt: string /* ISO 8601 date-time */;
        endsAt: null | string /* ISO 8601 date-time */;
        revokedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }
    | {
        state: string;
        etag: string;
        territoryId: string;
        priority: number;
        id: string;
        tenantId: string;
        membershipId: null | string;
        teamId: null | string;
        startsAt: string /* ISO 8601 date-time */;
        endsAt: null | string /* ISO 8601 date-time */;
        revokedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }
  >;
  nextCursor: null | string;
};
```

<a id="post-campaigns-campaignid-members"></a>

### POST /campaigns/:campaignId/members

[CampaignRosterController.create](../../apps/api/src/participation/participation.controller.ts#L82)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_member.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateCampaignMemberDto](API_REQUEST_SCHEMAS.md#createcampaignmemberdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      priority: number;
      territoryId: string;
    }
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      campaignId: string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      campaignRole: 'observer' | 'member' | 'coordinator';
    };
```

<a id="patch-campaign-members-id"></a>

### PATCH /campaign-members/:id

[CampaignMemberController.update](../../apps/api/src/participation/participation.controller.ts#L99)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_member.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `id`                                                                      | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateCampaignMemberDto](API_REQUEST_SCHEMAS.md#updatecampaignmemberdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      priority: number;
      territoryId: string;
    }
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      membershipId: null | string;
      revokedAt: null | string /* ISO 8601 date-time */;
      teamId: null | string;
      campaignId: string;
      startsAt: string /* ISO 8601 date-time */;
      endsAt: null | string /* ISO 8601 date-time */;
      campaignRole: 'observer' | 'member' | 'coordinator';
    };
```

<a id="delete-campaign-members-id"></a>

### DELETE /campaign-members/:id

[CampaignMemberController.end](../../apps/api/src/participation/participation.controller.ts#L111)

- **Access:** `AuthGuard`, `ParticipationGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign_member.end')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `id`          | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

## permissions

Permission catalogue, role permissions and role configuration.

| Method | Path                                                      | Accepted data                                                         | Success |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| GET    | [`/roles`](#get-roles)                                    | No declared body/query                                                | 200     |
| GET    | [`/roles/:role/permissions`](#get-roles-role-permissions) | No declared body/query                                                | 200     |
| PUT    | [`/roles/:role/permissions`](#put-roles-role-permissions) | Body: [RolePermissionsDto](API_REQUEST_SCHEMAS.md#rolepermissionsdto) | 200     |
| GET    | [`/permissions`](#get-permissions)                        | No declared body/query                                                | 200     |

<a id="get-roles"></a>

### GET /roles

[RoleController.list](../../apps/api/src/permissions/permission.controller.ts#L43)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

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

<a id="get-roles-role-permissions"></a>

### GET /roles/:role/permissions

[RoleController.get](../../apps/api/src/permissions/permission.controller.ts#L46)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Param          | [RoleParamDto](API_REQUEST_SCHEMAS.md#roleparamdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      role: 'super_admin';
      scope: string;
      configurable: boolean;
      permissions: Array<never>;
      message: string;
      configurablePermissions?: undefined;
      updatedAt?: undefined;
    }
  | {
      role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
      configurable: boolean;
      permissions: Array<
        | 'campaigns.read'
        | 'campaigns.manage'
        | 'territories.read'
        | 'territories.manage'
        | 'organizations.read'
        | 'organizations.manage'
        | 'prospects.read'
        | 'prospects.manage'
        | 'activities.read'
        | 'activities.manage'
        | 'follow_ups.read'
        | 'follow_ups.manage'
        | 'consents.read'
        | 'consents.manage'
        | 'routes.read'
        | 'routes.manage'
        | 'objectives.read'
        | 'objectives.manage'
        | 'reports.read'
        | 'imports.manage'
        | 'notifications.read'
        | 'notifications.manage'
        | 'reservations.manage'
        | 'allocation.manage'
        | 'scope.read'
        | 'memberships.manage'
        | 'scopes.manage'
        | 'permissions.configure'
        | 'access_history.read'
        | 'assignments.manage'
        | 'collisions.override'
        | 'exports.create'
        | 'teams.manage'
      >;
      configurablePermissions: Array<
        | 'campaigns.read'
        | 'campaigns.manage'
        | 'territories.read'
        | 'territories.manage'
        | 'organizations.read'
        | 'organizations.manage'
        | 'prospects.read'
        | 'prospects.manage'
        | 'activities.read'
        | 'activities.manage'
        | 'follow_ups.read'
        | 'follow_ups.manage'
        | 'consents.read'
        | 'consents.manage'
        | 'routes.read'
        | 'routes.manage'
        | 'objectives.read'
        | 'objectives.manage'
        | 'reports.read'
        | 'imports.manage'
        | 'notifications.read'
        | 'notifications.manage'
        | 'reservations.manage'
        | 'allocation.manage'
        | 'scope.read'
        | 'memberships.manage'
        | 'scopes.manage'
        | 'permissions.configure'
        | 'access_history.read'
        | 'assignments.manage'
        | 'collisions.override'
        | 'exports.create'
        | 'teams.manage'
      >;
      updatedAt: null | string /* ISO 8601 date-time */;
      scope?: undefined;
      message?: undefined;
    };
```

<a id="put-roles-role-permissions"></a>

### PUT /roles/:role/permissions

[RoleController.update](../../apps/api/src/permissions/permission.controller.ts#L82)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('role.update_permissions')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | [RoleParamDto](API_REQUEST_SCHEMAS.md#roleparamdto)             | All fields, defaults and validators in linked schema |
| Body           | [RolePermissionsDto](API_REQUEST_SCHEMAS.md#rolepermissionsdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                      | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | {
      role: 'super_admin';
      scope: string;
      configurable: boolean;
      permissions: Array<never>;
      message: string;
      configurablePermissions?: undefined;
      updatedAt?: undefined;
    }
  | {
      role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
      configurable: boolean;
      permissions: Array<
        | 'campaigns.read'
        | 'campaigns.manage'
        | 'territories.read'
        | 'territories.manage'
        | 'organizations.read'
        | 'organizations.manage'
        | 'prospects.read'
        | 'prospects.manage'
        | 'activities.read'
        | 'activities.manage'
        | 'follow_ups.read'
        | 'follow_ups.manage'
        | 'consents.read'
        | 'consents.manage'
        | 'routes.read'
        | 'routes.manage'
        | 'objectives.read'
        | 'objectives.manage'
        | 'reports.read'
        | 'imports.manage'
        | 'notifications.read'
        | 'notifications.manage'
        | 'reservations.manage'
        | 'allocation.manage'
        | 'scope.read'
        | 'memberships.manage'
        | 'scopes.manage'
        | 'permissions.configure'
        | 'access_history.read'
        | 'assignments.manage'
        | 'collisions.override'
        | 'exports.create'
        | 'teams.manage'
      >;
      configurablePermissions: Array<
        | 'campaigns.read'
        | 'campaigns.manage'
        | 'territories.read'
        | 'territories.manage'
        | 'organizations.read'
        | 'organizations.manage'
        | 'prospects.read'
        | 'prospects.manage'
        | 'activities.read'
        | 'activities.manage'
        | 'follow_ups.read'
        | 'follow_ups.manage'
        | 'consents.read'
        | 'consents.manage'
        | 'routes.read'
        | 'routes.manage'
        | 'objectives.read'
        | 'objectives.manage'
        | 'reports.read'
        | 'imports.manage'
        | 'notifications.read'
        | 'notifications.manage'
        | 'reservations.manage'
        | 'allocation.manage'
        | 'scope.read'
        | 'memberships.manage'
        | 'scopes.manage'
        | 'permissions.configure'
        | 'access_history.read'
        | 'assignments.manage'
        | 'collisions.override'
        | 'exports.create'
        | 'teams.manage'
      >;
      updatedAt: null | string /* ISO 8601 date-time */;
      scope?: undefined;
      message?: undefined;
    };
```

<a id="get-permissions"></a>

### GET /permissions

[PermissionCatalogueController.list](../../apps/api/src/permissions/permission.controller.ts#L140)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  items: [
    {
      permission:
        | 'campaigns.read'
        | 'campaigns.manage'
        | 'territories.read'
        | 'territories.manage'
        | 'organizations.read'
        | 'organizations.manage'
        | 'prospects.read'
        | 'prospects.manage'
        | 'activities.read'
        | 'activities.manage'
        | 'follow_ups.read'
        | 'follow_ups.manage'
        | 'consents.read'
        | 'consents.manage'
        | 'routes.read'
        | 'routes.manage'
        | 'objectives.read'
        | 'objectives.manage'
        | 'reports.read'
        | 'imports.manage'
        | 'notifications.read'
        | 'notifications.manage'
        | 'reservations.manage'
        | 'allocation.manage';
      description: string;
      configurable: true;
      roles: Array<'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor'>;
    },
    {
      permission: 'scope.read';
      description: 'Read resources within existing grants';
      configurable: false;
      roles: ['tenant_admin', 'director', 'manager', 'prospector', 'auditor'];
    },
    {
      permission: 'memberships.manage';
      description: 'Invite and manage workspace memberships';
      configurable: false;
      roles: ['tenant_admin'];
    },
    {
      permission: 'scopes.manage';
      description: 'Manage role and scope grants';
      configurable: false;
      roles: ['tenant_admin'];
    },
    {
      permission: 'permissions.configure';
      description: 'Configure supported role capabilities';
      configurable: false;
      roles: ['tenant_admin'];
    },
    {
      permission: 'access_history.read';
      description: 'Read membership access history';
      configurable: false;
      roles: ['tenant_admin'];
    },
    {
      permission: 'assignments.manage';
      description: 'Assign, reassign or unassign within management scope';
      configurable: true;
      roles: ['tenant_admin', 'director', 'manager'];
    },
    {
      permission: 'collisions.override';
      description: 'Approve immediate collision overrides within management scope';
      configurable: true;
      roles: ['tenant_admin', 'director', 'manager'];
    },
    {
      permission: 'exports.create';
      description: 'Generate controlled exports within management scope';
      configurable: true;
      roles: ['tenant_admin', 'director', 'manager'];
    },
    {
      permission: 'teams.manage';
      description: 'Update teams within management scope';
      configurable: true;
      roles: ['tenant_admin', 'director', 'manager'];
    },
  ];
};
```

## prospect-enrichment

Tags, custom fields, duplicate review, merging and data-quality overview.

| Method | Path                                                                                         | Accepted data                                                           | Success |
| ------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| GET    | [`/tags`](#get-tags)                                                                         | Query: [PageDto](API_REQUEST_SCHEMAS.md#pagedto)                        | 200     |
| POST   | [`/tags`](#post-tags)                                                                        | Body: [TagDto](API_REQUEST_SCHEMAS.md#tagdto)                           | 201     |
| PATCH  | [`/tags/:tagId`](#patch-tags-tagid)                                                          | Body: [UpdateTagDto](API_REQUEST_SCHEMAS.md#updatetagdto)               | 200     |
| DELETE | [`/tags/:tagId`](#delete-tags-tagid)                                                         | No declared body/query                                                  | 204     |
| GET    | [`/custom-fields`](#get-custom-fields)                                                       | Query: [PageDto](API_REQUEST_SCHEMAS.md#pagedto)                        | 200     |
| POST   | [`/custom-fields`](#post-custom-fields)                                                      | Body: [FieldDto](API_REQUEST_SCHEMAS.md#fielddto)                       | 201     |
| PATCH  | [`/custom-fields/:fieldId`](#patch-custom-fields-fieldid)                                    | Body: [UpdateFieldDto](API_REQUEST_SCHEMAS.md#updatefielddto)           | 200     |
| DELETE | [`/custom-fields/:fieldId`](#delete-custom-fields-fieldid)                                   | No declared body/query                                                  | 204     |
| POST   | [`/prospects/:prospectId/tags/:tagId`](#post-prospects-prospectid-tags-tagid)                | No declared body/query                                                  | 200     |
| DELETE | [`/prospects/:prospectId/tags/:tagId`](#delete-prospects-prospectid-tags-tagid)              | No declared body/query                                                  | 204     |
| PUT    | [`/prospects/:prospectId/custom-fields`](#put-prospects-prospectid-custom-fields)            | Body: [FieldValuesDto](API_REQUEST_SCHEMAS.md#fieldvaluesdto)           | 200     |
| GET    | [`/prospect-duplicates`](#get-prospect-duplicates)                                           | Query: [DuplicateQueryDto](API_REQUEST_SCHEMAS.md#duplicatequerydto)    | 200     |
| GET    | [`/prospect-duplicates/:duplicateId`](#get-prospect-duplicates-duplicateid)                  | No declared body/query                                                  | 200     |
| POST   | [`/prospect-duplicates/:duplicateId/resolve`](#post-prospect-duplicates-duplicateid-resolve) | Body: [ResolveDuplicateDto](API_REQUEST_SCHEMAS.md#resolveduplicatedto) | 200     |
| GET    | [`/data-quality/overview`](#get-data-quality-overview)                                       | No declared body/query                                                  | 200     |

<a id="get-tags"></a>

### GET /tags

[TagController.list](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L46)

- **Access:** `AuthGuard`

| Input location | Name / schema                             | Type / constraints                                   |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Query          | [PageDto](API_REQUEST_SCHEMAS.md#pagedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    name: string;
    color: null | string;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-tags"></a>

### POST /tags

[TagController.create](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L49)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('tag.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                           | Type / constraints                                   |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| Body           | [TagDto](API_REQUEST_SCHEMAS.md#tagdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      name: string;
      color: null | string;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="patch-tags-tagid"></a>

### PATCH /tags/:tagId

[TagController.update](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L56)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Param          | `tagId`                                             | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateTagDto](API_REQUEST_SCHEMAS.md#updatetagdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                          | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      name: string;
      color: null | string;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-tags-tagid"></a>

### DELETE /tags/:tagId

[TagController.remove](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L67)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `tagId`       | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="get-custom-fields"></a>

### GET /custom-fields

[CustomFieldController.list](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L82)

- **Access:** `AuthGuard`

| Input location | Name / schema                             | Type / constraints                                   |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Query          | [PageDto](API_REQUEST_SCHEMAS.md#pagedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    fieldKey: string;
    label: string;
    dataType: string;
    validation: {
      required?: undefined | boolean;
      min?: undefined | number;
      max?: undefined | number;
      options?: undefined | Array<string>;
    };
    visibility: {
      roles?: undefined | Array<string>;
    };
    isActive: boolean;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-custom-fields"></a>

### POST /custom-fields

[CustomFieldController.create](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L85)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('field.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                               | Type / constraints                                   |
| -------------- | ------------------------------------------- | ---------------------------------------------------- |
| Body           | [FieldDto](API_REQUEST_SCHEMAS.md#fielddto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      fieldKey: string;
      label: string;
      dataType: string;
      validation: {
        required?: undefined | boolean;
        min?: undefined | number;
        max?: undefined | number;
        options?: undefined | Array<string>;
      };
      visibility: {
        roles?: undefined | Array<string>;
      };
      isActive: boolean;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="patch-custom-fields-fieldid"></a>

### PATCH /custom-fields/:fieldId

[CustomFieldController.update](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L92)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `fieldId`                                               | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateFieldDto](API_REQUEST_SCHEMAS.md#updatefielddto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                              | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      fieldKey: string;
      label: string;
      dataType: string;
      validation: {
        required?: undefined | boolean;
        min?: undefined | number;
        max?: undefined | number;
        options?: undefined | Array<string>;
      };
      visibility: {
        roles?: undefined | Array<string>;
      };
      isActive: boolean;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-custom-fields-fieldid"></a>

### DELETE /custom-fields/:fieldId

[CustomFieldController.remove](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L103)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `fieldId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="post-prospects-prospectid-tags-tagid"></a>

### POST /prospects/:prospectId/tags/:tagId

[ProspectEnrichmentController.tag](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L118)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `tagId`       | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  prospectId: string;
  tagId: string;
};
```

<a id="delete-prospects-prospectid-tags-tagid"></a>

### DELETE /prospects/:prospectId/tags/:tagId

[ProspectEnrichmentController.untag](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L127)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `tagId`       | `string`; `new ParseUUIDPipe()` |

**Success: 204.**

No response body.

<a id="put-prospects-prospectid-custom-fields"></a>

### PUT /prospects/:prospectId/custom-fields

[ProspectEnrichmentController.values](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L136)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                            | `string`; `new ParseUUIDPipe()`                      |
| Body           | [FieldValuesDto](API_REQUEST_SCHEMAS.md#fieldvaluesdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: unknown;
  };
};
```

<a id="get-prospect-duplicates"></a>

### GET /prospect-duplicates

[DuplicateController.list](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L148)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [DuplicateQueryDto](API_REQUEST_SCHEMAS.md#duplicatequerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    leftProspectId: string;
    rightProspectId: string;
    matchingKeys: Array<string>;
    resolution: string;
    resolvedBy: null | string;
    resolvedAt: null | string /* ISO 8601 date-time */;
    createdAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-prospect-duplicates-duplicateid"></a>

### GET /prospect-duplicates/:duplicateId

[DuplicateController.get](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L151)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `duplicateId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  left: {
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
    status: 'active' | 'inactive' | 'archived';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  };
  right: {
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
    status: 'active' | 'inactive' | 'archived';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  leftProspectId: string;
  rightProspectId: string;
  matchingKeys: Array<string>;
  resolution: string;
  resolvedBy: null | string;
  resolvedAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
};
```

<a id="post-prospect-duplicates-duplicateid-resolve"></a>

### POST /prospect-duplicates/:duplicateId/resolve

[DuplicateController.resolve](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L157)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `duplicateId`                                                     | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ResolveDuplicateDto](API_REQUEST_SCHEMAS.md#resolveduplicatedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  left: {
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
    status: 'active' | 'inactive' | 'archived';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  };
  right: {
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
    status: 'active' | 'inactive' | 'archived';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  };
  id: string;
  tenantId: string;
  leftProspectId: string;
  rightProspectId: string;
  matchingKeys: Array<string>;
  resolution: string;
  resolvedBy: null | string;
  resolvedAt: null | string /* ISO 8601 date-time */;
  createdAt: string /* ISO 8601 date-time */;
};
```

<a id="get-data-quality-overview"></a>

### GET /data-quality/overview

[DataQualityController.overview](../../apps/api/src/prospect-enrichment/enrichment.controller.ts#L172)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      [key: string]: unknown;
    };
```

## prospect-master

Canonical prospect/establishment directory, addresses and contacts.

| Method | Path                                                                                            | Accepted data                                                                               | Success |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| GET    | [`/prospects`](#get-prospects)                                                                  | Query: [ListProspectsDto](API_REQUEST_SCHEMAS.md#listprospectsdto)                          | 200     |
| POST   | [`/prospects`](#post-prospects)                                                                 | Body: [CreateProspectDto](API_REQUEST_SCHEMAS.md#createprospectdto)                         | 201     |
| GET    | [`/prospects/:prospectId`](#get-prospects-prospectid)                                           | No declared body/query                                                                      | 200     |
| GET    | [`/prospects/:prospectId/campaign-memberships`](#get-prospects-prospectid-campaign-memberships) | No declared body/query                                                                      | 200     |
| PATCH  | [`/prospects/:prospectId`](#patch-prospects-prospectid)                                         | Body: [UpdateProspectDto](API_REQUEST_SCHEMAS.md#updateprospectdto)                         | 200     |
| DELETE | [`/prospects/:prospectId`](#delete-prospects-prospectid)                                        | No declared body/query                                                                      | 204     |
| POST   | [`/prospects/:prospectId/restore`](#post-prospects-prospectid-restore)                          | No declared body/query                                                                      | 200     |
| GET    | [`/prospects/:prospectId/addresses`](#get-prospects-prospectid-addresses)                       | Query: [PageDto](API_REQUEST_SCHEMAS.md#pagedto)                                            | 200     |
| POST   | [`/prospects/:prospectId/addresses`](#post-prospects-prospectid-addresses)                      | Body: [AddressDto](API_REQUEST_SCHEMAS.md#addressdto)                                       | 201     |
| GET    | [`/prospects/:prospectId/contacts`](#get-prospects-prospectid-contacts)                         | Query: [PageDto](API_REQUEST_SCHEMAS.md#pagedto)                                            | 200     |
| POST   | [`/prospects/:prospectId/contacts`](#post-prospects-prospectid-contacts)                        | Body: [CreateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#createestablishmentcontactdto) | 201     |
| PATCH  | [`/prospect-addresses/:addressId`](#patch-prospect-addresses-addressid)                         | Body: [UpdateAddressDto](API_REQUEST_SCHEMAS.md#updateaddressdto)                           | 200     |
| DELETE | [`/prospect-addresses/:addressId`](#delete-prospect-addresses-addressid)                        | No declared body/query                                                                      | 204     |
| PATCH  | [`/prospect-contacts/:contactId`](#patch-prospect-contacts-contactid)                           | Body: [UpdateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#updateestablishmentcontactdto) | 200     |
| DELETE | [`/prospect-contacts/:contactId`](#delete-prospect-contacts-contactid)                          | No declared body/query                                                                      | 204     |

<a id="get-prospects"></a>

### GET /prospects

[ProspectMasterController.list](../../apps/api/src/prospect-master/prospect-master.controller.ts#L70)

- **Access:** `AuthGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListProspectsDto](API_REQUEST_SCHEMAS.md#listprospectsdto) | All fields, defaults and validators in linked schema |

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
    status: 'active' | 'inactive' | 'archived';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-prospects"></a>

### POST /prospects

[ProspectMasterController.create](../../apps/api/src/prospect-master/prospect-master.controller.ts#L73)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('prospect.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateProspectDto](API_REQUEST_SCHEMAS.md#createprospectdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: unknown;
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
  status: 'active' | 'inactive' | 'archived';
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
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-prospects-prospectid"></a>

### GET /prospects/:prospectId

[ProspectMasterController.get](../../apps/api/src/prospect-master/prospect-master.controller.ts#L80)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: unknown;
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
  status: 'active' | 'inactive' | 'archived';
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
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-prospects-prospectid-campaign-memberships"></a>

### GET /prospects/:prospectId/campaign-memberships

[ProspectMasterController.campaignMemberships](../../apps/api/src/prospect-master/prospect-master.controller.ts#L97)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

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
      includedAt: string | string /* ISO 8601 date-time */;
      updatedAt: string | string /* ISO 8601 date-time */;
    };
    assignment: null | {
      id: string;
      status: string;
      priority: string;
      assignedAt: string | string /* ISO 8601 date-time */;
      teamId: string;
      teamName: null | string;
      assignedUserId: null | string;
      assignedUserName: null | string;
    };
    latestActivity: null | {
      id: string;
      type: string;
      occurredAt: string /* ISO 8601 date-time */;
    };
    nextFollowUp: null | {
      id: string;
      dueAt: string /* ISO 8601 date-time */;
      category: string;
      status: string;
    };
  }>;
};
```

<a id="patch-prospects-prospectid"></a>

### PATCH /prospects/:prospectId

[ProspectMasterController.update](../../apps/api/src/prospect-master/prospect-master.controller.ts#L104)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateProspectDto](API_REQUEST_SCHEMAS.md#updateprospectdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                    | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: unknown;
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
  status: 'active' | 'inactive' | 'archived';
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
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="delete-prospects-prospectid"></a>

### DELETE /prospects/:prospectId

[ProspectMasterController.archive](../../apps/api/src/prospect-master/prospect-master.controller.ts#L115)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="post-prospects-prospectid-restore"></a>

### POST /prospects/:prospectId/restore

[ProspectMasterController.restore](../../apps/api/src/prospect-master/prospect-master.controller.ts#L125)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  tags: Array<{
    id: string;
    name: string;
    color: null | string;
  }>;
  customFields: {
    [key: string]: unknown;
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
  status: 'active' | 'inactive' | 'archived';
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
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-prospects-prospectid-addresses"></a>

### GET /prospects/:prospectId/addresses

[ProspectMasterController.addresses](../../apps/api/src/prospect-master/prospect-master.controller.ts#L136)

- **Access:** `AuthGuard`

| Input location | Name / schema                             | Type / constraints                                   |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                              | `string`; `new ParseUUIDPipe()`                      |
| Query          | [PageDto](API_REQUEST_SCHEMAS.md#pagedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items:
    | Array<{
        id: string;
        tenantId: string;
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
        deletedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>
    | Array<{
        id: string;
        tenantId: string;
        establishmentId: string;
        name: null | string;
        jobTitle: null | string;
        email: null | string;
        phone: null | string;
        isPrimary: boolean;
        status: 'active' | 'inactive' | 'archived';
        source: 'manual' | 'import' | 'api';
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>;
  nextCursor: null | string;
};
```

<a id="post-prospects-prospectid-addresses"></a>

### POST /prospects/:prospectId/addresses

[ProspectMasterController.address](../../apps/api/src/prospect-master/prospect-master.controller.ts#L143)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('prospect_address.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                    | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AddressDto](API_REQUEST_SCHEMAS.md#addressdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
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
      deletedAt: null | string /* ISO 8601 date-time */;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="get-prospects-prospectid-contacts"></a>

### GET /prospects/:prospectId/contacts

[ProspectMasterController.contacts](../../apps/api/src/prospect-master/prospect-master.controller.ts#L154)

- **Access:** `AuthGuard`

| Input location | Name / schema                             | Type / constraints                                   |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                              | `string`; `new ParseUUIDPipe()`                      |
| Query          | [PageDto](API_REQUEST_SCHEMAS.md#pagedto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items:
    | Array<{
        id: string;
        tenantId: string;
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
        deletedAt: null | string /* ISO 8601 date-time */;
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>
    | Array<{
        id: string;
        tenantId: string;
        establishmentId: string;
        name: null | string;
        jobTitle: null | string;
        email: null | string;
        phone: null | string;
        isPrimary: boolean;
        status: 'active' | 'inactive' | 'archived';
        source: 'manual' | 'import' | 'api';
        createdAt: string /* ISO 8601 date-time */;
        updatedAt: string /* ISO 8601 date-time */;
      }>;
  nextCursor: null | string;
};
```

<a id="post-prospects-prospectid-contacts"></a>

### POST /prospects/:prospectId/contacts

[ProspectMasterController.contact](../../apps/api/src/prospect-master/prospect-master.controller.ts#L161)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('prospect_contact.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `prospectId`                                                                          | `string`; `new ParseUUIDPipe()`                      |
| Body           | [CreateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#createestablishmentcontactdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      establishmentId: string;
      name: null | string;
      jobTitle: null | string;
      email: null | string;
      phone: null | string;
      isPrimary: boolean;
      status: 'active' | 'inactive' | 'archived';
      source: 'manual' | 'import' | 'api';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="patch-prospect-addresses-addressid"></a>

### PATCH /prospect-addresses/:addressId

[ProspectAddressController.update](../../apps/api/src/prospect-master/prospect-master.controller.ts#L177)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `addressId`                                                 | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateAddressDto](API_REQUEST_SCHEMAS.md#updateaddressdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                  | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
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
      deletedAt: null | string /* ISO 8601 date-time */;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-prospect-addresses-addressid"></a>

### DELETE /prospect-addresses/:addressId

[ProspectAddressController.remove](../../apps/api/src/prospect-master/prospect-master.controller.ts#L187)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `addressId`   | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="patch-prospect-contacts-contactid"></a>

### PATCH /prospect-contacts/:contactId

[ProspectContactController.update](../../apps/api/src/prospect-master/prospect-master.controller.ts#L201)

- **Access:** `AuthGuard`, `ProspectWriteGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                         | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `contactId`                                                                           | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateEstablishmentContactDto](API_REQUEST_SCHEMAS.md#updateestablishmentcontactdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                            | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      establishmentId: string;
      name: null | string;
      jobTitle: null | string;
      email: null | string;
      phone: null | string;
      isPrimary: boolean;
      status: 'active' | 'inactive' | 'archived';
      source: 'manual' | 'import' | 'api';
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-prospect-contacts-contactid"></a>

### DELETE /prospect-contacts/:contactId

[ProspectContactController.remove](../../apps/api/src/prospect-master/prospect-master.controller.ts#L211)

- **Access:** `AuthGuard`, `ProspectWriteGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `contactId`   | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

## prospector-today

Today’s prioritized work, overdue items, meetings and summary counts.

| Method | Path                                         | Accepted data                                                                    | Success |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| GET    | [`/prospector/today`](#get-prospector-today) | Query: [ProspectorTodayQueryDto](API_REQUEST_SCHEMAS.md#prospectortodayquerydto) | 200     |

<a id="get-prospector-today"></a>

### GET /prospector/today

[ProspectorTodayController.getToday](../../apps/api/src/prospector-today/prospector-today.controller.ts#L15)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ProspectorTodayQueryDto](API_REQUEST_SCHEMAS.md#prospectortodayquerydto) | All fields, defaults and validators in linked schema |

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
    channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
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

## regions

Hierarchical geographic regions.

| Method | Path                                                            | Accepted data                                                   | Success |
| ------ | --------------------------------------------------------------- | --------------------------------------------------------------- | ------- |
| POST   | [`/regions`](#post-regions)                                     | Body: [CreateRegionDto](API_REQUEST_SCHEMAS.md#createregiondto) | 201     |
| GET    | [`/regions`](#get-regions)                                      | No declared body/query                                          | 200     |
| GET    | [`/regions/:regionId`](#get-regions-regionid)                   | No declared body/query                                          | 200     |
| GET    | [`/regions/:regionId/children`](#get-regions-regionid-children) | No declared body/query                                          | 200     |
| PATCH  | [`/regions/:regionId`](#patch-regions-regionid)                 | Body: [UpdateRegionDto](API_REQUEST_SCHEMAS.md#updateregiondto) | 200     |

<a id="post-regions"></a>

### POST /regions

[RegionController.create](../../apps/api/src/regions/region.controller.ts#L30)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('region.create')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateRegionDto](API_REQUEST_SCHEMAS.md#createregiondto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  code: null | string;
  tenantId: string;
  type: 'country' | 'administrative' | 'city' | 'sales_territory';
  parentRegionId: null | string;
};
```

<a id="get-regions"></a>

### GET /regions

[RegionController.list](../../apps/api/src/regions/region.controller.ts#L48)

- **Access:** `AuthGuard`, `ClientAdminGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  code: null | string;
  tenantId: string;
  type: 'country' | 'administrative' | 'city' | 'sales_territory';
  parentRegionId: null | string;
}>;
```

<a id="get-regions-regionid"></a>

### GET /regions/:regionId

[RegionController.findById](../../apps/api/src/regions/region.controller.ts#L56)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `regionId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  code: null | string;
  tenantId: string;
  type: 'country' | 'administrative' | 'city' | 'sales_territory';
  parentRegionId: null | string;
};
```

<a id="get-regions-regionid-children"></a>

### GET /regions/:regionId/children

[RegionController.listChildren](../../apps/api/src/regions/region.controller.ts#L67)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `regionId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  code: null | string;
  tenantId: string;
  type: 'country' | 'administrative' | 'city' | 'sales_territory';
  parentRegionId: null | string;
}>;
```

<a id="patch-regions-regionid"></a>

### PATCH /regions/:regionId

[RegionController.update](../../apps/api/src/regions/region.controller.ts#L78)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('region.update')`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `regionId`                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateRegionDto](API_REQUEST_SCHEMAS.md#updateregiondto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  code: null | string;
  tenantId: string;
  type: 'country' | 'administrative' | 'city' | 'sales_territory';
  parentRegionId: null | string;
};
```

## reporting

Manager/director/admin dashboards and operational report endpoints.

| Method | Path                                                                         | Accepted data                                                                      | Success |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| GET    | [`/manager/dashboard`](#get-manager-dashboard)                               | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/report-definitions`](#get-report-definitions)                             | No declared body/query                                                             | 200     |
| GET    | [`/reports/:reportId([0-9a-fA-F-]{36})`](#get-reports-reportid-0-9a-fa-f-36) | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/overview`](#get-reports-overview)                                 | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/workload`](#get-reports-workload)                                 | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/actions`](#get-reports-actions)                                   | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/funnel`](#get-reports-funnel)                                     | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/conversions`](#get-reports-conversions)                           | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/follow-ups`](#get-reports-follow-ups)                             | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/coverage`](#get-reports-coverage)                                 | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/collisions`](#get-reports-collisions)                             | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/data-quality`](#get-reports-data-quality)                         | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/territories`](#get-reports-territories)                           | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/reports/forecast`](#get-reports-forecast)                                 | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/dashboard/today`](#get-dashboard-today)                                   | Query: [ProspectorTodayQueryDto](API_REQUEST_SCHEMAS.md#prospectortodayquerydto)   | 200     |
| GET    | [`/dashboard/manager`](#get-dashboard-manager)                               | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/dashboard/director`](#get-dashboard-director)                             | Query: [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | 200     |
| GET    | [`/dashboard/admin`](#get-dashboard-admin)                                   | No declared body/query                                                             | 200     |

<a id="get-manager-dashboard"></a>

### GET /manager/dashboard

[ManagerDashboardController.getDashboard](../../apps/api/src/reporting/manager-dashboard.controller.ts#L15)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

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

<a id="get-report-definitions"></a>

### GET /report-definitions

[ReportController.definitions](../../apps/api/src/reporting/report.controller.ts#L24)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id:
      | 'actions'
      | 'overview'
      | 'workload'
      | 'funnel'
      | 'conversions'
      | 'follow-ups'
      | 'coverage'
      | 'collisions'
      | 'data-quality'
      | 'territories'
      | 'forecast';
    key:
      | 'actions'
      | 'overview'
      | 'workload'
      | 'funnel'
      | 'conversions'
      | 'follow-ups'
      | 'coverage'
      | 'collisions'
      | 'data-quality'
      | 'territories'
      | 'forecast';
    version: number;
    supportedFilters: Array<string>;
  }>;
};
```

<a id="get-reports-reportid-0-9a-fa-f-36"></a>

### GET /reports/:reportId([0-9a-fA-F-]{36})

[ReportController.report](../../apps/api/src/reporting/report.controller.ts#L33)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `reportId`                                                                  | `string`; `ParseUUIDPipe`                            |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

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

<a id="get-reports-overview"></a>

### GET /reports/overview

[ReportController.overview](../../apps/api/src/reporting/report.controller.ts#L41)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-workload"></a>

### GET /reports/workload

[ReportController.workload](../../apps/api/src/reporting/report.controller.ts#L48)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-actions"></a>

### GET /reports/actions

[ReportController.actions](../../apps/api/src/reporting/report.controller.ts#L55)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-funnel"></a>

### GET /reports/funnel

[ReportController.funnel](../../apps/api/src/reporting/report.controller.ts#L62)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-conversions"></a>

### GET /reports/conversions

[ReportController.conversions](../../apps/api/src/reporting/report.controller.ts#L69)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-follow-ups"></a>

### GET /reports/follow-ups

[ReportController.followups](../../apps/api/src/reporting/report.controller.ts#L76)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-coverage"></a>

### GET /reports/coverage

[ReportController.coverage](../../apps/api/src/reporting/report.controller.ts#L83)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-collisions"></a>

### GET /reports/collisions

[ReportController.collisions](../../apps/api/src/reporting/report.controller.ts#L90)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-data-quality"></a>

### GET /reports/data-quality

[ReportController.quality](../../apps/api/src/reporting/report.controller.ts#L97)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-territories"></a>

### GET /reports/territories

[ReportController.territories](../../apps/api/src/reporting/report.controller.ts#L104)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-reports-forecast"></a>

### GET /reports/forecast

[ReportController.forecast](../../apps/api/src/reporting/report.controller.ts#L111)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
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
      report: 'overview';
      definitionVersion: number;
      data?: undefined;
    }
  | {
      report:
        | 'actions'
        | 'workload'
        | 'funnel'
        | 'conversions'
        | 'follow-ups'
        | 'coverage'
        | 'collisions'
        | 'data-quality'
        | 'territories'
        | 'forecast';
      definitionVersion: number;
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
        organizationId?: undefined | string;
        teamId?: undefined | string;
        userId?: undefined | string;
        campaignId?: undefined | string;
      };
      data:
        | {
            teamOwned: number;
            byProspector: Array<{
              userId: string;
              assigned: number;
              paused: number;
            }>;
          }
        | {
            total: number;
            byType: {
              [key: string]: number;
            };
            byOutcome: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            stages: Array<{
              stage:
                | 'to_contact'
                | 'contact_made'
                | 'in_progress'
                | 'follow_up'
                | 'qualified'
                | 'converted';
              total: number;
              share: number;
            }>;
          }
        | {
            total: number;
            contacted: number;
            qualified: number;
            converted: number;
            contactRate: null | number;
            qualificationRate: null | number;
            conversionRate: null | number;
          }
        | {
            total: number;
            overdue: number;
            byStatus: {
              [key: string]: number;
            };
            completionRate: null | number;
          }
        | {
            prospects: number;
            establishments: number;
            touched: number;
            untouched: number;
            coverageRate: null | number;
          }
        | {
            total: number;
            byDecision: {
              [key: string]: number;
            };
            byReason: {
              [key: string]: number;
            };
          }
        | {
            total: number;
            missing: {
              phone: number;
              coordinates: number;
              address: number;
              website: number;
            };
            completeness: null | number;
          }
        | {
            items: Array<{
              territoryId: string;
              name: string;
              code: null | string;
              prospects: number;
              activities: number;
            }>;
          }
        | {
            pipeline: number;
            weightedPipeline: number;
            scheduledFollowUps: number;
            basis: string;
          };
    };
```

<a id="get-dashboard-today"></a>

### GET /dashboard/today

[CanonicalDashboardController.today](../../apps/api/src/reporting/canonical-dashboard.controller.ts#L142)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ProspectorTodayQueryDto](API_REQUEST_SCHEMAS.md#prospectortodayquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  routeSummary: {
    available: boolean;
    items: Array<{
      currentStop: null | {
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
      };
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
    }>;
    truncated: boolean;
  };
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
    channel: null | 'email' | 'call' | 'message' | 'visit' | 'letter';
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

<a id="get-dashboard-manager"></a>

### GET /dashboard/manager

[CanonicalDashboardController.manager](../../apps/api/src/reporting/canonical-dashboard.controller.ts#L148)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
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
          etag: string;
          progress: {
            actual: number;
            target: number;
            remaining: number;
            progressPercent: number;
            elapsedPercent: number;
            expectedToDate: number;
            projectedAtEnd: null | number;
            status: string;
            model: string;
            explanation: string;
          };
          id: string;
          name: string;
          createdAt: string /* ISO 8601 date-time */;
          updatedAt: string /* ISO 8601 date-time */;
          tenantId: string;
          organizationId: string;
          teamId: null | string;
          metric:
            | 'completed_actions'
            | 'completed_visits'
            | 'qualified_prospects'
            | 'converted_prospects'
            | 'completed_follow_ups';
          campaignId: null | string;
          ownerId: string;
          target: number;
          startsAt: string /* ISO 8601 date-time */;
          endsAt: string /* ISO 8601 date-time */;
        }>;
        truncated: boolean;
      };
  workload: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  territories: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
    basis: string;
  };
  outcomes: Array<{
    [key: string]: unknown;
  }>;
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

<a id="get-dashboard-director"></a>

### GET /dashboard/director

[CanonicalDashboardController.director](../../apps/api/src/reporting/canonical-dashboard.controller.ts#L154)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ManagerDashboardQueryDto](API_REQUEST_SCHEMAS.md#managerdashboardquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
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
          etag: string;
          progress: {
            actual: number;
            target: number;
            remaining: number;
            progressPercent: number;
            elapsedPercent: number;
            expectedToDate: number;
            projectedAtEnd: null | number;
            status: string;
            model: string;
            explanation: string;
          };
          id: string;
          name: string;
          createdAt: string /* ISO 8601 date-time */;
          updatedAt: string /* ISO 8601 date-time */;
          tenantId: string;
          organizationId: string;
          teamId: null | string;
          metric:
            | 'completed_actions'
            | 'completed_visits'
            | 'qualified_prospects'
            | 'converted_prospects'
            | 'completed_follow_ups';
          campaignId: null | string;
          ownerId: string;
          target: number;
          startsAt: string /* ISO 8601 date-time */;
          endsAt: string /* ISO 8601 date-time */;
        }>;
        truncated: boolean;
      };
  workload: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
  };
  territories: {
    items: Array<{
      [key: string]: unknown;
    }>;
    truncated: boolean;
    basis: string;
  };
  outcomes: Array<{
    [key: string]: unknown;
  }>;
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

<a id="get-dashboard-admin"></a>

### GET /dashboard/admin

[CanonicalDashboardController.admin](../../apps/api/src/reporting/canonical-dashboard.controller.ts#L160)

- **Access:** `AuthGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  generatedAt: string;
  scope: {
    tenantId: string;
  };
  metrics:
    | undefined
    | {
        [key: string]: unknown;
      };
  readiness: {
    productionCertified: boolean;
    checks: string;
  };
};
```

## reservations

Reservation rules, claims, heartbeat, extension and release.

| Method | Path                                                                                                                                                     | Accepted data                                                                     | Success |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| POST   | [`/campaigns/:campaignId/prospects/:prospectId/reservation`](#post-campaigns-campaignid-prospects-prospectid-reservation)                                | Body: [AcquireReservationDto](API_REQUEST_SCHEMAS.md#acquirereservationdto)       | 201     |
| GET    | [`/campaigns/:campaignId/prospects/:prospectId/reservation`](#get-campaigns-campaignid-prospects-prospectid-reservation)                                 | No declared body/query                                                            | 200     |
| DELETE | [`/campaigns/:campaignId/prospects/:prospectId/reservation/:reservationId`](#delete-campaigns-campaignid-prospects-prospectid-reservation-reservationid) | No declared body/query                                                            | 200     |
| GET    | [`/reservation-rules`](#get-reservation-rules)                                                                                                           | Query: [ReservationListDto](API_REQUEST_SCHEMAS.md#reservationlistdto)            | 200     |
| GET    | [`/reservation-rules/:ruleId`](#get-reservation-rules-ruleid)                                                                                            | No declared body/query                                                            | 200     |
| POST   | [`/reservation-rules`](#post-reservation-rules)                                                                                                          | Body: [CreateReservationRuleDto](API_REQUEST_SCHEMAS.md#createreservationruledto) | 201     |
| PATCH  | [`/reservation-rules/:ruleId`](#patch-reservation-rules-ruleid)                                                                                          | Body: [ReservationRulePatchDto](API_REQUEST_SCHEMAS.md#reservationrulepatchdto)   | 200     |
| DELETE | [`/reservation-rules/:ruleId`](#delete-reservation-rules-ruleid)                                                                                         | No declared body/query                                                            | 200     |
| GET    | [`/reservations`](#get-reservations)                                                                                                                     | Query: [ReservationListDto](API_REQUEST_SCHEMAS.md#reservationlistdto)            | 200     |
| POST   | [`/reservations/claim`](#post-reservations-claim)                                                                                                        | Body: [ClaimReservationDto](API_REQUEST_SCHEMAS.md#claimreservationdto)           | 201     |
| GET    | [`/reservations/:reservationId`](#get-reservations-reservationid)                                                                                        | No declared body/query                                                            | 200     |
| POST   | [`/reservations/:reservationId/heartbeat`](#post-reservations-reservationid-heartbeat)                                                                   | No declared body/query                                                            | 200     |
| POST   | [`/reservations/:reservationId/extend`](#post-reservations-reservationid-extend)                                                                         | Body: [ExtendReservationDto](API_REQUEST_SCHEMAS.md#extendreservationdto)         | 200     |
| POST   | [`/reservations/:reservationId/release`](#post-reservations-reservationid-release)                                                                       | Body: [ReleaseReservationDto](API_REQUEST_SCHEMAS.md#releasereservationdto)       | 200     |

<a id="post-campaigns-campaignid-prospects-prospectid-reservation"></a>

### POST /campaigns/:campaignId/prospects/:prospectId/reservation

[ReservationController.acquire](../../apps/api/src/reservations/reservation.controller.ts#L30)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                         | Type / constraints                                                       |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Param          | `campaignId`                                                          | `string`; `new ParseUUIDPipe()`                                          |
| Param          | `prospectId`                                                          | `string`; `new ParseUUIDPipe()`                                          |
| Body           | [AcquireReservationDto](API_REQUEST_SCHEMAS.md#acquirereservationdto) | All fields, defaults and validators in linked schema; optional parameter |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 201.**

```ts
type ResponseBody = {
  overrideId?: undefined | string;
  reservationId: string;
  tenantId: string;
  organizationId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  teamId: string;
  userId: string;
  acquiredAt: string;
  expiresAt: string;
};
```

<a id="get-campaigns-campaignid-prospects-prospectid-reservation"></a>

### GET /campaigns/:campaignId/prospects/:prospectId/reservation

[ReservationController.getCurrent](../../apps/api/src/reservations/reservation.controller.ts#L57)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`  | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

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

<a id="delete-campaigns-campaignid-prospects-prospectid-reservation-reservationid"></a>

### DELETE /campaigns/:campaignId/prospects/:prospectId/reservation/:reservationId

[ReservationController.release](../../apps/api/src/reservations/reservation.controller.ts#L79)

- **Access:** `AuthGuard`

| Input location | Name / schema   | Type / constraints              |
| -------------- | --------------- | ------------------------------- |
| Param          | `campaignId`    | `string`; `new ParseUUIDPipe()` |
| Param          | `prospectId`    | `string`; `new ParseUUIDPipe()` |
| Param          | `reservationId` | `string`; `new ParseUUIDPipe()` |

Here prospectId is the campaign_prospects row ID (campaignProspectId), not the canonical establishment ID.

**Success: 200.**

```ts
type ResponseBody = {
  released: true;
  reservationId: string;
};
```

<a id="get-reservation-rules"></a>

### GET /reservation-rules

[ReservationRuleController.list](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L81)

- **Access:** `AuthGuard`, `ReservationRuleGuard`

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ReservationListDto](API_REQUEST_SCHEMAS.md#reservationlistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    campaignId: null | string;
    durationMinutes: number;
    cooldownMinutes: number;
    maxHoldMinutes: number;
    allowHeartbeat: boolean;
    allowExtension: boolean;
    allowManagerOverride: boolean;
    isActive: boolean;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="get-reservation-rules-ruleid"></a>

### GET /reservation-rules/:ruleId

[ReservationRuleController.detail](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L84)

- **Access:** `AuthGuard`, `ReservationRuleGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `ruleId`      | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  tenantId: string;
  campaignId: null | string;
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowHeartbeat: boolean;
  allowExtension: boolean;
  allowManagerOverride: boolean;
  isActive: boolean;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="post-reservation-rules"></a>

### POST /reservation-rules

[ReservationRuleController.create](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L90)

- **Access:** `AuthGuard`, `ReservationRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation_rule.create')`.

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateReservationRuleDto](API_REQUEST_SCHEMAS.md#createreservationruledto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: null | string;
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowHeartbeat: boolean;
  allowExtension: boolean;
  allowManagerOverride: boolean;
};
```

<a id="patch-reservation-rules-ruleid"></a>

### PATCH /reservation-rules/:ruleId

[ReservationRuleController.update](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L96)

- **Access:** `AuthGuard`, `ReservationRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation_rule.update')`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `ruleId`                                                                  | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ReservationRulePatchDto](API_REQUEST_SCHEMAS.md#reservationrulepatchdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: null | string;
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowHeartbeat: boolean;
  allowExtension: boolean;
  allowManagerOverride: boolean;
};
```

<a id="delete-reservation-rules-ruleid"></a>

### DELETE /reservation-rules/:ruleId

[ReservationRuleController.remove](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L104)

- **Access:** `AuthGuard`, `ReservationRuleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation_rule.deactivate')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `ruleId`      | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  etag: string;
  id: string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  isActive: boolean;
  campaignId: null | string;
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowHeartbeat: boolean;
  allowExtension: boolean;
  allowManagerOverride: boolean;
};
```

<a id="get-reservations"></a>

### GET /reservations

[ReservationLifecycleController.list](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L116)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ReservationListDto](API_REQUEST_SCHEMAS.md#reservationlistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    ownerMembershipId: string;
    lease: {
      overrideId?: undefined | string;
      reservationId: string;
      tenantId: string;
      organizationId: string;
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
      teamId: string;
      userId: string;
      acquiredAt: string;
      expiresAt: string;
    };
    ruleSnapshot: {
      [key: string]: unknown;
    };
    status: 'active' | 'pending' | 'failed' | 'expired' | 'released' | 'lost';
    expiresAt: string /* ISO 8601 date-time */;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-reservations-claim"></a>

### POST /reservations/claim

[ReservationLifecycleController.claim](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L119)

- **Access:** `AuthGuard`, `ReservationLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation.claim')`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [ClaimReservationDto](API_REQUEST_SCHEMAS.md#claimreservationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  overrideId?: undefined | string;
  reservationId: string;
  tenantId: string;
  organizationId: string;
  campaignId: string;
  campaignProspectId: string;
  establishmentId: string;
  assignmentId: string;
  teamId: string;
  userId: string;
  acquiredAt: string;
  expiresAt: string;
  claimToken: string;
  status: string;
};
```

<a id="get-reservations-reservationid"></a>

### GET /reservations/:reservationId

[ReservationLifecycleController.detail](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L125)

- **Access:** `AuthGuard`

| Input location | Name / schema   | Type / constraints              |
| -------------- | --------------- | ------------------------------- |
| Param          | `reservationId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  claimToken: undefined | string;
  events: Array<{
    id: string;
    tenantId: string;
    reservationId: string;
    type: string;
    data: {
      [key: string]: unknown;
    };
    createdAt: string /* ISO 8601 date-time */;
  }>;
  id?: undefined | string;
  tenantId?: undefined | string;
  campaignId?: undefined | string;
  campaignProspectId?: undefined | string;
  establishmentId?: undefined | string;
  ownerMembershipId?: undefined | string;
  lease?:
    | undefined
    | {
        overrideId?: undefined | string;
        reservationId: string;
        tenantId: string;
        organizationId: string;
        campaignId: string;
        campaignProspectId: string;
        establishmentId: string;
        assignmentId: string;
        teamId: string;
        userId: string;
        acquiredAt: string;
        expiresAt: string;
      };
  ruleSnapshot?:
    | undefined
    | {
        [key: string]: unknown;
      };
  status?: undefined | 'active' | 'pending' | 'failed' | 'expired' | 'released' | 'lost';
  expiresAt?: undefined | string /* ISO 8601 date-time */;
  createdAt?: undefined | string /* ISO 8601 date-time */;
  updatedAt?: undefined | string /* ISO 8601 date-time */;
};
```

<a id="post-reservations-reservationid-heartbeat"></a>

### POST /reservations/:reservationId/heartbeat

[ReservationLifecycleController.heartbeat](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L131)

- **Access:** `AuthGuard`, `ReservationLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation.heartbeat')`.

| Input location | Name / schema   | Type / constraints              |
| -------------- | --------------- | ------------------------------- |
| Param          | `reservationId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody =
  | {
      overrideId?: undefined | string;
      reservationId: string;
      tenantId: string;
      organizationId: string;
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
      teamId: string;
      userId: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      reservationId: string;
      released: boolean;
    };
```

<a id="post-reservations-reservationid-extend"></a>

### POST /reservations/:reservationId/extend

[ReservationLifecycleController.extend](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L141)

- **Access:** `AuthGuard`, `ReservationLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation.extend')`.

| Input location | Name / schema                                                       | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `reservationId`                                                     | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ExtendReservationDto](API_REQUEST_SCHEMAS.md#extendreservationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      overrideId?: undefined | string;
      reservationId: string;
      tenantId: string;
      organizationId: string;
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
      teamId: string;
      userId: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      reservationId: string;
      released: boolean;
    };
```

<a id="post-reservations-reservationid-release"></a>

### POST /reservations/:reservationId/release

[ReservationLifecycleController.release](../../apps/api/src/reservations/reservation-lifecycle.controller.ts#L152)

- **Access:** `AuthGuard`, `ReservationLifecycleGuard`
- **Idempotency-Key:** required; `@Idempotent('reservation.release')`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `reservationId`                                                       | `string`; `new ParseUUIDPipe()`                      |
| Body           | [ReleaseReservationDto](API_REQUEST_SCHEMAS.md#releasereservationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | {
      overrideId?: undefined | string;
      reservationId: string;
      tenantId: string;
      organizationId: string;
      campaignId: string;
      campaignProspectId: string;
      establishmentId: string;
      assignmentId: string;
      teamId: string;
      userId: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      reservationId: string;
      released: boolean;
    };
```

## routes

Field routes, stops, ordering, optimization and completion.

| Method | Path                                                            | Accepted data                                                 | Success |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------- | ------- |
| GET    | [`/routes`](#get-routes)                                        | Query: [RouteListDto](API_REQUEST_SCHEMAS.md#routelistdto)    | 200     |
| POST   | [`/routes`](#post-routes)                                       | Body: [CreateRouteDto](API_REQUEST_SCHEMAS.md#createroutedto) | 201     |
| GET    | [`/routes/:routeId`](#get-routes-routeid)                       | No declared body/query                                        | 200     |
| PATCH  | [`/routes/:routeId`](#patch-routes-routeid)                     | Body: [UpdateRouteDto](API_REQUEST_SCHEMAS.md#updateroutedto) | 200     |
| DELETE | [`/routes/:routeId`](#delete-routes-routeid)                    | No declared body/query                                        | 200     |
| POST   | [`/routes/:routeId/stops`](#post-routes-routeid-stops)          | Body: [AddStopDto](API_REQUEST_SCHEMAS.md#addstopdto)         | 200     |
| PUT    | [`/routes/:routeId/stop-order`](#put-routes-routeid-stop-order) | Body: [StopOrderDto](API_REQUEST_SCHEMAS.md#stoporderdto)     | 200     |
| POST   | [`/routes/:routeId/optimize`](#post-routes-routeid-optimize)    | No declared body/query                                        | 200     |
| POST   | [`/routes/:routeId/start`](#post-routes-routeid-start)          | No declared body/query                                        | 200     |
| POST   | [`/routes/:routeId/complete`](#post-routes-routeid-complete)    | No declared body/query                                        | 200     |
| PATCH  | [`/route-stops/:stopId`](#patch-route-stops-stopid)             | Body: [UpdateStopDto](API_REQUEST_SCHEMAS.md#updatestopdto)   | 200     |
| DELETE | [`/route-stops/:stopId`](#delete-route-stops-stopid)            | No declared body/query                                        | 200     |

<a id="get-routes"></a>

### GET /routes

[RouteController.list](../../apps/api/src/routes/route.controller.ts#L67)

- **Access:** `AuthGuard`

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Query          | [RouteListDto](API_REQUEST_SCHEMAS.md#routelistdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    etag: string;
    id: string;
    tenantId: string;
    teamId: string;
    ownerId: string;
    name: string;
    scheduledAt: string /* ISO 8601 date-time */;
    status: 'active' | 'draft' | 'completed' | 'cancelled';
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
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-routes"></a>

### POST /routes

[RouteController.create](../../apps/api/src/routes/route.controller.ts#L70)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.create')`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateRouteDto](API_REQUEST_SCHEMAS.md#createroutedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

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

<a id="get-routes-routeid"></a>

### GET /routes/:routeId

[RouteController.detail](../../apps/api/src/routes/route.controller.ts#L76)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `routeId`     | `string`; `new ParseUUIDPipe()` |

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

<a id="patch-routes-routeid"></a>

### PATCH /routes/:routeId

[RouteController.update](../../apps/api/src/routes/route.controller.ts#L82)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.update')`.

| Input location | Name / schema                                           | Type / constraints                                   |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `routeId`                                               | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateRouteDto](API_REQUEST_SCHEMAS.md#updateroutedto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                              | `undefined \| string`; optional parameter            |

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

<a id="delete-routes-routeid"></a>

### DELETE /routes/:routeId

[RouteController.cancel](../../apps/api/src/routes/route.controller.ts#L90)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.cancel')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `routeId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

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

<a id="post-routes-routeid-stops"></a>

### POST /routes/:routeId/stops

[RouteController.add](../../apps/api/src/routes/route.controller.ts#L97)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.add_stop')`.

| Input location | Name / schema                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Param          | `routeId`                                       | `string`; `new ParseUUIDPipe()`                      |
| Body           | [AddStopDto](API_REQUEST_SCHEMAS.md#addstopdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                      | `undefined \| string`; optional parameter            |

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

<a id="put-routes-routeid-stop-order"></a>

### PUT /routes/:routeId/stop-order

[RouteController.order](../../apps/api/src/routes/route.controller.ts#L109)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.order')`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Param          | `routeId`                                           | `string`; `new ParseUUIDPipe()`                      |
| Body           | [StopOrderDto](API_REQUEST_SCHEMAS.md#stoporderdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                          | `undefined \| string`; optional parameter            |

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

<a id="post-routes-routeid-optimize"></a>

### POST /routes/:routeId/optimize

[RouteController.optimize](../../apps/api/src/routes/route.controller.ts#L117)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.optimize')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `routeId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

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

<a id="post-routes-routeid-start"></a>

### POST /routes/:routeId/start

[RouteController.start](../../apps/api/src/routes/route.controller.ts#L128)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.start')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `routeId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

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

<a id="post-routes-routeid-complete"></a>

### POST /routes/:routeId/complete

[RouteController.complete](../../apps/api/src/routes/route.controller.ts#L139)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.complete')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `routeId`     | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

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

<a id="patch-route-stops-stopid"></a>

### PATCH /route-stops/:stopId

[RouteStopController.update](../../apps/api/src/routes/route.controller.ts#L155)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.update_stop')`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `stopId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateStopDto](API_REQUEST_SCHEMAS.md#updatestopdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                            | `undefined \| string`; optional parameter            |

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

<a id="delete-route-stops-stopid"></a>

### DELETE /route-stops/:stopId

[RouteStopController.remove](../../apps/api/src/routes/route.controller.ts#L163)

- **Access:** `AuthGuard`, `RouteWriteGuard`
- **Idempotency-Key:** required; `@Idempotent('route.remove_stop')`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `stopId`      | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

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

## saved-views

Saved filters, sorting and visible columns.

| Method | Path                                                 | Accepted data                                                         | Success |
| ------ | ---------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| GET    | [`/saved-views`](#get-saved-views)                   | Query: [ListSavedViewsDto](API_REQUEST_SCHEMAS.md#listsavedviewsdto)  | 200     |
| POST   | [`/saved-views`](#post-saved-views)                  | Body: [CreateSavedViewDto](API_REQUEST_SCHEMAS.md#createsavedviewdto) | 201     |
| PATCH  | [`/saved-views/:viewId`](#patch-saved-views-viewid)  | Body: [UpdateSavedViewDto](API_REQUEST_SCHEMAS.md#updatesavedviewdto) | 200     |
| DELETE | [`/saved-views/:viewId`](#delete-saved-views-viewid) | No declared body/query                                                | 204     |

<a id="get-saved-views"></a>

### GET /saved-views

[SavedViewsController.list](../../apps/api/src/saved-views/saved-views.module.ts#L128)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                 | Type / constraints                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListSavedViewsDto](API_REQUEST_SCHEMAS.md#listsavedviewsdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  resource: string;
  filters: {
    [key: string]: unknown;
  };
  sort: {
    [key: string]: string;
  };
  columns: Array<string>;
  shared: boolean;
  isDefault: boolean;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
}>;
```

<a id="post-saved-views"></a>

### POST /saved-views

[SavedViewsController.create](../../apps/api/src/saved-views/saved-views.module.ts#L131)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('saved_view.create')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateSavedViewDto](API_REQUEST_SCHEMAS.md#createsavedviewdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      name: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      columns: Array<string>;
      tenantId: string;
      sort: {
        [key: string]: string;
      };
      ownerId: string;
      shared: boolean;
      filters: {
        [key: string]: unknown;
      };
      resource: string;
      isDefault: boolean;
    };
```

<a id="patch-saved-views-viewid"></a>

### PATCH /saved-views/:viewId

[SavedViewsController.update](../../apps/api/src/saved-views/saved-views.module.ts#L137)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `viewId`                                                        | `string`; `ParseUUIDPipe`                            |
| Body           | [UpdateSavedViewDto](API_REQUEST_SCHEMAS.md#updatesavedviewdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      ownerId: string;
      name: string;
      resource: string;
      filters: {
        [key: string]: unknown;
      };
      sort: {
        [key: string]: string;
      };
      columns: Array<string>;
      shared: boolean;
      isDefault: boolean;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-saved-views-viewid"></a>

### DELETE /saved-views/:viewId

[SavedViewsController.remove](../../apps/api/src/saved-views/saved-views.module.ts#L144)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `viewId`      | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

## scheduled-reports

Report schedules and delivery history.

| Method | Path                                                                                        | Accepted data                                                                     | Success |
| ------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| GET    | [`/scheduled-reports`](#get-scheduled-reports)                                              | Query: `limit?: undefined \| number`<br>Query: `cursor?: undefined \| string`     | 200     |
| POST   | [`/scheduled-reports`](#post-scheduled-reports)                                             | Body: [CreateScheduledReportDto](API_REQUEST_SCHEMAS.md#createscheduledreportdto) | 201     |
| PATCH  | [`/scheduled-reports/:scheduleId`](#patch-scheduled-reports-scheduleid)                     | Body: [UpdateScheduledReportDto](API_REQUEST_SCHEMAS.md#updatescheduledreportdto) | 200     |
| DELETE | [`/scheduled-reports/:scheduleId`](#delete-scheduled-reports-scheduleid)                    | No declared body/query                                                            | 204     |
| GET    | [`/scheduled-reports/:scheduleId/deliveries`](#get-scheduled-reports-scheduleid-deliveries) | Query: `limit?: undefined \| number`                                              | 200     |

<a id="get-scheduled-reports"></a>

### GET /scheduled-reports

[ScheduledReportsController.list](../../apps/api/src/scheduled-reports/scheduled-reports.module.ts#L146)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Query          | `limit`       | `undefined \| number`; optional parameter |
| Query          | `cursor`      | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    ownerId: string;
    reportKey: string;
    cadence: string;
    format: string;
    recipients: Array<string>;
    filters: {
      [key: string]: unknown;
    };
    timezone: string;
    nextRunAt: string /* ISO 8601 date-time */;
    active: number;
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-scheduled-reports"></a>

### POST /scheduled-reports

[ScheduledReportsController.create](../../apps/api/src/scheduled-reports/scheduled-reports.module.ts#L149)

- **Access:** `AuthGuard`
- **Idempotency-Key:** required; `@Idempotent('scheduled_report.create')`.

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateScheduledReportDto](API_REQUEST_SCHEMAS.md#createscheduledreportdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      active: number;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      tenantId: string;
      ownerId: string;
      format: string;
      timezone: string;
      reportKey: string;
      cadence: string;
      recipients: Array<string>;
      filters: {
        [key: string]: unknown;
      };
      nextRunAt: string /* ISO 8601 date-time */;
    };
```

<a id="patch-scheduled-reports-scheduleid"></a>

### PATCH /scheduled-reports/:scheduleId

[ScheduledReportsController.update](../../apps/api/src/scheduled-reports/scheduled-reports.module.ts#L155)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                               | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `scheduleId`                                                                | `string`; `ParseUUIDPipe`                            |
| Body           | [UpdateScheduledReportDto](API_REQUEST_SCHEMAS.md#updatescheduledreportdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      tenantId: string;
      ownerId: string;
      reportKey: string;
      cadence: string;
      format: string;
      recipients: Array<string>;
      filters: {
        [key: string]: unknown;
      };
      timezone: string;
      nextRunAt: string /* ISO 8601 date-time */;
      active: number;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
    };
```

<a id="delete-scheduled-reports-scheduleid"></a>

### DELETE /scheduled-reports/:scheduleId

[ScheduledReportsController.remove](../../apps/api/src/scheduled-reports/scheduled-reports.module.ts#L162)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints        |
| -------------- | ------------- | ------------------------- |
| Param          | `scheduleId`  | `string`; `ParseUUIDPipe` |

**Success: 204.**

No response body.

<a id="get-scheduled-reports-scheduleid-deliveries"></a>

### GET /scheduled-reports/:scheduleId/deliveries

[ScheduledReportsController.deliveries](../../apps/api/src/scheduled-reports/scheduled-reports.module.ts#L168)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `scheduleId`  | `string`; `ParseUUIDPipe`                 |
| Query          | `limit`       | `undefined \| number`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  tenantId: string;
  scheduleId: string;
  status: string;
  startedAt: string /* ISO 8601 date-time */;
  completedAt: null | string /* ISO 8601 date-time */;
  error: null | string;
  rowCount: null | number;
}>;
```

## search

Cross-resource search and facets.

| Method | Path                                   | Accepted data                                            | Success |
| ------ | -------------------------------------- | -------------------------------------------------------- | ------- |
| GET    | [`/search/facets`](#get-search-facets) | Query: [SearchQuery](API_REQUEST_SCHEMAS.md#searchquery) | 200     |
| GET    | [`/search`](#get-search)               | Query: [SearchQuery](API_REQUEST_SCHEMAS.md#searchquery) | 200     |

<a id="get-search-facets"></a>

### GET /search/facets

[SearchController.facets](../../apps/api/src/search/search.module.ts#L159)

- **Access:** `AuthGuard`

| Input location | Name / schema                                     | Type / constraints                                   |
| -------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Query          | [SearchQuery](API_REQUEST_SCHEMAS.md#searchquery) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  query: string;
  facets: Array<{
    type: string;
    count: number;
  }>;
};
```

<a id="get-search"></a>

### GET /search

[SearchController.search](../../apps/api/src/search/search.module.ts#L163)

- **Access:** `AuthGuard`

| Input location | Name / schema                                     | Type / constraints                                   |
| -------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Query          | [SearchQuery](API_REQUEST_SCHEMAS.md#searchquery) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: null | string;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

## security-administration

Invitations and tenant security/SSO policy.

| Method | Path                                                                                       | Accepted data                                                                   | Success |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------- |
| POST   | [`/memberships`](#post-memberships)                                                        | Body: [CreateInvitationDto](API_REQUEST_SCHEMAS.md#createinvitationdto)         | 201     |
| POST   | [`/memberships/:membershipId/resend-invite`](#post-memberships-membershipid-resend-invite) | No declared body/query                                                          | 200     |
| GET    | [`/invitations/:token`](#get-invitations-token)                                            | No declared body/query                                                          | 200     |
| POST   | [`/invitations/:token/accept`](#post-invitations-token-accept)                             | Body: [AcceptInvitationDto](API_REQUEST_SCHEMAS.md#acceptinvitationdto)         | 200     |
| GET    | [`/settings/security`](#get-settings-security)                                             | No declared body/query                                                          | 200     |
| PATCH  | [`/settings/security`](#patch-settings-security)                                           | Body: [UpdateSecurityPolicyDto](API_REQUEST_SCHEMAS.md#updatesecuritypolicydto) | 200     |

<a id="post-memberships"></a>

### POST /memberships

[MembershipInvitationController.invite](../../apps/api/src/security-administration/invitation.controller.ts#L24)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.invite')`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateInvitationDto](API_REQUEST_SCHEMAS.md#createinvitationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  membershipId: string;
  tenantId: string;
  email: string;
  status: string;
  role: 'director' | 'manager' | 'prospector' | 'tenant_admin' | 'auditor';
};
```

<a id="post-memberships-membershipid-resend-invite"></a>

### POST /memberships/:membershipId/resend-invite

[MembershipInvitationController.resend](../../apps/api/src/security-administration/invitation.controller.ts#L29)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('membership.resend_invite')`.

| Input location | Name / schema  | Type / constraints              |
| -------------- | -------------- | ------------------------------- |
| Param          | `membershipId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  membershipId: string;
  status: string;
};
```

<a id="get-invitations-token"></a>

### GET /invitations/:token

[InvitationController.previewInvitation](../../apps/api/src/security-administration/invitation.controller.ts#L43)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`; `@Header('Referrer-Policy', 'no-referrer')`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | [InvitationTokenDto](API_REQUEST_SCHEMAS.md#invitationtokendto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  workspaceName: string;
  emailHint: string;
  expiresAt: string /* ISO 8601 date-time */;
  existingAccount: boolean;
  mfaRequired: boolean;
};
```

<a id="post-invitations-token-accept"></a>

### POST /invitations/:token/accept

[InvitationController.acceptInvitation](../../apps/api/src/security-administration/invitation.controller.ts#L49)

- **Access:** `AuthRateLimitGuard`
- **Response headers:** `@Header('Cache-Control', 'no-store')`.

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | [InvitationTokenDto](API_REQUEST_SCHEMAS.md#invitationtokendto)   | All fields, defaults and validators in linked schema |
| Body           | [AcceptInvitationDto](API_REQUEST_SCHEMAS.md#acceptinvitationdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  accepted: boolean;
  membershipId: string;
  signInRequired: boolean;
};
```

<a id="get-settings-security"></a>

### GET /settings/security

[SecurityPolicyController.get](../../apps/api/src/security-administration/security-policy.controller.ts#L44)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody =
  | {
      sso:
        | {
            provider: string;
            mode: string;
            issuer: null;
            clientId: null;
            allowedDomains: Array<never>;
            clientSecretConfigured: boolean;
            loginAvailable: boolean;
          }
        | {
            clientSecretConfigured: boolean;
            loginAvailable: boolean;
            mode: 'disabled' | 'configured';
            issuer: string;
            clientId: string;
            provider: 'oidc';
            allowedDomains: Array<string>;
          };
      tenantId: string;
      requireMfa: boolean;
      passwordMinLength: number;
      sessionMaxHours: number;
      updatedAt: string /* ISO 8601 date-time */;
    }
  | {
      sso:
        | {
            provider: string;
            mode: string;
            issuer: null;
            clientId: null;
            allowedDomains: Array<never>;
            clientSecretConfigured: boolean;
            loginAvailable: boolean;
          }
        | {
            clientSecretConfigured: boolean;
            loginAvailable: boolean;
            mode: 'disabled' | 'configured';
            issuer: string;
            clientId: string;
            provider: 'oidc';
            allowedDomains: Array<string>;
          };
      updatedAt: null;
      requireMfa: boolean;
      passwordMinLength: number;
      sessionMaxHours: number;
      tenantId: string;
    };
```

<a id="patch-settings-security"></a>

### PATCH /settings/security

[SecurityPolicyController.update](../../apps/api/src/security-administration/security-policy.controller.ts#L55)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('security_policy.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [UpdateSecurityPolicyDto](API_REQUEST_SCHEMAS.md#updatesecuritypolicydto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  sso:
    | {
        provider: string;
        mode: string;
        issuer: null;
        clientId: null;
        allowedDomains: Array<never>;
        clientSecretConfigured: boolean;
        loginAvailable: boolean;
      }
    | {
        clientSecretConfigured: boolean;
        loginAvailable: boolean;
        mode: 'disabled' | 'configured';
        issuer: string;
        clientId: string;
        provider: 'oidc';
        allowedDomains: Array<string>;
      };
  updatedAt?: undefined | string /* ISO 8601 date-time */;
  tenantId?: undefined | string;
  requireMfa?: undefined | boolean;
  passwordMinLength?: undefined | number;
  sessionMaxHours?: undefined | number;
};
```

## tenants

Platform administration of tenants, configuration, users and platform grants.

| Method | Path                                                                                                          | Accepted data                                                                   | Success |
| ------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| GET    | [`/platform/tenants`](#get-platform-tenants)                                                                  | Query: `status?: undefined \| "active" \| "suspended" \| "inactive"`            | 200     |
| GET    | [`/platform/tenants/:tenantId`](#get-platform-tenants-tenantid)                                               | No declared body/query                                                          | 200     |
| GET    | [`/platform/tenants/:tenantId/usage`](#get-platform-tenants-tenantid-usage)                                   | No declared body/query                                                          | 200     |
| GET    | [`/platform/tenants/:tenantId/config`](#get-platform-tenants-tenantid-config)                                 | No declared body/query                                                          | 200     |
| PATCH  | [`/platform/tenants/:tenantId/config`](#patch-platform-tenants-tenantid-config)                               | Body: [PlatformTenantConfigDto](API_REQUEST_SCHEMAS.md#platformtenantconfigdto) | 200     |
| PATCH  | [`/platform/tenants/:tenantId/status`](#patch-platform-tenants-tenantid-status)                               | Body: [PlatformTenantStatusDto](API_REQUEST_SCHEMAS.md#platformtenantstatusdto) | 200     |
| GET    | [`/platform/users`](#get-platform-users)                                                                      | No declared body/query                                                          | 200     |
| POST   | [`/platform/users/:identityId/grants`](#post-platform-users-identityid-grants)                                | Body: [PlatformGrantDto](API_REQUEST_SCHEMAS.md#platformgrantdto)               | 201     |
| POST   | [`/platform/users/:identityId/grants/:grantId/revoke`](#post-platform-users-identityid-grants-grantid-revoke) | Body: [PlatformGrantRevokeDto](API_REQUEST_SCHEMAS.md#platformgrantrevokedto)   | 201     |

<a id="get-platform-tenants"></a>

### GET /platform/tenants

[PlatformTenantController.list](../../apps/api/src/tenants/platform-tenant.controller.ts#L32)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema | Type / constraints                                                       |
| -------------- | ------------- | ------------------------------------------------------------------------ |
| Query          | `status`      | `undefined \| "active" \| "suspended" \| "inactive"`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    status: 'active' | 'suspended' | 'inactive';
    platformConfig: {
      [key: string]: unknown;
    };
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="get-platform-tenants-tenantid"></a>

### GET /platform/tenants/:tenantId

[PlatformTenantController.detail](../../apps/api/src/tenants/platform-tenant.controller.ts#L42)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `tenantId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'inactive';
  platformConfig: {
    [key: string]: unknown;
  };
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-platform-tenants-tenantid-usage"></a>

### GET /platform/tenants/:tenantId/usage

[PlatformTenantController.usage](../../apps/api/src/tenants/platform-tenant.controller.ts#L49)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `tenantId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  tenantId: string;
  memberships: {};
  prospects: {};
  campaigns: {};
  activities: {};
};
```

<a id="get-platform-tenants-tenantid-config"></a>

### GET /platform/tenants/:tenantId/config

[PlatformTenantController.config](../../apps/api/src/tenants/platform-tenant.controller.ts#L74)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `tenantId`    | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  [key: string]: unknown;
};
```

<a id="patch-platform-tenants-tenantid-config"></a>

### PATCH /platform/tenants/:tenantId/config

[PlatformTenantController.updateConfig](../../apps/api/src/tenants/platform-tenant.controller.ts#L85)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `tenantId`                                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [PlatformTenantConfigDto](API_REQUEST_SCHEMAS.md#platformtenantconfigdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  [key: string]: unknown;
};
```

<a id="patch-platform-tenants-tenantid-status"></a>

### PATCH /platform/tenants/:tenantId/status

[PlatformTenantController.setStatus](../../apps/api/src/tenants/platform-tenant.controller.ts#L110)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema                                                             | Type / constraints                                   |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `tenantId`                                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [PlatformTenantStatusDto](API_REQUEST_SCHEMAS.md#platformtenantstatusdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'inactive';
  platformConfig: {
    [key: string]: unknown;
  };
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-platform-users"></a>

### GET /platform/users

[PlatformUserController.list](../../apps/api/src/tenants/platform-user.controller.ts#L21)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    identityId: string;
    email: string;
    status: 'active' | 'suspended' | 'disabled';
    role: 'super_admin' | 'support_operator';
    grantedAt: string /* ISO 8601 date-time */;
  }>;
};
```

<a id="post-platform-users-identityid-grants"></a>

### POST /platform/users/:identityId/grants

[PlatformUserController.grant](../../apps/api/src/tenants/platform-user.controller.ts#L39)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `identityId`                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [PlatformGrantDto](API_REQUEST_SCHEMAS.md#platformgrantdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody =
  | undefined
  | {
      id: string;
      createdAt: string /* ISO 8601 date-time */;
      updatedAt: string /* ISO 8601 date-time */;
      identityId: string;
      revokedAt: null | string /* ISO 8601 date-time */;
      role: 'super_admin' | 'support_operator';
      grantSource: 'bootstrap' | 'platform_admin';
      grantedByIdentityId: null | string;
      grantReason: string;
      externalReference: string;
      grantedAt: string /* ISO 8601 date-time */;
      revokedByIdentityId: null | string;
      revocationReason: null | string;
    };
```

<a id="post-platform-users-identityid-grants-grantid-revoke"></a>

### POST /platform/users/:identityId/grants/:grantId/revoke

[PlatformUserController.revoke](../../apps/api/src/tenants/platform-user.controller.ts#L68)

- **Access:** `AuthGuard`, `PlatformAdminGuard`

| Input location | Name / schema                                                           | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `identityId`                                                            | `string`; `new ParseUUIDPipe()`                      |
| Param          | `grantId`                                                               | `string`; `new ParseUUIDPipe()`                      |
| Body           | [PlatformGrantRevokeDto](API_REQUEST_SCHEMAS.md#platformgrantrevokedto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = null | {
  id: string;
  identityId: string;
  role: 'super_admin' | 'support_operator';
  grantSource: 'bootstrap' | 'platform_admin';
  grantedByIdentityId: null | string;
  grantReason: string;
  externalReference: string;
  grantedAt: string /* ISO 8601 date-time */;
  revokedByIdentityId: null | string;
  revokedAt: null | string /* ISO 8601 date-time */;
  revocationReason: null | string;
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

## territories

Territory CRUD, map geometry and campaign territory links.

| Method | Path                                                                                                      | Accepted data                                                         | Success |
| ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| GET    | [`/territories`](#get-territories)                                                                        | No declared body/query                                                | 200     |
| GET    | [`/territories/map`](#get-territories-map)                                                                | No declared body/query                                                | 200     |
| GET    | [`/territories/:territoryId`](#get-territories-territoryid)                                               | No declared body/query                                                | 200     |
| POST   | [`/territories`](#post-territories)                                                                       | Body: [CreateTerritoryDto](API_REQUEST_SCHEMAS.md#createterritorydto) | 201     |
| PATCH  | [`/territories/:territoryId`](#patch-territories-territoryid)                                             | Body: [UpdateTerritoryDto](API_REQUEST_SCHEMAS.md#updateterritorydto) | 200     |
| DELETE | [`/territories/:territoryId`](#delete-territories-territoryid)                                            | No declared body/query                                                | 204     |
| GET    | [`/campaigns/:campaignId/territories`](#get-campaigns-campaignid-territories)                             | No declared body/query                                                | 200     |
| POST   | [`/campaigns/:campaignId/territories`](#post-campaigns-campaignid-territories)                            | Body: [LinkTerritoryDto](API_REQUEST_SCHEMAS.md#linkterritorydto)     | 201     |
| DELETE | [`/campaigns/:campaignId/territories/:territoryId`](#delete-campaigns-campaignid-territories-territoryid) | No declared body/query                                                | 204     |

<a id="get-territories"></a>

### GET /territories

[TerritoryController.list](../../apps/api/src/territories/territory.controller.ts#L29)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

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

<a id="get-territories-map"></a>

### GET /territories/map

[TerritoryController.map](../../apps/api/src/territories/territory.controller.ts#L32)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

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

<a id="get-territories-territoryid"></a>

### GET /territories/:territoryId

[TerritoryController.get](../../apps/api/src/territories/territory.controller.ts#L35)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `territoryId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
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
};
```

<a id="post-territories"></a>

### POST /territories

[TerritoryController.create](../../apps/api/src/territories/territory.controller.ts#L41)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('territory.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateTerritoryDto](API_REQUEST_SCHEMAS.md#createterritorydto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
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
};
```

<a id="patch-territories-territoryid"></a>

### PATCH /territories/:territoryId

[TerritoryController.update](../../apps/api/src/territories/territory.controller.ts#L47)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('territory.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                   | Type / constraints                                   |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `territoryId`                                                   | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateTerritoryDto](API_REQUEST_SCHEMAS.md#updateterritorydto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                      | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody =
  | undefined
  | {
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
    };
```

<a id="delete-territories-territoryid"></a>

### DELETE /territories/:territoryId

[TerritoryController.remove](../../apps/api/src/territories/territory.controller.ts#L59)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('territory.deactivate')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `territoryId` | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 204.**

No response body.

<a id="get-campaigns-campaignid-territories"></a>

### GET /campaigns/:campaignId/territories

[CampaignTerritoryController.list](../../apps/api/src/territories/territory.controller.ts#L76)

- **Access:** `AuthGuard`

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |

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

<a id="post-campaigns-campaignid-territories"></a>

### POST /campaigns/:campaignId/territories

[CampaignTerritoryController.add](../../apps/api/src/territories/territory.controller.ts#L82)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign.territory_add')`.

| Input location | Name / schema                                               | Type / constraints                                   |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                | `string`; `new ParseUUIDPipe()`                      |
| Body           | [LinkTerritoryDto](API_REQUEST_SCHEMAS.md#linkterritorydto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  campaignId: string;
  territoryId: string;
};
```

<a id="delete-campaigns-campaignid-territories-territoryid"></a>

### DELETE /campaigns/:campaignId/territories/:territoryId

[CampaignTerritoryController.remove](../../apps/api/src/territories/territory.controller.ts#L93)

- **Access:** `AuthGuard`, `ResourceAccessGuard`
- **Idempotency-Key:** required; `@Idempotent('campaign.territory_remove')`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `campaignId`  | `string`; `new ParseUUIDPipe()` |
| Param          | `territoryId` | `string`; `new ParseUUIDPipe()` |

**Success: 204.**

No response body.

## user-management

Legacy tenant user list, creation and status changes.

| Method | Path                                                  | Accepted data                                                           | Success |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| GET    | [`/users`](#get-users)                                | No declared body/query                                                  | 200     |
| POST   | [`/users`](#post-users)                               | Body: [CreateUserDto](API_REQUEST_SCHEMAS.md#createuserdto)             | 201     |
| PATCH  | [`/users/:userId/status`](#patch-users-userid-status) | Body: [UpdateUserStatusDto](API_REQUEST_SCHEMAS.md#updateuserstatusdto) | 200     |

<a id="get-users"></a>

### GET /users

[UserManagementController.list](../../apps/api/src/user-management/user-management.controller.ts#L17)

- **Access:** `AuthGuard`, `ClientAdminGuard`

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = Array<{
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'disabled';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  displayName: null | string;
}>;
```

<a id="post-users"></a>

### POST /users

[UserManagementController.create](../../apps/api/src/user-management/user-management.controller.ts#L25)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateUserDto](API_REQUEST_SCHEMAS.md#createuserdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'disabled';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  displayName: null | string;
};
```

<a id="patch-users-userid-status"></a>

### PATCH /users/:userId/status

[UserManagementController.updateStatus](../../apps/api/src/user-management/user-management.controller.ts#L40)

- **Access:** `AuthGuard`, `ClientAdminGuard`

| Input location | Name / schema                                                     | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `userId`                                                          | `string`                                             |
| Body           | [UpdateUserStatusDto](API_REQUEST_SCHEMAS.md#updateuserstatusdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'disabled';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
  tenantId: string;
  displayName: null | string;
};
```

## work-queue

Prospector team/campaign options, assigned work and campaign-prospect detail.

| Method | Path                                                                           | Accepted data                                                                                          | Success |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------- |
| GET    | [`/work-queue/options`](#get-work-queue-options)                               | Query: [GetWorkQueueOptionsQueryDto](API_REQUEST_SCHEMAS.md#getworkqueueoptionsquerydto)               | 200     |
| GET    | [`/work-queue`](#get-work-queue)                                               | Query: [ListWorkQueueQueryDto](API_REQUEST_SCHEMAS.md#listworkqueuequerydto)                           | 200     |
| GET    | [`/work-queue/:campaignId/:prospectId`](#get-work-queue-campaignid-prospectid) | Query: [GetWorkQueueProspectDetailQueryDto](API_REQUEST_SCHEMAS.md#getworkqueueprospectdetailquerydto) | 200     |

<a id="get-work-queue-options"></a>

### GET /work-queue/options

[WorkQueueController.getOptions](../../apps/api/src/work-queue/work-queue.controller.ts#L19)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                     | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [GetWorkQueueOptionsQueryDto](API_REQUEST_SCHEMAS.md#getworkqueueoptionsquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaigns: Array<{
    id: string;
    name: string;
  }>;
};
```

<a id="get-work-queue"></a>

### GET /work-queue

[WorkQueueController.list](../../apps/api/src/work-queue/work-queue.controller.ts#L35)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListWorkQueueQueryDto](API_REQUEST_SCHEMAS.md#listworkqueuequerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    campaignProspectId: string;
    lifecycleStage:
      'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
    latestActivity: null | {
      type: 'email' | 'call' | 'message' | 'visit';
      occurredAt: string /* ISO 8601 date-time */;
    };
    nextFollowUp: null | {
      id: string;
      dueAt: string /* ISO 8601 date-time */;
    };
    campaign: {
      id: string;
      name: string;
    };
    assignment: {
      id: string;
      organizationId: string;
      teamId: string;
      assignedAt: string /* ISO 8601 date-time */;
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
      status: 'active' | 'inactive' | 'archived';
    };
  }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: null | string;
  };
};
```

<a id="get-work-queue-campaignid-prospectid"></a>

### GET /work-queue/:campaignId/:prospectId

[WorkQueueController.getProspectDetail](../../apps/api/src/work-queue/work-queue.controller.ts#L82)

- **Access:** `AuthGuard`

| Input location | Name / schema                                                                                   | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `campaignId`                                                                                    | `string`; `new ParseUUIDPipe()`                      |
| Param          | `prospectId`                                                                                    | `string`; `new ParseUUIDPipe()`                      |
| Query          | [GetWorkQueueProspectDetailQueryDto](API_REQUEST_SCHEMAS.md#getworkqueueprospectdetailquerydto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  campaignProspectId: string;
  lifecycleStage:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
  latestActivity: null | {
    type: 'email' | 'call' | 'message' | 'visit';
    occurredAt: string /* ISO 8601 date-time */;
  };
  campaign: {
    id: string;
    name: string;
  };
  assignment: {
    id: string;
    organizationId: string;
    teamId: string;
    assignedAt: string /* ISO 8601 date-time */;
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
    status: 'active' | 'inactive' | 'archived';
  };
};
```

## workspace-administration

Organizations, teams, capacities and skill settings.

| Method | Path                                                                     | Accepted data                                                                        | Success |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------- |
| GET    | [`/tenant`](#get-tenant)                                                 | No declared body/query                                                               | 200     |
| PATCH  | [`/tenant`](#patch-tenant)                                               | Body: [UpdateTenantDto](API_REQUEST_SCHEMAS.md#updatetenantdto)                      | 200     |
| GET    | [`/organizations`](#get-organizations)                                   | Query: [ListWorkspaceResourcesDto](API_REQUEST_SCHEMAS.md#listworkspaceresourcesdto) | 200     |
| POST   | [`/organizations`](#post-organizations)                                  | Body: [CreateOrganizationDto](API_REQUEST_SCHEMAS.md#createorganizationdto)          | 201     |
| GET    | [`/organizations/:organizationId`](#get-organizations-organizationid)    | No declared body/query                                                               | 200     |
| PATCH  | [`/organizations/:organizationId`](#patch-organizations-organizationid)  | Body: [UpdateOrganizationDto](API_REQUEST_SCHEMAS.md#updateorganizationdto)          | 200     |
| DELETE | [`/organizations/:organizationId`](#delete-organizations-organizationid) | No declared body/query                                                               | 200     |
| GET    | [`/teams`](#get-teams)                                                   | Query: [ListTeamsDto](API_REQUEST_SCHEMAS.md#listteamsdto)                           | 200     |
| POST   | [`/teams`](#post-teams)                                                  | Body: [CreateTeamDto](API_REQUEST_SCHEMAS.md#createteamdto)                          | 201     |
| GET    | [`/teams/:teamId`](#get-teams-teamid)                                    | No declared body/query                                                               | 200     |
| GET    | [`/teams/:teamId/capacity`](#get-teams-teamid-capacity)                  | No declared body/query                                                               | 200     |
| PATCH  | [`/teams/:teamId`](#patch-teams-teamid)                                  | Body: [UpdateTeamDto](API_REQUEST_SCHEMAS.md#updateteamdto)                          | 200     |
| DELETE | [`/teams/:teamId`](#delete-teams-teamid)                                 | No declared body/query                                                               | 200     |

<a id="get-tenant"></a>

### GET /tenant

[TenantSettingsController.get](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L38)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

No declared JSON body or query parameters.

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'inactive';
  locale: string;
  timezone: string;
};
```

<a id="patch-tenant"></a>

### PATCH /tenant

[TenantSettingsController.update](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L42)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('tenant.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                             | Type / constraints                                   |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [UpdateTenantDto](API_REQUEST_SCHEMAS.md#updatetenantdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'inactive';
  locale: string;
  timezone: string;
};
```

<a id="get-organizations"></a>

### GET /organizations

[OrganizationAdministrationController.list](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L59)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                                 | Type / constraints                                   |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListWorkspaceResourcesDto](API_REQUEST_SCHEMAS.md#listworkspaceresourcesdto) | All fields, defaults and validators in linked schema |

**Success: 200.**

```ts
type ResponseBody = {
  items: Array<{
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    status: 'active' | 'inactive';
    createdAt: string /* ISO 8601 date-time */;
    updatedAt: string /* ISO 8601 date-time */;
  }>;
  nextCursor: null | string;
};
```

<a id="post-organizations"></a>

### POST /organizations

[OrganizationAdministrationController.create](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L63)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('organization.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateOrganizationDto](API_REQUEST_SCHEMAS.md#createorganizationdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-organizations-organizationid"></a>

### GET /organizations/:organizationId

[OrganizationAdministrationController.get](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L69)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema    | Type / constraints              |
| -------------- | ---------------- | ------------------------------- |
| Param          | `organizationId` | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="patch-organizations-organizationid"></a>

### PATCH /organizations/:organizationId

[OrganizationAdministrationController.update](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L76)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('organization.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                                         | Type / constraints                                   |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Param          | `organizationId`                                                      | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateOrganizationDto](API_REQUEST_SCHEMAS.md#updateorganizationdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                                            | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="delete-organizations-organizationid"></a>

### DELETE /organizations/:organizationId

[OrganizationAdministrationController.deactivate](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L87)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('organization.deactivate')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema    | Type / constraints                        |
| -------------- | ---------------- | ----------------------------------------- |
| Param          | `organizationId` | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`       | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
  summary: {
    scope: string;
  };
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string /* ISO 8601 date-time */;
  updatedAt: string /* ISO 8601 date-time */;
};
```

<a id="get-teams"></a>

### GET /teams

[TeamAdministrationController.list](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L104)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                       | Type / constraints                                   |
| -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Query          | [ListTeamsDto](API_REQUEST_SCHEMAS.md#listteamsdto) | All fields, defaults and validators in linked schema |

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

<a id="post-teams"></a>

### POST /teams

[TeamAdministrationController.create](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L108)

- **Access:** `AuthGuard`, `ClientAdminGuard`
- **Idempotency-Key:** required; `@Idempotent('team.create')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Body           | [CreateTeamDto](API_REQUEST_SCHEMAS.md#createteamdto) | All fields, defaults and validators in linked schema |

**Success: 201.**

```ts
type ResponseBody = {
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
};
```

<a id="get-teams-teamid"></a>

### GET /teams/:teamId

[TeamAdministrationController.get](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L114)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `teamId`      | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
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
};
```

<a id="get-teams-teamid-capacity"></a>

### GET /teams/:teamId/capacity

[TeamAdministrationController.capacity](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L121)

- **Access:** `AuthGuard`
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints              |
| -------------- | ------------- | ------------------------------- |
| Param          | `teamId`      | `string`; `new ParseUUIDPipe()` |

**Success: 200.**

```ts
type ResponseBody = {
  teamId: string;
  capacity: number;
  assigned: number;
  available: number;
  overCapacity: number;
  acceptingAssignments: boolean;
  constraints: {
    teamActive: boolean;
    pausedAssignmentsConsumeCapacity: boolean;
    memberCapacityIsGlobal: boolean;
    territoryAndCampaignEligibility: string;
  };
  paused: {};
  teamOwned: {};
  members: {
    items: Array<{
      eligible: boolean;
      available: null | number;
    }>;
    truncated: boolean;
  };
};
```

<a id="patch-teams-teamid"></a>

### PATCH /teams/:teamId

[TeamAdministrationController.update](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L128)

- **Access:** `AuthGuard`, `TeamManagementGuard`
- **Idempotency-Key:** required; `@Idempotent('team.update')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema                                         | Type / constraints                                   |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Param          | `teamId`                                              | `string`; `new ParseUUIDPipe()`                      |
| Body           | [UpdateTeamDto](API_REQUEST_SCHEMAS.md#updateteamdto) | All fields, defaults and validators in linked schema |
| Headers        | `if-match`                                            | `undefined \| string`; optional parameter            |

**Success: 200.**

```ts
type ResponseBody = {
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
};
```

<a id="delete-teams-teamid"></a>

### DELETE /teams/:teamId

[TeamAdministrationController.deactivate](../../apps/api/src/workspace-administration/workspace-administration.controller.ts#L139)

- **Access:** `AuthGuard`, `TeamManagementGuard`
- **Idempotency-Key:** required; `@Idempotent('team.deactivate')`.
- **Response headers:** `@UseInterceptors(ResourceETagInterceptor)`.

| Input location | Name / schema | Type / constraints                        |
| -------------- | ------------- | ----------------------------------------- |
| Param          | `teamId`      | `string`; `new ParseUUIDPipe()`           |
| Headers        | `if-match`    | `undefined \| string`; optional parameter |

**Success: 200.**

```ts
type ResponseBody = {
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
};
```
