# Local object storage with MinIO

TrackRoster uses the AWS S3-compatible client for both Cloudflare R2 and local MinIO. The provider is selected entirely through environment variables.

The main Compose file exposes MinIO on `http://127.0.0.1:9000` and the console on `http://127.0.0.1:9001`. Create a bucket named `trackroster-dev` in the console with the development credentials from `docker-compose.yml`.

Use these local API/worker settings:

```env
R2_ENDPOINT=http://127.0.0.1:9000
R2_BUCKET=trackroster-dev
R2_ACCESS_KEY_ID=minio
R2_SECRET_ACCESS_KEY=minio-development-only
R2_FORCE_PATH_STYLE=true
```

`R2_FORCE_PATH_STYLE=true` is required for local MinIO. Production Cloudflare R2 should use its normal endpoint and set this value to `false`.

After the bucket exists, the existing upload presign, attachment download, scheduled-report, and compliance artifact paths use the same storage abstraction. No business code changes are needed when switching to R2.
