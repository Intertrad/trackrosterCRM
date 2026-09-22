import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
const require = createRequire(import.meta.url);
const ts = require('../apps/api/node_modules/typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const normalize = (p) => p.replace(/:[^/]+|\{[^}]+\}/g, ':id');
const ledger = new Map();
for (const line of fs
  .readFileSync(path.join(root, 'docs/backend/IMPLEMENTATION_STATUS.md'), 'utf8')
  .split('\n')) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  if (/^(GET|POST|PATCH|PUT|DELETE)$/.test(cells[0] ?? '') && cells.length === 4)
    ledger.set(`${cells[0]} ${normalize(cells[1].replace(/`/g, ''))}`, cells[3]);
}
const files = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const decorators = (n) => (ts.canHaveDecorators(n) ? (ts.getDecorators(n) ?? []) : []);
const routes = [];
for (const file of files(path.join(root, 'apps/api/src')).filter((f) =>
  f.endsWith('.controller.ts'),
)) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function walk(node) {
    if (ts.isClassDeclaration(node)) {
      let prefix;
      for (const d of decorators(node)) {
        const e = d.expression;
        if (ts.isCallExpression(e) && e.expression.getText(sf) === 'Controller')
          prefix = e.arguments[0] && ts.isStringLiteral(e.arguments[0]) ? e.arguments[0].text : '';
      }
      if (prefix !== undefined)
        for (const member of node.members)
          for (const d of decorators(member)) {
            const e = d.expression;
            if (!ts.isCallExpression(e)) continue;
            const verb = e.expression.getText(sf).toUpperCase();
            if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) continue;
            const suffix =
              e.arguments[0] && ts.isStringLiteral(e.arguments[0]) ? e.arguments[0].text : '';
            const relative = '/' + [prefix, suffix].filter(Boolean).join('/');
            routes.push({
              method: verb,
              path: '/api/v1' + relative,
              source: path.relative(root, file),
              line: sf.getLineAndCharacterOfPosition(d.getStart(sf)).line + 1,
              ledgerStatus:
                ledger.get(`${verb} ${normalize(relative)}`) ??
                'Outside matched product ledger; not certified by this inventory',
            });
          }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
}
routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
const unmatched = [...ledger].filter(
  ([key, status]) =>
    status.startsWith('Verified') &&
    !routes.some((r) => `${r.method} ${normalize(r.path.replace('/api/v1', ''))}` === key),
);
if (unmatched.length)
  throw new Error(`Verified routes missing controllers: ${JSON.stringify(unmatched)}`);
const counts = { Verified: 0, Partial: 0, Pending: 0 };
for (const status of ledger.values())
  for (const key of Object.keys(counts)) if (status.startsWith(key)) counts[key]++;
fs.writeFileSync(
  path.join(root, 'docs/backend/CONTROLLER_ROUTE_INVENTORY.json'),
  JSON.stringify(
    {
      snapshot: new Date().toISOString().slice(0, 10),
      scope: 'Static controller declarations, not runtime registration or production certification',
      routes,
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  JSON.stringify(
    { ledger: ledger.size, counts, controllers: routes.length, unmatchedVerified: unmatched },
    null,
    2,
  ) + '\n',
);
