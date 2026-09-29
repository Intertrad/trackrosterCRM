import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  SCRIPT_CHANNELS,
  ScriptService,
  type ScriptChannel,
  type ScriptInput,
} from './script.service.js';

class ScriptDto implements ScriptInput {
  @IsString() @MaxLength(160) name!: string;
  @IsIn(SCRIPT_CHANNELS) channel!: ScriptChannel;
  @IsOptional() @IsString() sector?: string | null;
  @IsOptional() @IsUUID() organizationId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) subject?: string | null;
  @IsString() @MaxLength(20000) body!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) variables?: string[];
  @IsOptional() enabled?: boolean;
}
class ScriptQuery {
  @IsOptional() @IsIn(SCRIPT_CHANNELS) channel?: ScriptChannel;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsString() sector?: string;
}
class PreviewDto {
  values!: Record<string, string>;
}
class TestDto extends PreviewDto {
  @IsEmail() to!: string;
}

@Controller('scripts')
@UseGuards(AuthGuard, ClientAdminGuard)
export class ScriptController {
  constructor(private readonly scripts: ScriptService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ScriptQuery) {
    return this.scripts.list(auth, query);
  }
  @Get(':scriptId') get(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scriptId', ParseUUIDPipe) id: string,
  ) {
    return this.scripts.get(auth, id);
  }
  @Post() @Idempotent('script.create') create(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: ScriptDto,
  ) {
    return this.scripts.create(auth, input);
  }
  @Patch(':scriptId') @Idempotent('script.update') update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scriptId', ParseUUIDPipe) id: string,
    @Body() input: Partial<ScriptDto>,
  ) {
    return this.scripts.update(auth, id, input);
  }
  @Delete(':scriptId') @Idempotent('script.delete') remove(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scriptId', ParseUUIDPipe) id: string,
  ) {
    return this.scripts.remove(auth, id);
  }
  @Post(':scriptId/preview') preview(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scriptId', ParseUUIDPipe) id: string,
    @Body() input: PreviewDto,
  ) {
    return this.scripts.preview(auth, id, input.values ?? {});
  }
  @Post(':scriptId/test') @Idempotent('script.test') test(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scriptId', ParseUUIDPipe) id: string,
    @Body() input: TestDto,
  ) {
    return this.scripts.sendTest(auth, id, input.to, input.values ?? {});
  }
}
