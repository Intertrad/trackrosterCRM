import { ReservationHistoryInterceptor } from './reservation-history.interceptor.js';
import { UseInterceptors } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AcquireReservationDto } from './acquire-reservation.dto.js';
import { ReservationService } from './reservation.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/reservation')
@UseGuards(AuthGuard)
@UseInterceptors(ReservationHistoryInterceptor)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  acquire(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    body?: AcquireReservationDto,
  ) {
    return this.reservationService.acquire({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      overrideId: body?.overrideId,
    });
  }

  @Get()
  getCurrent(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.reservationService.getCurrent({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,
    });
  }

  @Delete(':reservationId')
  release(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Param('reservationId', new ParseUUIDPipe())
    reservationId: string,
  ) {
    return this.reservationService.release({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      reservationId,
    });
  }
}
