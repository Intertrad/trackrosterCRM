import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/*
 * These are classes rather than type literals so the global ValidationPipe
 * runs against them: a `Record<string, unknown>` or `any` @Body() has no
 * runtime metatype, and Nest silently skips validation for the handler.
 */

export const MAX_SCOPES = 50;

export const MAX_WEBHOOK_EVENTS = 50;

export class ApiClientDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;

  /* Bounded and pattern-checked: a scope list is an authorization grant, so
   * it should not accept arbitrary strings or an unbounded array. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCOPES)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_.:-]{0,63}$/, { each: true })
  scopes!: string[];

  @IsOptional() @IsISO8601({ strict: true }) expiresAt?: string;
}

export class WebhookDto {
  /* https only, so a delivery cannot be sent in clear text. */
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_WEBHOOK_EVENTS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })
  events!: string[];
}

export class WebhookUpdateDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_WEBHOOK_EVENTS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })
  events?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

/**
 * Configuration handed to a provider connection.
 *
 * The keys differ per provider, so they cannot be enumerated. Bounding it to
 * an object still rejects an array or a scalar, which the previous
 * `Record<string, unknown>` parameter accepted without any check at all.
 */
export class ConnectIntegrationDto {
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
