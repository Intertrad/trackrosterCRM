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
import { CreateEstablishmentContactDto } from './dto/create-establishment-contact.dto.js';
import { UpdateEstablishmentContactDto } from './dto/update-establishment-contact.dto.js';
import { EstablishmentContactService } from './establishment-contact.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('establishments/:establishmentId/contacts')
@UseGuards(AuthGuard, ClientAdminGuard)
export class EstablishmentContactController {
  constructor(private readonly contactService: EstablishmentContactService) {}

  @Post()
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,

    @Body()
    input: CreateEstablishmentContactDto,
  ) {
    return this.contactService.create({
      tenantId: auth.tenantId,
      establishmentId,
      ...input,
      source: 'manual',
    });
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,
  ) {
    return this.contactService.list(auth.tenantId, establishmentId);
  }

  @Get(':contactId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,

    @Param('contactId', new ParseUUIDPipe())
    contactId: string,
  ) {
    return this.contactService.findById(auth.tenantId, establishmentId, contactId);
  }

  @Patch(':contactId')
  update(
    @CurrentAuth()
    auth: AuthContext,

    @Param('establishmentId', new ParseUUIDPipe())
    establishmentId: string,

    @Param('contactId', new ParseUUIDPipe())
    contactId: string,

    @Body()
    input: UpdateEstablishmentContactDto,
  ) {
    return this.contactService.update(auth.tenantId, establishmentId, contactId, input);
  }
}
