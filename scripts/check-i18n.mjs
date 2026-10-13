// Fails if any shipped locale is missing a key (or a plural form) that English has.
// Usage: node scripts/check-i18n.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', 'locales');
const BASE = 'en';
const SKIP = new Set(['meta.json', 'native.json']);
const PLURAL = /_(zero|one|two|few|many|other)$/;

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );

const load = (code, file) => {
  const p = path.join(root, code, file);
  return fs.existsSync(p)
    ? Object.fromEntries(flatten(JSON.parse(fs.readFileSync(p, 'utf8'))))
    : null;
};

const locales = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
const files = fs.readdirSync(path.join(root, BASE)).filter((f) => f.endsWith('.json'));
const errors = [];

for (const code of locales) {
  if (!fs.existsSync(path.join(root, code, 'meta.json'))) errors.push(`${code}: missing meta.json`);
  const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;

  for (const file of files.filter((f) => !SKIP.has(f))) {
    const base = load(BASE, file);
    const strings = load(code, file);
    if (!strings) {
      errors.push(`${code}/${file}: file missing`);
      continue;
    }
    // Expected keys: English keys, with each plural group expanded to this locale's categories.
    const expected = new Set();
    for (const key of Object.keys(base)) {
      if (PLURAL.test(key)) categories.forEach((c) => expected.add(key.replace(PLURAL, `_${c}`)));
      else expected.add(key);
    }
    for (const key of expected) {
      if (typeof strings[key] !== 'string' || !strings[key].trim()) {
        errors.push(`${code}/${file}: missing "${key}"`);
      }
    }
    for (const key of Object.keys(strings)) {
      const stem = key.replace(PLURAL, '');
      const known =
        expected.has(key) ||
        (PLURAL.test(key) && [...expected].some((k) => k.startsWith(stem + '_')));
      if (!known) errors.push(`${code}/${file}: unused key "${key}"`);
    }
  }
}

if (errors.length) {
  console.error(`i18n check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n check passed: ${locales.join(', ')} × ${files.length - SKIP.size} namespaces`);
