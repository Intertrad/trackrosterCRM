import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

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

await new Promise((resolve, reject) => {
  const child = spawn(
    process.env.PG_DUMP_BIN ?? 'pg_dump',
    ['--format=custom', '--no-owner', '--no-privileges', '--file', output, '--dbname', databaseUrl],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`pg_dump exited with ${code}`)),
  );
});

const bytes = await readFile(output);
const metadata = {
  createdAt: new Date().toISOString(),
  file: output,
  bytes: bytes.byteLength,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  runtimeRole: 'trackroster_app',
  runtimeRoleSql: 'infrastructure/docker/postgres/init/01-runtime-role.sql',
};
await writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(metadata)}\n`);
