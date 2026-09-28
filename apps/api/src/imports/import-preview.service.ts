import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { normalizeContactEmail } from '../establishment-contacts/establishment-contact.utils.js';
import {
  IMPORT_HEADERS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  REQUIRED_IMPORT_HEADERS,
} from './import-preview.constants.js';
import {
  ESTABLISHMENT_CATEGORIES,
  type EstablishmentCategory,
} from '../database/schema/establishments.js';

import type {
  ImportIssue,
  ImportPreviewContact,
  ImportPreviewEstablishment,
  ImportPreviewResult,
  ImportPreviewRow,
} from './import-preview.types.js';

type RawImportRow = Record<string, string | undefined>;

@Injectable()
export class ImportPreviewService {
  previewCsv(csvContent: string): ImportPreviewResult {
    if (!csvContent.trim()) {
      throw new BadRequestException('CSV file is empty');
    }

    if (Buffer.byteLength(csvContent, 'utf8') > MAX_IMPORT_FILE_BYTES) {
      throw new BadRequestException('CSV file is too large');
    }

    let records: RawImportRow[];

    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as RawImportRow[];
    } catch {
      throw new BadRequestException('CSV file could not be parsed');
    }

    if (records.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`CSV file cannot contain more than ${MAX_IMPORT_ROWS} rows`);
    }

    const headers = this.extractHeaders(csvContent);

    this.validateHeaders(headers);

    const rows = records.map((record, index) => this.previewRow(record, index + 2));

    this.markDuplicateRows(rows);

    return {
      summary: {
        totalRows: rows.length,

        validRows: rows.filter((row) => row.status === 'valid').length,

        warningRows: rows.filter((row) => row.status === 'warning').length,

        invalidRows: rows.filter((row) => row.status === 'invalid').length,
      },

      rows,
    };
  }

  private previewRow(record: RawImportRow, rowNumber: number): ImportPreviewRow {
    const issues: ImportIssue[] = [];

    const name = this.optionalText(record.name);

    const countryCode = this.optionalText(record.country_code)?.toUpperCase() ?? null;

    if (!name) {
      issues.push({
        field: 'name',
        code: 'required',
        message: 'Establishment name is required',
        severity: 'error',
      });
    }

    if (!countryCode) {
      issues.push({
        field: 'country_code',
        code: 'required',
        message: 'Country code is required',
        severity: 'error',
      });
    } else if (!/^[A-Z]{2}$/.test(countryCode)) {
      issues.push({
        field: 'country_code',
        code: 'invalid_country_code',
        message: 'Country code must contain exactly two letters',
        severity: 'error',
      });
    }

    const latitude = this.parseCoordinate(record.latitude, 'latitude', -90, 90, issues);

    const longitude = this.parseCoordinate(record.longitude, 'longitude', -180, 180, issues);

    if ((latitude === null) !== (longitude === null)) {
      issues.push({
        code: 'coordinate_pair_required',
        message: 'Latitude and longitude must be provided together',
        severity: 'error',
      });
    }

    const contactEmail = normalizeContactEmail(record.contact_email);

    if (contactEmail && !this.looksLikeEmail(contactEmail)) {
      issues.push({
        field: 'contact_email',
        code: 'invalid_email',
        message: 'Contact email is invalid',
        severity: 'error',
      });
    }

    const contactName = this.optionalText(record.contact_name);

    const contactPhone = this.optionalText(record.contact_phone);

    const contactJobTitle = this.optionalText(record.contact_job_title);

    const hasContactData = Boolean(contactName || contactEmail || contactPhone || contactJobTitle);

    const hasContactIdentity = Boolean(contactName || contactEmail || contactPhone);

    if (hasContactData && !hasContactIdentity) {
      issues.push({
        field: 'contact_job_title',
        code: 'contact_identity_missing',
        message: 'Contact has a job title but no name, email, or phone and will be ignored',
        severity: 'warning',
      });
    }

    const hasError = issues.some((issue) => issue.severity === 'error');

    if (hasError || !name || !countryCode) {
      return {
        rowNumber,
        status: 'invalid',
        establishment: null,
        contact: null,
        issues,
      };
    }

    /*
     * An unrecognised category is a warning, not a rejection: the row is still a
     * real establishment and is worth importing uncategorised. Dropping the value
     * silently would be worse — a file with a mis-spelled column would import
     * 14,000 rows that no dispatch filter could ever find.
     */
    const rawCategory = this.optionalText(record.category)?.toLowerCase() ?? null;
    const category =
      rawCategory && (ESTABLISHMENT_CATEGORIES as readonly string[]).includes(rawCategory)
        ? (rawCategory as EstablishmentCategory)
        : null;

    if (rawCategory && !category) {
      issues.push({
        field: 'category',
        code: 'unknown_value',
        message: `Unknown category "${rawCategory}"; the establishment is imported without one`,
        severity: 'warning',
      });
    }

    const establishment: ImportPreviewEstablishment = {
      externalReference: this.optionalText(record.external_reference),

      name,

      addressLine1: this.optionalText(record.address_line1),

      postalCode: this.optionalText(record.postal_code),

      city: this.optionalText(record.city),

      countryCode,

      phone: this.optionalText(record.phone),

      website: this.optionalText(record.website),

      latitude,
      longitude,

      category,
    };

    const contact = this.buildContact(record, contactEmail);

    const hasWarning = issues.some((issue) => issue.severity === 'warning');

    return {
      rowNumber,

      status: hasWarning ? 'warning' : 'valid',

      establishment,
      contact,
      issues,
    };
  }

  private buildContact(record: RawImportRow, email: string | null): ImportPreviewContact | null {
    const name = this.optionalText(record.contact_name);

    const jobTitle = this.optionalText(record.contact_job_title);

    const phone = this.optionalText(record.contact_phone);

    /*
     * A job title by itself is not
     * enough to create a contact.
     */
    if (!name && !email && !phone) {
      return null;
    }

    return {
      name,
      jobTitle,
      email,
      phone,

      isPrimary: this.parseBoolean(record.is_primary),
    };
  }

  private markDuplicateRows(rows: ImportPreviewRow[]): void {
    const seen = new Map<string, number>();

    for (const row of rows) {
      if (row.status === 'invalid' || !row.establishment) {
        continue;
      }

      const key = this.buildDuplicateKey(row.establishment);

      const firstRowNumber = seen.get(key);

      if (firstRowNumber !== undefined) {
        row.issues.push({
          code: 'duplicate_in_file',

          message: `Possible duplicate of CSV row ${firstRowNumber}`,

          severity: 'warning',
        });

        row.status = 'warning';

        continue;
      }

      seen.set(key, row.rowNumber);
    }
  }

  private buildDuplicateKey(establishment: ImportPreviewEstablishment): string {
    if (establishment.externalReference) {
      return ['external', establishment.externalReference.trim().toLowerCase()].join(':');
    }

    return [
      'identity',

      this.normalizeDuplicateText(establishment.name),

      this.normalizeDuplicateText(establishment.postalCode),

      this.normalizeDuplicateText(establishment.city),

      establishment.countryCode,
    ].join('|');
  }

  private normalizeDuplicateText(value: string | null): string {
    return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  }

  private validateHeaders(headers: string[]): void {
    for (const required of REQUIRED_IMPORT_HEADERS) {
      if (!headers.includes(required)) {
        throw new BadRequestException(`Missing required CSV column: ${required}`);
      }
    }

    const supportedHeaders: readonly string[] = IMPORT_HEADERS;

    const unsupported = headers.filter((header) => !supportedHeaders.includes(header));

    if (unsupported.length > 0) {
      throw new BadRequestException(`Unsupported CSV columns: ${unsupported.join(', ')}`);
    }
  }

  private extractHeaders(csvContent: string): string[] {
    try {
      const rows = parse(csvContent, {
        to_line: 1,
        bom: true,
        trim: true,
      }) as string[][];

      return (rows[0] ?? []).map((header) => header.trim());
    } catch {
      throw new BadRequestException('CSV header could not be parsed');
    }
  }

  private optionalText(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private parseCoordinate(
    value: string | undefined,

    field: string,

    minimum: number,
    maximum: number,

    issues: ImportIssue[],
  ): number | null {
    const normalized = this.optionalText(value);

    if (!normalized) {
      return null;
    }

    const number = Number(normalized);

    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      issues.push({
        field,

        code: 'invalid_coordinate',

        message: `${field} must be between ${minimum} and ${maximum}`,

        severity: 'error',
      });

      return null;
    }

    return number;
  }

  private parseBoolean(value: string | undefined): boolean {
    const normalized = this.optionalText(value)?.toLowerCase();

    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
