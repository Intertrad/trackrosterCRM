# Repository inventory

- Monorepo apps: `apps/api`, `apps/web`, `apps/worker`; shared `types`, `validation`, `jobs`, `ui`, `config`.
- API: NestJS/Fastify/Drizzle/pg; 64 controllers, 68 module files, 167 API tests.
- Web: Next.js 16.3.4/React 19; 90 pages, 168 BFF routes, 263 web tests.
- Worker: NestJS/BullMQ/ioredis; 21 worker tests.
- Database: 94 SQL migrations, journal, snapshots.
- CI provisions PostgreSQL/Redis and runs migrations, lint, formatting, typecheck, tests, integration, and build.
- No Vercel/Render/Terraform deployment manifest was found; hosted configuration needs external evidence.
  **Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
