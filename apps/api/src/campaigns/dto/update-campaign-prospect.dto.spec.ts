import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCampaignProspectDto } from './update-campaign-prospect.dto.js';

describe('UpdateCampaignProspectDto', () => {
  it('accepts membership status only', async () => {
    const dto = plainToInstance(UpdateCampaignProspectDto, { status: 'excluded' });
    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('rejects lifecycle stage writes through the membership PATCH', async () => {
    const dto = plainToInstance(UpdateCampaignProspectDto, {
      status: 'active',
      lifecycleStage: 'qualified',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((error) => error.property === 'lifecycleStage')).toBe(true);
  });
});
