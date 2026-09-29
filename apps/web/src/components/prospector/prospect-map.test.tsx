/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import { ProspectMap, toMapPoint } from './prospect-map';

afterEach(cleanup);

describe('ProspectMap', () => {
  it('explains the missing basemap instead of rendering an empty canvas', () => {
    /*
     * NEXT_PUBLIC_PMTILES_URL is unset in tests, which is also the state of a
     * fresh checkout. The map must say what is missing rather than show a
     * blank grey box.
     */
    render(<ProspectMap points={[]} />);

    expect(screen.getByText('Basemap is not configured')).toBeInTheDocument();
    expect(screen.getByText('NEXT_PUBLIC_PMTILES_URL')).toBeInTheDocument();
  });

  it('never mounts a map surface while the basemap is unconfigured', () => {
    render(<ProspectMap points={[]} />);

    expect(screen.queryByRole('application', { name: 'Prospect map' })).not.toBeInTheDocument();
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
