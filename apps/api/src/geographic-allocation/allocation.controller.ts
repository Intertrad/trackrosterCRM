import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { GeographicAllocationDto } from './allocation.dto.js';
import { GeographicAllocationService } from './allocation.service.js';
@Injectable()
export class GeographicAllocationGuard implements CanActivate {
  constructor(private readonly service: GeographicAllocationService) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ auth: AuthenticatedPrincipal; params: { campaignId: string } }>();
    if (!isUUID(req.params.campaignId))
      throw new BadRequestException('Valid campaign identifier required');
    await this.service.authorize(req.auth, req.params.campaignId);
    return true;
  }
}
@Controller('campaigns/:campaignId/geographic-allocation')
@UseGuards(AuthGuard, GeographicAllocationGuard)
export class GeographicAllocationController {
  constructor(private readonly service: GeographicAllocationService) {}
  @Post('preview')
  @HttpCode(200)
  preview(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) id: string,
    @Body() input: GeographicAllocationDto,
  ) {
    return this.service.run(auth, id, input, false);
  }
  @Post('apply')
  @HttpCode(200)
  @Idempotent('geographic_allocation.apply')
  apply(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) id: string,
    @Body() input: GeographicAllocationDto,
  ) {
    return this.service.run(auth, id, input, true);
  }
}
