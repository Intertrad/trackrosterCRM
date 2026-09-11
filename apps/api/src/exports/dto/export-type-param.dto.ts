import { IsIn } from 'class-validator';

import { CONTROLLED_EXPORT_TYPES, type ControlledExportType } from '../export.types.js';

export class ExportTypeParamDto {
  @IsIn(CONTROLLED_EXPORT_TYPES)
  type!: ControlledExportType;
}
