import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ControlledExportSerializerService } from './controlled-export-serializer.service.js';

describe('ControlledExportSerializerService', () => {
  const service = new ControlledExportSerializerService();

  const generatedAt = new Date('2026-09-11T12:00:00.000Z');

  it('generates a CSV with fixed assignment columns', async () => {
    const file = await service.serialize({
      exportId: '11111111-1111-4111-8111-111111111111',

      type: 'assignments',

      format: 'csv',

      generatedAt,

      rows: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

          campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

          organizationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

          teamId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

          assignedUserId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

          assignedAt: '2026-09-10T08:00:00.000Z',

          endedAt: null,
        },
      ],
    });

    expect(file.format).toBe('csv');

    expect(file.rowCount).toBe(1);

    expect(file.contentType).toBe('text/csv; charset=utf-8');

    expect(file.filename).toMatch(/^trackroster-assignments-.*\.csv$/);

    const text = file.content.toString('utf8');

    expect(text).toContain(
      'ID,Campaign ID,Campaign Prospect ID,Organization ID,Team ID,Assigned User ID,Assigned At,Ended At',
    );

    expect(text).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('escapes CSV fields containing commas and quotes', async () => {
    const file = await service.serialize({
      exportId: '11111111-1111-4111-8111-111111111111',

      type: 'assignments',

      format: 'csv',

      generatedAt,

      rows: [
        {
          id: 'value,with"quotes',

          campaignId: 'campaign',

          campaignProspectId: 'prospect',

          organizationId: 'organization',

          teamId: 'team',

          assignedUserId: null,

          assignedAt: '2026-09-10T08:00:00.000Z',

          endedAt: null,
        },
      ],
    });

    const text = file.content.toString('utf8');

    expect(text).toContain('"value,with""quotes"');
  });

  it('neutralizes spreadsheet formulas in CSV output', async () => {
    const file = await service.serialize({
      exportId: '11111111-1111-4111-8111-111111111111',

      type: 'assignments',

      format: 'csv',

      generatedAt,

      rows: [
        {
          id: '=SUM(1+1)',

          campaignId: '+danger',

          campaignProspectId: '-danger',

          organizationId: '@danger',

          teamId: 'safe',

          assignedUserId: null,

          assignedAt: '2026-09-10T08:00:00.000Z',

          endedAt: null,
        },
      ],
    });

    const text = file.content.toString('utf8');

    expect(text).toContain("'=SUM(1+1)");

    expect(text).toContain("'+danger");

    expect(text).toContain("'-danger");

    expect(text).toContain("'@danger");
  });

  it('generates a valid XLSX workbook', async () => {
    const file = await service.serialize({
      exportId: '11111111-1111-4111-8111-111111111111',

      type: 'assignments',

      format: 'xlsx',

      generatedAt,

      rows: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          campaignId: 'campaign',

          campaignProspectId: 'prospect',

          organizationId: 'organization',

          teamId: 'team',

          assignedUserId: '=FORMULA()',

          assignedAt: '2026-09-10T08:00:00.000Z',

          endedAt: null,
        },
      ],
    });

    expect(file.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    expect(file.filename).toMatch(/^trackroster-assignments-.*\.xlsx$/);

    const workbook = new ExcelJS.Workbook();

    const xlsxArrayBuffer = Uint8Array.from(file.content).buffer;

    await workbook.xlsx.load(xlsxArrayBuffer);

    const worksheet = workbook.getWorksheet('Export');

    expect(worksheet).toBeDefined();

    expect(worksheet?.getCell('A1').value).toBe('ID');

    expect(worksheet?.getCell('F2').value).toBe("'=FORMULA()");
  });

  it('exports an empty dataset with headers only', async () => {
    const file = await service.serialize({
      exportId: '11111111-1111-4111-8111-111111111111',

      type: 'activities',

      format: 'csv',

      generatedAt,

      rows: [],
    });

    expect(file.rowCount).toBe(0);

    const lines = file.content.toString('utf8').split('\r\n');

    expect(lines).toHaveLength(1);

    expect(lines[0]).toContain('Activity Type');
  });
});
