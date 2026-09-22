import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class CreateTerritoryDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID() parentId?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsObject() boundary?: Record<
    string,
    unknown
  > | null;
}
export class UpdateTerritoryDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID() parentId?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsObject() boundary?: Record<
    string,
    unknown
  > | null;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['active', 'inactive']) status?:
    'active' | 'inactive';
}
export class LinkTerritoryDto {
  @IsUUID() territoryId!: string;
}
