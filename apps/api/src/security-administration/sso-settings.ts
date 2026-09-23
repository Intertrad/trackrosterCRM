import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'node:crypto';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsObject,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class SsoSettingsDto {
  @IsIn(['oidc']) provider!: 'oidc';
  @IsIn(['disabled', 'configured']) mode!: 'disabled' | 'configured';
  @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })
  @MaxLength(2048)
  issuer!: string;
  @IsString() @MinLength(1) @MaxLength(512) clientId!: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  clientSecret?: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
      : value,
  )
  allowedDomains!: string[];
}
export class SsoPatchDto {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => SsoSettingsDto)
  sso?: SsoSettingsDto | null;
}
export type StoredSsoSettings = Omit<SsoSettingsDto, 'clientSecret'> & {
  encryptedClientSecret: string | null;
};
export function publicSso(settings: StoredSsoSettings | null | undefined) {
  if (!settings)
    return {
      provider: 'oidc',
      mode: 'disabled',
      issuer: null,
      clientId: null,
      allowedDomains: [],
      clientSecretConfigured: false,
      loginAvailable: false,
    };
  const { encryptedClientSecret, ...safe } = settings;
  return { ...safe, clientSecretConfigured: !!encryptedClientSecret, loginAvailable: false };
}
export function storeSso(
  input: SsoSettingsDto,
  current: StoredSsoSettings | null | undefined,
  keyHex: string | undefined,
  tenantId: string,
): StoredSsoSettings {
  const issuer = new URL(input.issuer);
  if (issuer.search || issuer.hash || issuer.username || issuer.password)
    throw new BadRequestException('OIDC issuer must not contain query, fragment or credentials');
  if (input.clientId.trim() !== input.clientId)
    throw new BadRequestException('Client ID must not contain surrounding whitespace');
  let encryptedClientSecret =
    current?.issuer === input.issuer && current.clientId === input.clientId
      ? current.encryptedClientSecret
      : null;
  if (input.clientSecret !== undefined) {
    if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex))
      throw new ServiceUnavailableException(
        'SSO_ENCRYPTION_KEY must be provisioned before saving a client secret',
      );
    const nonce = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), nonce);
    cipher.setAAD(Buffer.from(`trackroster:oidc:v1:${tenantId}`));
    const encrypted = Buffer.concat([cipher.update(input.clientSecret, 'utf8'), cipher.final()]);
    encryptedClientSecret = [
      'v1',
      nonce.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }
  if (input.mode === 'configured' && !encryptedClientSecret)
    throw new BadRequestException('Configured OIDC connections require a client secret');
  return {
    provider: input.provider,
    mode: input.mode,
    issuer: input.issuer,
    clientId: input.clientId,
    allowedDomains: input.allowedDomains,
    encryptedClientSecret,
  };
}
