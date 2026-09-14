import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEstablishmentDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;

  @IsOptional()
  @IsUUID()
  regionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string | null;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'countryCode must contain exactly two letters',
  })
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  website?: string | null;

  @IsOptional()
  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
  })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
  })
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}
