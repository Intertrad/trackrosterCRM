import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { CONTROLLED_EXPORT_COLUMNS, type ExportColumn } from './export-columns.js';

import {
  type ControlledExportFormat,
  type ControlledExportType,
  type ExportCellValue,
  type ExportRow,
  type GeneratedExportFile,
} from './export.types.js';

import { sanitizeSpreadsheetValue } from './spreadsheet-value.utils.js';

interface SerializeControlledExportInput {
  exportId: string;

  type: ControlledExportType;

  format: ControlledExportFormat;

  generatedAt: Date;

  rows: ExportRow[];
  fields?: string[];
}

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ControlledExportSerializerService {
  async serialize(input: SerializeControlledExportInput): Promise<GeneratedExportFile> {
    const columns = input.fields
      ? input.fields.map((key) => CONTROLLED_EXPORT_COLUMNS[input.type].find((c) => c.key === key)!)
      : CONTROLLED_EXPORT_COLUMNS[input.type];

    const filename = this.buildFilename(input.type, input.format, input.generatedAt);

    const content =
      input.format === 'csv'
        ? this.serializeCsv(columns, input.rows)
        : await this.serializeXlsx(columns, input.rows);

    return {
      exportId: input.exportId,

      type: input.type,

      format: input.format,

      filename,

      contentType: input.format === 'csv' ? CSV_CONTENT_TYPE : XLSX_CONTENT_TYPE,

      content,

      rowCount: input.rows.length,
    };
  }

  /*
   * -------------------------------------------------
   * CSV
   * -------------------------------------------------
   *
   * We deliberately implement the small amount of
   * CSV writing needed by controlled exports instead
   * of relying on the import-side csv parser.
   */
  private serializeCsv(columns: readonly ExportColumn[], rows: ExportRow[]): Buffer {
    const header = columns.map((column) => this.escapeCsvField(column.header)).join(',');

    const serializedRows = rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column.key] ?? null;

          return this.escapeCsvField(sanitizeSpreadsheetValue(value));
        })
        .join(','),
    );

    /*
     * UTF-8 BOM improves compatibility when opening
     * files containing accented/non-ASCII text in
     * spreadsheet applications.
     *
     * CRLF is used for broad CSV compatibility.
     */
    const csv = ['\uFEFF' + header, ...serializedRows].join('\r\n');

    return Buffer.from(csv, 'utf8');
  }

  private escapeCsvField(value: ExportCellValue): string {
    if (value === null) {
      return '';
    }

    const text = String(value);

    /*
     * RFC-style CSV escaping:
     *
     * - quote values containing comma
     * - quote values containing quote
     * - quote values containing CR/LF
     * - double embedded quotes
     */
    if (text.includes(',') || text.includes('"') || text.includes('\r') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  }

  /*
   * -------------------------------------------------
   * XLSX
   * -------------------------------------------------
   */
  private async serializeXlsx(
    columns: readonly ExportColumn[],
    rows: ExportRow[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'TrackRoster';

    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Export');

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    worksheet.columns = columns.map((column) => ({
      header: column.header,

      key: column.key,

      /*
       * This is only presentation width.
       *
       * We do not allow callers to influence
       * workbook structure.
       */
      width: 24,
    }));

    for (const row of rows) {
      const values: Record<string, ExportCellValue> = {};

      for (const column of columns) {
        values[column.key] = sanitizeSpreadsheetValue(row[column.key] ?? null);
      }

      worksheet.addRow(values);
    }

    /*
     * Header formatting only.
     *
     * No formulas, macros, hyperlinks or external
     * workbook references are generated.
     */
    worksheet.getRow(1).font = {
      bold: true,
    };

    const output = await workbook.xlsx.writeBuffer();

    return Buffer.from(output);
  }

  /*
   * -------------------------------------------------
   * SAFE FILENAME
   * -------------------------------------------------
   *
   * Every component is server-controlled.
   *
   * No user-provided filename reaches
   * Content-Disposition later.
   */
  private buildFilename(
    type: ControlledExportType,
    format: ControlledExportFormat,
    generatedAt: Date,
  ): string {
    const timestamp = generatedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-');

    const safeType = type.replaceAll('_', '-');

    return `trackroster-${safeType}-` + `${timestamp}.${format}`;
  }
}
