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

  it('sends a notification through the same tenant-safe provider contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'notification-message-id' }), {
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
      service.sendNotification('recipient@example.com', 'Follow-up due', 'A follow-up is due.'),
    ).resolves.toEqual({ sent: true, providerId: 'notification-message-id' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'mock-api-key' }),
      }),
    );
  });

  it('keeps notification delivery disabled when Brevo is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new WorkerMailService(new ConfigService());

    await expect(
      service.sendNotification('recipient@example.com', 'Follow-up due', 'A follow-up is due.'),
    ).resolves.toEqual({ sent: false, providerId: null });
    expect(fetchMock).not.toHaveBeenCalled();
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
