import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UserManagementService } from './user-management.service.js';
import { ManagedUser } from './user-management.types.js';

@Controller('users')
@UseGuards(AuthGuard, ClientAdminGuard)
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  async list(
    @CurrentAuth()
    auth: AuthenticatedUser,
  ): Promise<ManagedUser[]> {
    return this.userManagementService.list(auth.tenantId);
  }

  @Post()
  async create(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Body()
    input: CreateUserDto,
  ): Promise<ManagedUser> {
    return this.userManagementService.create({
      tenantId: auth.tenantId,
      email: input.email,
      password: input.password,
    });
  }

  @Patch(':userId/status')
  async updateStatus(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('userId')
    userId: string,

    @Body()
    input: UpdateUserStatusDto,
  ): Promise<ManagedUser> {
    return this.userManagementService.updateStatus(
      auth.tenantId,
      auth.userId,
      userId,
      input.status,
    );
  }
}
