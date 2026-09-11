import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import {
  ManagerDashboardQueryDto,
  MAX_DASHBOARD_RANGE_DAYS,
} from './manager-dashboard-query.dto.js';

async function validateQuery(input: Record<string, unknown>) {
  const dto = plainToInstance(ManagerDashboardQueryDto, input);

  const errors = await validate(dto);

  return {
    dto,

    errors,
  };
}

describe('ManagerDashboardQueryDto', () => {
  it('accepts an empty query so the service can apply the default 30 day range', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);

    expect(dto.from).toBeUndefined();

    expect(dto.to).toBeUndefined();

    expect(dto.organizationId).toBeUndefined();

    expect(dto.teamId).toBeUndefined();

    expect(dto.userId).toBeUndefined();

    expect(dto.campaignId).toBeUndefined();
  });

  it('transforms valid from and to query parameters into Date objects', async () => {
    const { dto, errors } = await validateQuery({
      from: '2026-09-01T00:00:00.000Z',

      to: '2026-09-11T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);

    expect(dto.from).toBeInstanceOf(Date);

    expect(dto.to).toBeInstanceOf(Date);

    expect(dto.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');

    expect(dto.to?.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  it('rejects from without to', async () => {
    const { errors } = await validateQuery({
      from: '2026-09-01T00:00:00.000Z',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects to without from', async () => {
    const { errors } = await validateQuery({
      to: '2026-09-11T00:00:00.000Z',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid from date', async () => {
    const { errors } = await validateQuery({
      from: 'not-a-date',

      to: '2026-09-11T00:00:00.000Z',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid to date', async () => {
    const { errors } = await validateQuery({
      from: '2026-09-01T00:00:00.000Z',

      to: 'not-a-date',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a range where from equals to', async () => {
    const { errors } = await validateQuery({
      from: '2026-09-11T00:00:00.000Z',

      to: '2026-09-11T00:00:00.000Z',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a range where from is after to', async () => {
    const { errors } = await validateQuery({
      from: '2026-09-12T00:00:00.000Z',

      to: '2026-09-11T00:00:00.000Z',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts the maximum supported 366 day range', async () => {
    const from = new Date('2025-01-01T00:00:00.000Z');

    const to = new Date(from.getTime() + MAX_DASHBOARD_RANGE_DAYS * 24 * 60 * 60 * 1000);

    const { errors } = await validateQuery({
      from: from.toISOString(),

      to: to.toISOString(),
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a range longer than 366 days', async () => {
    const from = new Date('2025-01-01T00:00:00.000Z');

    const to = new Date(from.getTime() + (MAX_DASHBOARD_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000);

    const { errors } = await validateQuery({
      from: from.toISOString(),

      to: to.toISOString(),
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid UUID filters', async () => {
    const { dto, errors } = await validateQuery({
      organizationId: '11111111-1111-4111-8111-111111111111',

      teamId: '22222222-2222-4222-8222-222222222222',

      userId: '33333333-3333-4333-8333-333333333333',

      campaignId: '44444444-4444-4444-8444-444444444444',
    });

    expect(errors).toHaveLength(0);

    expect(dto.organizationId).toBe('11111111-1111-4111-8111-111111111111');

    expect(dto.teamId).toBe('22222222-2222-4222-8222-222222222222');

    expect(dto.userId).toBe('33333333-3333-4333-8333-333333333333');

    expect(dto.campaignId).toBe('44444444-4444-4444-8444-444444444444');
  });

  it.each([
    {
      organizationId: 'not-a-uuid',
    },

    {
      teamId: 'not-a-uuid',
    },

    {
      userId: 'not-a-uuid',
    },

    {
      campaignId: 'not-a-uuid',
    },
  ])('rejects invalid UUID filters: %o', async (input) => {
    const { errors } = await validateQuery(input);

    expect(errors.length).toBeGreaterThan(0);
  });
});
