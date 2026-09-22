import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ProspectorTodayQueryDto } from './prospector-today-query.dto.js';

async function validateQuery(input: Record<string, unknown>) {
  const dto = plainToInstance(ProspectorTodayQueryDto, input);

  return {
    dto,
    errors: await validate(dto),
  };
}

describe('ProspectorTodayQueryDto', () => {
  it('accepts an exact team UUID and IANA time zone', async () => {
    const { dto, errors } = await validateQuery({
      teamId: '11111111-1111-4111-8111-111111111111',
      timeZone: 'Europe/Paris',
    });

    expect(errors).toHaveLength(0);
    expect(dto.teamId).toBe('11111111-1111-4111-8111-111111111111');
    expect(dto.timeZone).toBe('Europe/Paris');
  });

  it('rejects a malformed team id', async () => {
    const { errors } = await validateQuery({
      teamId: 'not-a-uuid',
      timeZone: 'Europe/Paris',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown time zone', async () => {
    const { errors } = await validateQuery({
      teamId: '11111111-1111-4111-8111-111111111111',
      timeZone: 'Mars/Olympus_Mons',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires both query parameters', async () => {
    const { errors } = await validateQuery({});

    expect(errors.length).toBeGreaterThan(0);
  });
});
