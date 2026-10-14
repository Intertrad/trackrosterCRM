/* global console */

import { readFile } from 'node:fs/promises';

const inventory = JSON.parse(
  await readFile('docs/backend/CONTROLLER_ROUTE_INVENTORY.json', 'utf8'),
);
const catalog = JSON.parse(
  await readFile('docs/backend/ROUTE_RUNTIME_DISPOSITION_RULES.json', 'utf8'),
);

if (!Array.isArray(inventory.routes) || !Array.isArray(catalog.rules)) {
  throw new Error('Route inventory or disposition rules are malformed');
}

const rules = catalog.rules.map((rule) => ({
  ...rule,
  matcher: new RegExp(rule.path),
}));
const pending = inventory.routes.filter(
  (route) => !String(route.ledgerStatus ?? '').startsWith('Verified'),
);
const matched = new Map();

for (const route of pending) {
  const identity = `${route.method.toUpperCase()} ${route.path}`;
  const matches = rules.filter((rule) => rule.matcher.test(route.path));
  if (matches.length !== 1) {
    throw new Error(
      `${identity} must match exactly one runtime disposition rule; matched ${matches.length}`,
    );
  }
  matched.set(matches[0].id, (matched.get(matches[0].id) ?? 0) + 1);
}

const unused = rules.filter((rule) => !matched.has(rule.id));
if (unused.length > 0) {
  throw new Error(`Unused runtime disposition rules: ${unused.map((rule) => rule.id).join(', ')}`);
}

console.log(
  `API route dispositions passed: ${pending.length} pending routes assigned to ${rules.length} explicit runtime disposition rules.`,
);
for (const rule of rules) {
  console.log(`- ${rule.id}: ${matched.get(rule.id)} route(s); ${rule.disposition}`);
}
