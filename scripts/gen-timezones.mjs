// Builds src/core/theme/timezones.json: IANA time zone → [lat, lon] of its main city, from the
// tz database's zone.tab. Lets the app estimate sunrise/sunset without location permission.
// Usage: node scripts/gen-timezones.mjs [path/to/zone.tab]
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] ?? '/usr/share/zoneinfo/zone.tab';
const out = path.join(import.meta.dirname, '..', 'src', 'core', 'theme', 'timezones.json');

// ISO 6709: ±DDMM[SS]±DDDMM[SS]
function parse(coord) {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(coord);
  if (!m) throw new Error(`bad coordinate ${coord}`);
  const dms = (sign, d, mi, s = '0') => (sign === '-' ? -1 : 1) * (+d + +mi / 60 + +s / 3600);
  const round = (n) => Math.round(n * 100) / 100;
  return [round(dms(m[1], m[2], m[3], m[4])), round(dms(m[5], m[6], m[7], m[8]))];
}

const zones = {};
for (const line of fs.readFileSync(src, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [, coord, zone] = line.split('\t');
  zones[zone] = parse(coord);
}
const sorted = Object.fromEntries(Object.entries(zones).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(out, JSON.stringify(sorted) + '\n');
console.log(`wrote ${Object.keys(sorted).length} zones to ${path.relative(process.cwd(), out)}`);
