import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import { ControlledExportQueryDto } from './dto/export-query.dto.js';
import { ExportTypeParamDto } from './dto/export-type-param.dto.js';

describe('controlled export DTOs', () => {
  describe('ExportTypeParamDto', () => {
    it.each(['assignments', 'activities', 'follow_ups'])('accepts export type %s', async (type) => {
      const dto = plainToInstance(ExportTypeParamDto, {
        type,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects an unsupported export type', async () => {
      const dto = plainToInstance(ExportTypeParamDto, {
        type: 'users',
      });

      const errors = await validate(dto);

      expect(errors).not.toHaveLength(0);
    });

    it('rejects arbitrary table-like values', async () => {
      const dto = plainToInstance(ExportTypeParamDto, {
        type: 'user_access_grants',
      });

      const errors = await validate(dto);

      expect(errors).not.toHaveLength(0);
    });
  });

  describe('ControlledExportQueryDto', () => {
    it('defaults format to csv', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {});

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);

      expect(dto.format).toBe('csv');
    });

    it.each(['csv', 'xlsx'])('accepts format %s', async (format) => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        format,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects an unsupported format', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        format: 'json',
      });

      const errors = await validate(dto);

      expect(errors).not.toHaveLength(0);
    });

    it('transforms valid ISO dates into Date objects', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        from: '2026-09-01T00:00:00.000Z',

        to: '2026-09-10T00:00:00.000Z',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);

      expect(dto.from).toBeInstanceOf(Date);

      expect(dto.to).toBeInstanceOf(Date);

      expect(dto.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('rejects an invalid date', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        from: 'not-a-date',

        to: '2026-09-10T00:00:00.000Z',
      });

      const errors = await validate(dto);

      expect(errors).not.toHaveLength(0);
    });

    it('accepts valid UUID filters', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        organizationId: '11111111-1111-4111-8111-111111111111',

        teamId: '22222222-2222-4222-8222-222222222222',

        userId: '33333333-3333-4333-8333-333333333333',

        campaignId: '44444444-4444-4444-8444-444444444444',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('rejects invalid UUID filters', async () => {
      const dto = plainToInstance(ControlledExportQueryDto, {
        teamId: 'not-a-uuid',
      });

      const errors = await validate(dto);

      expect(errors).not.toHaveLength(0);
    });
  });
});
