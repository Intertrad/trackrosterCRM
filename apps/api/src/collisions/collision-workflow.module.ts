import { ReservationPolicyModule } from '../reservations/reservation-policy.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PermissionModule } from '../permissions/permission.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { CollisionModule } from './collision.module.js';
import { CollisionWorkflowService } from './collision-workflow.service.js';
import {
  CollisionWorkflowController,
  CollisionWorkflowGuard,
} from './collision-workflow.controller.js';
@Module({
  imports: [
    ReservationPolicyModule,
    AuthModule,
    DatabaseModule,
    AuthorizationModule,
    PermissionModule,
    ReservationModule,
    CollisionModule,
  ],
  controllers: [CollisionWorkflowController],
  providers: [CollisionWorkflowService, CollisionWorkflowGuard],
})
export class CollisionWorkflowModule {}
