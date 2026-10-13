/* global console */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dictionaryPath = resolve('apps/web/src/lib/i18n/dictionary.ts');
const source = await readFile(dictionaryPath, 'utf8');
const entries = [...source.matchAll(/^\s*['"]([^'"]+)['"]\s*:\s*\{([\s\S]*?)\n\s*\},/gm)];

if (entries.length === 0) {
  throw new Error(`No translation entries found in ${dictionaryPath}`);
}

const missing = [];
for (const [, key, body] of entries) {
  for (const language of ['en', 'fr']) {
    if (!new RegExp(`\\b${language}\\s*:`).test(body)) {
      missing.push(`${key}:${language}`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(`Missing translation values: ${missing.join(', ')}`);
}

console.log(`Localization parity passed: ${entries.length} entries contain en and fr values.`);
