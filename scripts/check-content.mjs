// Validates word packs and punishments (run in CI). Usage: node scripts/check-content.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const uiLocales = fs
  .readdirSync(path.join(root, 'locales'))
  .filter((d) => fs.existsSync(path.join(root, 'locales', d, 'meta.json')));
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const MIN_WORDS = 20;

const readDir = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => [path.join(dir, f), f])
    : [];

const packsDir = path.join(root, 'content', 'packs');
const files = [
  ...readDir(packsDir).map(([p, f]) => ({ p, f, adultDir: false })),
  ...readDir(path.join(packsDir, 'adult')).map(([p, f]) => ({ p, f, adultDir: true })),
];
const packIds = new Set();

for (const { p, f, adultDir } of files) {
  const where = path.relative(root, p);
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    err(where, `invalid JSON (${e.message})`);
    continue;
  }
  for (const key of ['id', 'region', 'game', 'emoji', 'name', 'display', 'words']) {
    if (pack[key] == null) err(where, `missing "${key}"`);
  }
  if (!pack.words) continue;
  if (`${pack.id}.json` !== f) err(where, `id "${pack.id}" does not match the file name`);
  if (packIds.has(pack.id)) err(where, `duplicate pack id "${pack.id}"`);
  packIds.add(pack.id);
  if (adultDir !== Boolean(pack.adult)) {
    err(
      where,
      adultDir ? 'packs in adult/ need "adult": true' : '"adult": true packs belong in adult/',
    );
  }
  for (const code of uiLocales) if (!pack.name?.[code]) err(where, `name missing "${code}"`);

  // Locales every word needs: the explicit display languages, or all UI locales for "ui".
  const d = pack.display ?? {};
  const needed = new Set();
  for (const slot of [d.primary, d.secondary, d.tertiary]) {
    if (!slot || slot === 'translit') continue;
    if (slot === 'ui') uiLocales.forEach((c) => needed.add(c));
    else needed.add(slot);
  }
  const needsTranslit = [d.primary, d.secondary, d.tertiary].includes('translit');

  if (pack.words.length < MIN_WORDS) err(where, `${pack.words.length} words (need ${MIN_WORDS}+)`);
  const ids = new Set();
  const texts = {};
  for (const w of pack.words) {
    if (!w.id) err(where, 'word without id');
    if (ids.has(w.id)) err(where, `duplicate word id "${w.id}"`);
    ids.add(w.id);
    for (const code of needed) {
      const text = w.text?.[code]?.trim();
      if (!text) {
        err(where, `word "${w.id}" missing "${code}" text`);
        continue;
      }
      const seen = (texts[code] ??= new Set());
      if (seen.has(text.toLowerCase())) err(where, `duplicate ${code} word "${text}"`);
      seen.add(text.toLowerCase());
    }
    if (needsTranslit && !w.translit?.trim()) err(where, `word "${w.id}" missing translit`);
  }
}

// Punishments: same levels and the same number of items in every locale (decks store indices).
const punDir = path.join(root, 'content', 'punishments');
const pun = Object.fromEntries(
  readDir(punDir).map(([p, f]) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(p, 'utf8'))]),
);
const LEVELS = ['light', 'medium', 'hard', 'public'];
for (const code of uiLocales) {
  const where = `content/punishments/${code}.json`;
  if (!pun[code]) {
    err(where, 'missing');
    continue;
  }
  for (const level of LEVELS) {
    const items = pun[code][level];
    if (!Array.isArray(items) || items.length === 0) err(where, `no "${level}" items`);
    else if (items.length !== pun.en?.[level]?.length) {
      err(where, `"${level}" has ${items.length} items, en has ${pun.en?.[level]?.length}`);
    } else if (items.some((s) => typeof s !== 'string' || !s.trim())) {
      err(where, `"${level}" has an empty item`);
    }
  }
}

if (errors.length) {
  console.error(`content check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `content check passed: ${files.length} packs, punishments for ${Object.keys(pun).join(', ')}`,
);
