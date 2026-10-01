import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkerPushService } from './worker-push.service.js';

describe('WorkerPushService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a push notification through the configured provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'push-message-id' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new WorkerPushService(
      new ConfigService({
        PUSH_PROVIDER_URL: 'https://push.example.test/send',
        PUSH_PROVIDER_API_KEY: 'push-api-key',
      }),
    );

    await expect(
      service.send('device-token', 'Override requested', 'Review the request.'),
    ).resolves.toEqual({
      sent: true,
      invalid: false,
      providerId: 'push-message-id',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://push.example.test/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer push-api-key' }),
      }),
    );
  });

  it('classifies invalid devices without retrying them forever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 410 })));
    const service = new WorkerPushService(
      new ConfigService({
        PUSH_PROVIDER_URL: 'https://push.example.test/send',
        PUSH_PROVIDER_API_KEY: 'push-api-key',
      }),
    );

    await expect(
      service.send('expired-token', 'Override requested', 'Review the request.'),
    ).resolves.toEqual({
      sent: false,
      invalid: true,
      providerId: null,
    });
  });

  it('returns an unavailable result when push is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new WorkerPushService(new ConfigService());

    await expect(
      service.send('device-token', 'Override requested', 'Review the request.'),
    ).resolves.toEqual({
      sent: false,
      invalid: false,
      providerId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
