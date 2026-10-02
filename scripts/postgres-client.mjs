import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const MINIMUM_MAJOR = Number.parseInt(process.env.PG_MINIMUM_CLIENT_MAJOR ?? '16', 10);

if (!Number.isInteger(MINIMUM_MAJOR) || MINIMUM_MAJOR < 12) {
  throw new Error('PG_MINIMUM_CLIENT_MAJOR must be a PostgreSQL major version (12 or newer)');
}

const candidates = (binary) => {
  const override = binary === 'pg_dump' ? process.env.PG_DUMP_BIN : process.env.PG_RESTORE_BIN;
  const binDir = process.env.PG_CLIENT_BIN_DIR;
  return [
    override,
    binDir && join(binDir, binary),
    `${binary}-${MINIMUM_MAJOR}`,
    `${binary}${MINIMUM_MAJOR}`,
    `/opt/homebrew/opt/postgresql@${MINIMUM_MAJOR}/bin/${binary}`,
    `/usr/local/opt/postgresql@${MINIMUM_MAJOR}/bin/${binary}`,
    binary,
  ].filter(Boolean);
};

const canAccess = async (candidate) => {
  if (!candidate.startsWith('/')) return true;
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

const runVersion = (command, args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolvePromise(`${stdout}${stderr}`)
        : reject(new Error(`${command} --version exited with ${code}`)),
    );
  });

const majorFromVersion = (version) => {
  const match = version.match(/PostgreSQL\)\s+(\d+)(?:\.\d+)?/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

const containerSpec = (binary, paths) => {
  const image = process.env.PG_CLIENT_IMAGE;
  if (!image) return undefined;
  const workingDirectory = resolve(process.cwd());
  const mountRoots = [
    workingDirectory,
    ...paths.map((path) => {
      return dirname(resolve(path));
    }),
  ].filter((path, index, all) => all.indexOf(path) === index);
  return {
    command: process.env.DOCKER_BIN ?? 'docker',
    args: [
      'run',
      '--rm',
      '--network',
      process.env.PG_CLIENT_DOCKER_NETWORK ?? 'host',
      ...mountRoots.flatMap((root) => ['--volume', `${root}:${root}`]),
      '--workdir',
      workingDirectory,
      image,
      binary,
    ],
    description: `${image}/${binary}`,
  };
};

export async function resolvePostgresClient(binary, paths = []) {
  const container = containerSpec(binary, paths);
  if (container) {
    const version = await runVersion(container.command, [...container.args, '--version']);
    const major = majorFromVersion(version);
    if (!major || major < MINIMUM_MAJOR) {
      throw new Error(
        `${container.description} is PostgreSQL ${major ?? 'unknown'}; ` +
          `PostgreSQL ${MINIMUM_MAJOR}+ is required`,
      );
    }
    return container;
  }

  const rejected = [];
  for (const candidate of candidates(binary)) {
    if (!(await canAccess(candidate))) continue;
    try {
      const version = await runVersion(candidate, ['--version']);
      const major = majorFromVersion(version);
      if (major && major >= MINIMUM_MAJOR) {
        return { command: candidate, args: [], description: `${candidate} (PostgreSQL ${major})` };
      }
      rejected.push(`${candidate}: PostgreSQL ${major ?? 'unknown'}`);
    } catch (error) {
      rejected.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    `No PostgreSQL ${MINIMUM_MAJOR}+ ${binary} client is available. ` +
      `Set PG_CLIENT_BIN_DIR or PG_${binary === 'pg_dump' ? 'DUMP' : 'RESTORE'}_BIN, ` +
      `or set PG_CLIENT_IMAGE=postgres:${MINIMUM_MAJOR}-alpine. ` +
      `Rejected clients: ${rejected.join('; ')}`,
  );
}

export function runPostgresClient(client, args, stdio = ['ignore', 'inherit', 'inherit']) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(client.command, [...client.args, ...args], { stdio });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      reject(
        new Error(`${client.description} exited with ${code ?? `signal ${signal ?? 'unknown'}`}`),
      );
    });
  });
}

export function capturePostgresClient(client, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(client.command, [...client.args, ...args], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise(stdout);
      reject(
        new Error(`${client.description} exited with ${code ?? `signal ${signal ?? 'unknown'}`}`),
      );
    });
  });
}
