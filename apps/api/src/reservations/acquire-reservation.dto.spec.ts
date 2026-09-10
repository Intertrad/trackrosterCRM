import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { AcquireReservationDto } from './acquire-reservation.dto.js';

describe('AcquireReservationDto', () => {
  it('allows an omitted overrideId', async () => {
    const dto = new AcquireReservationDto();

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows a valid UUID overrideId', async () => {
    const dto = new AcquireReservationDto();

    dto.overrideId = '66666666-6666-4666-8666-666666666666';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid overrideId', async () => {
    const dto = new AcquireReservationDto();

    dto.overrideId = 'manager-says-yes';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);

    expect(errors[0]?.property).toBe('overrideId');
  });
});
