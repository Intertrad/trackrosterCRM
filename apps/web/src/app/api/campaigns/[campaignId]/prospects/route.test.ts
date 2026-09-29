import { beforeEach, describe, expect, it, vi } from 'vitest';
const { backend } = vi.hoisted(() => ({ backend: vi.fn() }));
vi.mock('@/lib/server/authenticated-backend-json', () => ({ authenticatedBackendJson: backend }));
import { GET } from './route';

const context = { params: Promise.resolve({ campaignId: 'campaign' }) };
beforeEach(() => vi.clearAllMocks());
describe('bounded campaign enrollment resolution', () => {
  it('rejects an unbounded browser read before calling the backend', async () => {
    const response = await GET(
      new Request('https://app.test/api/campaigns/campaign/prospects'),
      context,
    );
    expect(response.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
  it('forwards only explicit establishment IDs and preserves the backend result', async () => {
    backend.mockResolvedValue([{ id: 'enrollment', establishmentId: 'record' }]);
    const response = await GET(
      new Request(
        'https://app.test/api/campaigns/campaign/prospects?establishmentIds=a,b&tenantId=foreign&limit=100000',
      ),
      context,
    );
    expect(backend).toHaveBeenCalledWith('/campaigns/campaign/prospects?establishmentIds=a%2Cb');
    expect(await response.json()).toEqual([{ id: 'enrollment', establishmentId: 'record' }]);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('preserves a missing session as 401', async () => {
    backend.mockResolvedValue(null);
    const response = await GET(
      new Request('https://app.test/api/campaigns/campaign/prospects?establishmentIds=a'),
      context,
    );
    expect(response.status).toBe(401);
  });
});
