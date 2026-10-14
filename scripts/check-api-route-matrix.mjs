/* global console, process */

import { readFile, writeFile } from 'node:fs/promises';

const inventoryPath = 'docs/backend/CONTROLLER_ROUTE_INVENTORY.json';
const rulesPath = 'docs/backend/ROUTE_RUNTIME_DISPOSITION_RULES.json';
const matrixPath = 'docs/backend/ROUTE_RUNTIME_MATRIX.json';
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
const catalog = JSON.parse(await readFile(rulesPath, 'utf8'));
const rules = catalog.rules.map((rule) => ({ ...rule, matcher: new RegExp(rule.path) }));

if (!Array.isArray(inventory.routes) || !Array.isArray(catalog.rules))
  throw new Error('Route inventory or disposition rules are malformed');

const routes = inventory.routes.map((route) => {
  const identity = `${route.method.toUpperCase()} ${route.path}`;
  const verified = String(route.ledgerStatus ?? '').startsWith('Verified');
  const matches = rules.filter((rule) => rule.matcher.test(route.path));
  if (!verified && matches.length !== 1)
    throw new Error(`${identity} must match exactly one disposition rule`);
  const rule = matches[0];
  return {
    method: route.method.toUpperCase(),
    path: route.path,
    accessClass: verified ? 'route-specific-fixture' : rule.disposition,
    tenantFixture: verified ? 'source-evidence-only' : rule.blockingDependency,
    owner: verified ? 'api' : rule.owner,
    runtimeStatus: verified ? 'static-evidence' : 'runtime-pending',
  };
});

const expected = {
  schemaVersion: 1,
  sourceSnapshot: inventory.snapshot,
  redaction: 'No credentials, tenant identifiers, tokens, or provider payloads',
  routes,
};

if (process.argv.includes('--write')) {
  await writeFile(matrixPath, `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${matrixPath}`);
} else {
  const actual = JSON.parse(await readFile(matrixPath, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${matrixPath} is stale; run node scripts/check-api-route-matrix.mjs --write`);
}

const pending = routes.filter((route) => route.runtimeStatus === 'runtime-pending').length;
console.log(`API route matrix passed: ${routes.length} routes; ${pending} runtime-pending.`);
