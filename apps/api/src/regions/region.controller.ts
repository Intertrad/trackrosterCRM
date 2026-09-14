import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { UpdateRegionDto } from './dto/update-region.dto.js';
import { RegionService } from './region.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('regions')
@UseGuards(AuthGuard, ClientAdminGuard)
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Idempotent('region.create')
  @Post()
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Body()
    input: CreateRegionDto,
  ) {
    return this.regionService.create({
      ...input,

      tenantId: auth.tenantId,

      actorUserId: auth.userId,
    });
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,
  ) {
    return this.regionService.list(auth.tenantId);
  }

  @Get(':regionId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('regionId', new ParseUUIDPipe())
    regionId: string,
  ) {
    return this.regionService.findById(auth.tenantId, regionId);
  }

  @Get(':regionId/children')
  listChildren(
    @CurrentAuth()
    auth: AuthContext,

    @Param('regionId', new ParseUUIDPipe())
    regionId: string,
  ) {
    return this.regionService.listChildren(auth.tenantId, regionId);
  }

  @Idempotent('region.update')
  @Patch(':regionId')
  update(
    @CurrentAuth()
    auth: AuthContext,

    @Param('regionId', new ParseUUIDPipe())
    regionId: string,

    @Body()
    input: UpdateRegionDto,
  ) {
    return this.regionService.update(auth.tenantId, regionId, auth.userId, input);
  }
}
