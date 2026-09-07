import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { ImportPreviewService } from './import-preview.service.js';
import type { ImportPreviewResult } from './import-preview.types.js';

interface MultipartFileUpload {
  fieldname: string;
  filename: string;

  toBuffer(): Promise<Buffer>;
}

interface MultipartFastifyRequest {
  isMultipart(): boolean;

  file(): Promise<MultipartFileUpload | undefined>;
}

@Controller('imports')
@UseGuards(AuthGuard, ClientAdminGuard)
export class ImportPreviewController {
  constructor(private readonly importPreviewService: ImportPreviewService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Req()
    request: MultipartFastifyRequest,
  ): Promise<ImportPreviewResult> {
    if (!request.isMultipart()) {
      throw new BadRequestException('Request must use multipart/form-data');
    }

    try {
      const file = await request.file();

      if (!file) {
        throw new BadRequestException('CSV file is required');
      }

      if (file.fieldname !== 'file') {
        throw new BadRequestException('CSV file must use the field name "file"');
      }

      if (!file.filename.toLowerCase().endsWith('.csv')) {
        throw new BadRequestException('Only CSV files are supported');
      }

      const buffer = await file.toBuffer();

      const csvContent = buffer.toString('utf8');

      return this.importPreviewService.previewCsv(csvContent);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (this.getErrorCode(error) === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('CSV file is too large');
      }

      throw new BadRequestException('CSV upload could not be processed');
    }
  }

  private getErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }

    return typeof error.code === 'string' ? error.code : null;
  }
}
