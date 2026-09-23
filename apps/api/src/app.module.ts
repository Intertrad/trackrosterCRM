import { EnrichmentModule } from './prospect-enrichment/enrichment.controller.js';
import { ProspectMasterModule } from './prospect-master/prospect-master.controller.js';
import { MapModule } from './maps/map.controller.js';
import { CanonicalDashboardModule } from './reporting/canonical-dashboard.controller.js';
import { OutcomeSettingsModule } from './outcome-settings/outcome-settings.controller.js';
import { DataJobsModule } from './data-jobs/data-jobs.module.js';
import { ReservationLifecycleModule } from './reservations/reservation-lifecycle.module.js';
import { CollisionWorkflowModule } from './collisions/collision-workflow.module.js';
import { ActionModule } from './actions/action.module.js';
import { ConsentModule } from './consents/consent.module.js';
import { GeographicAllocationModule } from './geographic-allocation/allocation.module.js';
import { CampaignOrganizationModule } from './campaign-organizations/campaign-organization.module.js';
import { StructureModule } from './organization-structure/structure.module.js';
import { ParticipationModule } from './participation/participation.module.js';
import { TerritoryModule } from './territories/territory.module.js';
import { MembershipModule } from './memberships/membership.module.js';
import { SecurityAdministrationModule } from './security-administration/security-administration.module.js';
import { Module } from '@nestjs/common';
import { AccountModule } from './account/account.module.js';
import { WorkspaceAdministrationModule } from './workspace-administration/workspace-administration.module.js';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from './tenants/tenant.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationModule } from './organizations/organization.module.js';
import { TeamModule } from './teams/team.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './users/user.module.js';
import { validateEnvironment } from './config/environment.validation.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { UserManagementModule } from './user-management/user-management.module.js';
import { EstablishmentModule } from './establishments/establishment.module.js';
import { EstablishmentContactModule } from './establishment-contacts/establishment-contact.module.js';
import { ImportPreviewModule } from './imports/import-preview.module.js';
import { ImportExecutionModule } from './imports/import-execution.module.js';
import { CampaignModule } from './campaigns/campaign.module.js';
import { AssignmentModule } from './assignments/assignment.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ReservationModule } from './reservations/reservation.module.js';
import { CollisionModule } from './collisions/collision.module.js';
import { ActivityModule } from './activities/activity.module.js';
import { FollowUpModule } from './follow-ups/follow-up.module.js';
import { JobQueueModule } from './jobs/job-queue.module.js';
import { NotificationModule } from './notifications/notification.module.js';
import { ReportingModule } from './reporting/reporting.module.js';
import { ExportModule } from './exports/export.module.js';
import { ApiErrorModule } from './errors/api-error.module.js';
import { IdempotencyModule } from './idempotency/idempotency.module.js';
import { RegionModule } from './regions/region.module.js';
import { WorkQueueModule } from './work-queue/work-queue.module.js';
import { ProspectorTodayModule } from './prospector-today/prospector-today.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { CommunicationsModule } from './communications/communications.module.js';
@Module({
  imports: [
    EnrichmentModule,
    ProspectMasterModule,
    MapModule,
    CanonicalDashboardModule,
    OutcomeSettingsModule,
    DataJobsModule,
    ReservationLifecycleModule,
    CollisionWorkflowModule,
    ActionModule,
    ConsentModule,
    GeographicAllocationModule,
    CampaignOrganizationModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validate: validateEnvironment,
    }),

    DatabaseModule,
    AccountModule,
    MembershipModule,
    TerritoryModule,
    ParticipationModule,
    StructureModule,
    SecurityAdministrationModule,
    WorkspaceAdministrationModule,
    TenantModule,
    HealthModule,
    OrganizationModule,
    TeamModule,
    AuthModule,
    UserModule,
    ApiErrorModule,

    AuthorizationModule,
    UserManagementModule,
    EstablishmentModule,
    EstablishmentContactModule,
    ImportPreviewModule,
    ImportExecutionModule,
    CampaignModule,
    AssignmentModule,
    RedisModule,
    ReservationModule,
    CollisionModule,
    ActivityModule,
    FollowUpModule,
    NotificationModule,
    JobQueueModule,
    ReportingModule,
    ExportModule,
    IdempotencyModule,
    RegionModule,
    WorkQueueModule,
    ProspectorTodayModule,
    MessagingModule,
    CommunicationsModule,
  ],
})
export class AppModule {}
