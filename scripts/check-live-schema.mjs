import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { Client } = require('../apps/api/node_modules/pg');

const migrationsDirectory = join(process.cwd(), 'database', 'migrations');
const journalPath = join(migrationsDirectory, 'meta', '_journal.json');

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_MIGRATION_URL or DATABASE_URL is required for live schema checks');
}

const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const entries = journal.entries;
if (!Array.isArray(entries) || entries.length === 0) {
  throw new Error('Migration journal does not contain any entries');
}

const expected = [];
for (const entry of entries) {
  const sql = await readFile(join(migrationsDirectory, `${entry.tag}.sql`), 'utf8');
  expected.push({
    tag: entry.tag,
    when: String(entry.when),
    hash: createHash('sha256').update(sql).digest('hex'),
  });
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const result = await client.query(
    'SELECT id, hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id',
  );

  if (result.rows.length !== expected.length) {
    throw new Error(
      `Live schema migration count is ${String(result.rows.length)}; repository expects ${String(expected.length)}`,
    );
  }

  for (const [index, row] of result.rows.entries()) {
    const expectedMigration = expected[index];
    if (
      !expectedMigration ||
      row.hash !== expectedMigration.hash ||
      row.created_at !== expectedMigration.when
    ) {
      throw new Error(
        `Live schema drift at migration ${expectedMigration?.tag ?? `row ${String(index + 1)}`}`,
      );
    }
  }

  process.stdout.write(
    `Live schema check passed: ${String(result.rows.length)} migrations match the repository journal and SQL hashes.\n`,
  );
} finally {
  await client.end();
}
