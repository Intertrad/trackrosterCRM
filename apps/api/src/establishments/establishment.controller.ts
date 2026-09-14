import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { CreateEstablishmentDto } from './dto/create-establishment.dto.js';
import { NearbyEstablishmentsQueryDto } from './dto/nearby-establishments-query.dto.js';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto.js';
import { EstablishmentService } from './establishment.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('establishments')
@UseGuards(AuthGuard, ClientAdminGuard)
export class EstablishmentController {
  constructor(private readonly establishmentService: EstablishmentService) {}

  @Post()
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Body()
    input: CreateEstablishmentDto,
  ) {
    return this.establishmentService.create({
      tenantId: auth.tenantId,

      ...input,

      source: 'manual',
    });
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,
  ) {
    return this.establishmentService.list(auth.tenantId);
  }

  /*
   * Keep the static /nearby route above the UUID
   * parameter route for an unambiguous HTTP contract.
   */
  @Get('nearby')
  findNearby(
    @CurrentAuth()
    auth: AuthContext,

    @Query()
    query: NearbyEstablishmentsQueryDto,
  ) {
    return this.establishmentService.findNearby({
      tenantId: auth.tenantId,

      latitude: query.latitude,

      longitude: query.longitude,

      radiusMeters: query.radiusMeters,

      limit: query.limit,
    });
  }

  @Get(':establishmentId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,
  ) {
    return this.establishmentService.findById(
      auth.tenantId,

      establishmentId,
    );
  }

  @Patch(':establishmentId')
  update(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,

    @Body()
    input: UpdateEstablishmentDto,
  ) {
    return this.establishmentService.update(
      auth.tenantId,

      establishmentId,

      input,
    );
  }
}
