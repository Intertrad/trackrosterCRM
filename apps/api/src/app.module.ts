import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validate: validateEnvironment,
    }),

    DatabaseModule,
    TenantModule,
    HealthModule,
    OrganizationModule,
    TeamModule,
    AuthModule,
    UserModule,
    AuthorizationModule,
    UserManagementModule,
    EstablishmentModule,
    EstablishmentContactModule,
  ],
})
export class AppModule {}
