import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionService } from './permission.service.js';
@Module({ imports: [DatabaseModule], providers: [PermissionService], exports: [PermissionService] })
export class PermissionModule {}
