import type { ExportCellValue } from './export.types.js';

/*
 * Prevent spreadsheet formula injection.
 *
 * Values beginning with these characters may be
 * interpreted as formulas by spreadsheet software:
 *
 * =SUM(...)
 * +CMD(...)
 * -1+1
 * @SUM(...)
 *
 * Tabs / carriage returns are also treated
 * conservatively because spreadsheet applications
 * may interpret them specially when opening CSVs.
 *
 * Numbers remain numbers. Only strings require
 * neutralization.
 */
const DANGEROUS_SPREADSHEET_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeSpreadsheetValue(value: ExportCellValue): ExportCellValue {
  if (typeof value !== 'string') {
    return value;
  }

  if (DANGEROUS_SPREADSHEET_PREFIX.test(value)) {
    return `'${value}`;
  }

  return value;
}
