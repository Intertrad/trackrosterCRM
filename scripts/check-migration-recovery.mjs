import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const migrationsDirectory = join(root, 'database', 'migrations');
const recoveryGuide = join(root, 'docs', 'operations', 'MIGRATION_RECOVERY.md');
const migrationPattern = /^\d{4}_.+\.sql$/;

execFileSync(process.execPath, ['scripts/check-migration-integrity.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const guide = await readFile(recoveryGuide, 'utf8');
for (const required of [
  'forward-only Drizzle migrations',
  'trackroster_app',
  'last known-good custom-format backup',
  'RLS access',
  'forward repair migration',
]) {
  if (!guide.includes(required)) {
    throw new Error(`Migration recovery guide is missing required control: ${required}`);
  }
}

const migrationFiles = (await readdir(migrationsDirectory)).filter((name) =>
  migrationPattern.test(name),
);
for (const migrationFile of migrationFiles) {
  const sql = await readFile(join(migrationsDirectory, migrationFile), 'utf8');
  if (sql.trim().length === 0) throw new Error(`Migration is empty: ${migrationFile}`);
}

process.stdout.write(
  `Migration recovery check passed: ${migrationFiles.length} non-empty migrations and documented forward-fix restore procedure.\n`,
);
