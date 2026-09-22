import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  CreateCampaignOrganizationDto,
  ListCampaignOrganizationsDto,
  UpdateCampaignOrganizationDto,
} from './campaign-organization.dto.js';
import { CampaignOrganizationService } from './campaign-organization.service.js';
@Injectable()
export class CampaignOrganizationGuard implements CanActivate {
  constructor(private readonly service: CampaignOrganizationService) {}
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
@Controller('campaigns/:campaignId/organizations')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class CampaignOrganizationController {
  constructor(private readonly service: CampaignOrganizationService) {}
  @Get() list(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Query() query: ListCampaignOrganizationsDto,
  ) {
    return this.service.list(auth, campaignId, query);
  }
  @Post()
  @UseGuards(CampaignOrganizationGuard)
  @Idempotent('campaign_organization.create')
  create(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Body() input: CreateCampaignOrganizationDto,
  ) {
    return this.service.mutate(auth, campaignId, input.organizationId, input, true);
  }
  @Patch(':organizationId')
  @UseGuards(CampaignOrganizationGuard)
  @Idempotent('campaign_organization.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() input: UpdateCampaignOrganizationDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.service.mutate(auth, campaignId, organizationId, input, false, ifMatch);
  }
  @Delete(':organizationId')
  @HttpCode(204)
  @UseGuards(CampaignOrganizationGuard)
  @Idempotent('campaign_organization.end')
  async end(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.service.mutate(auth, campaignId, organizationId, null, false, ifMatch);
  }
}
