import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  GeographicAllocationController,
  GeographicAllocationGuard,
} from './allocation.controller.js';
import { GeographicAllocationService } from './allocation.service.js';
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GeographicAllocationController],
  providers: [GeographicAllocationService, GeographicAllocationGuard],
})
export class GeographicAllocationModule {}
