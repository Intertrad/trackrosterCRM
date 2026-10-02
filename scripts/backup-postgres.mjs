import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { resolvePostgresClient, runPostgresClient } from './postgres-client.mjs';

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_MIGRATION_URL (or DATABASE_URL) before creating a backup');
}
if (databaseUrl.includes('trackroster_app@')) {
  throw new Error('Backups must use the migration/owner connection, not trackroster_app');
}

const backupDir = process.env.BACKUP_DIR ?? 'backups';
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const output = join(backupDir, `trackroster-${stamp}.dump`);
await mkdir(dirname(output), { recursive: true });

const client = await resolvePostgresClient('pg_dump', [output]);
await runPostgresClient(client, [
  '--format=custom',
  '--no-owner',
  '--no-privileges',
  '--file',
  output,
  '--dbname',
  databaseUrl,
]);

const bytes = await readFile(output);
const metadata = {
  createdAt: new Date().toISOString(),
  file: output,
  bytes: bytes.byteLength,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  runtimeRole: 'trackroster_app',
  runtimeRoleSql: 'infrastructure/docker/postgres/init/01-runtime-role.sql',
  postgresClient: client.description,
};
await writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(metadata)}\n`);
