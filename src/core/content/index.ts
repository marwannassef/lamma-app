import { getLocales } from 'expo-localization';

import { packFiles } from './packFiles';
import type { ContentLevel, LocaleCode, Pack, PackTier, Region, Word } from './types';

export type { ContentLevel, LocaleCode, Pack, PackTier, Region, Word };
export { chooseCategory, chooseWord, RANDOM, type CategoryChoice } from './picking';

type Context = { keys(): string[]; (key: string): unknown };
const fromContext = (ctx: Context) => ctx.keys().map((k) => ctx(k) as Pack);

function loadPacks(): Pack[] {
  return fromContext(packFiles).sort((a, b) => a.id.localeCompare(b.id));
}

/** Every pack bundled in this build. */
export const allPacks: readonly Pack[] = loadPacks();

/** Regions that have at least one pack, "global" first. */
export const allRegions: readonly Region[] = [...new Set(allPacks.map((p) => p.region))].sort(
  (a, b) => (a === 'global' ? -1 : b === 'global' ? 1 : a.localeCompare(b)),
);

/** Device in a region with its own packs → Global + that region; otherwise Global only. */
export function defaultRegions(deviceRegion = getLocales()[0]?.regionCode): Region[] {
  const local = deviceRegion?.toLowerCase();
  return local && local !== 'global' && allRegions.includes(local) ? ['global', local] : ['global'];
}

/** Kids allows only Kids content; Teen allows both. */
export const levelAllows = (allowed: ContentLevel, level: ContentLevel) =>
  allowed === 'teen' || level === 'kids';

/** The word's own level, or its pack's. */
export const wordLevel = (pack: Pack, word: Word): ContentLevel => word.level ?? pack.level;

export interface PackFilter {
  game: string;
  regions: readonly Region[];
  /** Highest content level allowed (the effective level, monetization §7). */
  level: ContentLevel;
}

/**
 * Packs for a game in the enabled regions at the allowed level. Words above the level are
 * removed too, so a Kids table never sees a Teen word even inside a Kids pack.
 */
export function filterPacks(packs: readonly Pack[], f: PackFilter): Pack[] {
  return packs
    .filter(
      (p) => p.game === f.game && f.regions.includes(p.region) && levelAllows(f.level, p.level),
    )
    .map((p) =>
      p.words.every((w) => levelAllows(f.level, wordLevel(p, w)))
        ? p
        : {
            ...p,
            words: p.words.filter((w) => levelAllows(f.level, wordLevel(p, w))),
            pairs: p.pairs?.filter(([a, b]) =>
              [a, b].every((id) => {
                const w = p.words.find((x) => x.id === id);
                return !!w && levelAllows(f.level, wordLevel(p, w));
              }),
            ),
          },
    );
}

/** Text in the requested language, falling back to English, then to any language present. */
export function localized(text: Record<LocaleCode, string>, lang: LocaleCode): string {
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? '';
}

/**
 * The lines shown on a word card, biggest first. A line in the same language as an earlier
 * line is skipped, so a Global pack shows "UI language, then the other one".
 */
export function wordLines(pack: Pack, word: Word, uiLang: LocaleCode): string[] {
  const slots = [pack.display.primary, pack.display.secondary, pack.display.tertiary];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const slot of slots) {
    if (!slot) continue;
    const lang = slot === 'ui' ? uiLang : slot;
    if (seen.has(lang)) continue;
    seen.add(lang);
    const text = lang === 'translit' ? word.translit : word.text[lang];
    if (text) lines.push(text);
  }
  if (lines.length === 0) lines.push(localized(word.text, uiLang));
  return lines;
}
