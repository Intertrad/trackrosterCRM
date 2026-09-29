import { inflateRawSync } from 'node:zlib';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from '../imports/import-preview.constants.js';
function checkZip(buffer: Buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new BadRequestException('Invalid XLSX archive');
  const count = buffer.readUInt16LE(end + 10),
    offset = buffer.readUInt32LE(end + 16);
  if (count > 200 || offset >= buffer.length)
    throw new BadRequestException('XLSX archive exceeds supported bounds');
  let cursor = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new BadRequestException('Invalid XLSX directory');
    if (buffer.readUInt16LE(cursor + 8) & 1)
      throw new BadRequestException('Encrypted XLSX is not supported');
    const declared = buffer.readUInt32LE(cursor + 24),
      compressedSize = buffer.readUInt32LE(cursor + 20),
      local = buffer.readUInt32LE(cursor + 42),
      method = buffer.readUInt16LE(cursor + 10);
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
      throw new BadRequestException('Invalid XLSX entry');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressedSize > offset)
      throw new BadRequestException('Invalid XLSX compressed bounds');
    const compressed = buffer.subarray(start, start + compressedSize);
    let expanded: Buffer;
    try {
      expanded =
        method === 0
          ? compressed
          : method === 8
            ? inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 - total })
            : Buffer.alloc(0);
    } catch {
      throw new PayloadTooLargeException('Invalid or oversized compressed XLSX entry');
    }
    if (![0, 8].includes(method) || expanded.length !== declared)
      throw new BadRequestException('Invalid XLSX expansion metadata');
    total += buffer.readUInt32LE(cursor + 24);
    if (total > 20 * 1024 * 1024)
      throw new PayloadTooLargeException('Expanded XLSX exceeds 20 MiB');
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
}
export async function parseImportFile(filename: string, buffer: Buffer) {
  if (buffer.length > MAX_IMPORT_FILE_BYTES)
    throw new PayloadTooLargeException('Import exceeds 5 MiB');
  let cells: string[][];
  if (filename.toLowerCase().endsWith('.csv')) {
    try {
      cells = parse(buffer.toString('utf8'), {
        bom: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as string[][];
    } catch {
      throw new BadRequestException('Invalid CSV');
    }
  } else if (filename.toLowerCase().endsWith('.xlsx')) {
    checkZip(buffer);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('Invalid XLSX workbook');
    }
    if (workbook.worksheets.length !== 1)
      throw new BadRequestException('Use a workbook with exactly one worksheet');
    const sheet = workbook.worksheets[0]!;
    if (sheet.rowCount > MAX_IMPORT_ROWS + 1 || sheet.columnCount > 100)
      throw new PayloadTooLargeException('Workbook exceeds row/column limits');
    cells = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const value = row.getCell(c).value;
        if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value))
          throw new BadRequestException(
            'Replace spreadsheet formulas with values before importing',
          );
        values.push(value instanceof Date ? value.toISOString() : row.getCell(c).text.trim());
      }
      cells.push(values);
    });
  } else throw new BadRequestException('Only CSV and XLSX files are supported');
  if (cells.length < 2 || cells.length > MAX_IMPORT_ROWS + 1)
    throw new BadRequestException('Import requires 1–10000 data rows');
  const headers = cells[0]!.map((v) => v.trim());
  if (
    headers.length > 100 ||
    headers.some((v) => !v || v.length > 255) ||
    new Set(headers).size !== headers.length
  )
    throw new BadRequestException('Headers must be nonempty, distinct and bounded');
  const records = cells.slice(1);
  if (records.some((r) => r.length > headers.length || r.some((c) => c.length > 10000)))
    throw new BadRequestException('Import cells exceed supported bounds');
  return { headers, records: records.map((r) => headers.map((_, i) => r[i] ?? '')) };
}
export const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
