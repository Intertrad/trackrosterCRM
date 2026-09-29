import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  Injectable,
  Module,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DatabaseModule } from '../database/database.module.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { OutcomeSettingsService, ACTION_TYPES, BEHAVIORS } from './outcome-settings.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
class OutcomeDto {
  @IsString() @Matches(/^[a-z][a-z0-9_]{0,39}$/) code!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) label!: string;
  @IsIn(BEHAVIORS) behavior!: string;
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn(ACTION_TYPES, { each: true })
  actionTypes!: string[];
}
class SettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OutcomeDto)
  outcomes!: OutcomeDto[];
}
@Injectable()
class SettingsGuard implements CanActivate {
  constructor(private readonly service: OutcomeSettingsService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      await this.service.authorize(
        c.switchToHttp().getRequest<{ auth: AuthenticatedPrincipal }>().auth,
      );
      return true;
    });
  }
}
@Controller('settings/default-statuses')
@UseGuards(AuthGuard)
class OutcomeSettingsController {
  constructor(private readonly service: OutcomeSettingsService) {}
  @Get() read(@CurrentAuth() a: AuthenticatedPrincipal) {
    return this.service.read(a);
  }
  @Patch() @UseGuards(SettingsGuard) @Idempotent('outcome_settings.update') update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Body() b: SettingsDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.update(a, b.outcomes, v);
  }
}
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [OutcomeSettingsController],
  providers: [OutcomeSettingsService, SettingsGuard],
})
export class OutcomeSettingsModule {}
