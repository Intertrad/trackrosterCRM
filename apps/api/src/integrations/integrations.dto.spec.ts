import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { ApiClientDto, WebhookDto, WebhookUpdateDto } from './integrations.dto.js';

describe('integration DTOs', () => {
  it('rejects non-HTTPS webhook URLs', async () => {
    const dto = Object.assign(new WebhookDto(), { url: 'http://example.test/hook', events: ['x'] });
    expect(await validate(dto)).not.toHaveLength(0);
  });
  it('accepts bounded API client data', async () => {
    const dto = Object.assign(new ApiClientDto(), { name: 'Reporting', scopes: ['reports:read'] });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('rejects non-boolean webhook activation', async () => {
    const dto = Object.assign(new WebhookUpdateDto(), { active: 'yes' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
