import { spawn } from 'node:child_process';
import process from 'node:process';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: node scripts/verify-postgres-backup.mjs <backup.dump>');

await new Promise((resolve, reject) => {
  const child = spawn(process.env.PG_RESTORE_BIN ?? 'pg_restore', ['--list', backup], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.once('error', reject);
  child.once('exit', (code) => {
    if (code !== 0) return reject(new Error(`pg_restore --list exited with ${code}`));
    const entries = output.split('\n').filter((line) => line && !line.startsWith(';'));
    process.stdout.write(
      `${JSON.stringify({ backup, entries: entries.length, readable: true })}\n`,
    );
    resolve();
  });
});
