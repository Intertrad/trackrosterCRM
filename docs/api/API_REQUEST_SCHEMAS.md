# Accepted API request data

[Overview](API_CATALOG.md) · [Endpoints](API_ENDPOINTS.md)

These tables include inherited DTO fields and the validation/transformation decorators attached to their declarations. A DTO is a request data class. Send JSON body fields as an object; query DTO fields go in the query string. A class name is a schema label, not a field to send.

“Optional” reflects a question-mark property, IsOptional, a default, or conditional validation. IsOptional skips validation for null as well as undefined; ValidateIf uses the exact condition shown. Business services can require combinations or restrict transitions further. Declared required fields overridden from a base DTO may still inherit base class-validator rules. Defaults shown are class initializers; additional service fallbacks remain implementation-specific.

Validators: IsUUID/IsEmail/IsISO8601/IsUrl validate formats; IsIn restricts values; Length/MinLength/MaxLength restrict text or array sizes as used; Min/Max restrict numbers; Matches is a regex; ArrayMinSize/ArrayMaxSize/ArrayUnique constrain arrays; Type/Transform convert input; ValidateNested applies child DTO validation. The exact decorator is retained where custom validation is used.

## Index

- [AcceptInvitationDto](#acceptinvitationdto)
- [AccessReviewDecisionDto](#accessreviewdecisiondto)
- [AcquireReservationDto](#acquirereservationdto)
- [AddCampaignProspectDto](#addcampaignprospectdto)
- [AddParticipantDto](#addparticipantdto)
- [AddStopDto](#addstopdto)
- [AddressDto](#addressdto)
- [ApiClientDto](#apiclientdto)
- [AssignCampaignProspectDto](#assigncampaignprospectdto)
- [AssignmentBatchDto](#assignmentbatchdto)
- [AssignmentEndDto](#assignmentenddto)
- [AssignmentListDto](#assignmentlistdto)
- [AssignmentRuleListDto](#assignmentrulelistdto)
- [AssignmentRulePatchDto](#assignmentrulepatchdto)
- [AssignmentRuleTargetDto](#assignmentruletargetdto)
- [AssignmentSelectionDto](#assignmentselectiondto)
- [AssignmentSuggestionDto](#assignmentsuggestiondto)
- [AttachUploadDto](#attachuploaddto)
- [AvatarDto](#avatardto)
- [CampaignStatusDto](#campaignstatusdto)
- [CancelFollowUpDto](#cancelfollowupdto)
- [CheckCollisionDto](#checkcollisiondto)
- [ClaimReservationDto](#claimreservationdto)
- [CollisionListDto](#collisionlistdto)
- [CompleteActionDto](#completeactiondto)
- [ConnectIntegrationDto](#connectintegrationdto)
- [ContactUpdateDto](#contactupdatedto)
- [ControlledExportQueryDto](#controlledexportquerydto)
- [ConversationListDto](#conversationlistdto)
- [CorrectionDto](#correctiondto)
- [CreateAccessGrantDto](#createaccessgrantdto)
- [CreateActionDto](#createactiondto)
- [CreateAssignmentDto](#createassignmentdto)
- [CreateAssignmentRuleDto](#createassignmentruledto)
- [CreateCampaignDto](#createcampaigndto)
- [CreateCampaignMemberDto](#createcampaignmemberdto)
- [CreateCampaignOrganizationDto](#createcampaignorganizationdto)
- [CreateCollisionOverrideDto](#createcollisionoverridedto)
- [CreateComplianceReportDto](#createcompliancereportdto)
- [CreateConsentDto](#createconsentdto)
- [CreateConversationDto](#createconversationdto)
- [CreateEstablishmentContactDto](#createestablishmentcontactdto)
- [CreateEstablishmentDto](#createestablishmentdto)
- [CreateInvitationDto](#createinvitationdto)
- [CreateObjectiveDto](#createobjectivedto)
- [CreateOrganizationDto](#createorganizationdto)
- [CreateProspectActivityDto](#createprospectactivitydto)
- [CreateProspectDto](#createprospectdto)
- [CreateProspectFollowUpDto](#createprospectfollowupdto)
- [CreateRegionDto](#createregiondto)
- [CreateRelationshipDto](#createrelationshipdto)
- [CreateReservationRuleDto](#createreservationruledto)
- [CreateRosterDto](#createrosterdto)
- [CreateRouteDto](#createroutedto)
- [CreateSavedViewDto](#createsavedviewdto)
- [CreateScheduledReportDto](#createscheduledreportdto)
- [CreateTeamDto](#createteamdto)
- [CreateTerritoryAssignmentDto](#createterritoryassignmentdto)
- [CreateTerritoryDto](#createterritorydto)
- [CreateUserDto](#createuserdto)
- [DispatchLocationDto](#dispatchlocationdto)
- [DownloadExportDto](#downloadexportdto)
- [DuplicateQueryDto](#duplicatequerydto)
- [EnrolCampaignProspectsDto](#enrolcampaignprospectsdto)
- [EvidenceExportScopeDto](#evidenceexportscopedto)
- [ExportRequestDto](#exportrequestdto)
- [ExtendReservationDto](#extendreservationdto)
- [FieldDto](#fielddto)
- [FieldValidationDto](#fieldvalidationdto)
- [FieldValuesDto](#fieldvaluesdto)
- [FieldVisibilityDto](#fieldvisibilitydto)
- [ForgotPasswordDto](#forgotpassworddto)
- [GeographicAllocationDto](#geographicallocationdto)
- [GetWorkQueueOptionsQueryDto](#getworkqueueoptionsquerydto)
- [GetWorkQueueProspectDetailQueryDto](#getworkqueueprospectdetailquerydto)
- [HeatmapDto](#heatmapdto)
- [ImportIssueResolutionDto](#importissueresolutiondto)
- [ImportMappingDto](#importmappingdto)
- [ImportRowsDto](#importrowsdto)
- [InvitationTokenDto](#invitationtokendto)
- [JobListDto](#joblistdto)
- [LinkTerritoryDto](#linkterritorydto)
- [ListActionsDto](#listactionsdto)
- [ListCampaignOrganizationsDto](#listcampaignorganizationsdto)
- [ListCampaignsDto](#listcampaignsdto)
- [ListConsentsDto](#listconsentsdto)
- [ListEstablishmentsQueryDto](#listestablishmentsquerydto)
- [ListFollowUpQueueQueryDto](#listfollowupqueuequerydto)
- [ListMembershipsDto](#listmembershipsdto)
- [ListNotificationsQueryDto](#listnotificationsquerydto)
- [ListParticipationDto](#listparticipationdto)
- [ListProspectTimelineQueryDto](#listprospecttimelinequerydto)
- [ListProspectsDto](#listprospectsdto)
- [ListRelationshipsDto](#listrelationshipsdto)
- [ListRosterDto](#listrosterdto)
- [ListSavedViewsDto](#listsavedviewsdto)
- [ListSessionsDto](#listsessionsdto)
- [ListTeamsDto](#listteamsdto)
- [ListWorkQueueQueryDto](#listworkqueuequerydto)
- [ListWorkspaceResourcesDto](#listworkspaceresourcesdto)
- [LoginDto](#logindto)
- [ManagerDashboardQueryDto](#managerdashboardquerydto)
- [MapAggregateDto](#mapaggregatedto)
- [MapViewportDto](#mapviewportdto)
- [MembershipReasonDto](#membershipreasondto)
- [MembershipScopeDto](#membershipscopedto)
- [MfaEnrollDto](#mfaenrolldto)
- [MfaRecoveryDto](#mfarecoverydto)
- [MfaStepUpDto](#mfastepupdto)
- [MfaVerifyDto](#mfaverifydto)
- [MuteConversationDto](#muteconversationdto)
- [NearbyEstablishmentsQueryDto](#nearbyestablishmentsquerydto)
- [NearbyProspectsDto](#nearbyprospectsdto)
- [NextFollowUpDto](#nextfollowupdto)
- [NotificationChannelDto](#notificationchanneldto)
- [NotificationPreferencesDto](#notificationpreferencesdto)
- [ObjectiveListDto](#objectivelistdto)
- [OutcomeDto](#outcomedto)
- [OverrideReasonDto](#overridereasondto)
- [PageDto](#pagedto)
- [PlatformGrantDto](#platformgrantdto)
- [PlatformGrantRevokeDto](#platformgrantrevokedto)
- [PlatformTenantConfigDto](#platformtenantconfigdto)
- [PlatformTenantStatusDto](#platformtenantstatusdto)
- [PresignUploadDto](#presignuploaddto)
- [ProspectorTodayQueryDto](#prospectortodayquerydto)
- [ReasonDto](#reasondto)
- [ReassignAssignmentDto](#reassignassignmentdto)
- [RefreshTokenDto](#refreshtokendto)
- [RegisterDeviceDto](#registerdevicedto)
- [ReleaseReservationDto](#releasereservationdto)
- [RescheduleProspectFollowUpDto](#rescheduleprospectfollowupdto)
- [ReservationListDto](#reservationlistdto)
- [ReservationRulePatchDto](#reservationrulepatchdto)
- [ResetPasswordDto](#resetpassworddto)
- [ResetTokenDto](#resettokendto)
- [ResolveDuplicateDto](#resolveduplicatedto)
- [RoleParamDto](#roleparamdto)
- [RolePermissionsDto](#rolepermissionsdto)
- [RosterTargetDto](#rostertargetdto)
- [RouteListDto](#routelistdto)
- [RoutePointDto](#routepointdto)
- [SearchQuery](#searchquery)
- [SelectWorkspaceDto](#selectworkspacedto)
- [SendMessageDto](#sendmessagedto)
- [SettingsDto](#settingsdto)
- [SsoSettingsDto](#ssosettingsdto)
- [StartActionDto](#startactiondto)
- [StopOrderDto](#stoporderdto)
- [SwitchMembershipDto](#switchmembershipdto)
- [TagDto](#tagdto)
- [TimelineQuery](#timelinequery)
- [UnassignedListDto](#unassignedlistdto)
- [UpdateAccountDto](#updateaccountdto)
- [UpdateActionDto](#updateactiondto)
- [UpdateAddressDto](#updateaddressdto)
- [UpdateAssignmentDto](#updateassignmentdto)
- [UpdateCampaignDto](#updatecampaigndto)
- [UpdateCampaignMemberDto](#updatecampaignmemberdto)
- [UpdateCampaignOrganizationDto](#updatecampaignorganizationdto)
- [UpdateCampaignProspectDto](#updatecampaignprospectdto)
- [UpdateConversationDto](#updateconversationdto)
- [UpdateEstablishmentContactDto](#updateestablishmentcontactdto)
- [UpdateEstablishmentDto](#updateestablishmentdto)
- [UpdateFieldDto](#updatefielddto)
- [UpdateFollowUpDto](#updatefollowupdto)
- [UpdateMembershipDto](#updatemembershipdto)
- [UpdateObjectiveDto](#updateobjectivedto)
- [UpdateOrganizationDto](#updateorganizationdto)
- [UpdatePreferencesDto](#updatepreferencesdto)
- [UpdateProspectDto](#updateprospectdto)
- [UpdateRegionDto](#updateregiondto)
- [UpdateRosterDto](#updaterosterdto)
- [UpdateRouteDto](#updateroutedto)
- [UpdateSavedViewDto](#updatesavedviewdto)
- [UpdateScheduledReportDto](#updatescheduledreportdto)
- [UpdateSecurityPolicyDto](#updatesecuritypolicydto)
- [UpdateStopDto](#updatestopdto)
- [UpdateTagDto](#updatetagdto)
- [UpdateTeamDto](#updateteamdto)
- [UpdateTenantDto](#updatetenantdto)
- [UpdateTerritoryAssignmentDto](#updateterritoryassignmentdto)
- [UpdateTerritoryDto](#updateterritorydto)
- [UpdateUserStatusDto](#updateuserstatusdto)
- [WebhookDto](#webhookdto)
- [WebhookUpdateDto](#webhookupdatedto)

## AcceptInvitationDto

[Source](../../apps/api/src/security-administration/invitation.dto.ts#L30)

| Field      | Type                  | Presence / default     | Validation / transformation                               |
| ---------- | --------------------- | ---------------------- | --------------------------------------------------------- |
| `password` | `string`              | Required               | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(128)`     |
| `mfaCode`  | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@Matches(/^\d{6}$/)` |

## AccessReviewDecisionDto

[Source](../../apps/api/src/compliance/compliance.dto.ts#L17)

| Field          | Type                                   | Presence / default     | Validation / transformation                            |
| -------------- | -------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `membershipId` | `string`                               | Required               | `@IsUUID()`                                            |
| `decision`     | `"revoke" \| "approve" \| "remediate"` | Required               | `@IsIn(ACCESS_REVIEW_DECISIONS)`                       |
| `reason`       | `undefined \| string`                  | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(2000)` |

Referenced validation constants:

```ts
const ACCESS_REVIEW_DECISIONS = ['approve', 'revoke', 'remediate'] as const;
```

## AcquireReservationDto

[Source](../../apps/api/src/reservations/acquire-reservation.dto.ts#L3)

| Field        | Type                  | Presence / default     | Validation / transformation    |
| ------------ | --------------------- | ---------------------- | ------------------------------ |
| `overrideId` | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()` |

## AddCampaignProspectDto

[Source](../../apps/api/src/campaigns/dto/add-campaign-prospect.dto.ts#L3)

| Field             | Type     | Presence / default | Validation / transformation |
| ----------------- | -------- | ------------------ | --------------------------- |
| `establishmentId` | `string` | Required           | `@IsUUID()`                 |

## AddParticipantDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L58)

| Field          | Type     | Presence / default | Validation / transformation |
| -------------- | -------- | ------------------ | --------------------------- |
| `membershipId` | `string` | Required           | `@IsUUID()`                 |

## AddStopDto

[Source](../../apps/api/src/routes/route.dto.ts#L56)

| Field                | Type                  | Presence / default     | Validation / transformation                              |
| -------------------- | --------------------- | ---------------------- | -------------------------------------------------------- |
| `campaignProspectId` | `string`              | Required               | `@IsUUID()`                                              |
| `actionId`           | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()` |

## AddressDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L60)

| Field         | Type                          | Presence / default     | Validation / transformation                                                                                                              |
| ------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `label`       | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(100)`                                                                                    |
| `line1`       | `string`                      | Required               | `@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)` |
| `line2`       | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                    |
| `postalCode`  | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                     |
| `city`        | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                    |
| `region`      | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                    |
| `countryCode` | `string`                      | Required               | `@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/)`                                                                                             |
| `latitude`    | `undefined \| null \| number` | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(-90)`<br>`@Max(90)`                                                                            |
| `longitude`   | `undefined \| null \| number` | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(-180)`<br>`@Max(180)`                                                                          |
| `isPrimary`   | `undefined \| false \| true`  | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsBoolean()`                                                                               |

## ApiClientDto

[Source](../../apps/api/src/integrations/integrations.dto.ts#L27)

| Field       | Type                  | Presence / default     | Validation / transformation                                                                                                                                                     |
| ----------- | --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `string`              | Required               | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)`                                                                                                                           |
| `scopes`    | `Array<string>`       | Required               | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_SCOPES)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-z][a-z0-9_.:-]{0,63}$/, { each: true })` |
| `expiresAt` | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsISO8601({ strict: true })`                                                                                                                               |

Referenced validation constants:

```ts
const MAX_SCOPES = 50;
```

## AssignCampaignProspectDto

[Source](../../apps/api/src/assignments/dto/assign-campaign-prospect.dto.ts#L3)

| Field            | Type                          | Presence / default     | Validation / transformation    |
| ---------------- | ----------------------------- | ---------------------- | ------------------------------ |
| `teamId`         | `string`                      | Required               | `@IsUUID()`                    |
| `assignedUserId` | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()` |

## AssignmentBatchDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L45)

| Field            | Type                          | Presence / default     | Validation / transformation                                                                                                                                            |
| ---------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaignId`     | `string`                      | Required               | `@IsUUID()`                                                                                                                                                            |
| `teamId`         | `undefined \| string`         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                         |
| `assignedUserId` | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                         |
| `ruleId`         | `undefined \| string`         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                         |
| `prospectIds`    | `Array<string>`               | Required               | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(100)`<br>`@ArrayUnique((v) => (typeof v === 'string' ? v.toLowerCase() : v))`<br>`@IsUUID('all', { each: true })` |

## AssignmentEndDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L33)

| Field    | Type     | Presence / default | Validation / transformation         |
| -------- | -------- | ------------------ | ----------------------------------- |
| `reason` | `string` | Required           | `@IsString()`<br>`@Length(3, 1000)` |

## AssignmentListDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L39)

| Field            | Type                                                            | Presence / default                   | Validation / transformation                                              |
| ---------------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `campaignId`     | `undefined \| string`                                           | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                           |
| `teamId`         | `undefined \| string`                                           | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                           |
| `assignedUserId` | `undefined \| string`                                           | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                           |
| `status`         | `undefined \| "active" \| "paused" \| "completed" \| "revoked"` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['active', 'paused', 'completed', 'revoked'])` |
| `cursor`         | `undefined \| string`                                           | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                           |
| `limit`          | `number`                                                        | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`          |

## AssignmentRuleListDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L84)

| Field        | Type     | Presence / default                   | Validation / transformation                                        |
| ------------ | -------- | ------------------------------------ | ------------------------------------------------------------------ |
| `campaignId` | `string` | Required                             | `@IsUUID()`                                                        |
| `limit`      | `number` | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`    |
| `offset`     | `number` | Optional / conditional; default `0`  | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(100000)` |

## AssignmentRulePatchDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L51)

| Field            | Type                                                                                                                                                                                           | Presence / default     | Validation / transformation                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | `undefined \| string`                                                                                                                                                                          | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@Length(1, 120)`                                                                                                       |
| `strategy`       | `undefined \| "capacity" \| "round_robin" \| "skill" \| "proximity"`                                                                                                                           | Optional / conditional | `@IsOptional()`<br>`@IsIn(['capacity', 'round_robin', 'skill', 'proximity'])`                                                                               |
| `targets`        | `undefined \| Array<{ skills?: undefined \| Array<string>; location?: undefined \| { longitude: number; latitude: number; }; teamId: string; assignedUserId?: undefined \| null \| string; }>` | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(50)`<br>`@ValidateNested({ each: true })`<br>`@Type(() => AssignmentRuleTargetDto)` |
| `priority`       | `undefined \| number`                                                                                                                                                                          | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(10000)`                                                                                                 |
| `isActive`       | `undefined \| false \| true`                                                                                                                                                                   | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                                           |
| `requiredSkills` | `undefined \| Array<string>`                                                                                                                                                                   | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(50)`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, { each: true })`     |
| `maxDistanceKm`  | `undefined \| null \| number`                                                                                                                                                                  | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(0.001)`<br>`@Max(20040)`                                                                                          |

## AssignmentRuleTargetDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L28)

| Field            | Type                                                    | Presence / default     | Validation / transformation                                                                                                                             |
| ---------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills`         | `undefined \| Array<string>`                            | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(50)`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, { each: true })` |
| `location`       | `undefined \| { longitude: number; latitude: number; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => DispatchLocationDto)`                                                                            |
| `teamId`         | `string`                                                | Required               | `@IsUUID()`                                                                                                                                             |
| `assignedUserId` | `undefined \| null \| string`                           | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                          |

## AssignmentSelectionDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L37)

| Field         | Type            | Presence / default | Validation / transformation                                                                                                                                            |
| ------------- | --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prospectIds` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(100)`<br>`@ArrayUnique((v) => (typeof v === 'string' ? v.toLowerCase() : v))`<br>`@IsUUID('all', { each: true })` |

## AssignmentSuggestionDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L90)

| Field                | Type     | Presence / default | Validation / transformation |
| -------------------- | -------- | ------------------ | --------------------------- |
| `ruleId`             | `string` | Required           | `@IsUUID()`                 |
| `campaignProspectId` | `string` | Required           | `@IsUUID()`                 |

## AttachUploadDto

[Source](../../apps/api/src/communications/communications.dto.ts#L33)

| Field         | Type     | Presence / default | Validation / transformation                                                  |
| ------------- | -------- | ------------------ | ---------------------------------------------------------------------------- |
| `objectKey`   | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(500)`                        |
| `filename`    | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                        |
| `contentType` | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)`                        |
| `byteSize`    | `number` | Required           | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(MAX_UPLOAD_BYTES)` |

Referenced validation constants:

```ts
const MAX_UPLOAD_BYTES = 25_000_000;
```

## AvatarDto

[Source](../../apps/api/src/account/account.dto.ts#L22)

| Field     | Type     | Presence / default                   | Validation / transformation                                                                           |
| --------- | -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `url`     | `string` | Required                             | `@IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })`<br>`@MaxLength(2048)` |
| `altText` | `string` | Optional / conditional; default `''` | `@IsString()`<br>`@MaxLength(120)`                                                                    |

## CampaignStatusDto

[Source](../../apps/api/src/campaigns/dto/campaign-status.dto.ts#L4)

| Field    | Type                                                           | Presence / default     | Validation / transformation                                                                                                                                                      |
| -------- | -------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status` | `"active" \| "archived" \| "draft" \| "paused" \| "completed"` | Required               | `@IsIn(['active', 'paused', 'completed', 'archived'])`                                                                                                                           |
| `reason` | `undefined \| string`                                          | Optional / conditional | `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsOptional()`<br>`@IsString()`<br>`@MinLength(3)`<br>`@MaxLength(1000)` |

## CancelFollowUpDto

[Source](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L35)

| Field    | Type     | Presence / default | Validation / transformation                             |
| -------- | -------- | ------------------ | ------------------------------------------------------- |
| `reason` | `string` | Required           | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(2000)` |

## CheckCollisionDto

[Source](../../apps/api/src/collisions/collision-workflow.dto.ts#L3)

| Field                | Type     | Presence / default | Validation / transformation |
| -------------------- | -------- | ------------------ | --------------------------- |
| `campaignId`         | `string` | Required           | `@IsUUID()`                 |
| `campaignProspectId` | `string` | Required           | `@IsUUID()`                 |

## ClaimReservationDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L24)

| Field                | Type                  | Presence / default     | Validation / transformation    |
| -------------------- | --------------------- | ---------------------- | ------------------------------ |
| `campaignId`         | `string`              | Required               | `@IsUUID()`                    |
| `campaignProspectId` | `string`              | Required               | `@IsUUID()`                    |
| `overrideId`         | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()` |

## CollisionListDto

[Source](../../apps/api/src/collisions/collision-workflow.dto.ts#L13)

| Field        | Type                                                                | Presence / default                   | Validation / transformation                                                                                 |
| ------------ | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `cursor`     | `undefined \| string`                                               | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                                              |
| `campaignId` | `undefined \| string`                                               | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                                              |
| `reasonCode` | `undefined \| string`                                               | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['ACTIVE_RESERVATION', 'ACTIVE_ASSIGNMENT', 'PLANNED_ACTION', 'RECENT_CONTACT'])` |
| `status`     | `undefined \| "pending" \| "cancelled" \| "approved" \| "rejected"` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['pending', 'approved', 'rejected', 'cancelled'])`                                |
| `limit`      | `number`                                                            | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                             |

## CompleteActionDto

[Source](../../apps/api/src/actions/action.dto.ts#L62)

| Field                    | Type                                                                                                                        | Presence / default                          | Validation / transformation                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `outcomeCode`            | `string`                                                                                                                    | Required                                    | `@IsString()`<br>`@Matches(/^[a-z][a-z0-9_]{0,39}$/)`                                                                                      |
| `notes`                  | `undefined \| string`                                                                                                       | Optional / conditional                      | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@MaxLength(10000)`                                                          |
| `lifecycleStage`         | `undefined \| "to_contact" \| "contact_made" \| "in_progress" \| "follow_up" \| "qualified" \| "converted"`                 | Optional / conditional                      | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['to_contact', 'contact_made', 'in_progress', 'follow_up', 'qualified', 'converted'])` |
| `contactUpdate`          | `undefined \| { contactId: string; name?: undefined \| string; email?: undefined \| string; phone?: undefined \| string; }` | Optional / conditional                      | `@ValidateIf((_o, v) => v !== undefined)`<br>`@ValidateNested()`<br>`@Type(() => ContactUpdateDto)`                                        |
| `nextFollowUp`           | `undefined \| { dueAt: string; channel?: undefined \| "email" \| "call" \| "message" \| "visit" \| "letter"; }`             | Optional / conditional                      | `@ValidateIf((_o, v) => v !== undefined)`<br>`@ValidateNested()`<br>`@Type(() => NextFollowUpDto)`                                         |
| `reservationDisposition` | `"release" \| "keep"`                                                                                                       | Optional / conditional; default `'release'` | `@IsIn(['keep', 'release'])`                                                                                                               |

## ConnectIntegrationDto

[Source](../../apps/api/src/integrations/integrations.dto.ts#L79)

| Field    | Type                                       | Presence / default     | Validation / transformation      |
| -------- | ------------------------------------------ | ---------------------- | -------------------------------- |
| `config` | `undefined \| { [key: string]: unknown; }` | Optional / conditional | `@IsOptional()`<br>`@IsObject()` |

## ContactUpdateDto

[Source](../../apps/api/src/actions/action.dto.ts#L40)

| Field       | Type                  | Presence / default     | Validation / transformation                                                                         |
| ----------- | --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `contactId` | `string`              | Required               | `@IsUUID()`                                                                                         |
| `name`      | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)` |
| `email`     | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsEmail()`<br>`@MaxLength(320)`                      |
| `phone`     | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(50)`  |

## ControlledExportQueryDto

[Source](../../apps/api/src/exports/dto/export-query.dto.ts#L19)

| Field            | Type                                           | Presence / default                      | Validation / transformation                           |
| ---------------- | ---------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `format`         | `"csv" \| "xlsx"`                              | Optional / conditional; default `'csv'` | `@IsOptional()`<br>`@IsIn(CONTROLLED_EXPORT_FORMATS)` |
| `from`           | `undefined \| string /* ISO 8601 date-time */` | Optional / conditional                  | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()` |
| `to`             | `undefined \| string /* ISO 8601 date-time */` | Optional / conditional                  | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()` |
| `organizationId` | `undefined \| string`                          | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                        |
| `teamId`         | `undefined \| string`                          | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                        |
| `userId`         | `undefined \| string`                          | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                        |
| `campaignId`     | `undefined \| string`                          | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                        |

Referenced validation constants:

```ts
const CONTROLLED_EXPORT_FORMATS = ['csv', 'xlsx'] as const;
```

## ConversationListDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L84)

| Field    | Type                  | Presence / default                   | Validation / transformation                                                        |
| -------- | --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `cursor` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsString()`<br>`@Matches(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\\       | [0-9a-fA-F-]{36}$/)` |
| `limit`  | `number`              | Optional / conditional; default `50` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## CorrectionDto

[Source](../../apps/api/src/actions/action.dto.ts#L82)

| Field         | Type                  | Presence / default     | Validation / transformation                                                                        |
| ------------- | --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `notes`       | `string`              | Required               | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(10000)`                                           |
| `outcomeCode` | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/^[a-z][a-z0-9_]{0,39}$/)` |
| `reason`      | `string`              | Required               | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(2000)`                                            |

## CreateAccessGrantDto

[Source](../../apps/api/src/authorization/dto/create-access-grant.dto.ts#L5)

| Field            | Type                                                                      | Presence / default     | Validation / transformation                                                |
| ---------------- | ------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `role`           | `"client_admin" \| "director" \| "manager" \| "prospector" \| "observer"` | Required               | `@IsIn(['client_admin', 'director', 'manager', 'prospector', 'observer'])` |
| `scopeType`      | `"tenant" \| "organization" \| "team"`                                    | Required               | `@IsIn(['tenant', 'organization', 'team'])`                                |
| `organizationId` | `undefined \| string`                                                     | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                             |
| `teamId`         | `undefined \| string`                                                     | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                             |

## CreateActionDto

[Source](../../apps/api/src/actions/action.dto.ts#L29)

| Field                  | Type                                                            | Presence / default     | Validation / transformation                                                                                                        |
| ---------------------- | --------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `campaignId`           | `string`                                                        | Required               | `@IsUUID()`                                                                                                                        |
| `campaignProspectId`   | `string`                                                        | Required               | `@IsUUID()`                                                                                                                        |
| `type`                 | `"email" \| "call" \| "message" \| "visit" \| "task" \| "note"` | Required               | `@IsIn(['call', 'email', 'message', 'visit', 'task', 'note'])`                                                                     |
| `subject`              | `string`                                                        | Required               | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                                                                             |
| `assigneeMembershipId` | `undefined \| string`                                           | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `notes`                | `undefined \| null \| string`                                   | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsString()`<br>`@MaxLength(10000)`                                    |
| `dueAt`                | `undefined \| null \| string`                                   | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## CreateAssignmentDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L24)

| Field                | Type                          | Presence / default     | Validation / transformation    |
| -------------------- | ----------------------------- | ---------------------- | ------------------------------ |
| `campaignId`         | `string`                      | Required               | `@IsUUID()`                    |
| `campaignProspectId` | `string`                      | Required               | `@IsUUID()`                    |
| `teamId`             | `string`                      | Required               | `@IsUUID()`                    |
| `assignedUserId`     | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()` |

## CreateAssignmentRuleDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L72)

| Field            | Type                                                                                                                                                                              | Presence / default     | Validation / transformation                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaignId`     | `string`                                                                                                                                                                          | Required               | `@IsUUID()`                                                                                                                                             |
| `name`           | `string`                                                                                                                                                                          | Required               | `@IsString()`<br>`@Length(1, 120)`                                                                                                                      |
| `strategy`       | `"capacity" \| "round_robin" \| "skill" \| "proximity"`                                                                                                                           | Required               | `@IsIn(['capacity', 'round_robin', 'skill', 'proximity'])`                                                                                              |
| `targets`        | `Array<{ skills?: undefined \| Array<string>; location?: undefined \| { longitude: number; latitude: number; }; teamId: string; assignedUserId?: undefined \| null \| string; }>` | Required               | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(50)`<br>`@ValidateNested({ each: true })`<br>`@Type(() => AssignmentRuleTargetDto)`                |
| `priority`       | `undefined \| number`                                                                                                                                                             | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(10000)`                                                                                             |
| `isActive`       | `undefined \| false \| true`                                                                                                                                                      | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                                       |
| `requiredSkills` | `undefined \| Array<string>`                                                                                                                                                      | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(50)`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, { each: true })` |
| `maxDistanceKm`  | `undefined \| null \| number`                                                                                                                                                     | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(0.001)`<br>`@Max(20040)`                                                                                      |

## CreateCampaignDto

[Source](../../apps/api/src/campaigns/dto/create-campaign.dto.ts#L4)

| Field            | Type                                                   | Presence / default     | Validation / transformation                             |
| ---------------- | ------------------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| `organizationId` | `string`                                               | Required               | `@IsUUID()`                                             |
| `name`           | `string`                                               | Required               | `@IsString()`<br>`@MaxLength(255)`                      |
| `description`    | `undefined \| null \| string`                          | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(10000)` |
| `startsAt`       | `undefined \| null \| string /* ISO 8601 date-time */` | Optional / conditional | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`   |
| `endsAt`         | `undefined \| null \| string /* ISO 8601 date-time */` | Optional / conditional | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`   |

## CreateCampaignMemberDto

[Source](../../apps/api/src/participation/participation.dto.ts#L24)

| Field          | Type                                                   | Presence / default     | Validation / transformation                                                                                                        |
| -------------- | ------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `campaignRole` | `undefined \| "observer" \| "member" \| "coordinator"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['member', 'coordinator', 'observer'])`                                        |
| `membershipId` | `undefined \| string`                                  | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `teamId`       | `undefined \| string`                                  | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `startsAt`     | `undefined \| string`                                  | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`       | `undefined \| null \| string`                          | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## CreateCampaignOrganizationDto

[Source](../../apps/api/src/campaign-organizations/campaign-organization.dto.ts#L3)

| Field            | Type                           | Presence / default                              | Validation / transformation           |
| ---------------- | ------------------------------ | ----------------------------------------------- | ------------------------------------- |
| `organizationId` | `string`                       | Required                                        | `@IsUUID()`                           |
| `accessMode`     | `"participate" \| "read_only"` | Optional / conditional; default `'participate'` | `@IsIn(['participate', 'read_only'])` |

## CreateCollisionOverrideDto

[Source](../../apps/api/src/collisions/create-collision-override.dto.ts#L3)

| Field              | Type     | Presence / default | Validation / transformation                             |
| ------------------ | -------- | ------------------ | ------------------------------------------------------- |
| `prospectorUserId` | `string` | Required           | `@IsUUID()`                                             |
| `reason`           | `string` | Required           | `@IsString()`<br>`@MinLength(10)`<br>`@MaxLength(1000)` |

## CreateComplianceReportDto

[Source](../../apps/api/src/compliance/compliance.dto.ts#L34)

| Field        | Type                                       | Presence / default     | Validation / transformation                                       |
| ------------ | ------------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| `reportType` | `string`                                   | Required               | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(MAX_REPORT_TYPE)` |
| `parameters` | `undefined \| { [key: string]: unknown; }` | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                  |

Referenced validation constants:

```ts
const MAX_REPORT_TYPE = 60;
```

## CreateConsentDto

[Source](../../apps/api/src/consents/consent.dto.ts#L15)

| Field         | Type                                              | Presence / default     | Validation / transformation                                                                                                        |
| ------------- | ------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `contactId`   | `undefined \| string`                             | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `channel`     | `"email" \| "phone" \| "all" \| "visit" \| "sms"` | Required               | `@IsIn(['all', 'phone', 'email', 'sms', 'visit'])`                                                                                 |
| `status`      | `"allowed" \| "blocked" \| "unknown"`             | Required               | `@IsIn(['allowed', 'blocked', 'unknown'])`                                                                                         |
| `reason`      | `string`                                          | Required               | `@IsString()`<br>`@MaxLength(2000)`<br>`@Matches(/\S/)`                                                                            |
| `evidence`    | `undefined \| { [key: string]: string; }`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsObject()`                                                                         |
| `effectiveAt` | `undefined \| string`                             | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `expiresAt`   | `undefined \| null \| string`                     | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## CreateConversationDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L34)

| Field            | Type                                             | Presence / default     | Validation / transformation                                                                                   |
| ---------------- | ------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `kind`           | `"prospect" \| "team" \| "campaign" \| "direct"` | Required               | `@IsIn(CONVERSATION_KINDS)`                                                                                   |
| `title`          | `undefined \| string`                            | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(200)`                                                         |
| `participantIds` | `undefined \| Array<string>`                     | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayUnique()`<br>`@ArrayMaxSize(200)`<br>`@IsUUID('4', { each: true })` |

Referenced validation constants:

```ts
const CONVERSATION_KINDS = ['direct', 'team', 'prospect', 'campaign'] as const;
```

## CreateEstablishmentContactDto

[Source](../../apps/api/src/establishment-contacts/dto/create-establishment-contact.dto.ts#L3)

| Field       | Type                          | Presence / default     | Validation / transformation                                                                                                             |
| ----------- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                   |
| `jobTitle`  | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                   |
| `email`     | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsEmail()`<br>`@MaxLength(320)` |
| `phone`     | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                    |
| `isPrimary` | `undefined \| false \| true`  | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                       |

## CreateEstablishmentDto

[Source](../../apps/api/src/establishments/dto/create-establishment.dto.ts#L15)

| Field               | Type                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `string`                                                                                                                              | Required               | `@IsString()`<br>`@MaxLength(255)`                                                                                                                                    |
| `externalReference` | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `addressLine1`      | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `regionId`          | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                        |
| `category`          | `undefined \| null \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional | `@IsOptional()`<br>`@IsIn([ 'prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs', ] satisfies EstablishmentCategory[])` |
| `postalCode`        | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                                                  |
| `city`              | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                 |
| `countryCode`       | `string`                                                                                                                              | Required               | `@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must contain exactly two letters', })`                                                            |
| `phone`             | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                                                  |
| `website`           | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(2048)`                                                                                                                |
| `latitude`          | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-90)`<br>`@Max(90)`                                                               |
| `longitude`         | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-180)`<br>`@Max(180)`                                                             |

## CreateInvitationDto

[Source](../../apps/api/src/security-administration/invitation.dto.ts#L12)

| Field            | Type                                                                     | Presence / default     | Validation / transformation                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`          | `string`                                                                 | Required               | `@Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value, )`<br>`@IsEmail()`<br>`@MaxLength(320)`                          |
| `role`           | `"director" \| "manager" \| "prospector" \| "tenant_admin" \| "auditor"` | Required               | `@IsIn(['tenant_admin', 'director', 'manager', 'prospector', 'auditor'])`                                                                                                       |
| `organizationId` | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                  |
| `teamId`         | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                  |
| `displayName`    | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)` |

## CreateObjectiveDto

[Source](../../apps/api/src/objectives/objective.dto.ts#L21)

| Field            | Type                                                                                                                    | Presence / default     | Validation / transformation                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `organizationId` | `string`                                                                                                                | Required               | `@IsUUID()`                                                             |
| `teamId`         | `undefined \| string`                                                                                                   | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                |
| `campaignId`     | `undefined \| string`                                                                                                   | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                |
| `ownerId`        | `undefined \| string`                                                                                                   | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                |
| `name`           | `string`                                                                                                                | Required               | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                  |
| `metric`         | `"completed_actions" \| "completed_visits" \| "qualified_prospects" \| "converted_prospects" \| "completed_follow_ups"` | Required               | `@IsIn(OBJECTIVE_METRICS)`                                              |
| `target`         | `number`                                                                                                                | Required               | `@IsInt()`<br>`@Min(1)`<br>`@Max(10000000)`                             |
| `startsAt`       | `string`                                                                                                                | Required               | `@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |
| `endsAt`         | `string`                                                                                                                | Required               | `@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

Referenced validation constants:

```ts
const OBJECTIVE_METRICS = [
  'completed_actions',
  'completed_visits',
  'qualified_prospects',
  'converted_prospects',
  'completed_follow_ups',
] as const;
```

## CreateOrganizationDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L31)

| Field  | Type     | Presence / default | Validation / transformation                                                                          |
| ------ | -------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `name` | `string` | Required           | `@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                          |
| `slug` | `string` | Required           | `@Transform(trim)`<br>`@IsString()`<br>`@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`<br>`@MaxLength(100)` |

Referenced validation constants:

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## CreateProspectActivityDto

[Source](../../apps/api/src/activities/prospect-activity.dto.ts#L8)

| Field  | Type                                        | Presence / default | Validation / transformation                  |
| ------ | ------------------------------------------- | ------------------ | -------------------------------------------- |
| `type` | `"email" \| "call" \| "message" \| "visit"` | Required           | `@IsIn(prospectActivityTypeEnum.enumValues)` |

## CreateProspectDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L24)

| Field               | Type                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `string`                                                                                                                              | Required               | `@IsString()`<br>`@MaxLength(255)`                                                                                                                                    |
| `externalReference` | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `addressLine1`      | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `regionId`          | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                        |
| `category`          | `undefined \| null \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional | `@IsOptional()`<br>`@IsIn([ 'prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs', ] satisfies EstablishmentCategory[])` |
| `postalCode`        | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                                                  |
| `city`              | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                 |
| `countryCode`       | `string`                                                                                                                              | Required               | `@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must contain exactly two letters', })`                                                            |
| `phone`             | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                                                  |
| `website`           | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(2048)`                                                                                                                |
| `latitude`          | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-90)`<br>`@Max(90)`                                                               |
| `longitude`         | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-180)`<br>`@Max(180)`                                                             |

## CreateProspectFollowUpDto

[Source](../../apps/api/src/follow-ups/prospect-follow-up.dto.ts#L11)

| Field            | Type                                                                         | Presence / default     | Validation / transformation                                                                      |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `dueAt`          | `string /* ISO 8601 date-time */`                                            | Required               | `@Type(() => Date)`<br>`@IsDate()`                                                               |
| `assignedUserId` | `undefined \| null \| string`                                                | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                   |
| `category`       | `undefined \| "follow_up" \| "todo" \| "meeting"`                            | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsIn(PROSPECT_FOLLOW_UP_CATEGORIES)` |
| `channel`        | `undefined \| null \| "email" \| "call" \| "message" \| "visit" \| "letter"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(PROSPECT_FOLLOW_UP_CHANNELS)`                                          |

Referenced validation constants:

```ts
const PROSPECT_FOLLOW_UP_CATEGORIES = ['todo', 'follow_up', 'meeting'] as const;
```

```ts
const PROSPECT_FOLLOW_UP_CHANNELS = ['call', 'email', 'message', 'visit', 'letter'] as const;
```

## CreateRegionDto

[Source](../../apps/api/src/regions/dto/create-region.dto.ts#L5)

| Field            | Type                                                           | Presence / default     | Validation / transformation                                                              |
| ---------------- | -------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `name`           | `string`                                                       | Required               | `@IsString()`<br>`@MaxLength(255)`                                                       |
| `code`           | `undefined \| null \| string`                                  | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(100)`                                    |
| `type`           | `"country" \| "administrative" \| "city" \| "sales_territory"` | Required               | `@IsIn(['country', 'administrative', 'city', 'sales_territory'] satisfies RegionType[])` |
| `parentRegionId` | `undefined \| null \| string`                                  | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                           |

## CreateRelationshipDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L3)

| Field                  | Type                                                 | Presence / default | Validation / transformation                             |
| ---------------------- | ---------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| `parentOrganizationId` | `string`                                             | Required           | `@IsUUID()`                                             |
| `childOrganizationId`  | `string`                                             | Required           | `@IsUUID()`                                             |
| `relationshipType`     | `"brand" \| "parent" \| "partner" \| "coordination"` | Required           | `@IsIn(['parent', 'brand', 'partner', 'coordination'])` |

## CreateReservationRuleDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L21)

| Field                  | Type                         | Presence / default     | Validation / transformation                                 |
| ---------------------- | ---------------------------- | ---------------------- | ----------------------------------------------------------- |
| `campaignId`           | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                              |
| `durationMinutes`      | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(240)`   |
| `cooldownMinutes`      | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(10080)` |
| `maxHoldMinutes`       | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(1440)`  |
| `allowHeartbeat`       | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |
| `allowExtension`       | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |
| `allowManagerOverride` | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |

## CreateRosterDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L30)

| Field          | Type                                 | Presence / default     | Validation / transformation                                                                                                        |
| -------------- | ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `membershipId` | `string`                             | Required               | `@IsUUID()`                                                                                                                        |
| `teamRole`     | `undefined \| "manager" \| "member"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['manager', 'member'])`                                                        |
| `startsAt`     | `undefined \| string`                | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`       | `undefined \| null \| string`        | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## CreateRouteDto

[Source](../../apps/api/src/routes/route.dto.ts#L42)

| Field         | Type                                                            | Presence / default     | Validation / transformation                                                                                                     |
| ------------- | --------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `teamId`      | `string`                                                        | Required               | `@IsUUID()`                                                                                                                     |
| `name`        | `string`                                                        | Required               | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                                                                          |
| `scheduledAt` | `string`                                                        | Required               | `@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                                                         |
| `startPoint`  | `{ latitude: number; longitude: number; }`                      | Required               | `@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => RoutePointDto)`                                                            |
| `endPoint`    | `undefined \| null \| { latitude: number; longitude: number; }` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => RoutePointDto)` |

## CreateSavedViewDto

[Source](../../apps/api/src/saved-views/saved-views.dto.ts#L40)

| Field       | Type                                                                                      | Presence / default     | Validation / transformation                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource`  | `"campaigns" \| "follow-ups" \| "prospects" \| "activities" \| "assignments" \| "routes"` | Required               | `@IsIn(SAVED_VIEW_RESOURCES)`                                                                                                                   |
| `name`      | `string`                                                                                  | Required               | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(MAX_SAVED_VIEW_NAME)`                                                                           |
| `filters`   | `{ [key: string]: unknown; }`                                                             | Required               | `@IsObject()`                                                                                                                                   |
| `sort`      | `undefined \| { [key: string]: string; }`                                                 | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                                                                                                |
| `columns`   | `Array<string>`                                                                           | Required               | `@IsArray()`<br>`@ArrayMaxSize(MAX_SAVED_VIEW_COLUMNS)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@MaxLength(120, { each: true })` |
| `shared`    | `undefined \| false \| true`                                                              | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`<br>`@Type(() => Boolean)`                                                                                     |
| `isDefault` | `undefined \| false \| true`                                                              | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`<br>`@Type(() => Boolean)`                                                                                     |

Referenced validation constants:

```ts
const SAVED_VIEW_RESOURCES = [
  'prospects',
  'campaigns',
  'activities',
  'follow-ups',
  'assignments',
  'routes',
] as const;
```

```ts
const MAX_SAVED_VIEW_NAME = 120;
```

```ts
const MAX_SAVED_VIEW_COLUMNS = 100;
```

## CreateScheduledReportDto

[Source](../../apps/api/src/scheduled-reports/scheduled-reports.dto.ts#L46)

| Field        | Type                                                                                                                                                                | Presence / default     | Validation / transformation                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportKey`  | `"actions" \| "overview" \| "workload" \| "funnel" \| "conversions" \| "follow-ups" \| "coverage" \| "collisions" \| "data-quality" \| "territories" \| "forecast"` | Required               | `@IsIn(REPORT_KEYS)`                                                                                                                                             |
| `cadence`    | `"daily" \| "weekly" \| "monthly"`                                                                                                                                  | Required               | `@IsIn(CADENCES)`                                                                                                                                                |
| `format`     | `"csv" \| "xlsx" \| "pdf"`                                                                                                                                          | Required               | `@IsIn(FORMATS)`                                                                                                                                                 |
| `recipients` | `Array<string>`                                                                                                                                                     | Required               | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_RECIPIENTS)`<br>`@ArrayUnique()`<br>`@IsEmail({}, { each: true })`<br>`@MaxLength(320, { each: true })` |
| `filters`    | `undefined \| { [key: string]: unknown; }`                                                                                                                          | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                                                                                                                 |
| `timezone`   | `undefined \| string`                                                                                                                                               | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(64)`<br>`@Matches(/^[A-Za-z0-9_+\-/]+$/)`                                                                        |
| `nextRunAt`  | `undefined \| string`                                                                                                                                               | Optional / conditional | `@IsOptional()`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                                                                       |

Referenced validation constants:

```ts
const REPORT_KEYS = [
  'overview',
  'workload',
  'actions',
  'funnel',
  'conversions',
  'follow-ups',
  'coverage',
  'collisions',
  'data-quality',
  'territories',
  'forecast',
] as const;
```

```ts
const CADENCES = ['daily', 'weekly', 'monthly'] as const;
```

```ts
const FORMATS = ['csv', 'xlsx', 'pdf'] as const;
```

```ts
const MAX_RECIPIENTS = 50;
```

## CreateTeamDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L47)

| Field                 | Type                          | Presence / default     | Validation / transformation                                                                          |
| --------------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `organizationId`      | `string`                      | Required               | `@IsUUID()`                                                                                          |
| `capacity`            | `undefined \| number`         | Optional / conditional | `@ValidateIf(optional)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100000)`                                 |
| `managerMembershipId` | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_, value) => value !== undefined && value !== null)`<br>`@IsUUID()`                    |
| `name`                | `string`                      | Required               | `@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                          |
| `slug`                | `string`                      | Required               | `@Transform(trim)`<br>`@IsString()`<br>`@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`<br>`@MaxLength(100)` |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## CreateTerritoryAssignmentDto

[Source](../../apps/api/src/participation/participation.dto.ts#L17)

| Field          | Type                          | Presence / default     | Validation / transformation                                                                                                        |
| -------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `territoryId`  | `string`                      | Required               | `@IsUUID()`                                                                                                                        |
| `priority`     | `undefined \| number`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(100000)`                                             |
| `membershipId` | `undefined \| string`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `teamId`       | `undefined \| string`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                                           |
| `startsAt`     | `undefined \| string`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`       | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## CreateTerritoryDto

[Source](../../apps/api/src/territories/territory.dto.ts#L12)

| Field      | Type                                               | Presence / default     | Validation / transformation                                                                                                            |
| ---------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | `string`                                           | Required               | `@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                                                            |
| `code`     | `undefined \| null \| string`                      | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(100)` |
| `parentId` | `undefined \| null \| string`                      | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsUUID()`                                                                 |
| `boundary` | `undefined \| null \| { [key: string]: unknown; }` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsObject()`                                                               |

Referenced validation constants:

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## CreateUserDto

[Source](../../apps/api/src/user-management/dto/create-user.dto.ts#L3)

| Field      | Type     | Presence / default | Validation / transformation                                                |
| ---------- | -------- | ------------------ | -------------------------------------------------------------------------- |
| `email`    | `string` | Required           | `@IsEmail()`<br>`@MaxLength(320)`                                          |
| `password` | `string` | Required           | `@IsString()`<br>`@IsNotEmpty()`<br>`@MinLength(12)`<br>`@MaxLength(1024)` |

## DispatchLocationDto

[Source](../../apps/api/src/assignments/assignment-batch.dto.ts#L24)

| Field       | Type     | Presence / default | Validation / transformation                  |
| ----------- | -------- | ------------------ | -------------------------------------------- |
| `longitude` | `number` | Required           | `@IsNumber()`<br>`@Min(-180)`<br>`@Max(180)` |
| `latitude`  | `number` | Required           | `@IsNumber()`<br>`@Min(-90)`<br>`@Max(90)`   |

## DownloadExportDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L41)

| Field   | Type     | Presence / default | Validation / transformation |
| ------- | -------- | ------------------ | --------------------------- |
| `token` | `string` | Required           | `@IsString()`               |

## DuplicateQueryDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L98)

| Field        | Type                  | Presence / default                          | Validation / transformation                                               |
| ------------ | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `resolution` | `string`              | Optional / conditional; default `'pending'` | `@IsOptional()`<br>`@IsIn(['pending', 'not_duplicate', 'merged', 'all'])` |
| `cursor`     | `undefined \| string` | Optional / conditional                      | `@IsOptional()`<br>`@IsUUID()`                                            |
| `limit`      | `number`              | Optional / conditional; default `50`        | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`           |

## EnrolCampaignProspectsDto

[Source](../../apps/api/src/campaigns/dto/enrol-campaign-prospects.dto.ts#L43)

| Field              | Type                                                                                                                          | Presence / default                      | Validation / transformation                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `establishmentIds` | `undefined \| Array<string>`                                                                                                  | Optional / conditional                  | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_ENROLMENT_ROWS)`<br>`@ArrayUnique((value) => (typeof value === 'string' ? value.toLowerCase() : value))`<br>`@IsUUID('all', { each: true })` |
| `search`           | `undefined \| string`                                                                                                         | Optional / conditional                  | `@IsOptional()`<br>`@IsString()`<br>`@Length(1, 200)`                                                                                                                                                                    |
| `category`         | `undefined \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional                  | `@IsOptional()`<br>`@IsIn(ESTABLISHMENT_CATEGORIES)`                                                                                                                                                                     |
| `department`       | `undefined \| string`                                                                                                         | Optional / conditional                  | `@IsOptional()`<br>`@Matches(DEPARTMENT_PATTERN)`                                                                                                                                                                        |
| `city`             | `undefined \| string`                                                                                                         | Optional / conditional                  | `@IsOptional()`<br>`@IsString()`<br>`@Length(1, 150)`                                                                                                                                                                    |
| `regionId`         | `undefined \| string`                                                                                                         | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                                           |
| `limit`            | `number`                                                                                                                      | Optional / conditional; default `1_000` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(MAX_ENROLMENT_ROWS)`                                                                                                                                           |

Referenced validation constants:

```ts
const MAX_ENROLMENT_ROWS = 10_000;
```

```ts
const ESTABLISHMENT_CATEGORIES = establishmentCategoryEnum.enumValues;
```

```ts
const DEPARTMENT_PATTERN = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;
```

## EvidenceExportScopeDto

[Source](../../apps/api/src/audit/audit.dto.ts#L35)

| Field           | Type                         | Presence / default     | Validation / transformation                                                                                                                                                          |
| --------------- | ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resourceTypes` | `undefined \| Array<string>` | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(MAX_EVIDENCE_ACTIONS)`<br>`@ArrayUnique()`<br>`@IsIn(EVIDENCE_RESOURCE_TYPES, { each: true })`                                     |
| `actions`       | `undefined \| Array<string>` | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(MAX_EVIDENCE_ACTIONS)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })` |
| `membershipId`  | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                       |
| `from`          | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                                                                                           |
| `to`            | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                                                                                           |
| `reason`        | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(1000)`                                                                                                                               |

Referenced validation constants:

```ts
const MAX_EVIDENCE_ACTIONS = 50;
```

```ts
const EVIDENCE_RESOURCE_TYPES = [
  'assignment',
  'collision',
  'export',
  'override_request',
  'prospect',
  'security',
  'tenant_membership',
  'role',
  'import',
] as const;
```

## ExportRequestDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L31)

| Field            | Type                                            | Presence / default                      | Validation / transformation                                                                               |
| ---------------- | ----------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `type`           | `"activities" \| "assignments" \| "follow_ups"` | Required                                | `@IsIn(['assignments', 'activities', 'follow_ups'])`                                                      |
| `fields`         | `undefined \| Array<string>`                    | Optional / conditional                  | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayUnique()`<br>`@ArrayMaxSize(40)`<br>`@IsString({ each: true })` |
| `format`         | `"csv" \| "xlsx"`                               | Optional / conditional; default `'csv'` | `@IsOptional()`<br>`@IsIn(CONTROLLED_EXPORT_FORMATS)`                                                     |
| `from`           | `undefined \| string /* ISO 8601 date-time */`  | Optional / conditional                  | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`                                                     |
| `to`             | `undefined \| string /* ISO 8601 date-time */`  | Optional / conditional                  | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`                                                     |
| `organizationId` | `undefined \| string`                           | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                                                                            |
| `teamId`         | `undefined \| string`                           | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                                                                            |
| `userId`         | `undefined \| string`                           | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                                                                            |
| `campaignId`     | `undefined \| string`                           | Optional / conditional                  | `@IsOptional()`<br>`@IsUUID()`                                                                            |

Referenced validation constants:

```ts
const CONTROLLED_EXPORT_FORMATS = ['csv', 'xlsx'] as const;
```

## ExtendReservationDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L29)

| Field     | Type     | Presence / default | Validation / transformation            |
| --------- | -------- | ------------------ | -------------------------------------- |
| `minutes` | `number` | Required           | `@IsInt()`<br>`@Min(1)`<br>`@Max(240)` |

## FieldDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L57)

| Field        | Type                                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `fieldKey`   | `string`                                                                                                                                              | Required               | `@Matches(/^[a-z][a-z0-9_]{0,63}$/)`                                                                                                     |
| `label`      | `string`                                                                                                                                              | Required               | `@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(100)` |
| `dataType`   | `string`                                                                                                                                              | Required               | `@IsIn(['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'json'])`                                                         |
| `validation` | `undefined \| { required?: undefined \| false \| true; min?: undefined \| number; max?: undefined \| number; options?: undefined \| Array<string>; }` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => FieldValidationDto)`                    |
| `visibility` | `undefined \| { roles?: undefined \| Array<string>; }`                                                                                                | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => FieldVisibilityDto)`                    |

## FieldValidationDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L37)

| Field      | Type                         | Presence / default     | Validation / transformation                                                                                                                                              |
| ---------- | ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `required` | `undefined \| false \| true` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsBoolean()`                                                                                                               |
| `min`      | `undefined \| number`        | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsNumber()`                                                                                                                |
| `max`      | `undefined \| number`        | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsNumber()`                                                                                                                |
| `options`  | `undefined \| Array<string>` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsArray()`<br>`@ArrayMaxSize(100)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@MaxLength(100, { each: true })` |

## FieldValuesDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L95)

| Field    | Type                          | Presence / default | Validation / transformation |
| -------- | ----------------------------- | ------------------ | --------------------------- |
| `values` | `{ [key: string]: unknown; }` | Required           | `@IsObject()`               |

## FieldVisibilityDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L49)

| Field   | Type                         | Presence / default     | Validation / transformation                                                                                                                                                                     |
| ------- | ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles` | `undefined \| Array<string>` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsArray()`<br>`@ArrayMaxSize(5)`<br>`@ArrayUnique()`<br>`@IsIn(['tenant_admin', 'director', 'manager', 'prospector', 'auditor'], { each: true })` |

## ForgotPasswordDto

[Source](../../apps/api/src/auth/password-recovery.controller.ts#L6)

| Field   | Type     | Presence / default | Validation / transformation                                                                                                                            |
| ------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `email` | `string` | Required           | `@Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value, )`<br>`@IsEmail()`<br>`@MaxLength(320)` |

## GeographicAllocationDto

[Source](../../apps/api/src/geographic-allocation/allocation.dto.ts#L2)

| Field         | Type            | Presence / default | Validation / transformation                                                                                                                                            |
| ------------- | --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prospectIds` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(100)`<br>`@ArrayUnique((v) => (typeof v === 'string' ? v.toLowerCase() : v))`<br>`@IsUUID('all', { each: true })` |

## GetWorkQueueOptionsQueryDto

[Source](../../apps/api/src/work-queue/dto/get-work-queue-options-query.dto.ts#L3)

| Field    | Type     | Presence / default | Validation / transformation |
| -------- | -------- | ------------------ | --------------------------- |
| `teamId` | `string` | Required           | `@IsUUID()`                 |

## GetWorkQueueProspectDetailQueryDto

[Source](../../apps/api/src/work-queue/dto/get-work-queue-prospect-detail-query.dto.ts#L3)

| Field    | Type     | Presence / default | Validation / transformation |
| -------- | -------- | ------------------ | --------------------------- |
| `teamId` | `string` | Required           | `@IsUUID()`                 |

## HeatmapDto

[Source](../../apps/api/src/maps/map.dto.ts#L41)

| Field            | Type                         | Presence / default                           | Validation / transformation                                                        |
| ---------------- | ---------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `metric`         | `"activity" \| "conversion"` | Optional / conditional; default `'activity'` | `@IsOptional()`<br>`@IsIn(['activity', 'conversion'])`                             |
| `from`           | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsDateString({ strict: true })`                               |
| `to`             | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsDateString({ strict: true })`                               |
| `bbox`           | `string`                     | Required                                     | `@IsString()`<br>`@MaxLength(160)`                                                 |
| `zoom`           | `number`                     | Optional / conditional; default `10`         | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(20)`  |
| `campaignId`     | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `organizationId` | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `teamId`         | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `territoryId`    | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `lifecycleStage` | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsIn(campaignProspectLifecycleStageEnum.enumValues)`          |
| `campaignStatus` | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsIn(['draft', 'active', 'paused', 'completed', 'archived'])` |
| `search`         | `undefined \| string`        | Optional / conditional                       | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(120)`                              |

## ImportIssueResolutionDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L27)

| Field        | Type                                      | Presence / default     | Validation / transformation           |
| ------------ | ----------------------------------------- | ---------------------- | ------------------------------------- |
| `resolution` | `"skip" \| "reuse" \| "correct"`          | Required               | `@IsIn(['skip', 'reuse', 'correct'])` |
| `values`     | `undefined \| { [key: string]: string; }` | Optional / conditional | `@IsOptional()`<br>`@IsObject()`      |

## ImportMappingDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L24)

| Field     | Type                         | Presence / default | Validation / transformation |
| --------- | ---------------------------- | ------------------ | --------------------------- |
| `mapping` | `{ [key: string]: string; }` | Required           | `@IsObject()`               |

## ImportRowsDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L20)

| Field      | Type     | Presence / default                   | Validation / transformation                                       |
| ---------- | -------- | ------------------------------------ | ----------------------------------------------------------------- |
| `afterRow` | `number` | Optional / conditional; default `0`  | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(10001)` |
| `limit`    | `number` | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`   |

## InvitationTokenDto

[Source](../../apps/api/src/security-administration/invitation.dto.ts#L34)

| Field   | Type     | Presence / default | Validation / transformation                        |
| ------- | -------- | ------------------ | -------------------------------------------------- |
| `token` | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)` |

## JobListDto

[Source](../../apps/api/src/data-jobs/data-jobs.dto.ts#L16)

| Field    | Type                  | Presence / default                   | Validation / transformation                                     |
| -------- | --------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `cursor` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                  |
| `limit`  | `number`              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## LinkTerritoryDto

[Source](../../apps/api/src/territories/territory.dto.ts#L47)

| Field         | Type     | Presence / default | Validation / transformation |
| ------------- | -------- | ------------------ | --------------------------- |
| `territoryId` | `string` | Required           | `@IsUUID()`                 |

## ListActionsDto

[Source](../../apps/api/src/actions/action.dto.ts#L89)

| Field                  | Type                                                                | Presence / default                   | Validation / transformation                                                                            |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `campaignId`           | `undefined \| string`                                               | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                               |
| `assigneeMembershipId` | `undefined \| string`                                               | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                               |
| `status`               | `undefined \| "completed" \| "cancelled" \| "planned" \| "started"` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['planned', 'started', 'completed', 'cancelled'])` |
| `cursor`               | `undefined \| string`                                               | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                               |
| `limit`                | `number`                                                            | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                        |

## ListCampaignOrganizationsDto

[Source](../../apps/api/src/campaign-organizations/campaign-organization.dto.ts#L10)

| Field    | Type                           | Presence / default                         | Validation / transformation                                     |
| -------- | ------------------------------ | ------------------------------------------ | --------------------------------------------------------------- |
| `cursor` | `undefined \| string`          | Optional / conditional                     | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `limit`  | `number`                       | Optional / conditional; default `25`       | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `state`  | `"active" \| "all" \| "ended"` | Optional / conditional; default `'active'` | `@IsIn(['active', 'ended', 'all'])`                             |

## ListCampaignsDto

[Source](../../apps/api/src/campaigns/dto/list-campaigns.dto.ts#L13)

| Field            | Type                                                                        | Presence / default     | Validation / transformation                                                                                  |
| ---------------- | --------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `organizationId` | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                     |
| `territoryId`    | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                     |
| `status`         | `undefined \| "active" \| "archived" \| "draft" \| "paused" \| "completed"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['draft', 'active', 'paused', 'completed', 'archived'])` |
| `search`         | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@MaxLength(120)`                              |
| `startsAfter`    | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`                                  |
| `startsBefore`   | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`                                  |
| `cursor`         | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                                     |
| `sort`           | `undefined \| "name" \| "createdAt"`                                        | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['name', 'createdAt'])`                                  |
| `limit`          | `undefined \| number`                                                       | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## ListConsentsDto

[Source](../../apps/api/src/consents/consent.dto.ts#L31)

| Field    | Type                  | Presence / default                   | Validation / transformation                                     |
| -------- | --------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `cursor` | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `limit`  | `number`              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## ListEstablishmentsQueryDto

[Source](../../apps/api/src/establishments/dto/list-establishments-query.dto.ts#L13)

| Field      | Type                                                                                                                          | Presence / default     | Validation / transformation                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category` | `undefined \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional | `@IsOptional()`<br>`@IsIn([ 'prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs', ] satisfies EstablishmentCategory[])` |

## ListFollowUpQueueQueryDto

[Source](../../apps/api/src/follow-ups/list-follow-up-queue-query.dto.ts#L4)

| Field        | Type                         | Presence / default                   | Validation / transformation                                                                                                                                         |
| ------------ | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `teamId`     | `undefined \| string`        | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                      |
| `status`     | `undefined \| string`        | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['pending', 'due', 'missed', 'completed', 'cancelled', 'all'])`                                                                           |
| `cursor`     | `undefined \| string`        | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                      |
| `campaignId` | `undefined \| string`        | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                      |
| `overdue`    | `undefined \| false \| true` | Optional / conditional               | `@IsOptional()`<br>`@Transform(({ value }) => { if (value === 'true') { return true; } if (value === 'false') { return false; } return value; })`<br>`@IsBoolean()` |
| `limit`      | `number`                     | Optional / conditional; default `50` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                                                                  |

## ListMembershipsDto

[Source](../../apps/api/src/memberships/membership.dto.ts#L15)

| Field            | Type                                                                                  | Presence / default                   | Validation / transformation                                                        |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `territoryId`    | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `campaignId`     | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `cursor`         | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `limit`          | `number`                                                                              | Optional / conditional; default `25` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `role`           | `undefined \| "director" \| "manager" \| "prospector" \| "tenant_admin" \| "auditor"` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(TENANT_ROLES)`                                           |
| `status`         | `undefined \| "active" \| "suspended" \| "invited" \| "departed"`                     | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['invited', 'active', 'suspended', 'departed'])`         |
| `organizationId` | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `teamId`         | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `search`         | `undefined \| string`                                                                 | Optional / conditional               | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(120)`                              |

Referenced validation constants:

```ts
const TENANT_ROLES = ['tenant_admin', 'director', 'manager', 'prospector', 'auditor'] as const;
```

## ListNotificationsQueryDto

[Source](../../apps/api/src/notifications/notification.dto.ts#L4)

| Field        | Type                                                        | Presence / default     | Validation / transformation                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `severity`   | `undefined \| "critical" \| "warning" \| "error" \| "info"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['info', 'warning', 'error', 'critical'])`                                                                                                                                         |
| `readState`  | `undefined \| "all" \| "read" \| "unread"`                  | Optional / conditional | `@IsOptional()`<br>`@IsIn(['read', 'unread', 'all'])`                                                                                                                                                        |
| `cursor`     | `undefined \| string`                                       | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                               |
| `unreadOnly` | `undefined \| false \| true`                                | Optional / conditional | `@IsOptional()`<br>`@Transform(({ value }) => { if (value === true \|\| value === 'true') { return true; } if (value === false \|\| value === 'false') { return false; } return value; })`<br>`@IsBoolean()` |
| `limit`      | `undefined \| number`                                       | Optional / conditional | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                                                                                                           |

## ListParticipationDto

[Source](../../apps/api/src/participation/participation.dto.ts#L34)

| Field          | Type                                                       | Presence / default                      | Validation / transformation                                     |
| -------------- | ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `cursor`       | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `limit`        | `number`                                                   | Optional / conditional; default `25`    | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `territoryId`  | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `membershipId` | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `teamId`       | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `state`        | `"active" \| "all" \| "revoked" \| "ended" \| "scheduled"` | Optional / conditional; default `'all'` | `@IsIn(['all', 'active', 'scheduled', 'ended', 'revoked'])`     |

## ListProspectTimelineQueryDto

[Source](../../apps/api/src/activities/prospect-timeline.dto.ts#L4)

| Field    | Type                  | Presence / default                   | Validation / transformation                                                        |
| -------- | --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `limit`  | `number`              | Optional / conditional; default `50` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `cursor` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsString()`                                                   |

## ListProspectsDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L43)

| Field        | Type                                                                                                                          | Presence / default                         | Validation / transformation                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `search`     | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(200)`                 |
| `campaignId` | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@IsUUID()`                                        |
| `regionId`   | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@IsUUID()`                                        |
| `category`   | `undefined \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional                     | `@IsOptional()`<br>`@IsIn(ESTABLISHMENT_CATEGORIES)`                  |
| `department` | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@Matches(DEPARTMENT_PATTERN)`                     |
| `city`       | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                 |
| `status`     | `"active" \| "inactive" \| "archived" \| "all"`                                                                               | Optional / conditional; default `'active'` | `@IsOptional()`<br>`@IsIn(['active', 'inactive', 'archived', 'all'])` |
| `sort`       | `"name" \| "createdAt"`                                                                                                       | Optional / conditional; default `'name'`   | `@IsOptional()`<br>`@IsIn(['name', 'createdAt'])`                     |
| `direction`  | `"asc" \| "desc"`                                                                                                             | Optional / conditional; default `'asc'`    | `@IsOptional()`<br>`@IsIn(['asc', 'desc'])`                           |
| `cursor`     | `undefined \| string`                                                                                                         | Optional / conditional                     | `@IsOptional()`<br>`@IsUUID()`                                        |
| `limit`      | `number`                                                                                                                      | Optional / conditional; default `50`       | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`       |

Referenced validation constants:

```ts
const ESTABLISHMENT_CATEGORIES = establishmentCategoryEnum.enumValues;
```

```ts
const DEPARTMENT_PATTERN = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;
```

## ListRelationshipsDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L9)

| Field              | Type                                                              | Presence / default                         | Validation / transformation                                                                          |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `organizationId`   | `undefined \| string`                                             | Optional / conditional                     | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                             |
| `relationshipType` | `undefined \| "brand" \| "parent" \| "partner" \| "coordination"` | Optional / conditional                     | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['parent', 'brand', 'partner', 'coordination'])` |
| `cursor`           | `undefined \| string`                                             | Optional / conditional                     | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                             |
| `limit`            | `number`                                                          | Optional / conditional; default `25`       | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                      |
| `state`            | `"active" \| "all" \| "ended"`                                    | Optional / conditional; default `'active'` | `@IsIn(['active', 'ended', 'all'])`                                                                  |

## ListRosterDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L36)

| Field          | Type                                                       | Presence / default                      | Validation / transformation                                     |
| -------------- | ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `membershipId` | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `cursor`       | `undefined \| string`                                      | Optional / conditional                  | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `limit`        | `number`                                                   | Optional / conditional; default `25`    | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `state`        | `"active" \| "all" \| "revoked" \| "ended" \| "scheduled"` | Optional / conditional; default `'all'` | `@IsIn(['all', 'active', 'scheduled', 'ended', 'revoked'])`     |

## ListSavedViewsDto

[Source](../../apps/api/src/saved-views/saved-views.dto.ts#L87)

| Field      | Type                                                                                                   | Presence / default     | Validation / transformation                      |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------ |
| `resource` | `undefined \| "campaigns" \| "follow-ups" \| "prospects" \| "activities" \| "assignments" \| "routes"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(SAVED_VIEW_RESOURCES)` |

Referenced validation constants:

```ts
const SAVED_VIEW_RESOURCES = [
  'prospects',
  'campaigns',
  'activities',
  'follow-ups',
  'assignments',
  'routes',
] as const;
```

## ListSessionsDto

[Source](../../apps/api/src/account/account.dto.ts#L81)

| Field    | Type                  | Presence / default                   | Validation / transformation                                                                                         |
| -------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `limit`  | `number`              | Optional / conditional; default `25` | `@ValidateIf((_, value) => value !== undefined)`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |
| `cursor` | `undefined \| string` | Optional / conditional               | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsUUID()`                                                     |

## ListTeamsDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L27)

| Field            | Type                                  | Presence / default                   | Validation / transformation                                                         |
| ---------------- | ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `organizationId` | `undefined \| string`                 | Optional / conditional               | `@ValidateIf(optional)`<br>`@IsUUID()`                                              |
| `cursor`         | `undefined \| string`                 | Optional / conditional               | `@ValidateIf(optional)`<br>`@IsUUID()`                                              |
| `limit`          | `number`                              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                     |
| `status`         | `undefined \| "active" \| "inactive"` | Optional / conditional               | `@ValidateIf(optional)`<br>`@IsIn(['active', 'inactive'])`                          |
| `search`         | `undefined \| string`                 | Optional / conditional               | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MaxLength(100)` |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## ListWorkQueueQueryDto

[Source](../../apps/api/src/work-queue/dto/list-work-queue-query.dto.ts#L9)

| Field            | Type                                                                                                        | Presence / default     | Validation / transformation                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `teamId`         | `string`                                                                                                    | Required               | `@IsUUID()`                                                                                                                                                                                                       |
| `campaignId`     | `undefined \| string`                                                                                       | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                                    |
| `lifecycleStage` | `undefined \| "to_contact" \| "contact_made" \| "in_progress" \| "follow_up" \| "qualified" \| "converted"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(campaignProspectLifecycleStageEnum.enumValues)`                                                                                                                                         |
| `q`              | `undefined \| string`                                                                                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(100)`<br>`@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`                                                      |
| `cursor`         | `undefined \| string`                                                                                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(512)`                                                                                                                                                             |
| `limit`          | `undefined \| number`                                                                                       | Optional / conditional | `@IsOptional()`<br>`@Transform(({ value }: { value: unknown }) => { if (typeof value !== 'string' \|\| value.trim() === '') { return value; } return Number(value); })`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## ListWorkspaceResourcesDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L20)

| Field    | Type                                  | Presence / default                   | Validation / transformation                                                         |
| -------- | ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `cursor` | `undefined \| string`                 | Optional / conditional               | `@ValidateIf(optional)`<br>`@IsUUID()`                                              |
| `limit`  | `number`                              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                     |
| `status` | `undefined \| "active" \| "inactive"` | Optional / conditional               | `@ValidateIf(optional)`<br>`@IsIn(['active', 'inactive'])`                          |
| `search` | `undefined \| string`                 | Optional / conditional               | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MaxLength(100)` |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## LoginDto

[Source](../../apps/api/src/auth/dto/login.dto.ts#L3)

| Field      | Type     | Presence / default | Validation / transformation                            |
| ---------- | -------- | ------------------ | ------------------------------------------------------ |
| `email`    | `string` | Required           | `@IsEmail()`<br>`@MaxLength(320)`                      |
| `password` | `string` | Required           | `@IsString()`<br>`@IsNotEmpty()`<br>`@MaxLength(1024)` |

## ManagerDashboardQueryDto

[Source](../../apps/api/src/reporting/manager-dashboard-query.dto.ts#L86)

| Field            | Type                                           | Presence / default     | Validation / transformation                                                                                                                                                                           |
| ---------------- | ---------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`           | `undefined \| string /* ISO 8601 date-time */` | Optional / conditional | `@ValidateIf( (query: ManagerDashboardQueryDto) => query.from !== undefined \|\| query.to !== undefined, )`<br>`@Type(() => Date)`<br>`@IsDate()`                                                     |
| `to`             | `undefined \| string /* ISO 8601 date-time */` | Optional / conditional | `@ValidateIf( (query: ManagerDashboardQueryDto) => query.from !== undefined \|\| query.to !== undefined, )`<br>`@Type(() => Date)`<br>`@IsDate()`<br>`@Validate(ManagerDashboardDateRangeConstraint)` |
| `organizationId` | `undefined \| string`                          | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                        |
| `teamId`         | `undefined \| string`                          | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                        |
| `userId`         | `undefined \| string`                          | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                        |
| `campaignId`     | `undefined \| string`                          | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                                                        |

## MapAggregateDto

[Source](../../apps/api/src/maps/map.dto.ts#L37)

| Field            | Type                  | Presence / default                   | Validation / transformation                                                        |
| ---------------- | --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `from`           | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsDateString({ strict: true })`                               |
| `to`             | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsDateString({ strict: true })`                               |
| `bbox`           | `string`              | Required                             | `@IsString()`<br>`@MaxLength(160)`                                                 |
| `zoom`           | `number`              | Optional / conditional; default `10` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(20)`  |
| `campaignId`     | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `organizationId` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `teamId`         | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `territoryId`    | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `lifecycleStage` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(campaignProspectLifecycleStageEnum.enumValues)`          |
| `campaignStatus` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['draft', 'active', 'paused', 'completed', 'archived'])` |
| `search`         | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(120)`                              |

## MapViewportDto

[Source](../../apps/api/src/maps/map.dto.ts#L26)

| Field            | Type                  | Presence / default                   | Validation / transformation                                                        |
| ---------------- | --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `bbox`           | `string`              | Required                             | `@IsString()`<br>`@MaxLength(160)`                                                 |
| `zoom`           | `number`              | Optional / conditional; default `10` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(20)`  |
| `campaignId`     | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `organizationId` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `teamId`         | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `territoryId`    | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                     |
| `lifecycleStage` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(campaignProspectLifecycleStageEnum.enumValues)`          |
| `campaignStatus` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['draft', 'active', 'paused', 'completed', 'archived'])` |
| `search`         | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(120)`                              |

## MembershipReasonDto

[Source](../../apps/api/src/memberships/membership.dto.ts#L27)

| Field    | Type     | Presence / default | Validation / transformation                                                                                                                                   |
| -------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason` | `string` | Required           | `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(3)`<br>`@MaxLength(1000)` |

## MembershipScopeDto

[Source](../../apps/api/src/memberships/membership.dto.ts#L34)

| Field            | Type                                                                     | Presence / default     | Validation / transformation                                                                    |
| ---------------- | ------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `effect`         | `undefined \| "allow" \| "deny"`                                         | Optional / conditional | `@IsOptional()`<br>`@IsIn(['allow', 'deny'])`                                                  |
| `reason`         | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MinLength(3)`<br>`@MaxLength(1000)`                      |
| `territoryId`    | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                 |
| `campaignId`     | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                 |
| `accessLevel`    | `undefined \| "read" \| "read_write" \| "manage"`                        | Optional / conditional | `@IsOptional()`<br>`@IsIn(['read', 'read_write', 'manage'])`                                   |
| `role`           | `"director" \| "manager" \| "prospector" \| "tenant_admin" \| "auditor"` | Optional / conditional | `@ValidateIf((input: MembershipScopeDto) => input.effect !== 'deny')`<br>`@IsIn(TENANT_ROLES)` |
| `scopeType`      | `"tenant" \| "organization" \| "team" \| "campaign" \| "territory"`      | Required               | `@IsIn(['tenant', 'organization', 'team', 'territory', 'campaign'])`                           |
| `organizationId` | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                 |
| `teamId`         | `undefined \| string`                                                    | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                 |

Referenced validation constants:

```ts
const TENANT_ROLES = ['tenant_admin', 'director', 'manager', 'prospector', 'auditor'] as const;
```

## MfaEnrollDto

[Source](../../apps/api/src/auth/dto/mfa.dto.ts#L2)

| Field      | Type     | Presence / default | Validation / transformation                            |
| ---------- | -------- | ------------------ | ------------------------------------------------------ |
| `password` | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(1024)` |

## MfaRecoveryDto

[Source](../../apps/api/src/auth/dto/mfa.dto.ts#L9)

| Field            | Type     | Presence / default | Validation / transformation                        |
| ---------------- | -------- | ------------------ | -------------------------------------------------- |
| `challengeToken` | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)` |
| `code`           | `string` | Required           | `@IsString()`<br>`@Matches(/^[0-9a-f]{32}$/)`      |

## MfaStepUpDto

[Source](../../apps/api/src/auth/dto/mfa.dto.ts#L13)

| Field      | Type     | Presence / default | Validation / transformation                            |
| ---------- | -------- | ------------------ | ------------------------------------------------------ |
| `code`     | `string` | Required           | `@IsString()`<br>`@Matches(/^\d{6}$/)`                 |
| `password` | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(1024)` |

## MfaVerifyDto

[Source](../../apps/api/src/auth/dto/mfa.dto.ts#L5)

| Field            | Type     | Presence / default | Validation / transformation                        |
| ---------------- | -------- | ------------------ | -------------------------------------------------- |
| `challengeToken` | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)` |
| `code`           | `string` | Required           | `@IsString()`<br>`@Matches(/^\d{6}$/)`             |

## MuteConversationDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L66)

| Field        | Type                          | Presence / default     | Validation / transformation                                                                                                                         |
| ------------ | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mutedUntil` | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined && value !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## NearbyEstablishmentsQueryDto

[Source](../../apps/api/src/establishments/dto/nearby-establishments-query.dto.ts#L4)

| Field          | Type                  | Presence / default     | Validation / transformation                                                                                     |
| -------------- | --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `latitude`     | `number`              | Required               | `@Type(() => Number)`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-90)`<br>`@Max(90)`   |
| `longitude`    | `number`              | Required               | `@Type(() => Number)`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-180)`<br>`@Max(180)` |
| `radiusMeters` | `number`              | Required               | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100_000)`                                             |
| `limit`        | `undefined \| number` | Optional / conditional | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                              |

## NearbyProspectsDto

[Source](../../apps/api/src/maps/map.dto.ts#L30)

| Field            | Type                  | Presence / default                     | Validation / transformation                                                             |
| ---------------- | --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `latitude`       | `number`              | Required                               | `@Type(() => Number)`<br>`@IsNumber()`<br>`@Min(-90)`<br>`@Max(90)`                     |
| `longitude`      | `number`              | Required                               | `@Type(() => Number)`<br>`@IsNumber()`<br>`@Min(-180)`<br>`@Max(180)`                   |
| `radiusMeters`   | `number`              | Optional / conditional; default `5000` | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsNumber()`<br>`@Min(1)`<br>`@Max(50000)` |
| `limit`          | `number`              | Optional / conditional; default `50`   | `@IsOptional()`<br>`@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(200)`      |
| `cursor`         | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsUUID()`                                                          |
| `campaignId`     | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsUUID()`                                                          |
| `organizationId` | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsUUID()`                                                          |
| `teamId`         | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsUUID()`                                                          |
| `territoryId`    | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsUUID()`                                                          |
| `lifecycleStage` | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsIn(campaignProspectLifecycleStageEnum.enumValues)`               |
| `campaignStatus` | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsIn(['draft', 'active', 'paused', 'completed', 'archived'])`      |
| `search`         | `undefined \| string` | Optional / conditional                 | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(120)`                                   |

## NextFollowUpDto

[Source](../../apps/api/src/actions/action.dto.ts#L46)

| Field     | Type                                                                 | Presence / default     | Validation / transformation                                                                           |
| --------- | -------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `dueAt`   | `string`                                                             | Required               | `@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                               |
| `channel` | `undefined \| "email" \| "call" \| "message" \| "visit" \| "letter"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['call', 'email', 'message', 'visit', 'letter'])` |

## NotificationChannelDto

[Source](../../apps/api/src/communications/communications.dto.ts#L54)

| Field   | Type                         | Presence / default     | Validation / transformation       |
| ------- | ---------------------------- | ---------------------- | --------------------------------- |
| `email` | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()` |
| `push`  | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()` |
| `inApp` | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()` |

## NotificationPreferencesDto

[Source](../../apps/api/src/communications/communications.dto.ts#L67)

| Field         | Type                                                                                                                          | Presence / default     | Validation / transformation                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `assignments` | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |
| `followUps`   | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |
| `collisions`  | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |
| `overrides`   | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |
| `messages`    | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |
| `imports`     | `undefined \| { email?: undefined \| false \| true; push?: undefined \| false \| true; inApp?: undefined \| false \| true; }` | Optional / conditional | `@IsOptional()`<br>`@ValidateNested()`<br>`@Type(() => NotificationChannelDto)` |

## ObjectiveListDto

[Source](../../apps/api/src/objectives/objective.dto.ts#L44)

| Field            | Type                  | Presence / default                   | Validation / transformation                                     |
| ---------------- | --------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `organizationId` | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `teamId`         | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `campaignId`     | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `ownerId`        | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `cursor`         | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`        |
| `limit`          | `number`              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## OutcomeDto

[Source](../../apps/api/src/outcome-settings/outcome-settings.controller.ts#L34)

| Field         | Type            | Presence / default | Validation / transformation                                                                                           |
| ------------- | --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `code`        | `string`        | Required           | `@IsString()`<br>`@Matches(/^[a-z][a-z0-9_]{0,39}$/)`                                                                 |
| `label`       | `string`        | Required           | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(100)`                                                                |
| `behavior`    | `string`        | Required           | `@IsIn(BEHAVIORS)`                                                                                                    |
| `enabled`     | `boolean`       | Required           | `@IsBoolean()`                                                                                                        |
| `actionTypes` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(6)`<br>`@ArrayUnique()`<br>`@IsIn(ACTION_TYPES, { each: true })` |

Referenced validation constants:

```ts
const BEHAVIORS = [
  'no_answer',
  'contacted',
  'interested',
  'not_interested',
  'qualified',
  'converted',
  'do_not_contact',
  'completed',
] as const;
```

```ts
const ACTION_TYPES = ['call', 'email', 'message', 'visit', 'task', 'note'];
```

## OverrideReasonDto

[Source](../../apps/api/src/collisions/collision-workflow.dto.ts#L7)

| Field    | Type     | Presence / default | Validation / transformation                                                                                                                 |
| -------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason` | `string` | Required           | `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@Length(10, 1000)` |

## PageDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L26)

| Field    | Type                  | Presence / default                   | Validation / transformation                                     |
| -------- | --------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `cursor` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                  |
| `limit`  | `number`              | Optional / conditional; default `50` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)` |

## PlatformGrantDto

[Source](../../apps/api/src/tenants/platform-user.dto.ts#L3)

| Field    | Type                                  | Presence / default | Validation / transformation                             |
| -------- | ------------------------------------- | ------------------ | ------------------------------------------------------- |
| `role`   | `"super_admin" \| "support_operator"` | Required           | `@IsIn(['super_admin', 'support_operator'])`            |
| `reason` | `string`                              | Required           | `@IsString()`<br>`@MinLength(10)`<br>`@MaxLength(1000)` |

## PlatformGrantRevokeDto

[Source](../../apps/api/src/tenants/platform-user.dto.ts#L13)

| Field    | Type     | Presence / default | Validation / transformation                             |
| -------- | -------- | ------------------ | ------------------------------------------------------- |
| `reason` | `string` | Required           | `@IsString()`<br>`@MinLength(10)`<br>`@MaxLength(1000)` |

## PlatformTenantConfigDto

[Source](../../apps/api/src/tenants/platform-tenant.dto.ts#L8)

| Field    | Type                          | Presence / default | Validation / transformation |
| -------- | ----------------------------- | ------------------ | --------------------------- |
| `config` | `{ [key: string]: unknown; }` | Required           | `@IsObject()`               |

## PlatformTenantStatusDto

[Source](../../apps/api/src/tenants/platform-tenant.dto.ts#L3)

| Field    | Type                                    | Presence / default | Validation / transformation                  |
| -------- | --------------------------------------- | ------------------ | -------------------------------------------- |
| `status` | `"active" \| "suspended" \| "inactive"` | Required           | `@IsIn(['active', 'suspended', 'inactive'])` |

## PresignUploadDto

[Source](../../apps/api/src/communications/communications.dto.ts#L25)

| Field         | Type     | Presence / default | Validation / transformation                                                  |
| ------------- | -------- | ------------------ | ---------------------------------------------------------------------------- |
| `filename`    | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                        |
| `contentType` | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)`                        |
| `byteSize`    | `number` | Required           | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(MAX_UPLOAD_BYTES)` |

Referenced validation constants:

```ts
const MAX_UPLOAD_BYTES = 25_000_000;
```

## ProspectorTodayQueryDto

[Source](../../apps/api/src/prospector-today/prospector-today-query.dto.ts#L19)

| Field      | Type     | Presence / default | Validation / transformation                           |
| ---------- | -------- | ------------------ | ----------------------------------------------------- |
| `teamId`   | `string` | Required           | `@IsUUID()`                                           |
| `timeZone` | `string` | Required           | `@IsString()`<br>`@MaxLength(100)`<br>`@IsTimeZone()` |

## ReasonDto

[Source](../../apps/api/src/actions/action.dto.ts#L79)

| Field    | Type     | Presence / default | Validation / transformation                             |
| -------- | -------- | ------------------ | ------------------------------------------------------- |
| `reason` | `string` | Required           | `@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(2000)` |

## ReassignAssignmentDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L36)

| Field            | Type                          | Presence / default     | Validation / transformation         |
| ---------------- | ----------------------------- | ---------------------- | ----------------------------------- |
| `reason`         | `string`                      | Required               | `@IsString()`<br>`@Length(3, 1000)` |
| `teamId`         | `string`                      | Required               | `@IsUUID()`                         |
| `assignedUserId` | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`      |

## RefreshTokenDto

[Source](../../apps/api/src/auth/dto/refresh-token.dto.ts#L3)

| Field          | Type     | Presence / default | Validation / transformation                            |
| -------------- | -------- | ------------------ | ------------------------------------------------------ |
| `refreshToken` | `string` | Required           | `@IsString()`<br>`@IsNotEmpty()`<br>`@MaxLength(4096)` |

## RegisterDeviceDto

[Source](../../apps/api/src/communications/communications.dto.ts#L47)

| Field      | Type                          | Presence / default | Validation / transformation                           |
| ---------- | ----------------------------- | ------------------ | ----------------------------------------------------- |
| `token`    | `string`                      | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(512)` |
| `platform` | `"ios" \| "android" \| "web"` | Required           | `@IsIn(['ios', 'android', 'web'])`                    |

## ReleaseReservationDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L32)

| Field    | Type     | Presence / default | Validation / transformation         |
| -------- | -------- | ------------------ | ----------------------------------- |
| `reason` | `string` | Required           | `@IsString()`<br>`@Length(3, 1000)` |

## RescheduleProspectFollowUpDto

[Source](../../apps/api/src/follow-ups/prospect-follow-up.dto.ts#L29)

| Field   | Type                              | Presence / default | Validation / transformation        |
| ------- | --------------------------------- | ------------------ | ---------------------------------- |
| `dueAt` | `string /* ISO 8601 date-time */` | Required           | `@Type(() => Date)`<br>`@IsDate()` |

## ReservationListDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L35)

| Field        | Type                  | Presence / default                   | Validation / transformation                                                                |
| ------------ | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `cursor`     | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                             |
| `campaignId` | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsUUID()`                                                             |
| `status`     | `undefined \| string` | Optional / conditional               | `@IsOptional()`<br>`@IsIn(['pending', 'active', 'released', 'expired', 'lost', 'failed'])` |
| `limit`      | `number`              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                            |

## ReservationRulePatchDto

[Source](../../apps/api/src/reservations/reservation-lifecycle.dto.ts#L13)

| Field                  | Type                         | Presence / default     | Validation / transformation                                 |
| ---------------------- | ---------------------------- | ---------------------- | ----------------------------------------------------------- |
| `durationMinutes`      | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(240)`   |
| `cooldownMinutes`      | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(10080)` |
| `maxHoldMinutes`       | `undefined \| number`        | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(1440)`  |
| `allowHeartbeat`       | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |
| `allowExtension`       | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |
| `allowManagerOverride` | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                           |

## ResetPasswordDto

[Source](../../apps/api/src/auth/password-recovery.controller.ts#L17)

| Field      | Type     | Presence / default | Validation / transformation                            |
| ---------- | -------- | ------------------ | ------------------------------------------------------ |
| `password` | `string` | Required           | `@IsString()`<br>`@MinLength(12)`<br>`@MaxLength(128)` |
| `token`    | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)`     |

## ResetTokenDto

[Source](../../apps/api/src/auth/password-recovery.controller.ts#L14)

| Field   | Type     | Presence / default | Validation / transformation                        |
| ------- | -------- | ------------------ | -------------------------------------------------- |
| `token` | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)` |

## ResolveDuplicateDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L101)

| Field        | Type                  | Presence / default     | Validation / transformation          |
| ------------ | --------------------- | ---------------------- | ------------------------------------ |
| `resolution` | `string`              | Required               | `@IsIn(['not_duplicate', 'merged'])` |
| `targetId`   | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`       |

## RoleParamDto

[Source](../../apps/api/src/permissions/permission.controller.ts#L32)

| Field  | Type                                                                                      | Presence / default | Validation / transformation               |
| ------ | ----------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------- |
| `role` | `"super_admin" \| "director" \| "manager" \| "prospector" \| "tenant_admin" \| "auditor"` | Required           | `@IsIn([...TENANT_ROLES, 'super_admin'])` |

## RolePermissionsDto

[Source](../../apps/api/src/permissions/permission.controller.ts#L35)

| Field         | Type            | Presence / default | Validation / transformation                                     |
| ------------- | --------------- | ------------------ | --------------------------------------------------------------- |
| `permissions` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayUnique()`<br>`@IsString({ each: true })` |

## RosterTargetDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L33)

| Field      | Type                  | Presence / default     | Validation / transformation                              |
| ---------- | --------------------- | ---------------------- | -------------------------------------------------------- |
| `periodId` | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()` |

## RouteListDto

[Source](../../apps/api/src/routes/route.dto.ts#L48)

| Field    | Type                                                             | Presence / default                   | Validation / transformation                                                                         |
| -------- | ---------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `teamId` | `undefined \| string`                                            | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                            |
| `cursor` | `undefined \| string`                                            | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()`                                            |
| `status` | `undefined \| "active" \| "draft" \| "completed" \| "cancelled"` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['draft', 'active', 'completed', 'cancelled'])` |
| `limit`  | `number`                                                         | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                     |

## RoutePointDto

[Source](../../apps/api/src/routes/route.dto.ts#L21)

| Field       | Type     | Presence / default | Validation / transformation                  |
| ----------- | -------- | ------------------ | -------------------------------------------- |
| `latitude`  | `number` | Required           | `@IsNumber()`<br>`@Min(-90)`<br>`@Max(90)`   |
| `longitude` | `number` | Required           | `@IsNumber()`<br>`@Min(-180)`<br>`@Max(180)` |

## SearchQuery

[Source](../../apps/api/src/search/search.module.ts#L21)

| Field    | Type                  | Presence / default     | Validation / transformation                                                 |
| -------- | --------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `q`      | `string`              | Required               | `@IsString()`<br>`@MaxLength(120)`                                          |
| `type`   | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['all', 'prospect', 'organization', 'campaign'])` |
| `cursor` | `undefined \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`                                            |
| `limit`  | `undefined \| number` | Optional / conditional | `@IsOptional()`                                                             |

## SelectWorkspaceDto

[Source](../../apps/api/src/auth/dto/select-workspace.dto.ts#L3)

| Field            | Type     | Presence / default | Validation / transformation                                            |
| ---------------- | -------- | ------------------ | ---------------------------------------------------------------------- |
| `selectionToken` | `string` | Required           | `@IsString()`<br>`@Matches(/^[A-Za-z0-9_-]{43}$/)`<br>`@MaxLength(43)` |
| `membershipId`   | `string` | Required           | `@IsUUID()`                                                            |

## SendMessageDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L62)

| Field  | Type     | Presence / default | Validation / transformation                                        |
| ------ | -------- | ------------------ | ------------------------------------------------------------------ |
| `body` | `string` | Required           | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(MAX_MESSAGE_BODY)` |

Referenced validation constants:

```ts
const MAX_MESSAGE_BODY = 10_000;
```

## SettingsDto

[Source](../../apps/api/src/outcome-settings/outcome-settings.controller.ts#L46)

| Field      | Type                                                                                                      | Presence / default | Validation / transformation                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `outcomes` | `Array<{ code: string; label: string; behavior: string; enabled: boolean; actionTypes: Array<string>; }>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(100)`<br>`@ValidateNested({ each: true })`<br>`@Type(() => OutcomeDto)` |

## SsoSettingsDto

[Source](../../apps/api/src/security-administration/sso-settings.ts#L18)

| Field            | Type                         | Presence / default     | Validation / transformation                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider`       | `"oidc"`                     | Required               | `@IsIn(['oidc'])`                                                                                                                                                                                                                                                                                                                            |
| `mode`           | `"disabled" \| "configured"` | Required               | `@IsIn(['disabled', 'configured'])`                                                                                                                                                                                                                                                                                                          |
| `issuer`         | `string`                     | Required               | `@IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })`<br>`@MaxLength(2048)`                                                                                                                                                                                                                                        |
| `clientId`       | `string`                     | Required               | `@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(512)`                                                                                                                                                                                                                                                                                        |
| `clientSecret`   | `undefined \| string`        | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(4096)`                                                                                                                                                                                                                                           |
| `allowedDomains` | `Array<string>`              | Required               | `@IsArray()`<br>`@ArrayMaxSize(50)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, { each: true })`<br>`@Transform(({ value }: { value: unknown }) => Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)) : value, )` |

## StartActionDto

[Source](../../apps/api/src/actions/action.dto.ts#L37)

| Field        | Type                  | Presence / default     | Validation / transformation                              |
| ------------ | --------------------- | ---------------------- | -------------------------------------------------------- |
| `overrideId` | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsUUID()` |

## StopOrderDto

[Source](../../apps/api/src/routes/route.dto.ts#L74)

| Field     | Type            | Presence / default | Validation / transformation                                                                                            |
| --------- | --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `stopIds` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(100)`<br>`@ArrayUnique()`<br>`@IsUUID(undefined, { each: true })` |

## SwitchMembershipDto

[Source](../../apps/api/src/account/account.dto.ts#L76)

| Field          | Type     | Presence / default | Validation / transformation |
| -------------- | -------- | ------------------ | --------------------------- |
| `membershipId` | `string` | Required           | `@IsUUID()`                 |

## TagDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L20)

| Field   | Type                          | Presence / default     | Validation / transformation                                                                                                             |
| ------- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`  | `string`                      | Required               | `@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(80)` |
| `color` | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@Matches(/^#[0-9a-fA-F]{6}$/)`                                                                                      |

## TimelineQuery

[Source](../../apps/api/src/actions/unified-timeline.controller.ts#L8)

| Field    | Type                  | Presence / default                   | Validation / transformation                                                     |
| -------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `limit`  | `number`              | Optional / conditional; default `25` | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                 |
| `cursor` | `undefined \| string` | Optional / conditional               | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@MaxLength(500)` |

## UnassignedListDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L60)

| Field            | Type                                                                                                                          | Presence / default                             | Validation / transformation                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `campaignId`     | `string`                                                                                                                      | Required                                       | `@IsUUID()`                                                                                                                     |
| `teamId`         | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@IsUUID()`                                                                                                  |
| `cursor`         | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@IsUUID()`                                                                                                  |
| `limit`          | `number`                                                                                                                      | Optional / conditional; default `25`           | `@Type(() => Number)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                                                 |
| `search`         | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@IsString()`<br>`@Length(1, 200)`                                                                           |
| `category`       | `undefined \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional                         | `@IsOptional()`<br>`@IsIn(ESTABLISHMENT_CATEGORIES)`                                                                            |
| `regionId`       | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@IsUUID()`                                                                                                  |
| `department`     | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@Matches(DEPARTMENT_PATTERN)`                                                                               |
| `city`           | `undefined \| string`                                                                                                         | Optional / conditional                         | `@IsOptional()`<br>`@IsString()`<br>`@Length(1, 150)`                                                                           |
| `lifecycleStage` | `undefined \| "to_contact" \| "contact_made" \| "in_progress" \| "follow_up" \| "qualified" \| "converted"`                   | Optional / conditional                         | `@IsOptional()`<br>`@IsIn(CAMPAIGN_PROSPECT_LIFECYCLE_STAGES)`                                                                  |
| `contactable`    | `undefined \| false \| true`                                                                                                  | Optional / conditional                         | `@IsOptional()`<br>`@Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))`<br>`@IsBoolean()` |
| `availability`   | `"unassigned" \| "uncontested"`                                                                                               | Optional / conditional; default `'unassigned'` | `@IsOptional()`<br>`@IsIn(['unassigned', 'uncontested'])`                                                                       |

Referenced validation constants:

```ts
const ESTABLISHMENT_CATEGORIES = establishmentCategoryEnum.enumValues;
```

```ts
const DEPARTMENT_PATTERN = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;
```

```ts
const CAMPAIGN_PROSPECT_LIFECYCLE_STAGES = campaignProspectLifecycleStageEnum.enumValues;
```

## UpdateAccountDto

[Source](../../apps/api/src/account/account.dto.ts#L28)

| Field         | Type                                                     | Presence / default     | Validation / transformation                                                                                                     |
| ------------- | -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `avatar`      | `undefined \| null \| { url: string; altText: string; }` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined && v !== null)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => AvatarDto)`      |
| `displayName` | `undefined \| string`                                    | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)` |
| `phone`       | `undefined \| null \| string`                            | Optional / conditional | `@ValidateIf((_, value) => value !== undefined && value !== null)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MaxLength(40)`   |
| `locale`      | `undefined \| string`                                    | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsLocale()`<br>`@MaxLength(35)`                                           |
| `timezone`    | `undefined \| string`                                    | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsTimeZone()`<br>`@MaxLength(100)`                                        |

Referenced validation constants:

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## UpdateActionDto

[Source](../../apps/api/src/actions/action.dto.ts#L16)

| Field     | Type                          | Presence / default     | Validation / transformation                                                                                                        |
| --------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `subject` | `undefined \| string`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                                |
| `notes`   | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsString()`<br>`@MaxLength(10000)`                                    |
| `dueAt`   | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## UpdateAddressDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L76)

| Field         | Type                          | Presence / default     | Validation / transformation                                                                                                                                                          |
| ------------- | ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`       | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(100)`                                                                                                                                |
| `line1`       | `undefined \| string`         | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)` |
| `line2`       | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                                |
| `postalCode`  | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                                                                 |
| `city`        | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                                |
| `region`      | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                                |
| `countryCode` | `undefined \| string`         | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/)`                                                                                             |
| `latitude`    | `undefined \| null \| number` | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(-90)`<br>`@Max(90)`                                                                                                                        |
| `longitude`   | `undefined \| null \| number` | Optional / conditional | `@IsOptional()`<br>`@IsNumber()`<br>`@Min(-180)`<br>`@Max(180)`                                                                                                                      |
| `isPrimary`   | `undefined \| false \| true`  | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsBoolean()`                                                                                                                           |

## UpdateAssignmentDto

[Source](../../apps/api/src/assignments/assignment-lifecycle.dto.ts#L28)

| Field      | Type                                                     | Presence / default     | Validation / transformation                                       |
| ---------- | -------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `status`   | `undefined \| "active" \| "paused"`                      | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'paused'])`                  |
| `priority` | `undefined \| "low" \| "normal" \| "high" \| "critical"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['low', 'normal', 'high', 'critical'])` |

## UpdateCampaignDto

[Source](../../apps/api/src/campaigns/dto/update-campaign.dto.ts#L6)

| Field         | Type                                                                        | Presence / default     | Validation / transformation                                                                |
| ------------- | --------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `name`        | `undefined \| string`                                                       | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsString()`<br>`@MaxLength(255)`     |
| `description` | `undefined \| null \| string`                                               | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(10000)`                                    |
| `status`      | `undefined \| "active" \| "archived" \| "draft" \| "paused" \| "completed"` | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsIn(campaignStatusEnum.enumValues)` |
| `startsAt`    | `undefined \| null \| string /* ISO 8601 date-time */`                      | Optional / conditional | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`                                      |
| `endsAt`      | `undefined \| null \| string /* ISO 8601 date-time */`                      | Optional / conditional | `@IsOptional()`<br>`@Type(() => Date)`<br>`@IsDate()`                                      |

## UpdateCampaignMemberDto

[Source](../../apps/api/src/participation/participation.dto.ts#L29)

| Field          | Type                                                   | Presence / default     | Validation / transformation                                                                                                        |
| -------------- | ------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `campaignRole` | `undefined \| "observer" \| "member" \| "coordinator"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['member', 'coordinator', 'observer'])`                                        |
| `startsAt`     | `undefined \| string`                                  | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`       | `undefined \| null \| string`                          | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## UpdateCampaignOrganizationDto

[Source](../../apps/api/src/campaign-organizations/campaign-organization.dto.ts#L7)

| Field        | Type                           | Presence / default | Validation / transformation           |
| ------------ | ------------------------------ | ------------------ | ------------------------------------- |
| `accessMode` | `"participate" \| "read_only"` | Required           | `@IsIn(['participate', 'read_only'])` |

## UpdateCampaignProspectDto

[Source](../../apps/api/src/campaigns/dto/update-campaign-prospect.dto.ts#L5)

| Field    | Type                     | Presence / default | Validation / transformation                    |
| -------- | ------------------------ | ------------------ | ---------------------------------------------- |
| `status` | `"active" \| "excluded"` | Required           | `@IsIn(campaignProspectStatusEnum.enumValues)` |

## UpdateConversationDto

[Source](../../apps/api/src/messaging/messaging.dto.ts#L52)

| Field    | Type                                  | Presence / default     | Validation / transformation                           |
| -------- | ------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `title`  | `undefined \| string`                 | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(200)` |
| `status` | `undefined \| "active" \| "archived"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'archived'])`    |

## UpdateEstablishmentContactDto

[Source](../../apps/api/src/establishment-contacts/dto/update-establishment-contact.dto.ts#L6)

| Field       | Type                                                | Presence / default     | Validation / transformation                                                                                                             |
| ----------- | --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `undefined \| null \| string`                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                   |
| `jobTitle`  | `undefined \| null \| string`                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                   |
| `email`     | `undefined \| null \| string`                       | Optional / conditional | `@IsOptional()`<br>`@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsEmail()`<br>`@MaxLength(320)` |
| `phone`     | `undefined \| null \| string`                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                    |
| `isPrimary` | `undefined \| false \| true`                        | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                       |
| `status`    | `undefined \| "active" \| "inactive" \| "archived"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'inactive', 'archived'] satisfies EstablishmentContactStatus[])`                                   |

## UpdateEstablishmentDto

[Source](../../apps/api/src/establishments/dto/update-establishment.dto.ts#L18)

| Field               | Type                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `undefined \| string`                                                                                                                 | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `regionId`          | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                        |
| `externalReference` | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `addressLine1`      | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `postalCode`        | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                                                  |
| `city`              | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                 |
| `countryCode`       | `undefined \| string`                                                                                                                 | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must contain exactly two letters', })`                                         |
| `phone`             | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                                                  |
| `website`           | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(2048)`                                                                                                                |
| `latitude`          | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-90)`<br>`@Max(90)`                                                               |
| `longitude`         | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-180)`<br>`@Max(180)`                                                             |
| `status`            | `undefined \| "active" \| "inactive" \| "archived"`                                                                                   | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'inactive', 'archived'] satisfies EstablishmentStatus[])`                                                                        |
| `category`          | `undefined \| null \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional | `@IsOptional()`<br>`@IsIn([ 'prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs', ] satisfies EstablishmentCategory[])` |

## UpdateFieldDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L76)

| Field        | Type                                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`      | `undefined \| string`                                                                                                                                 | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(100)` |
| `validation` | `undefined \| { required?: undefined \| false \| true; min?: undefined \| number; max?: undefined \| number; options?: undefined \| Array<string>; }` | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => FieldValidationDto)`                                                                |
| `visibility` | `undefined \| { roles?: undefined \| Array<string>; }`                                                                                                | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => FieldVisibilityDto)`                                                                |
| `isActive`   | `undefined \| false \| true`                                                                                                                          | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@IsBoolean()`                                                                                                                           |

## UpdateFollowUpDto

[Source](../../apps/api/src/follow-ups/canonical-follow-up.controller.ts#L24)

| Field      | Type                                                                         | Presence / default     | Validation / transformation                                                                                          |
| ---------- | ---------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dueAt`    | `undefined \| string`                                                        | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |
| `category` | `undefined \| "follow_up" \| "todo" \| "meeting"`                            | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['todo', 'follow_up', 'meeting'])`                               |
| `channel`  | `undefined \| null \| "email" \| "call" \| "message" \| "visit" \| "letter"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsIn(['call', 'email', 'message', 'visit', 'letter'])`  |

## UpdateMembershipDto

[Source](../../apps/api/src/memberships/membership.dto.ts#L49)

| Field            | Type                                                                                  | Presence / default     | Validation / transformation                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayName`    | `undefined \| string`                                                                 | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(120)` |
| `capacity`       | `undefined \| null \| number`                                                         | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined && value !== null)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(100000)`                                                                                                  |
| `status`         | `undefined \| "active" \| "suspended" \| "departed"`                                  | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsIn(['active', 'suspended', 'departed'])`                                                                                                                 |
| `role`           | `undefined \| "director" \| "manager" \| "prospector" \| "tenant_admin" \| "auditor"` | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsIn(TENANT_ROLES)`                                                                                                                                        |
| `scopeType`      | `undefined \| "tenant" \| "organization" \| "team"`                                   | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsIn(['tenant', 'organization', 'team'])`                                                                                                                  |
| `organizationId` | `undefined \| string`                                                                 | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsUUID()`                                                                                                                                                  |
| `teamId`         | `undefined \| string`                                                                 | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsUUID()`                                                                                                                                                  |
| `reason`         | `undefined \| string`                                                                 | Optional / conditional | `@ValidateIf((_object, value) => value !== undefined)`<br>`@IsString()`<br>`@MinLength(3)`<br>`@MaxLength(1000)`                                                                                                       |

Referenced validation constants:

```ts
const TENANT_ROLES = ['tenant_admin', 'director', 'manager', 'prospector', 'auditor'] as const;
```

## UpdateObjectiveDto

[Source](../../apps/api/src/objectives/objective.dto.ts#L32)

| Field      | Type                  | Presence / default     | Validation / transformation                                                                                          |
| ---------- | --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `name`     | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                  |
| `target`   | `undefined \| number` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(10000000)`                             |
| `startsAt` | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |
| `endsAt`   | `undefined \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## UpdateOrganizationDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L36)

| Field    | Type                                  | Presence / default     | Validation / transformation                                                                                                     |
| -------- | ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | `undefined \| string`                 | Optional / conditional | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                          |
| `slug`   | `undefined \| string`                 | Optional / conditional | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`<br>`@MaxLength(100)` |
| `status` | `undefined \| "active" \| "inactive"` | Optional / conditional | `@ValidateIf(optional)`<br>`@IsIn(['active', 'inactive'])`                                                                      |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## UpdatePreferencesDto

[Source](../../apps/api/src/account/account.dto.ts#L58)

| Field           | Type                                         | Presence / default     | Validation / transformation                                                              |
| --------------- | -------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `theme`         | `undefined \| "system" \| "light" \| "dark"` | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsIn(['system', 'light', 'dark'])` |
| `density`       | `undefined \| "comfortable" \| "compact"`    | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsIn(['comfortable', 'compact'])`  |
| `reducedMotion` | `undefined \| false \| true`                 | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsBoolean()`                       |
| `highContrast`  | `undefined \| false \| true`                 | Optional / conditional | `@ValidateIf((_, value) => value !== undefined)`<br>`@IsBoolean()`                       |

## UpdateProspectDto

[Source](../../apps/api/src/prospect-master/prospect-master.dto.ts#L25)

| Field               | Type                                                                                                                                  | Presence / default     | Validation / transformation                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `undefined \| string`                                                                                                                 | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `regionId`          | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                                                                                        |
| `externalReference` | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `addressLine1`      | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                                                                                 |
| `postalCode`        | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(32)`                                                                                                                  |
| `city`              | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(150)`                                                                                                                 |
| `countryCode`       | `undefined \| string`                                                                                                                 | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must contain exactly two letters', })`                                         |
| `phone`             | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(50)`                                                                                                                  |
| `website`           | `undefined \| null \| string`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(2048)`                                                                                                                |
| `latitude`          | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-90)`<br>`@Max(90)`                                                               |
| `longitude`         | `undefined \| null \| number`                                                                                                         | Optional / conditional | `@IsOptional()`<br>`@IsNumber({ allowInfinity: false, allowNaN: false, })`<br>`@Min(-180)`<br>`@Max(180)`                                                             |
| `status`            | `undefined \| "active" \| "inactive" \| "archived"`                                                                                   | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'inactive', 'archived'] satisfies EstablishmentStatus[])`                                                                        |
| `category`          | `undefined \| null \| "prospection" \| "justice_enquetes" \| "sante" \| "asile_social" \| "douanes_onaf" \| "cra" \| "prescripteurs"` | Optional / conditional | `@IsOptional()`<br>`@IsIn([ 'prospection', 'justice_enquetes', 'sante', 'asile_social', 'douanes_onaf', 'cra', 'prescripteurs', ] satisfies EstablishmentCategory[])` |

## UpdateRegionDto

[Source](../../apps/api/src/regions/dto/update-region.dto.ts#L5)

| Field            | Type                                                                        | Presence / default     | Validation / transformation                                                                                 |
| ---------------- | --------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `name`           | `undefined \| string`                                                       | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(255)`                                                       |
| `code`           | `undefined \| null \| string`                                               | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(100)`                                                       |
| `type`           | `undefined \| "country" \| "administrative" \| "city" \| "sales_territory"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(['country', 'administrative', 'city', 'sales_territory'] satisfies RegionType[])` |
| `parentRegionId` | `undefined \| null \| string`                                               | Optional / conditional | `@IsOptional()`<br>`@IsUUID()`                                                                              |
| `status`         | `undefined \| "active" \| "inactive" \| "archived"`                         | Optional / conditional | `@IsOptional()`<br>`@IsIn(['active', 'inactive', 'archived'] satisfies RegionStatus[])`                     |

## UpdateRosterDto

[Source](../../apps/api/src/organization-structure/structure.dto.ts#L18)

| Field      | Type                                 | Presence / default     | Validation / transformation                                                                                                        |
| ---------- | ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `teamRole` | `undefined \| "manager" \| "member"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['manager', 'member'])`                                                        |
| `startsAt` | `undefined \| string`                | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`   | `undefined \| null \| string`        | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## UpdateRouteDto

[Source](../../apps/api/src/routes/route.dto.ts#L25)

| Field         | Type                                                            | Presence / default     | Validation / transformation                                                                                                     |
| ------------- | --------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | `undefined \| string`                                           | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(255)`                             |
| `scheduledAt` | `undefined \| string`                                           | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`            |
| `startPoint`  | `undefined \| { latitude: number; longitude: number; }`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => RoutePointDto)`               |
| `endPoint`    | `undefined \| null \| { latitude: number; longitude: number; }` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => RoutePointDto)` |

## UpdateSavedViewDto

[Source](../../apps/api/src/saved-views/saved-views.dto.ts#L67)

| Field       | Type                                       | Presence / default     | Validation / transformation                                                                                                                                        |
| ----------- | ------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`      | `undefined \| string`                      | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(MAX_SAVED_VIEW_NAME)`                                                                           |
| `filters`   | `undefined \| { [key: string]: unknown; }` | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                                                                                                                   |
| `sort`      | `undefined \| { [key: string]: string; }`  | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                                                                                                                   |
| `columns`   | `undefined \| Array<string>`               | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMaxSize(MAX_SAVED_VIEW_COLUMNS)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@MaxLength(120, { each: true })` |
| `shared`    | `undefined \| false \| true`               | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`<br>`@Type(() => Boolean)`                                                                                                        |
| `isDefault` | `undefined \| false \| true`               | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`<br>`@Type(() => Boolean)`                                                                                                        |

Referenced validation constants:

```ts
const MAX_SAVED_VIEW_NAME = 120;
```

```ts
const MAX_SAVED_VIEW_COLUMNS = 100;
```

## UpdateScheduledReportDto

[Source](../../apps/api/src/scheduled-reports/scheduled-reports.dto.ts#L76)

| Field        | Type                                            | Presence / default     | Validation / transformation                                                                                                                                                         |
| ------------ | ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cadence`    | `undefined \| "daily" \| "weekly" \| "monthly"` | Optional / conditional | `@IsOptional()`<br>`@IsIn(CADENCES)`                                                                                                                                                |
| `format`     | `undefined \| "csv" \| "xlsx" \| "pdf"`         | Optional / conditional | `@IsOptional()`<br>`@IsIn(FORMATS)`                                                                                                                                                 |
| `recipients` | `undefined \| Array<string>`                    | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_RECIPIENTS)`<br>`@ArrayUnique()`<br>`@IsEmail({}, { each: true })`<br>`@MaxLength(320, { each: true })` |
| `filters`    | `undefined \| { [key: string]: unknown; }`      | Optional / conditional | `@IsOptional()`<br>`@IsObject()`                                                                                                                                                    |
| `timezone`   | `undefined \| string`                           | Optional / conditional | `@IsOptional()`<br>`@IsString()`<br>`@MaxLength(64)`<br>`@Matches(/^[A-Za-z0-9_+\-/]+$/)`                                                                                           |
| `nextRunAt`  | `undefined \| string`                           | Optional / conditional | `@IsOptional()`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`                                                                                          |

Referenced validation constants:

```ts
const CADENCES = ['daily', 'weekly', 'monthly'] as const;
```

```ts
const FORMATS = ['csv', 'xlsx', 'pdf'] as const;
```

```ts
const MAX_RECIPIENTS = 50;
```

## UpdateSecurityPolicyDto

[Source](../../apps/api/src/security-administration/security-policy.controller.ts#L31)

| Field               | Type                                                                                                                                                                                | Presence / default     | Validation / transformation                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireMfa`        | `undefined \| false \| true`                                                                                                                                                        | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                           |
| `passwordMinLength` | `undefined \| number`                                                                                                                                                               | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(12)`<br>`@Max(128)`                                                                                  |
| `sessionMaxHours`   | `undefined \| number`                                                                                                                                                               | Optional / conditional | `@IsOptional()`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(168)`                                                                                   |
| `sso`               | `undefined \| null \| { provider: "oidc"; mode: "disabled" \| "configured"; issuer: string; clientId: string; clientSecret?: undefined \| string; allowedDomains: Array<string>; }` | Optional / conditional | `@ValidateIf((_, value) => value !== undefined && value !== null)`<br>`@IsObject()`<br>`@ValidateNested()`<br>`@Type(() => SsoSettingsDto)` |

## UpdateStopDto

[Source](../../apps/api/src/routes/route.dto.ts#L60)

| Field      | Type                                                 | Presence / default     | Validation / transformation                                                                                                        |
| ---------- | ---------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `position` | `undefined \| number`                                | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100)`                                                |
| `eta`      | `undefined \| null \| string`                        | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |
| `status`   | `undefined \| "completed" \| "arrived" \| "skipped"` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['arrived', 'completed', 'skipped'])`                                          |
| `outcome`  | `undefined \| string`                                | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsString()`<br>`@Matches(/\S/)`<br>`@MaxLength(2000)`                               |

## UpdateTagDto

[Source](../../apps/api/src/prospect-enrichment/enrichment.dto.ts#L28)

| Field   | Type                          | Presence / default     | Validation / transformation                                                                                                                                                         |
| ------- | ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`  | `undefined \| string`         | Optional / conditional | `@ValidateIf((_, v) => v !== undefined)`<br>`@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(80)` |
| `color` | `undefined \| null \| string` | Optional / conditional | `@IsOptional()`<br>`@Matches(/^#[0-9a-fA-F]{6}$/)`                                                                                                                                  |

## UpdateTeamDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L54)

| Field                 | Type                                  | Presence / default     | Validation / transformation                                                                                                     |
| --------------------- | ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `capacity`            | `undefined \| number`                 | Optional / conditional | `@ValidateIf(optional)`<br>`@IsInt()`<br>`@Min(1)`<br>`@Max(100000)`                                                            |
| `managerMembershipId` | `undefined \| null \| string`         | Optional / conditional | `@ValidateIf((_, value) => value !== undefined && value !== null)`<br>`@IsUUID()`                                               |
| `name`                | `undefined \| string`                 | Optional / conditional | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`                          |
| `slug`                | `undefined \| string`                 | Optional / conditional | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`<br>`@MaxLength(100)` |
| `status`              | `undefined \| "active" \| "inactive"` | Optional / conditional | `@ValidateIf(optional)`<br>`@IsIn(['active', 'inactive'])`                                                                      |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## UpdateTenantDto

[Source](../../apps/api/src/workspace-administration/workspace.dto.ts#L60)

| Field      | Type                  | Presence / default     | Validation / transformation                                                                            |
| ---------- | --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `name`     | `undefined \| string` | Optional / conditional | `@ValidateIf(optional)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)` |
| `locale`   | `undefined \| string` | Optional / conditional | `@ValidateIf(optional)`<br>`@IsLocale()`<br>`@MaxLength(35)`                                           |
| `timezone` | `undefined \| string` | Optional / conditional | `@ValidateIf(optional)`<br>`@IsTimeZone()`<br>`@MaxLength(100)`                                        |

Referenced validation constants:

```ts
const optional = (_: unknown, value: unknown) => value !== undefined;
```

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## UpdateTerritoryAssignmentDto

[Source](../../apps/api/src/participation/participation.dto.ts#L21)

| Field      | Type                          | Presence / default     | Validation / transformation                                                                                                        |
| ---------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `priority` | `undefined \| number`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsInt()`<br>`@Min(0)`<br>`@Max(100000)`                                             |
| `startsAt` | `undefined \| string`         | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)`               |
| `endsAt`   | `undefined \| null \| string` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsISO8601({ strict: true })`<br>`@Matches(/(?:Z\|[+-]\d{2}:\d{2})$/)` |

## UpdateTerritoryDto

[Source](../../apps/api/src/territories/territory.dto.ts#L26)

| Field      | Type                                               | Presence / default     | Validation / transformation                                                                                                            |
| ---------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | `undefined \| string`                              | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(255)`               |
| `code`     | `undefined \| null \| string`                      | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@Transform(trim)`<br>`@IsString()`<br>`@MinLength(1)`<br>`@MaxLength(100)` |
| `parentId` | `undefined \| null \| string`                      | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsUUID()`                                                                 |
| `boundary` | `undefined \| null \| { [key: string]: unknown; }` | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined && v !== null)`<br>`@IsObject()`                                                               |
| `status`   | `undefined \| "active" \| "inactive"`              | Optional / conditional | `@ValidateIf((_o, v) => v !== undefined)`<br>`@IsIn(['active', 'inactive'])`                                                           |

Referenced validation constants:

```ts
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
```

## UpdateUserStatusDto

[Source](../../apps/api/src/user-management/dto/update-user-status.dto.ts#L5)

| Field    | Type                                    | Presence / default | Validation / transformation                  |
| -------- | --------------------------------------- | ------------------ | -------------------------------------------- |
| `status` | `"active" \| "suspended" \| "disabled"` | Required           | `@IsIn(['active', 'suspended', 'disabled'])` |

## WebhookDto

[Source](../../apps/api/src/integrations/integrations.dto.ts#L43)

| Field    | Type            | Presence / default | Validation / transformation                                                                                                                                                           |
| -------- | --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`    | `string`        | Required           | `@IsUrl({ protocols: ['https'], require_protocol: true })`<br>`@MaxLength(500)`                                                                                                       |
| `events` | `Array<string>` | Required           | `@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_WEBHOOK_EVENTS)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })` |

Referenced validation constants:

```ts
const MAX_WEBHOOK_EVENTS = 50;
```

## WebhookUpdateDto

[Source](../../apps/api/src/integrations/integrations.dto.ts#L56)

| Field    | Type                         | Presence / default     | Validation / transformation                                                                                                                                                                              |
| -------- | ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`    | `undefined \| string`        | Optional / conditional | `@IsOptional()`<br>`@IsUrl({ protocols: ['https'], require_protocol: true })`<br>`@MaxLength(500)`                                                                                                       |
| `events` | `undefined \| Array<string>` | Optional / conditional | `@IsOptional()`<br>`@IsArray()`<br>`@ArrayMinSize(1)`<br>`@ArrayMaxSize(MAX_WEBHOOK_EVENTS)`<br>`@ArrayUnique()`<br>`@IsString({ each: true })`<br>`@Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })` |
| `active` | `undefined \| false \| true` | Optional / conditional | `@IsOptional()`<br>`@IsBoolean()`                                                                                                                                                                        |

Referenced validation constants:

```ts
const MAX_WEBHOOK_EVENTS = 50;
```
