#!/usr/bin/env node
/* global process, setTimeout, URL, fetch, console */

/*
 * Backfill coordinates for establishments that do not have them.
 *
 * The French BAN service is free, but it is a public service: this script is
 * deliberately conservative and slow by default. It never replaces existing
 * coordinates, supports a dry run, and writes only a successful BAN result.
 * Use DATABASE_SEED_URL (the migration/owner connection) for the controlled
 * backfill, not the restricted application role.
 */
import pg from '../apps/api/node_modules/pg/lib/index.js';

const { Pool } = pg;

const args = new Set(process.argv.slice(2));
const valueFor = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const limit = Math.min(Math.max(Number(valueFor('limit', '100')), 1), 1000);
const delayMs = Math.min(Math.max(Number(valueFor('delay-ms', '1100')), 1000), 60000);
const tenantId = valueFor('tenant', null);
const apply = args.has('--apply');
const databaseUrl = process.env.DATABASE_SEED_URL ?? process.env.DATABASE_MIGRATION_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_SEED_URL or DATABASE_MIGRATION_URL is required');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addressFor(row) {
  const locality = [row.address_line1, row.postal_code, row.city].filter(Boolean);
  return locality.length ? [...locality, row.country_code].filter(Boolean).join(', ') : null;
}

function precisionFor(properties) {
  if (properties.type === 'housenumber' && Number(properties.score ?? 0) >= 0.7) return 'exact';
  if (properties.type === 'street') return 'street';
  return 'postcode_or_city';
}

async function geocode(address) {
  const url = new URL('https://api-adresse.data.gouv.fr/search/');
  url.searchParams.set('q', address);
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', '0');

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'TrackRoster/1.0 coordinate-backfill (admin-controlled)',
    },
  });
  if (!response.ok) throw new Error(`BAN HTTP ${response.status}`);
  const body = await response.json();
  const feature = body.features?.[0];
  if (!feature?.geometry?.coordinates || !feature.properties) return null;

  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    precision: precisionFor(feature.properties),
    label: feature.properties.label ?? null,
    score: Number(feature.properties.score ?? 0),
  };
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
try {
  const rows = (
    await pool.query(
      `select id, tenant_id, name, address_line1, postal_code, city, country_code
       from establishments
       where (latitude is null or longitude is null)
         and ($1::uuid is null or tenant_id = $1::uuid)
       order by tenant_id, id
       limit $2`,
      [tenantId, limit],
    )
  ).rows;

  console.log(`${apply ? 'Applying' : 'Previewing'} BAN geocoding for ${rows.length} records`);
  if (!rows.length) process.exitCode = 0;

  let matched = 0;
  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    const address = addressFor(row);
    if (!address) {
      failed += 1;
      console.log(`SKIP ${row.id} no address fields`);
      continue;
    }

    try {
      const geocodeResult = await geocode(address);
      if (!geocodeResult) {
        failed += 1;
        console.log(`MISS ${row.id} ${address}`);
      } else {
        matched += 1;
        console.log(
          `${apply ? 'MATCH' : 'DRY-RUN'} ${row.id} ${geocodeResult.precision} ${geocodeResult.latitude},${geocodeResult.longitude} ${geocodeResult.label ?? address}`,
        );
        if (apply) {
          const client = await pool.connect();
          try {
            await client.query('begin');
            await client.query(`select set_config('trackroster.tenant_id', $1, true)`, [
              row.tenant_id,
            ]);
            const updateResult = await client.query(
              `update establishments
               set latitude = $1, longitude = $2, updated_at = clock_timestamp()
               where tenant_id = $3 and id = $4 and (latitude is null or longitude is null)`,
              [geocodeResult.latitude, geocodeResult.longitude, row.tenant_id, row.id],
            );
            await client.query('commit');
            updated += updateResult.rowCount ?? 0;
          } catch (error) {
            await client.query('rollback');
            throw error;
          } finally {
            client.release();
          }
        }
      }
    } catch (error) {
      failed += 1;
      console.error(`ERROR ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(delayMs);
  }
  console.log(JSON.stringify({ inspected: rows.length, matched, updated, failed, apply }));
} finally {
  await pool.end();
}
