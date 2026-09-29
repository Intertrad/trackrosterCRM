import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import { CreateProspectFollowUpDto } from './prospect-follow-up.dto.js';

const dueAt = '2026-09-21T10:00:00.000Z';

const categories = ['todo', 'follow_up', 'meeting'] as const;

const channels = ['call', 'email', 'message', 'visit', 'letter'] as const;

async function validateCreate(input: Record<string, unknown>) {
  const dto = plainToInstance(CreateProspectFollowUpDto, {
    dueAt,

    ...input,
  });

  return {
    dto,

    errors: await validate(dto),
  };
}

describe('CreateProspectFollowUpDto', () => {
  it.each(categories)('accepts category %s', async (category) => {
    const { errors } = await validateCreate({ category });

    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported category', async () => {
    const { errors } = await validateCreate({
      category: 'reminder',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'category',
        }),
      ]),
    );
  });

  it('rejects a null category instead of silently applying the default', async () => {
    const { errors } = await validateCreate({
      category: null,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'category',
        }),
      ]),
    );
  });

  it.each(channels)('accepts channel %s', async (channel) => {
    const { errors } = await validateCreate({ channel });

    expect(errors).toHaveLength(0);
  });

  it('allows an omitted or null channel', async () => {
    const omitted = await validateCreate({});

    const explicitNull = await validateCreate({
      channel: null,
    });

    expect(omitted.errors).toHaveLength(0);

    expect(omitted.dto.channel).toBeUndefined();

    expect(explicitNull.errors).toHaveLength(0);

    expect(explicitNull.dto.channel).toBeNull();
  });

  it('rejects an unsupported channel', async () => {
    const { errors } = await validateCreate({
      channel: 'sms',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'channel',
        }),
      ]),
    );
  });
});
