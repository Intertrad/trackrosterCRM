import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ControlledExportQueryDto } from '../exports/dto/export-query.dto.js';
export class JobListDto {
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export class ImportRowsDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(10001) afterRow = 0;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export class ImportMappingDto {
  @IsObject() mapping!: Record<string, string>;
}
export class ImportIssueResolutionDto {
  @IsIn(['skip', 'reuse', 'correct']) resolution!: 'skip' | 'reuse' | 'correct';
  @IsOptional() @IsObject() values?: Record<string, string>;
}
export class ExportRequestDto extends ControlledExportQueryDto {
  @IsIn(['assignments', 'activities', 'follow_ups']) type!:
    'assignments' | 'activities' | 'follow_ups';
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  fields?: string[];
}
export class DownloadExportDto {
  @IsString() token!: string;
}
