/* global console */

import { access, readFile } from 'node:fs/promises';

const reportNames = Array.from(
  { length: 15 },
  (_, index) =>
    `docs/audit/${String(index).padStart(2, '0')}-${
      [
        'executive-summary',
        'repository-inventory',
        'frontend-audit',
        'backend-audit',
        'security-audit',
        'database-audit',
        'workers-redis-audit',
        'integrations-audit',
        'infrastructure-audit',
        'qa-test-audit',
        'performance-audit',
        'observability-audit',
        'feature-coverage',
        'api-readiness',
        'remediation-backlog',
      ][index]
    }.md`,
);

for (const report of reportNames) await access(report);
const backlog = await readFile('docs/audit/14-remediation-backlog.md', 'utf8');
for (let index = 1; index <= 12; index += 1) {
  const ticket = `TR-FIX-${String(index).padStart(3, '0')}`;
  if (!backlog.includes(ticket)) throw new Error(`Missing remediation ticket ${ticket}`);
}

console.log(
  'Release evidence passed: audit reports 00-14 and remediation tickets TR-FIX-001..012 exist.',
);
