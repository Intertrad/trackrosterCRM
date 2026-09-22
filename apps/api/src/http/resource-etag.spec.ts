import { describe, expect, it } from 'vitest';
import { assertResourceMatches, resourceETag } from './resource-etag.js';

describe('Resource ETags', () => {
  it('survives JSONB field reordering and Date serialization', () => {
    const timestamp = new Date('2026-09-22T10:00:00.000Z');
    expect(resourceETag({ z: timestamp, a: { y: 1, x: 2 } })).toBe(
      resourceETag({ a: { x: 2, y: 1 }, z: timestamp.toISOString() }),
    );
  });
  it('preserves meaningful array order and rejects stale or weak tags', () => {
    const resource = { stops: ['a', 'b'] };
    expect(resourceETag(resource)).not.toBe(resourceETag({ stops: ['b', 'a'] }));
    expect(() => assertResourceMatches(resourceETag(resource), resource)).not.toThrow();
    expect(() => assertResourceMatches(`W/${resourceETag(resource)}`, resource)).toThrow();
    expect(() => assertResourceMatches('"stale"', resource)).toThrow();
  });
});
