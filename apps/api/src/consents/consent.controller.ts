import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { CreateConsentDto, ListConsentsDto } from './consent.dto.js';
import { ConsentService } from './consent.service.js';
@Injectable()
export class ConsentWriteGuard implements CanActivate {
  constructor(private readonly service: ConsentService) {}
  async canActivate(c: ExecutionContext) {
    const r = c
      .switchToHttp()
      .getRequest<{ auth: AuthenticatedPrincipal; params: { prospectId: string } }>();
    if (!isUUID(r.params.prospectId))
      throw new BadRequestException('Valid prospect identifier required');
    await this.service.authorize(r.auth, r.params.prospectId, true);
    return true;
  }
}
@Controller('prospects/:prospectId/consents')
@UseGuards(AuthGuard)
export class ConsentController {
  constructor(private readonly service: ConsentService) {}
  @Get() list(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Query() q: ListConsentsDto,
  ) {
    return this.service.list(a, id, q);
  }
  @Post()
  @UseGuards(ConsentWriteGuard)
  @Idempotent('prospect_consent.append')
  append(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Body() input: CreateConsentDto,
  ) {
    return this.service.append(a, id, input);
  }
}
