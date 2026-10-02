/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

const mapState = vi.hoisted(() => ({ instances: [] as Array<{ options: { style: unknown } }> }));

vi.mock('maplibre-gl', () => {
  class MockMap {
    options: { style: unknown };

    constructor(options: { style: unknown }) {
      this.options = options;
      mapState.instances.push(this);
    }

    addControl() {
      return this;
    }

    isStyleLoaded() {
      return true;
    }

    on() {
      return this;
    }

    off() {
      return this;
    }

    once() {
      return this;
    }

    remove() {}
  }

  return {
    Map: MockMap,
    NavigationControl: class MockNavigationControl {},
    Marker: class MockMarker {
      setLngLat() {
        return this;
      }

      setPopup() {
        return this;
      }

      addTo() {
        return this;
      }

      remove() {}
    },
    Popup: class MockPopup {
      setText() {
        return this;
      }
    },
    LngLatBounds: class MockLngLatBounds {
      extend() {
        return this;
      }
    },
  };
});

import { ProspectMap, toMapPoint } from './prospect-map';
import { MAP_STYLE_URL } from '@/lib/ui/map-config';

afterEach(() => {
  cleanup();
  mapState.instances.length = 0;
});

describe('ProspectMap', () => {
  it('renders without NEXT_PUBLIC_PMTILES_URL', () => {
    render(<ProspectMap points={[]} />);

    expect(screen.getByRole('application', { name: 'Prospect map' })).toBeInTheDocument();
  });

  it('passes the OpenFreeMap style URL directly to MapLibre', async () => {
    render(<ProspectMap points={[]} />);

    await waitFor(() => expect(mapState.instances[0]?.options.style).toBe(MAP_STYLE_URL));
  });
});

describe('toMapPoint', () => {
  const stage = 'qualified' as const;

  it('accepts a real coordinate pair', () => {
    expect(toMapPoint('1', 'Verdun police', 49.1596, 5.3828, stage)).toEqual([
      {
        id: '1',
        name: 'Verdun police',
        latitude: 49.1596,
        longitude: 5.3828,
        stage,
        href: undefined,
      },
    ]);
  });

  it('drops an establishment that has not been geocoded', () => {
    expect(toMapPoint('1', 'No coords', null, null, stage)).toEqual([]);
  });

  it('drops missing fields, which an older API build omits entirely', () => {
    /*
     * This is the real defect: a `=== null` guard let `undefined` through and
     * MapLibre threw "Invalid LngLat object: (NaN, NaN)".
     */
    expect(toMapPoint('1', 'Absent fields', undefined, undefined, stage)).toEqual([]);
  });

  it('drops values that cannot be read as numbers', () => {
    expect(toMapPoint('1', 'Junk', 'abc', 'def', stage)).toEqual([]);
    expect(toMapPoint('1', 'NaN', Number.NaN, Number.NaN, stage)).toEqual([]);
  });

  it('drops coordinates outside the valid range', () => {
    expect(toMapPoint('1', 'Off globe', 120, 5, stage)).toEqual([]);
    expect(toMapPoint('1', 'Off globe', 49, 200, stage)).toEqual([]);
  });

  it('coerces numeric strings, which a driver may return for doubles', () => {
    expect(toMapPoint('1', 'String coords', '49.1596', '5.3828', stage)).toEqual([
      {
        id: '1',
        name: 'String coords',
        latitude: 49.1596,
        longitude: 5.3828,
        stage,
        href: undefined,
      },
    ]);
  });
});
