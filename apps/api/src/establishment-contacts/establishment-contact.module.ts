import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstablishmentModule } from '../establishments/establishment.module.js';
import { EstablishmentContactController } from './establishment-contact.controller.js';
import { EstablishmentContactRepository } from './establishment-contact.repository.js';
import { EstablishmentContactService } from './establishment-contact.service.js';

@Module({
  imports: [DatabaseModule, EstablishmentModule, AuthModule, AuthorizationModule],

  controllers: [EstablishmentContactController],

  providers: [EstablishmentContactRepository, EstablishmentContactService],

  exports: [EstablishmentContactRepository, EstablishmentContactService],
})
export class EstablishmentContactModule {}
