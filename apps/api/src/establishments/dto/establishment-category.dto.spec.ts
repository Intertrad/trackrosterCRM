import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { ESTABLISHMENT_CATEGORIES } from '../../database/schema/establishments.js';
import { CreateEstablishmentDto } from './create-establishment.dto.js';
import { ListEstablishmentsQueryDto } from './list-establishments-query.dto.js';
import { UpdateEstablishmentDto } from './update-establishment.dto.js';

/*
 * The taxonomy is validated in three places — create, update and the listing
 * filter — and all three have to agree with the database enum. A value accepted
 * by a DTO but rejected by PostgreSQL is a 500 where a 400 belongs, and a value
 * the filter rejects but create accepts is a row nobody can search for.
 */
const base = { name: 'Brigade des Rives', countryCode: 'FR' };

describe('establishment category validation', () => {
  it('accepts every category the database defines, and no others', async () => {
    for (const category of ESTABLISHMENT_CATEGORIES) {
      const dto = plainToInstance(CreateEstablishmentDto, { ...base, category });

      expect(await validate(dto), `create should accept ${category}`).toHaveLength(0);
    }

    const unknown = plainToInstance(CreateEstablishmentDto, { ...base, category: 'gendarmerie' });
    const errors = await validate(unknown);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('category');
  });

  it('treats the category as optional on create and on update', async () => {
    expect(await validate(plainToInstance(CreateEstablishmentDto, base))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateEstablishmentDto, {}))).toHaveLength(0);
  });

  it('rejects an unknown category on the listing filter', async () => {
    const valid = plainToInstance(ListEstablishmentsQueryDto, { category: 'cra' });
    const invalid = plainToInstance(ListEstablishmentsQueryDto, { category: 'CRA' });

    expect(await validate(valid)).toHaveLength(0);
    /* Upper case is a different string to PostgreSQL, so it is a 400 here. */
    expect(await validate(invalid)).toHaveLength(1);
  });
});
