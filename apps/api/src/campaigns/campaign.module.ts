import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstablishmentModule } from '../establishments/establishment.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { CampaignProspectController } from './campaign-prospect.controller.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';
import { CampaignProspectService } from './campaign-prospect.service.js';
import { CampaignController } from './campaign.controller.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignService } from './campaign.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuthorizationModule,
    OrganizationModule,
    EstablishmentModule,
  ],

  controllers: [CampaignController, CampaignProspectController],

  providers: [
    CampaignRepository,
    CampaignService,
    CampaignProspectRepository,
    CampaignProspectService,
  ],

  exports: [
    CampaignRepository,
    CampaignService,
    CampaignProspectRepository,
    CampaignProspectService,
  ],
})
export class CampaignModule {}
