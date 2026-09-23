import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class RoutePointDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
}
export class UpdateRouteDto {
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/\S/) @MaxLength(255) name?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  scheduledAt?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => RoutePointDto)
  startPoint?: RoutePointDto;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => RoutePointDto)
  endPoint?: RoutePointDto | null;
}
export class CreateRouteDto extends UpdateRouteDto {
  @IsUUID() teamId!: string;
  @IsString() @Matches(/\S/) @MaxLength(255) declare name: string;
  @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) declare scheduledAt: string;
  @IsObject() @ValidateNested() @Type(() => RoutePointDto) declare startPoint: RoutePointDto;
}
export class RouteListDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() teamId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['draft', 'active', 'completed', 'cancelled'])
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export class AddStopDto {
  @IsUUID() campaignProspectId!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() actionId?: string;
}
export class UpdateStopDto {
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(1) @Max(100) position?: number;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  eta?: string | null;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['arrived', 'completed', 'skipped']) status?:
    'arrived' | 'completed' | 'skipped';
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  outcome?: string;
}
export class StopOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  stopIds!: string[];
}
