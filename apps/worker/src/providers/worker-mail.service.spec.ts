import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerMailService } from './worker-mail.service.js';

describe('WorkerMailService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a report through a mocked Brevo response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'mock-message-id' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new WorkerMailService(
      new ConfigService({
        BREVO_API_KEY: 'mock-api-key',
        BREVO_SENDER_EMAIL: 'sender@example.com',
      }),
    );

    await expect(
      service.sendReport(['recipient@example.com'], 'Test report', 'report.txt', 'mock content'),
    ).resolves.toEqual({ sent: true, providerId: 'mock-message-id' });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.brevo.com/v3/smtp/email');
  });

  it('surfaces provider failures for worker retry handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })),
    );
    const service = new WorkerMailService(
      new ConfigService({
        BREVO_API_KEY: 'mock-api-key',
        BREVO_SENDER_EMAIL: 'sender@example.com',
      }),
    );

    await expect(
      service.sendReport(['recipient@example.com'], 'Test', 'report.txt', 'content'),
    ).rejects.toThrow('Brevo delivery failed with HTTP 401');
  });
});
