import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(repositoryRoot, 'database', 'migrations');
const metadataDirectory = join(migrationsDirectory, 'meta');
const journalPath = join(metadataDirectory, '_journal.json');
const migrationPattern = /^\d{4}_.+\.sql$/;
const snapshotPattern = /^\d{4}_snapshot\.json$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function difference(left, right) {
  const rightSet = new Set(right);

  return left.filter((value) => !rightSet.has(value));
}

function assertUnique(values, label, errors) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);

  if (duplicates.length > 0) {
    errors.push(`${label} contains duplicates: ${sorted(new Set(duplicates)).join(', ')}`);
  }
}

async function main() {
  const errors = [];
  const journal = await readJson(journalPath);
  const migrationFiles = sorted(
    (await readdir(migrationsDirectory)).filter((name) => migrationPattern.test(name)),
  );
  const snapshotFiles = sorted(
    (await readdir(metadataDirectory)).filter((name) => snapshotPattern.test(name)),
  );

  if (!Array.isArray(journal.entries)) {
    throw new Error('Migration journal does not contain an entries array.');
  }

  const entries = journal.entries;
  const journalFiles = entries.map((entry) => `${entry.tag}.sql`);
  const expectedSnapshotFiles = entries.map(
    (entry) => `${String(entry.idx).padStart(4, '0')}_snapshot.json`,
  );

  assertUnique(
    entries.map((entry) => entry.idx),
    'Migration indexes',
    errors,
  );
  assertUnique(
    entries.map((entry) => entry.tag),
    'Migration tags',
    errors,
  );

  entries.forEach((entry, position) => {
    if (entry.idx !== position) {
      errors.push(
        `Journal position ${position} has idx=${String(entry.idx)}; indexes must be contiguous.`,
      );
    }

    if (!new RegExp(`^${String(entry.idx).padStart(4, '0')}_`).test(entry.tag)) {
      errors.push(`Journal idx=${String(entry.idx)} does not match tag ${entry.tag}.`);
    }
  });

  const missingFromJournal = difference(migrationFiles, journalFiles);
  const missingSqlFiles = difference(journalFiles, migrationFiles);

  if (missingFromJournal.length > 0) {
    errors.push(`SQL migrations missing from journal: ${missingFromJournal.join(', ')}`);
  }

  if (missingSqlFiles.length > 0) {
    errors.push(`Journal entries missing SQL files: ${missingSqlFiles.join(', ')}`);
  }

  const snapshotsMissingFromJournal = difference(snapshotFiles, expectedSnapshotFiles);
  const missingSnapshotFiles = difference(expectedSnapshotFiles, snapshotFiles);

  if (snapshotsMissingFromJournal.length > 0) {
    errors.push(`Snapshots missing from journal: ${snapshotsMissingFromJournal.join(', ')}`);
  }

  if (missingSnapshotFiles.length > 0) {
    errors.push(`Journal entries missing snapshots: ${missingSnapshotFiles.join(', ')}`);
  }

  let previousSnapshotId = '00000000-0000-0000-0000-000000000000';
  const snapshotIds = [];

  for (const entry of entries) {
    const snapshotName = `${String(entry.idx).padStart(4, '0')}_snapshot.json`;
    let snapshot;

    try {
      snapshot = await readJson(join(metadataDirectory, snapshotName));
    } catch (error) {
      errors.push(
        `Missing or invalid snapshot ${snapshotName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (snapshot.prevId !== previousSnapshotId) {
      errors.push(
        `${snapshotName} prevId=${String(snapshot.prevId)} does not match the previous snapshot id ${previousSnapshotId}.`,
      );
    }

    if (snapshot.version !== journal.version) {
      errors.push(
        `${snapshotName} version=${String(snapshot.version)} does not match journal version ${String(journal.version)}.`,
      );
    }

    if (snapshot.dialect !== journal.dialect) {
      errors.push(
        `${snapshotName} dialect=${String(snapshot.dialect)} does not match journal dialect ${String(journal.dialect)}.`,
      );
    }

    if (typeof snapshot.id !== 'string' || snapshot.id.length === 0) {
      errors.push(`${snapshotName} does not contain a valid snapshot id.`);
      continue;
    }

    snapshotIds.push(snapshot.id);
    previousSnapshotId = snapshot.id;
  }

  assertUnique(snapshotIds, 'Snapshot IDs', errors);

  if (errors.length > 0) {
    process.stderr.write('Migration integrity check failed:\n\n');

    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }

    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Migration integrity check passed: ${String(entries.length)} journal entries, SQL files, and snapshots form one contiguous chain.\n`,
  );
}

await main();
