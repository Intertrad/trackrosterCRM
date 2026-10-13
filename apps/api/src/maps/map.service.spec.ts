import { describe, expect, it, vi } from 'vitest';

import { MapService, viewport } from './map.service.js';

const auth = { tenantId: 'tenant-1', membershipId: 'member-1' } as never;

describe('map service', () => {
  it('validates WGS84 bounds and handles the antimeridian', () => {
    expect(viewport('170,-10,-170,10')).toEqual([170, -10, -170, 10]);
    expect(() => viewport('0,0,0,10')).toThrow('Invalid WGS84 bounding box');
    expect(() => viewport('0,91,10,95')).toThrow('Invalid WGS84 bounding box');
  });

  it('returns stable ordered map features for a bounded scope', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ scope_type: 'tenant', role: 'client_admin' }] })
      .mockResolvedValueOnce({ rows: [{ memberships: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            memberships: 2,
            total: 2,
            cells: 2,
            stages: { to_contact: 2 },
            features: [
              {
                type: 'Feature',
                id: 'a',
                geometry: { type: 'Point', coordinates: [2, 48] },
                properties: { cluster: false },
              },
              {
                type: 'Feature',
                id: 'b',
                geometry: { type: 'Point', coordinates: [3, 49] },
                properties: { cluster: false },
              },
            ],
          },
        ],
      });

    const result = await new MapService({ execute } as never).markers(auth, {
      bbox: '1,47,4,50',
      zoom: 12,
    });

    const features = result.features as Array<{ id: string }>;
    expect(features.map((feature) => feature.id)).toEqual(['a', 'b']);
    expect(result.summary).toEqual({
      prospects: 2,
      campaignMemberships: 2,
      byLifecycleStage: { to_contact: 2 },
    });
    expect(result.truncated).toBe(false);
  });

  it('fails closed when a large-scope request exceeds the membership budget', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ memberships: 20_001 }] });

    await expect(
      new MapService({ execute } as never).markers(auth, {
        bbox: '1,47,4,50',
        zoom: 2,
      }),
    ).rejects.toMatchObject({ response: { code: 'MAP_SCOPE_TOO_LARGE' } });
  });
});
