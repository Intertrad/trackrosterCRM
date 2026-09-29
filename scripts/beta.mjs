/*
 * Runner for the TrackRoster Beta environment.
 *
 * Same shape as scripts/backend-test.mjs and for the same reason: the beta
 * connection strings are injected into the child process rather than left to
 * whatever `.env` happens to contain. Both drizzle.config.ts and
 * vitest.integration.config.ts call dotenv on `../../.env`, and dotenv does not
 * overwrite a variable that is already set, so an injected value wins.
 *
 * Relying on the developer having edited `.env` is the failure this prevents:
 * `pnpm --filter api db:migrate` reads `.env` and would migrate the development
 * database while appearing to do beta work.
 *
 *   node scripts/beta.mjs migrate            -- apply migrations to beta
 *   node scripts/beta.mjs seed               -- bootstrap the beta tenant
 *   node scripts/beta.mjs api                -- run the beta API on 3101
 *   node scripts/beta.mjs web                -- run the beta web app on 3100
 *   node scripts/beta.mjs psql [args...]     -- psql as the owner
 *   node scripts/beta.mjs run <cmd> [args]   -- anything else, with beta env
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = `${root}.env.beta`;

if (!existsSync(envPath)) {
  throw new Error('.env.beta is missing. It is gitignored by design; regenerate it locally.');
}

/*
 * A deliberately small parser rather than dotenv: this file is the safety
 * boundary, so it should not depend on a workspace that may not be installed.
 * Values are taken verbatim after the first '=' — no interpolation, because a
 * base64 secret can contain almost anything.
 */
const beta = {};

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) continue;

  const at = trimmed.indexOf('=');

  if (at > 0) beta[trimmed.slice(0, at)] = trimmed.slice(at + 1);
}

/*
 * The guard that makes this runner worth having.
 *
 * Every destructive step of the data load is aimed through here, so if the file
 * is ever edited to point somewhere else the runner stops instead of loading
 * fourteen thousand establishments into the wrong database. Port and database
 * name are both checked: the beta database is named differently precisely so a
 * mistake fails rather than succeeds quietly.
 */
for (const key of ['DATABASE_URL', 'DATABASE_MIGRATION_URL', 'DATABASE_SEED_URL']) {
  const value = beta[key];

  if (!value) throw new Error(`.env.beta is missing ${key}`);

  if (!value.includes('127.0.0.1:5434') || !value.endsWith('/trackroster_beta')) {
    throw new Error(
      `${key} in .env.beta does not address the beta database ` +
        '(expected 127.0.0.1:5434/trackroster_beta). Refusing to run.',
    );
  }
}

const env = { ...process.env, ...beta };

const mode = process.argv[2];
const rest = process.argv.slice(3);

function run(command, args, cwd = root, overrides = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...env, ...overrides }, stdio: 'inherit' });

  if (result.error) throw result.error;

  return result.status ?? 1;
}

function bin(app, executable) {
  return `${root}apps/${app}/node_modules/.bin/${executable}`;
}

if (mode === 'migrate') {
  process.exitCode = run(
    bin('api', 'drizzle-kit'),
    ['migrate', '--config=drizzle.config.ts'],
    `${root}apps/api`,
  );
} else if (mode === 'seed') {
  /* db:seed:beta, never db:seed: the development seed bootstraps the
   * `intertrad` sandbox tenant, and running it here would plant that sandbox
   * inside the beta environment. */
  process.exitCode = run('pnpm', ['--filter', 'api', 'db:seed:beta']);
} else if (mode === 'api') {
  process.exitCode = run('pnpm', ['--filter', 'api', 'dev']);
} else if (mode === 'web') {
  /*
   * PORT rather than a --port flag: pnpm's `--` passthrough hands `--port` to
   * `next dev` as a positional, which reads it as a project directory and dies.
   * .env.beta's PORT belongs to the API, so the web port is overridden here
   * instead — otherwise the two beta processes fight over 3101.
   */
  process.exitCode = run('pnpm', ['--filter', 'web', 'dev'], root, {
    PORT: '3100',
    NEXT_DIST_DIR: '.next-beta',
  });
} else if (mode === 'psql') {
  process.exitCode = run('psql', [beta.DATABASE_MIGRATION_URL, ...rest]);
} else if (mode === 'run') {
  if (rest.length === 0) throw new Error('run needs a command');

  process.exitCode = run(rest[0], rest.slice(1));
} else {
  throw new Error('Use migrate, seed, api, web, psql, or run');
}
