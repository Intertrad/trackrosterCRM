import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from './tenants/tenant.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationModule } from './organizations/organization.module.js';
import { TeamModule } from './teams/team.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    DatabaseModule,
    TenantModule,
    HealthModule,
    OrganizationModule,
    TeamModule,
  ],
})
export class AppModule {}
