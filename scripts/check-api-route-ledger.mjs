/* global console */

import { readFile } from 'node:fs/promises';

const inventory = JSON.parse(
  await readFile('docs/backend/CONTROLLER_ROUTE_INVENTORY.json', 'utf8'),
);
const routes = inventory.routes;
if (!Array.isArray(routes) || routes.length === 0) {
  throw new Error('API route inventory is empty or malformed');
}

const seen = new Set();
let verified = 0;
for (const route of routes) {
  if (!route.method || !route.path || !route.source || !Number.isInteger(route.line)) {
    throw new Error(`Malformed route entry: ${JSON.stringify(route)}`);
  }
  const identity = `${route.method.toUpperCase()} ${route.path}`;
  if (seen.has(identity)) throw new Error(`Duplicate route: ${identity}`);
  seen.add(identity);
  if (String(route.ledgerStatus ?? '').startsWith('Verified')) verified += 1;
}

console.log(
  `API route ledger passed: ${routes.length} unique routes; ${verified} ledger-verified; ${routes.length - verified} runtime-unverified.`,
);
