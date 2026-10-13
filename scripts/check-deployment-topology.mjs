/* global AbortSignal, URL, console, fetch, process */

import dns from 'node:dns/promises';
import tls from 'node:tls';

const webUrl = requiredUrl(process.env.TOPOLOGY_WEB_URL, 'TOPOLOGY_WEB_URL');
const apiUrl = optionalUrl(process.env.TOPOLOGY_API_URL, 'TOPOLOGY_API_URL');
const timeoutMs = positiveInteger(process.env.TOPOLOGY_TIMEOUT_MS, 5_000, 'TOPOLOGY_TIMEOUT_MS');
const expectedRoutes = parseRoutes(
  process.env.TOPOLOGY_EXPECTED_ROUTES ?? '/login:200,/forgot-password:200,/reset-password:200',
);
const requirePasswordRecovery = process.env.TOPOLOGY_REQUIRE_PASSWORD_RECOVERY !== 'false';

const hosts = [...new Set([webUrl.hostname, apiUrl?.hostname].filter(Boolean))];
const dnsResults = Object.fromEntries(
  await Promise.all(hosts.map(async (hostname) => [hostname, await resolveHost(hostname)])),
);
const tlsResults = Object.fromEntries(
  await Promise.all(
    hosts
      .filter((hostname) => isHttps(webUrl, apiUrl, hostname))
      .map(async (hostname) => [hostname, await inspectTls(hostname)]),
  ),
);
const routeResults = await Promise.all(
  expectedRoutes.map(({ path, expectedStatus }) => checkRoute(webUrl, path, expectedStatus)),
);
const authConfig = apiUrl ? await checkAuthConfig(apiUrl) : null;

const report = {
  generatedAt: new Date().toISOString(),
  web: redactUrl(webUrl),
  api: apiUrl ? redactUrl(apiUrl) : null,
  timeoutMs,
  dns: dnsResults,
  tls: tlsResults,
  routes: routeResults,
  authConfig,
};

console.log(JSON.stringify(report));

const failures = [
  ...Object.entries(dnsResults)
    .filter(([, result]) => !result.ok)
    .map(([hostname, result]) => `${hostname}: DNS ${result.error}`),
  ...Object.entries(tlsResults)
    .filter(([, result]) => !result.ok)
    .map(([hostname, result]) => `${hostname}: TLS ${result.error}`),
  ...routeResults
    .filter((result) => !result.ok)
    .map(
      (result) =>
        `${result.path}: expected ${result.expectedStatus}, got ${result.status ?? result.error}`,
    ),
];

if (requirePasswordRecovery && authConfig && !authConfig.passwordRecovery) {
  failures.push('/api/auth/config: passwordRecovery is false');
}

if (failures.length) {
  console.error(`Deployment topology check failed: ${failures.join('; ')}`);
  process.exitCode = 1;
}

async function resolveHost(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    return {
      ok: addresses.length > 0,
      addresses: addresses.map(({ address, family }) => ({ address, family })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? (error.code ?? error.name) : 'UnknownError',
    };
  }
}

function inspectTls(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const certificate = socket.getPeerCertificate();
        const result = {
          ok: socket.authorized,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError ?? null,
          subject: certificate.subject?.CN ?? null,
          issuer: certificate.issuer?.CN ?? null,
          validFrom: certificate.valid_from ?? null,
          validTo: certificate.valid_to ?? null,
        };
        socket.end();
        resolve(result);
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ ok: false, error: 'TIMEOUT' });
    });
    socket.on('error', (error) => resolve({ ok: false, error: error.code ?? error.name }));
  });
}

async function checkRoute(base, path, expectedStatus) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      path,
      expectedStatus,
      status: response.status,
      ok: response.status === expectedStatus,
    };
  } catch (error) {
    return {
      path,
      expectedStatus,
      status: null,
      ok: false,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

async function checkAuthConfig(base) {
  try {
    const response = await fetch(new URL('/api/auth/config', base), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { status: response.status, passwordRecovery: null, ok: false };
    const body = await response.json();
    return {
      status: response.status,
      passwordRecovery: body?.passwordRecovery === true,
      ok: typeof body?.passwordRecovery === 'boolean',
    };
  } catch (error) {
    return {
      status: null,
      passwordRecovery: null,
      ok: false,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

function parseRoutes(value) {
  const routes = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.lastIndexOf(':');
      const path = separator > 0 ? entry.slice(0, separator) : entry;
      const expectedStatus = separator > 0 ? Number(entry.slice(separator + 1)) : 200;
      if (
        !path.startsWith('/') ||
        !Number.isInteger(expectedStatus) ||
        expectedStatus < 100 ||
        expectedStatus > 599
      ) {
        throw new Error(`Invalid TOPOLOGY_EXPECTED_ROUTES entry: ${entry}`);
      }
      return { path, expectedStatus };
    });
  if (!routes.length) throw new Error('TOPOLOGY_EXPECTED_ROUTES must contain at least one route');
  return routes;
}

function requiredUrl(value, name) {
  const parsed = optionalUrl(value, name);
  if (!parsed) throw new Error(`${name} is required`);
  return parsed;
}

function optionalUrl(value, name) {
  if (!value?.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol))
    throw new Error(`${name} must use HTTP or HTTPS`);
  if (parsed.username || parsed.password)
    throw new Error(`${name} must not include embedded credentials`);
  return new URL(parsed.toString().endsWith('/') ? parsed : `${parsed}/`);
}

function redactUrl(value) {
  return `${value.origin}${value.pathname}`.replace(/\/$/, '');
}

function isHttps(web, api, hostname) {
  return [web, api].some((url) => url?.hostname === hostname && url.protocol === 'https:');
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}
