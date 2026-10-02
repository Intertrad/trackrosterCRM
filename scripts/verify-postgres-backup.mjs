import process from 'node:process';
import { capturePostgresClient, resolvePostgresClient } from './postgres-client.mjs';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/verify-postgres-backup.mjs <backup.dump>');

const client = await resolvePostgresClient('pg_restore', [backup]);
const output = await capturePostgresClient(client, ['--list', backup]);
const entries = output.split('\n').filter((line) => line && !line.startsWith(';'));
process.stdout.write(
  `${JSON.stringify({ backup, entries: entries.length, readable: true, postgresClient: client.description })}\n`,
);
