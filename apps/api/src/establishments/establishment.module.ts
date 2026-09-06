import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstablishmentController } from './establishment.controller.js';
import { EstablishmentRepository } from './establishment.repository.js';
import { EstablishmentService } from './establishment.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuthorizationModule],
  controllers: [EstablishmentController],
  providers: [EstablishmentRepository, EstablishmentService],
  exports: [EstablishmentRepository, EstablishmentService],
})
export class EstablishmentModule {}
