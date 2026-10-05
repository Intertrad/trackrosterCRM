import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { resolveOutcome } from './outcome-settings.service.js';

function executorWith(outcomes: Array<Record<string, unknown>>) {
  const where = vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', outcomes }]);
  const from = vi.fn().mockReturnValue({ where });

  return {
    select: vi.fn().mockReturnValue({ from }),
  } as never;
}

describe('resolveOutcome', () => {
  it('accepts a tenant-wide outcome with no channel list', async () => {
    await expect(
      resolveOutcome(
        executorWith([
          {
            code: 'qualified',
            label: 'Qualified',
            behavior: 'qualified',
            enabled: true,
            actionTypes: [],
          },
        ]),
        'tenant-1',
        'qualified',
        'call',
      ),
    ).resolves.toMatchObject({ code: 'qualified' });
  });

  it('still rejects an enabled outcome limited to another channel', async () => {
    await expect(
      resolveOutcome(
        executorWith([
          {
            code: 'qualified',
            label: 'Qualified',
            behavior: 'qualified',
            enabled: true,
            actionTypes: ['visit'],
          },
        ]),
        'tenant-1',
        'qualified',
        'call',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
