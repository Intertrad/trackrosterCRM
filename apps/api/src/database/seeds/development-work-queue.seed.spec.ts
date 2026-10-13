import { describe, expect, it } from 'vitest';

import { developmentCoordinates, developmentSeedNow } from './development-work-queue.seed.js';

describe('development map fixtures', () => {
  it('generates stable coordinates from a city and external reference', () => {
    const first = developmentCoordinates('Nancy', 'dev-map-001');
    const second = developmentCoordinates('Nancy', 'dev-map-001');

    expect(first).toEqual(second);
    expect(first.latitude).toBeGreaterThan(48.6795);
    expect(first.latitude).toBeLessThan(48.7046);
    expect(first.longitude).toBeGreaterThan(6.1719);
    expect(first.longitude).toBeLessThan(6.1969);
    expect(developmentCoordinates('Unknown', 'dev-map-001')).toEqual({
      latitude: null,
      longitude: null,
    });
  });

  it('accepts an explicit seed clock for reproducible relative dates', () => {
    const previous = process.env.DEVELOPMENT_SEED_NOW;
    process.env.DEVELOPMENT_SEED_NOW = '2026-09-22T12:00:00.000Z';

    try {
      expect(developmentSeedNow()).toEqual(new Date('2026-09-22T12:00:00.000Z'));
    } finally {
      if (previous === undefined) delete process.env.DEVELOPMENT_SEED_NOW;
      else process.env.DEVELOPMENT_SEED_NOW = previous;
    }
  });

  it('rejects an invalid explicit seed clock', () => {
    const previous = process.env.DEVELOPMENT_SEED_NOW;
    process.env.DEVELOPMENT_SEED_NOW = 'not-a-date';

    try {
      expect(() => developmentSeedNow()).toThrow('valid ISO timestamp');
    } finally {
      if (previous === undefined) delete process.env.DEVELOPMENT_SEED_NOW;
      else process.env.DEVELOPMENT_SEED_NOW = previous;
    }
  });
});
