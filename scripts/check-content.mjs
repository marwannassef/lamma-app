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
const MIN_PAIRS = 8;

const readDir = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => [path.join(dir, f), f])
    : [];

const packsDir = path.join(root, 'content', 'packs');
const files = readDir(packsDir).map(([p, f]) => ({ p, f }));
const CONTENT_LEVELS = ['kids', 'teen'];
const TIERS = ['free', 'premium'];
if (fs.existsSync(path.join(packsDir, 'adult')))
  err('content/packs/adult', 'adult content never ships in Lamma');
const packIds = new Set();

for (const { p, f } of files) {
  const where = path.relative(root, p);
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    err(where, `invalid JSON (${e.message})`);
    continue;
  }
  for (const key of [
    'id',
    'region',
    'game',
    'emoji',
    'name',
    'level',
    'tier',
    'display',
    'words',
  ]) {
    if (pack[key] == null) err(where, `missing "${key}"`);
  }
  if (!pack.words) continue;
  if (`${pack.id}.json` !== f) err(where, `id "${pack.id}" does not match the file name`);
  if (packIds.has(pack.id)) err(where, `duplicate pack id "${pack.id}"`);
  packIds.add(pack.id);
  // Every pack has a level and a tier; no pack or word is ever adult (BRIEF §5–6).
  if (pack.level != null && !CONTENT_LEVELS.includes(pack.level))
    err(where, `level "${pack.level}" is not kids or teen`);
  if (pack.tier != null && !TIERS.includes(pack.tier))
    err(where, `tier "${pack.tier}" is not free or premium`);
  if ('adult' in pack) err(where, 'the "adult" flag was removed; use level');
  for (const w of pack.words) {
    if (w.level != null && !CONTENT_LEVELS.includes(w.level))
      err(where, `word "${w.id}" level "${w.level}" is not kids or teen`);
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
  if (pack.pairs) {
    if (pack.pairs.length < MIN_PAIRS)
      err(where, `${pack.pairs.length} pairs (need ${MIN_PAIRS}+)`);
    for (const [a, b] of pack.pairs) {
      if (!ids.has(a) || !ids.has(b)) err(where, `pair ${a}/${b} uses an unknown word id`);
      if (a === b) err(where, `pair ${a}/${b} repeats the same word`);
    }
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

// Punishment levels: Teen indices must exist in every level's deck.
const levelsPath = path.join(root, 'content', 'punishment-levels.json');
if (!fs.existsSync(levelsPath)) err('content/punishment-levels.json', 'missing');
else {
  const lv = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
  for (const [level, ids] of Object.entries(lv.teen ?? {})) {
    for (const i of ids) {
      if (!Number.isInteger(i) || i < 0 || i >= (pun.en?.[level]?.length ?? 0)) {
        err('content/punishment-levels.json', `teen ${level}[${i}] is not a punishment`);
      }
    }
  }
}

// No religious references in narration, role texts and punishments (werewolf spec §17).
{
  const banned = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'banned-terms.json'), 'utf8'),
  );
  const LETTER = '\\p{L}\\p{M}';
  const re = (lang) =>
    new RegExp(
      `(?<![${LETTER}])(${banned[lang].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![${LETTER}])`,
      'iu',
    );
  const strings = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
    return out;
  };
  const scan = (file, lang) => {
    if (!banned[lang] || !fs.existsSync(file)) return;
    const r = re(lang);
    for (const s of strings(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      const m = s.match(r);
      if (m) err(path.relative(root, file), `banned term "${m[1]}" in "${s}"`);
    }
  };
  for (const lang of uiLocales) {
    for (const f of fs.readdirSync(path.join(root, 'locales', lang)))
      if (f.endsWith('.json') && f !== 'meta.json' && f !== 'native.json')
        scan(path.join(root, 'locales', lang, f), lang);
    scan(path.join(root, 'content', 'punishments', `${lang}.json`), lang);
  }
}

if (errors.length) {
  console.error(`content check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `content check passed: ${files.length} packs, no banned terms, punishments for ${Object.keys(pun).join(', ')}`,
);
