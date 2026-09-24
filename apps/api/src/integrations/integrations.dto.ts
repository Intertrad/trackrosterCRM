import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApiClientDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsArray() @IsString({ each: true }) scopes!: string[];
  @IsOptional() @IsISO8601() expiresAt?: string;
}

export class WebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) url!: string;
  @IsArray() @IsString({ each: true }) events!: string[];
}

export class WebhookUpdateDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) events?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
