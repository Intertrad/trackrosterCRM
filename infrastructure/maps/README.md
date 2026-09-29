# PMTiles basemap hosting

This directory is the local development mount for the TrackRoster basemap. The
archive is intentionally ignored by Git because regional Protomaps archives are
large binary assets and must not be committed with application code.

## Local development

1. Create or obtain a regional `.pmtiles` archive. Keep it outside Git, then
   copy it into this directory, for example:

   ```text
   infrastructure/maps/france.pmtiles
   ```

2. Start the range-capable static server:

   ```bash
   pnpm maps:serve
   ```

3. Set the web application's public URL in `apps/web/.env.local`:

   ```env
   NEXT_PUBLIC_PMTILES_URL=http://127.0.0.1:8787/france.pmtiles
   ```

4. Verify the browser contract before opening the map:

   ```bash
   NEXT_PUBLIC_PMTILES_URL=http://127.0.0.1:8787/france.pmtiles pnpm maps:check
   ```

The server must return `206 Partial Content`, `Accept-Ranges: bytes`, a
`Content-Range` header, and a binary PMTiles content type. The `http-server`
configuration used by `maps:serve` enables CORS and disables caching of stale
development metadata.

## Production

Upload the archive to a dedicated public-read map path in Cloudflare R2 and
serve it through an R2 custom domain or CDN. Do not proxy tile requests through
the TrackRoster API and do not put private tenant artifacts in this bucket path.

Set:

```env
NEXT_PUBLIC_PMTILES_URL=https://maps.example.com/trackroster/france.pmtiles
```

The public endpoint must support:

- `GET` with byte `Range` requests and `206 Partial Content` responses;
- `Accept-Ranges: bytes` and `Content-Range`;
- CORS for the deployed TrackRoster web origin;
- `Content-Type: application/octet-stream` (or another PMTiles-compatible
  binary type);
- immutable caching, for example `Cache-Control: public, max-age=31536000,
immutable`, when archive names are content/version-addressed.

Run `pnpm maps:check` against the production URL as a deployment smoke check.
The check does not download the complete archive.

## Archive updates

Publish a new versioned object, verify it with `maps:check`, then update the
web deployment variable. Keep the previous archive available until all active
web builds have rolled over.
