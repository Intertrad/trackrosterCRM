#!/usr/bin/env node
/* global console, fetch, process */

/*
 * Smoke-check the public PMTiles endpoint. PMTiles is a range-read format:
 * accepting a normal 200 response is not enough because the browser protocol
 * would otherwise download the complete archive for every map session.
 */
const url = process.env.NEXT_PUBLIC_PMTILES_URL || process.argv[2];

if (!url) {
  console.error('NEXT_PUBLIC_PMTILES_URL is not configured');
  process.exit(2);
}

let response;
try {
  response = await fetch(url, { headers: { Range: 'bytes=0-31' } });
} catch (error) {
  console.error(
    `PMTiles endpoint is unreachable: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const acceptRanges = response.headers.get('accept-ranges')?.toLowerCase();
const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
const contentRange = response.headers.get('content-range');
const valid =
  response.status === 206 &&
  acceptRanges === 'bytes' &&
  Boolean(contentRange) &&
  (contentType.includes('application/octet-stream') ||
    contentType.includes('application/x-protobuf'));

if (!valid) {
  console.error(
    JSON.stringify(
      {
        url,
        status: response.status,
        acceptRanges,
        contentRange,
        contentType,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(`PMTiles range check passed: ${url}`);
