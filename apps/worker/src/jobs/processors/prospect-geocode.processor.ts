import { Inject, Injectable } from '@nestjs/common';
import type { ProspectGeocodeJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';
import type { JobProcessorResult } from '../job-processing.types.js';
import type { Pool } from 'pg';

let lastBanRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ProspectGeocodeProcessor {
  constructor(@Inject(WORKER_DATABASE_POOL) private readonly db: Pool) {}

  async process(data: ProspectGeocodeJobData): Promise<JobProcessorResult> {
    const source = await workerTenantQuery<{
      address_line1: string | null;
      postal_code: string | null;
      city: string | null;
      country_code: string;
      latitude: number | null;
      longitude: number | null;
    }>(
      this.db,
      data.tenantId,
      `SELECT address_line1,postal_code,city,country_code,latitude,longitude
       FROM establishments WHERE tenant_id=$1 AND id=$2`,
      [data.tenantId, data.prospectId],
    );
    const row = source.rows[0];
    if (!row || (row.latitude !== null && row.longitude !== null))
      return { status: 'noop', reason: 'coordinates already present or prospect missing' };

    const address = [row.address_line1, row.postal_code, row.city, row.country_code]
      .filter(Boolean)
      .join(', ');
    if (!address) return { status: 'noop', reason: 'no geocodable address' };

    const wait = 1100 - (Date.now() - lastBanRequestAt);
    if (wait > 0) await sleep(wait);
    lastBanRequestAt = Date.now();

    const url = new URL('https://api-adresse.data.gouv.fr/search/');
    url.searchParams.set('q', address);
    url.searchParams.set('limit', '1');
    url.searchParams.set('autocomplete', '0');
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'TrackRoster/1.0 coordinate-enrichment (admin-controlled)',
      },
    });
    if (!response.ok) throw new Error(`BAN geocoding failed with HTTP ${response.status}`);
    const body = (await response.json()) as {
      features?: Array<{ geometry?: { coordinates?: unknown }; properties?: unknown }>;
    };
    const coordinates = body.features?.[0]?.geometry?.coordinates;
    const longitude = Array.isArray(coordinates) ? Number(coordinates[0]) : NaN;
    const latitude = Array.isArray(coordinates) ? Number(coordinates[1]) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return { status: 'noop', reason: 'BAN returned no usable match' };

    const updated = await workerTenantQuery(
      this.db,
      data.tenantId,
      `UPDATE establishments SET latitude=$1,longitude=$2,updated_at=clock_timestamp()
       WHERE tenant_id=$3 AND id=$4 AND (latitude IS NULL OR longitude IS NULL)`,
      [latitude, longitude, data.tenantId, data.prospectId],
    );
    return updated.rowCount
      ? { status: 'processed' }
      : { status: 'noop', reason: 'coordinates changed concurrently' };
  }
}
